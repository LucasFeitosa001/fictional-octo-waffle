/**
 * Certificação do PAGAMENTO de comissões — pedido do dono depois do defeito do
 * líquido: *"faça uns 10 testes unitários, pra poder certificar"*.
 *
 * Cada teste trava uma regra que já custou dinheiro ou confiança uma vez:
 * pagar o que não está em aberto, pagar fora do período da tela, recibo
 * fantasma de R$ 0,00, vale sumindo, vale desmarcado sendo descontado.
 * Ver estudo 51.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@beautypass/db';
import { CommissionsService } from '../commissions/commissions.service';

const salonpayDuble = { registrarTransferencia: async () => null } as any;

function servico(tx: any) {
  return new CommissionsService(
    { client: { $transaction: async (fn: any) => fn(tx) } } as any,
    salonpayDuble,
  );
}

/**
 * Duble de transação. Guarda o `where` de cada consulta: sem espiar o recorte
 * não dá para provar "paga só o que está em aberto" — o total devolvido seria
 * o mesmo com o filtro errado.
 */
function txDuble(input: {
  entries?: any[];
  advances?: any[];
  espiao?: { entryWhere?: any; advanceWhere?: any; entryUpdate?: any };
  criados?: any[];
}) {
  const espiao = input.espiao ?? {};
  return {
    commissionEntry: {
      findMany: async ({ where }: any) => {
        espiao.entryWhere = where;
        return input.entries ?? [];
      },
      updateMany: async (args: any) => {
        espiao.entryUpdate = args;
        return { count: input.entries?.length ?? 0 };
      },
    },
    commissionAdvance: {
      findMany: async ({ where }: any) => {
        espiao.advanceWhere = where;
        return input.advances ?? [];
      },
      updateMany: async () => ({ count: 0 }),
      findUnique: async () => ({
        professionalId: 'pro-1',
        date: new Date('2026-07-01T00:00:00.000Z'),
        note: null,
      }),
      update: async ({ data }: any) => ({ id: 'advance-1', ...data }),
      create: async ({ data }: any) => {
        input.criados?.push(data);
        return { id: 'advance-saldo', ...data };
      },
    },
    commissionPayment: {
      create: async ({ data }: any) => ({ id: 'payment-1', ...data }),
      update: async ({ data }: any) => ({ id: 'payment-1', ...data }),
    },
    professional: { findFirst: async () => ({ name: 'Pro Um' }) },
    financialCategory: { findFirst: async () => null },
    transaction: { create: async ({ data }: any) => ({ id: 'tx-1', ...data }) },
    paymentMethod: { findFirst: async () => null },
    cashRegister: { findFirst: async () => null },
    cashMovement: { create: async ({ data }: any) => ({ id: 'cm-1', ...data }) },
  };
}

const entrada = (comissao: number, bonus = 0, id = 'entry-1') => ({
  id,
  commissionAmount: new Prisma.Decimal(comissao),
  bonusAmount: new Prisma.Decimal(bonus),
});

