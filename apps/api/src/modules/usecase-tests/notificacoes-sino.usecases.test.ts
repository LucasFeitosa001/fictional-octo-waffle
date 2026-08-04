/**
 * O sino do PAINEL mostra o recado do SALÃO, não o da cliente.
 *
 * O bug: um agendamento online criava DUAS linhas em `Notification` com o mesmo
 * `companyId` — a do salão (`userId` nulo) e a da cliente logada no portal
 * (`userId` preenchido). Todas as consultas do painel filtravam só por
 * `companyId`, então a segunda vazava para o sino e o dono lia
 *
 *   "Olá, Lucas Feitosa! Seu Manicure com Bruna Lima está confirmado para
 *    terça-feira, 04/08, 16:15 (até 16:30) no DesignModa. Até lá! 💕"
 *
 * em vez do resumo curto que as outras notificações usam. Só acontecia no
 * agendamento ONLINE porque só ali a cliente tem conta. Ver estudo 123.
 *
 * São CINCO consultas, não uma — lista, contagem do sino, resumo por categoria,
 * marcar uma e marcar todas. Uma delas sem o filtro já traz o vazamento de
 * volta (ou faz o painel apagar um aviso do feed da cliente), por isso cada uma
 * tem seu teste.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationsService } from '../notifications/notifications.service';
import { composeAppointmentMessages } from '../notifications/notifications.templates';

/** Uma linha de `Notification` como o banco devolve. */
function linha(over: Record<string, unknown> = {}) {
  return {
    id: 'n-1',
    companyId: 'company-1',
    userId: null as string | null,
    type: 'appointment.confirmed',
    title: 'Agendamento confirmado: Lucas Feitosa',
    body: 'Manicure com Bruna Lima em terça-feira, 04/08, 16:15 (até 16:30).',
    entityId: 'appt-1',
    readAt: null as Date | null,
    createdAt: new Date('2026-08-04T19:00:00Z'),
    ...over,
  };
}

const DO_SALAO = linha();
const DA_CLIENTE = linha({
  id: 'n-2',
  userId: 'user-cliente',
  title: 'Agendamento confirmado',
  body: 'Olá, Lucas Feitosa! Seu Manicure com Bruna Lima está confirmado para terça-feira, 04/08, 16:15 (até 16:30) no DesignModa. Até lá! 💕',
});

/**
 * Prisma de mentira que aplica o `where` DE VERDADE sobre as duas linhas. Um
 * mock que devolvesse lista fixa passaria mesmo com o filtro removido — é
 * justamente o `where` que está sob teste.
 */
function servicoCom(linhas = [DO_SALAO, DA_CLIENTE]) {
  const filtrar = (where: Record<string, any>) =>
    linhas.filter((n: any) => {
      if (where.companyId !== undefined && n.companyId !== where.companyId) return false;
      if (where.userId !== undefined && n.userId !== where.userId) return false;
      if (where.id !== undefined && n.id !== where.id) return false;
      if (where.readAt === null && n.readAt !== null) return false;
      if (where.type?.in && !where.type.in.includes(n.type)) return false;
      return true;
    });
  const marcadas: string[] = [];
  const client = {
    notification: {
      findMany: async (a: { where: Record<string, any> }) => filtrar(a.where),
      count: async (a: { where: Record<string, any> }) => filtrar(a.where).length,
      groupBy: async (a: { where: Record<string, any> }) => {
        const porTipo = new Map<string, number>();
        for (const n of filtrar(a.where)) {
          porTipo.set(n.type, (porTipo.get(n.type) ?? 0) + 1);
        }
        return [...porTipo].map(([type, total]) => ({ type, _count: { _all: total } }));
      },
      updateMany: async (a: { where: Record<string, any> }) => {
        const alvo = filtrar(a.where);
        marcadas.push(...alvo.map((n: any) => n.id));
        return { count: alvo.length };
      },
    },
  };
  const service = new NotificationsService(
    { client } as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, marcadas };
}

describe('Sino do painel — separação salão x cliente (estudo 123)', () => {
  it('1) a lista do painel devolve só a notificação do salão', async () => {
    const { service } = servicoCom();
    const { data } = await service.listForCompany('company-1');

    assert.equal(data.length, 1);
    assert.equal(data[0].id, DO_SALAO.id);
    assert.equal(data[0].userId, null);
    assert.ok(
      !data[0].body?.includes('Olá,'),
      'o recado pessoal da cliente não pode aparecer no sino do salão',
    );
  });

  it('2) o total e o não-lidas da lista ignoram a linha da cliente', async () => {
    const { service } = servicoCom();
    const { total, unreadCount } = await service.listForCompany('company-1');

    assert.equal(total, 1);
    assert.equal(unreadCount, 1);
  });

  it('3) a bolinha do sino não conta a notificação da cliente', async () => {
    const { service } = servicoCom();

    assert.deepEqual(await service.unreadCount('company-1'), { unreadCount: 1 });
  });

  it('4) o resumo por categoria não infla com a linha da cliente', async () => {
    const { service } = servicoCom();
    const { types } = await service.summaryByType('company-1');

    assert.deepEqual(types, [
      { type: 'appointment.confirmed', total: 1, unread: 1 },
    ]);
  });

  it('5) o painel não consegue marcar como lida uma notificação da cliente', async () => {
    const { service, marcadas } = servicoCom();
    await service.markRead('company-1', DA_CLIENTE.id);

    assert.deepEqual(marcadas, [], 'nada da cliente pode ser marcado pelo painel');
  });

  it('6) "marcar todas como lidas" não encosta no feed da cliente', async () => {
    const { service, marcadas } = servicoCom();
    await service.markAllRead('company-1');

    assert.deepEqual(marcadas, [DO_SALAO.id]);
  });

  it('7) o texto do salão é curto, no formato das outras notificações', () => {
    const inicio = new Date('2026-08-04T19:15:00Z');
    const messages = composeAppointmentMessages('confirmed', {
      companyName: 'DesignModa',
      timezone: 'America/Sao_Paulo',
      customerName: 'Lucas Feitosa',
      customerPhone: null,
      customerEmail: null,
      professionalName: 'Bruna Lima',
      serviceNames: ['Manicure'],
      start: inicio,
      end: new Date(inicio.getTime() + 15 * 60 * 1000),
    });

    // O do salão: quem + o quê, sem saudação e sem emoji.
    assert.equal(messages.studio.title, 'Agendamento confirmado: Lucas Feitosa');
    assert.ok(messages.studio.body.startsWith('Manicure com Bruna Lima em '));
    assert.ok(!messages.studio.body.includes('Olá,'));
    assert.ok(!messages.studio.body.includes('💕'));

    // O da cliente segue sendo o recado com saudação — no lugar dela.
    assert.ok(messages.client.body.startsWith('Olá, Lucas Feitosa!'));
  });
});
