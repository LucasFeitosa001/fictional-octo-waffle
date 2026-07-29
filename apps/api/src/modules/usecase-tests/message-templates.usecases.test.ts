/**
 * Certificação da PERSONALIZAÇÃO das mensagens de WhatsApp (estudo 61).
 *
 * O que estes testes travam, porque cada item já foi um bug ou um risco real:
 *  - o aviso AUTOMÁTICO tem de usar o modelo da empresa (era uma linha fixa no
 *    código, e o dono editava sem efeito nenhum);
 *  - se o modelo faltar, quebrar ou estourar o limite, a mensagem NÃO pode
 *    desaparecer — cai no texto fixo;
 *  - `{motivo}` só existe no cancelamento, e vazio apaga a linha inteira (em vez
 *    de mandar "Motivo:" solto para a cliente);
 *  - personalizar NÃO autoriza envio: sem o padrão da conta e sem o toggle do
 *    agendamento, nada é enfileirado (regra permanente do projeto);
 *  - cada tipo grava na SUA chave de Setting, sem vazar entre tipos.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import { NotificationSettingsController } from '../notifications/notifications.controller';
import {
  MESSAGE_TEMPLATE_SPECS,
  renderMessageTemplate,
} from '../notifications/message-templates';
import { BUILTIN_CANCELLATION_TEMPLATES } from '../notifications/cancellation.templates';
import { composeReminderMessage } from '../queues/reminder.templates';

const START = new Date('2026-07-30T19:00:00.000Z'); // 16h em São Paulo

function appointmentRow(over: Record<string, unknown> = {}) {
  return {
    id: 'appt-1',
    companyId: 'company-1',
    customerId: 'cus-1',
    start: START,
    end: new Date('2026-07-30T20:00:00.000Z'),
    status: 'scheduled',
    source: 'panel',
    notifyConfirmation: null,
    notifyCancellation: null,
    company: { name: 'La Belle de Jour', timezone: 'America/Sao_Paulo' },
    customer: {
      id: 'cus-1',
      name: 'Tais Silva',
      phone: '5511999990000',
      email: null,
      userId: null,
      notificationsEnabled: null,
      whatsappOptIn: null,
    },
    professional: { name: 'Vitória' },
    items: [{ service: { name: 'cabelo' } }],
    ...over,
  };
}

/**
 * NotificationsService com prisma/whatsapp/email/settings de mentira. `modelo`
 * é o que `activeTemplateMessage` responde; `automacao` é o padrão da conta.
 */
function notificationsService(options: {
  appt?: Record<string, unknown>;
  modelo?: string | null;
  modeloThrows?: boolean;
  automacao?: Partial<Record<string, boolean>>;
} = {}) {
  process.env.NOTIFICATIONS_MODE = 'live';
  const enfileirados: { to: string; text: string; meta: unknown }[] = [];
  const sinos: unknown[] = [];
  const consultasDeModelo: string[] = [];
  const client = {
    appointment: { findFirst: async () => options.appt ?? appointmentRow() },
    notification: {
      create: async (args: { data: unknown }) => {
        sinos.push(args.data);
        return args.data;
      },
    },
    user: { findMany: async () => [] },
  };
  const whatsapp = {
    enqueueText: async (to: string, text: string, meta: unknown) => {
      enfileirados.push({ to, text, meta });
      return { id: 'outbox-1', status: 'pending', deduplicated: false };
    },
  };
  const email = { send: async () => undefined };
  const settings = {
    get: async () => ({
      confirmation: false,
      cancellation: false,
      reminder: false,
      followUp: false,
      notifyProfessional: false,
      ...options.automacao,
    }),
    activeTemplateMessage: async (_companyId: string, kind: string) => {
      consultasDeModelo.push(kind);
      if (options.modeloThrows) throw new Error('setting corrompido');
      return options.modelo ?? null;
    },
  };
  const service = new NotificationsService(
    { client } as any,
    whatsapp as any,
    email as any,
    settings as any,
  );
  return { service, enfileirados, sinos, consultasDeModelo };
}