describe('Pagamento de comissões — certificação', () => {
  it('1. só considera lançamentos EM ABERTO, da empresa e do profissional', async () => {
    const espiao: any = {};
    const service = servico(txDuble({ entries: [entrada(100)], espiao }));

    await service.createPayment('company-a', { professionalId: 'pro-1' } as any);

    assert.equal(espiao.entryWhere.status, 'open');
    assert.equal(espiao.entryWhere.companyId, 'company-a');
    assert.equal(espiao.entryWhere.professionalId, 'pro-1');
  });

  it('2. recorta pelo PERÍODO da tela quando from/to vêm no pagamento', async () => {
    const espiao: any = {};
    const service = servico(txDuble({ entries: [entrada(100)], espiao }));

    await service.createPayment('company-a', {
      professionalId: 'pro-1',
      from: '2026-07-01',
      to: '2026-07-31',
    } as any);

    assert.ok(espiao.entryWhere.competenceDate, 'deveria filtrar por competência');
    assert.equal(
      espiao.entryWhere.competenceDate.gte.toISOString().slice(0, 10),
      '2026-07-01',
    );
    // Fim inclusivo: o corte fica DEPOIS do dia 31, senão o último dia some.
    assert.ok(
      espiao.entryWhere.competenceDate.lt > new Date('2026-07-31T00:00:00.000Z'),
    );
  });

  it('3. sem período informado, não inventa filtro de competência', async () => {
    const espiao: any = {};
    const service = servico(txDuble({ entries: [entrada(50)], espiao }));

    await service.createPayment('company-a', { professionalId: 'pro-1' } as any);

    assert.equal(espiao.entryWhere.competenceDate, undefined);
  });

  it('4. recusa pagamento sem nada em aberto (nada de recibo de R$ 0,00)', async () => {
    const service = servico(txDuble({ entries: [] }));

    await assert.rejects(
      () => service.createPayment('company-a', { professionalId: 'pro-1' } as any),
      /Não há comissão em aberto/,
    );
  });

  it('5. valor pago = comissões + bonificações − vales', async () => {
    const service = servico(
      txDuble({
        entries: [entrada(100, 10)],
        advances: [{ id: 'advance-1', amount: new Prisma.Decimal(30) }],
      }),
    );

    const p = await service.createPayment('company-a', { professionalId: 'pro-1' } as any);

    assert.equal(Number(p.commissionTotal), 100);
    assert.equal(Number(p.bonusTotal), 10);
    assert.equal(Number(p.advancesTotal), 30);
    assert.equal(Number(p.amount), 80);
  });

  it('6. soma várias entradas num recibo só', async () => {
    const service = servico(
      txDuble({
        entries: [entrada(60, 0, 'e1'), entrada(60, 5, 'e2'), entrada(10, 0, 'e3')],
      }),
    );

    const p = await service.createPayment('company-a', { professionalId: 'pro-1' } as any);

    assert.equal(Number(p.commissionTotal), 130);
    assert.equal(Number(p.bonusTotal), 5);
    assert.equal(Number(p.amount), 135);
  });

  it('7. vale MAIOR que a comissão é partido: consome o que cabe, resto volta em aberto', async () => {
    const criados: any[] = [];
    const service = servico(
      txDuble({
        entries: [entrada(100)],
        advances: [{ id: 'advance-1', amount: new Prisma.Decimal(500) }],
        criados,
      }),
    );

    const p = await service.createPayment('company-a', { professionalId: 'pro-1' } as any);

    assert.equal(Number(p.advancesTotal), 100, 'consome só até o disponível');
    assert.equal(Number(p.amount), 0, 'valor a pagar nunca fica negativo');
    assert.equal(criados.length, 1, 'o residual vira uma linha nova');
    assert.equal(Number(criados[0].amount), 400);
    assert.equal(criados[0].status, 'open');
  });

  it('8. advanceIds vazio = desmarcou todos → nenhum vale é descontado', async () => {
    const espiao: any = {};
    const service = servico(txDuble({ entries: [entrada(100)], advances: [], espiao }));

    const p = await service.createPayment('company-a', {
      professionalId: 'pro-1',
      advanceIds: [],
    } as any);

    assert.deepEqual(espiao.advanceWhere.id, { in: [] });
    assert.equal(Number(p.advancesTotal), 0);
    assert.equal(Number(p.amount), 100);
  });

  it('9. advanceIds ausente = desconta todos os vales em aberto', async () => {
    const espiao: any = {};
    const service = servico(
      txDuble({
        entries: [entrada(100)],
        advances: [
          { id: 'a1', amount: new Prisma.Decimal(20) },
          { id: 'a2', amount: new Prisma.Decimal(15) },
        ],
        espiao,
      }),
    );

    const p = await service.createPayment('company-a', { professionalId: 'pro-1' } as any);

    assert.equal(espiao.advanceWhere.id, undefined, 'sem restrição de id');
    assert.equal(espiao.advanceWhere.status, 'open');
    assert.equal(Number(p.advancesTotal), 35);
    assert.equal(Number(p.amount), 65);
  });

  it('10. entryIds restringe o pagamento aos lançamentos escolhidos', async () => {
    const espiao: any = {};
    const service = servico(txDuble({ entries: [entrada(60)], espiao }));

    await service.createPayment('company-a', {
      professionalId: 'pro-1',
      entryIds: ['e1', 'e2'],
    } as any);

    assert.deepEqual(espiao.entryWhere.id, { in: ['e1', 'e2'] });
  });

  it('11. data de pagamento inválida é recusada', async () => {
    const service = servico(txDuble({ entries: [entrada(100)] }));

    await assert.rejects(
      () =>
        service.createPayment('company-a', {
          professionalId: 'pro-1',
          paidAt: 'ontem à tarde',
        } as any),
      /Data de pagamento inválida/,
    );
  });

  it('12. lote paga cada profissional com o próprio recorte', async () => {
    const vistos: string[] = [];
    const tx = txDuble({ entries: [entrada(40)] });
    const findManyOriginal = tx.commissionEntry.findMany;
    tx.commissionEntry.findMany = async (args: any) => {
      vistos.push(args.where.professionalId);
      return findManyOriginal(args);
    };
    const service = servico(tx);

    const res = await service.payBulk('company-a', {
      items: [{ professionalId: 'pro-1' }, { professionalId: 'pro-2' }],
    } as any);

    assert.equal(res.count, 2);
    assert.deepEqual(vistos, ['pro-1', 'pro-2']);
    assert.equal(Number(res.payments[0].amount), 40);
    assert.equal(Number(res.payments[1].amount), 40);
  });

  it('13. marca as entradas como pagas e as amarra ao recibo', async () => {
    const espiao: any = {};
    const service = servico(txDuble({ entries: [entrada(100, 0, 'e1')], espiao }));

    await service.createPayment('company-a', { professionalId: 'pro-1' } as any);

    assert.equal(espiao.entryUpdate.data.status, 'paid');
    assert.equal(espiao.entryUpdate.data.paymentId, 'payment-1');
    assert.deepEqual(espiao.entryUpdate.where.id, { in: ['e1'] });
  });
});