/** NotificationSettingsService com a tabela Setting em memória. */
function settingsService(inicial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(inicial));
  const escritas: { key: string; valueJson: unknown }[] = [];
  const client = {
    setting: {
      findUnique: async (args: { where: { companyId_key: { key: string } } }) => {
        const key = args.where.companyId_key.key;
        return store.has(key) ? { valueJson: store.get(key) } : null;
      },
      upsert: async (args: {
        where: { companyId_key: { key: string } };
        create: { valueJson: unknown };
      }) => {
        const key = args.where.companyId_key.key;
        store.set(key, args.create.valueJson);
        escritas.push({ key, valueJson: args.create.valueJson });
        return { valueJson: args.create.valueJson };
      },
    },
  };
  return {
    settings: new NotificationSettingsService({ client } as any),
    store,
    escritas,
  };
}

describe('Personalização das mensagens de WhatsApp (estudo 61)', () => {
  // ------------------------------------------------- texto automático

  it('1) confirmação automática usa o modelo da empresa, não a linha fixa', async () => {
    const { service, enfileirados, consultasDeModelo } = notificationsService({
      modelo:
        'Oi {cliente}! {servico} com {profissional} {quando} às {hora}. — {estabelecimento}',
      automacao: { confirmation: true },
    });

    await service.notifyAppointment('created', 'company-1', 'appt-1');

    assert.equal(enfileirados.length, 1);
    assert.deepEqual(consultasDeModelo, ['confirmation']);
    assert.equal(
      enfileirados[0].text,
      'Oi Tais! cabelo com Vitória amanhã às 16 horas. — La Belle de Jour',
    );
    assert.equal(
      enfileirados[0].meta && (enfileirados[0].meta as any).kind,
      'confirmation',
    );
  });

  it('2) sem modelo utilizável, mantém o texto fixo (nunca fica sem mensagem)', async () => {
    const { service, enfileirados } = notificationsService({
      modelo: null,
      automacao: { confirmation: true },
    });

    await service.notifyAppointment('created', 'company-1', 'appt-1');

    assert.equal(enfileirados.length, 1);
    assert.match(
      enfileirados[0].text,
      /^Olá, Tais Silva! Seu cabelo com Vitória está agendado/,
    );
  });

  it('3) erro ao ler o modelo não derruba o aviso — cai no texto fixo', async () => {
    const { service, enfileirados } = notificationsService({
      modeloThrows: true,
      automacao: { confirmation: true },
    });

    await service.notifyAppointment('created', 'company-1', 'appt-1');

    assert.equal(enfileirados.length, 1);
    assert.match(enfileirados[0].text, /está agendado para/);
  });

  it('4) modelo que renderiza acima de 2000 caracteres é descartado', async () => {
    const { service, enfileirados } = notificationsService({
      modelo: `${'x'.repeat(2_001)} {cliente}`,
      automacao: { confirmation: true },
    });

    await service.notifyAppointment('created', 'company-1', 'appt-1');

    assert.equal(enfileirados.length, 1);
    assert.match(enfileirados[0].text, /está agendado para/);
  });

  it('5) cancelamento usa o modelo de cancelamento e escreve o motivo', async () => {
    const { service, enfileirados, consultasDeModelo } = notificationsService({
      modelo: BUILTIN_CANCELLATION_TEMPLATES[0].message,
      automacao: { cancellation: true },
    });

    await service.notifyAppointment('canceled', 'company-1', 'appt-1', {
      reason: 'profissional de folga',
    });

    assert.deepEqual(consultasDeModelo, ['cancellation']);
    assert.match(enfileirados[0].text, /^Olá, Tais!/);
    assert.match(enfileirados[0].text, /Motivo: profissional de folga/);
  });

  it('6) cancelamento sem motivo apaga a linha "Motivo:" inteira', async () => {
    const { service, enfileirados } = notificationsService({
      modelo: BUILTIN_CANCELLATION_TEMPLATES[0].message,
      automacao: { cancellation: true },
    });

    await service.notifyAppointment('canceled', 'company-1', 'appt-1');

    assert.doesNotMatch(enfileirados[0].text, /Motivo/);
    assert.match(enfileirados[0].text, /foi cancelado\./);
  });

  it('7) personalizar NÃO autoriza envio: sem padrão da conta e sem toggle, nada sai', async () => {
    const { service, enfileirados, consultasDeModelo, sinos } =
      notificationsService({ modelo: 'Oi {cliente}!' });

    await service.notifyAppointment('created', 'company-1', 'appt-1');

    assert.equal(enfileirados.length, 0, 'nenhuma mensagem pode ser enfileirada');
    assert.deepEqual(consultasDeModelo, [], 'nem o modelo é consultado');
    assert.equal(sinos.length, 1, 'o aviso interno do salão continua');
  });

  it('8) toggle do agendamento sozinho já autoriza, e o modelo é usado', async () => {
    const { service, enfileirados } = notificationsService({
      appt: appointmentRow({ notifyConfirmation: true }),
      modelo: 'Oi {cliente}, é {quando}!',
    });

    await service.notifyAppointment('created', 'company-1', 'appt-1');

    assert.equal(enfileirados.length, 1);
    assert.equal(enfileirados[0].text, 'Oi Tais, é amanhã!');
  });

  it('9) toggle desligado no agendamento vence o padrão ligado da conta', async () => {
    const { service, enfileirados } = notificationsService({
      appt: appointmentRow({ notifyConfirmation: false }),
      modelo: 'Oi {cliente}!',
      automacao: { confirmation: true },
    });

    await service.notifyAppointment('created', 'company-1', 'appt-1');

    assert.equal(enfileirados.length, 0);
  });

  // ------------------------------------------------- renderizador

  it('10) variável vazia apaga a linha em que aparece', () => {
    const texto = renderMessageTemplate(
      'cancellation',
      ['Olá, {cliente}!', 'Motivo: {motivo}', 'Com {profissional}.'].join('\n'),
      { cliente: 'Tais', motivo: '   ', profissional: 'nossa equipe' },
    );

    assert.equal(texto, 'Olá, Tais!\nCom nossa equipe.');
  });

  it('11) {motivo} não é variável da confirmação — por isso o PUT recusa', () => {
    assert.ok(
      !MESSAGE_TEMPLATE_SPECS.confirmation.variables.includes('motivo'),
    );
    assert.ok(MESSAGE_TEMPLATE_SPECS.cancellation.variables.includes('motivo'));
  });

  // ------------------------------------------------- Setting por tipo

  it('12) cada tipo lê e grava na sua própria chave', async () => {
    const { settings, escritas } = settingsService();

    await settings.updateTemplates('company-1', 'cancellation', {
      defaultTemplateId: 'custom-a',
      templates: [{ id: 'custom-a', label: 'Meu', message: 'Oi {cliente}' }],
    });
    await settings.updateTemplates('company-1', 'reminder2h', {
      defaultTemplateId: 'custom-b',
      templates: [
        { id: 'custom-b', label: 'Meu 2h', message: 'Hoje, {cliente}' },
      ],
    });

    assert.deepEqual(
      escritas.map((e) => e.key),
      [
        'notifications.cancellationTemplates',
        'notifications.reminder2hTemplates',
      ],
    );
    const cancelamento = await settings.getTemplates('company-1', 'cancellation');
    const lembrete = await settings.getTemplates('company-1', 'reminder2h');
    assert.equal(cancelamento.defaultTemplateId, 'custom-a');
    assert.equal(lembrete.defaultTemplateId, 'custom-b');
    assert.ok(!cancelamento.templates.some((t) => t.id === 'custom-b'));
  });

  it('13) embutidos vêm sempre; JSON lixo não apaga o padrão seguro', async () => {
    const { settings } = settingsService({
      'notifications.cancellationTemplates': {
        defaultTemplateId: 'nao-existe',
        templates: [{ id: 'sem-prefixo', label: '', message: '' }, 42, null],
      },
    });

    const cfg = await settings.getTemplates('company-1', 'cancellation');

    assert.equal(cfg.defaultTemplateId, BUILTIN_CANCELLATION_TEMPLATES[0].id);
    assert.deepEqual(
      cfg.templates.map((t) => t.id),
      BUILTIN_CANCELLATION_TEMPLATES.map((t) => t.id),
    );
  });

  it('14) activeTemplateMessage devolve o padrão escolhido, e null quando falha', async () => {
    const { settings } = settingsService({
      'notifications.reminder24hTemplates': {
        defaultTemplateId: 'custom-v',
        templates: [
          { id: 'custom-v', label: 'Véspera', message: 'Amanhã, {cliente}!' },
        ],
      },
    });
    assert.equal(
      await settings.activeTemplateMessage('company-1', 'reminder24h'),
      'Amanhã, {cliente}!',
    );

    const quebrado = new NotificationSettingsService({
      client: {
        setting: {
          findUnique: async () => {
            throw new Error('banco fora');
          },
        },
      },
    } as any);
    assert.equal(
      await quebrado.activeTemplateMessage('company-1', 'confirmation'),
      null,
    );
  });

  // ------------------------------------------------- lembretes

  it('15) lembrete sem modelo mantém exatamente o texto de antes', () => {
    const dados = {
      companyName: 'La Belle de Jour',
      timezone: 'America/Sao_Paulo',
      customerName: 'Tais Silva',
      customerPhone: '5511999990000',
      professionalName: 'Vitória',
      serviceNames: ['cabelo'],
      start: START,
    };

    assert.match(
      composeReminderMessage('reminder_24h', dados)!.text,
      /^Olá, Tais Silva! Passando para lembrar do seu cabelo com Vitória amanhã, /,
    );
    assert.match(
      composeReminderMessage('reminder_2h', dados)!.text,
      /é hoje às \d{2}:\d{2} no La Belle de Jour/,
    );
  });

  it('16) lembrete com modelo usa o modelo da empresa', () => {
    const msg = composeReminderMessage(
      'reminder_2h',
      {
        companyName: 'La Belle de Jour',
        timezone: 'America/Sao_Paulo',
        customerName: 'Tais Silva',
        customerPhone: '5511999990000',
        professionalName: 'Vitória',
        serviceNames: ['cabelo'],
        start: START,
      },
      'Já é hoje, {cliente}! {servico} às {hora_curta} com {profissional}.',
    );

    assert.equal(msg!.text, 'Já é hoje, Tais! cabelo às 16hrs com Vitória.');
  });

  it('17) sem telefone não há mensagem, nem com modelo', () => {
    assert.equal(
      composeReminderMessage(
        'reminder_2h',
        {
          companyName: 'X',
          timezone: 'America/Sao_Paulo',
          customerName: 'Tais',
          customerPhone: null,
          professionalName: null,
          serviceNames: [],
          start: START,
        },
        'Oi {cliente}',
      ),
      null,
    );
  });

  // ------------------------------------------------- rotas

  it('18) PUT com tipo desconhecido é recusado', async () => {
    const controller = new NotificationSettingsController({} as any);

    await assert.rejects(
      async () =>
        controller.updateMessageTemplates('company-1', 'inventado', {
          templates: [],
        }),
      /Tipo de mensagem desconhecido/,
    );
  });

  it('19) {motivo} é aceito no cancelamento e recusado na confirmação', async () => {
    const { settings } = settingsService();
    const controller = new NotificationSettingsController(settings as any);
    const modelo = (message: string) => ({
      defaultTemplateId: 'custom-x',
      templates: [{ id: 'custom-x', label: 'Meu', message }],
    });

    const salvo = await controller.updateMessageTemplates(
      'company-1',
      'cancellation',
      modelo('Oi {cliente}, motivo: {motivo}'),
    );
    assert.equal(salvo.defaultTemplateId, 'custom-x');

    await assert.rejects(
      async () =>
        controller.updateMessageTemplates(
          'company-1',
          'confirmation',
          modelo('Oi {cliente}, motivo: {motivo}'),
        ),
      /Variável não reconhecida no modelo: \{motivo\}/,
    );
  });

  it('20) modelo sem nome, sem texto ou com id inválido é recusado', async () => {
    const { settings } = settingsService();
    const controller = new NotificationSettingsController(settings as any);

    await assert.rejects(
      async () =>
        controller.updateMessageTemplates('company-1', 'confirmation', {
          templates: [{ id: 'sem-prefixo', label: 'x', message: 'y' }],
        }),
      /Identificador do modelo inválido/,
    );
    await assert.rejects(
      async () =>
        controller.updateMessageTemplates('company-1', 'confirmation', {
          templates: [{ id: 'custom-x', label: '', message: 'y' }],
        }),
      /nome do modelo/,
    );
    await assert.rejects(
      async () =>
        controller.updateMessageTemplates('company-1', 'confirmation', {
          templates: [{ id: 'custom-x', label: 'x', message: '' }],
        }),
      /mensagem do modelo/,
    );
  });
});
