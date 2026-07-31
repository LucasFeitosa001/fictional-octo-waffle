import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppointmentsService } from '../appointments/appointments.service';
import {
  BUILTIN_CONFIRMATION_TEMPLATES,
  confirmationTemplateVariables,
  renderConfirmationTemplate,
} from '../notifications/confirmation.templates';
import {
  NotificationSettingsService,
} from '../notifications/notification-settings.service';

type Call = { model: string; method: string; args: any };

function makeAvailabilityService(options: {
  services?: { id: string; durationMin: number; price: number }[];
  performs?: boolean;
  schedules?: any[];
  busy?: { start: Date; end: Date }[];
}) {
  const calls: Call[] = [];
  const client = {
    service: {
      findMany: async (args: any) => {
        calls.push({ model: 'service', method: 'findMany', args });
        return options.services ?? [{ id: 'svc-1', durationMin: 30, price: 50 }];
      },
    },
    professionalService: {
      findUnique: async (args: any) => {
        calls.push({ model: 'professionalService', method: 'findUnique', args });
        return options.performs === false ? null : { id: 'link' };
      },
    },
    professionalSchedule: {
      findMany: async (args: any) => {
        calls.push({ model: 'professionalSchedule', method: 'findMany', args });
        return (
          options.schedules ?? [
            { professionalId: 'pro-1', weekday: 1, startTime: '09:00', endTime: '10:00' },
          ]
        );
      },
    },
    appointment: {
      findMany: async (args: any) => {
        calls.push({ model: 'appointment', method: 'findMany', args });
        return options.busy ?? [];
      },
    },
  };
  const service = new AppointmentsService(
    { client } as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
    undefined as any,
  );
  (service as any).companyTimezone = async () => 'UTC';
  return { service, calls };
}

describe('UC-01 — disponibilidade de horário', () => {
  it('soma a duração de todos os serviços ao montar slots', async () => {
    const { service } = makeAvailabilityService({
      services: [
        { id: 'svc-1', durationMin: 30, price: 50 },
        { id: 'svc-2', durationMin: 30, price: 70 },
      ],
    });

    const result = await service.availability(
      'company-a',
      'svc-1',
      'pro-1',
      '2099-01-05',
      ['svc-1', 'svc-2'],
    );

    assert.equal(result.slots.length, 1);
    assert.equal(
      new Date(result.slots[0].end).getTime() - new Date(result.slots[0].start).getTime(),
      60 * 60_000,
    );
  });

  it('remove todos os slots que sobrepõem um atendimento ativo', async () => {
    const { service } = makeAvailabilityService({
      busy: [
        {
          start: new Date('2099-01-05T09:15:00.000Z'),
          end: new Date('2099-01-05T09:45:00.000Z'),
        },
      ],
    });

    const result = await service.availability(
      'company-a',
      'svc-1',
      'pro-1',
      '2099-01-05',
    );

    assert.deepEqual(result.slots, []);
  });

  it('serviço desconhecido não produz disponibilidade', async () => {
    const { service } = makeAvailabilityService({ services: [] });

    const result = await service.availability(
      'company-a',
      'missing',
      'pro-1',
      '2099-01-05',
    );

    assert.deepEqual(result.slots, []);
  });
});

describe('GAP: UC-AGD-002 — isolamento e flags do profissional', () => {
  it('não oferece expediente de profissional pertencente a outro tenant', async () => {
    const { service } = makeAvailabilityService({
      schedules: [
        {
          professionalId: 'pro-foreign',
          weekday: 1,
          startTime: '09:00',
          endTime: '10:00',
          professional: { companyId: 'company-b', active: true },
        },
      ],
    });

    const result = await service.availability(
      'company-a',
      'svc-1',
      'pro-foreign',
      '2099-01-05',
    );

    assert.deepEqual(
      result.slots,
      [],
      'expediente de company-b não pode gerar slots para company-a',
    );
  });

  it('não oferece slots quando o profissional está inativo e não gera agenda', async () => {
    const { service } = makeAvailabilityService({
      schedules: [
        {
          professionalId: 'pro-1',
          weekday: 1,
          startTime: '09:00',
          endTime: '10:00',
          professional: { companyId: 'company-a', active: false, generateSchedule: false },
        },
      ],
    });

    const result = await service.availability(
      'company-a',
      'svc-1',
      'pro-1',
      '2099-01-05',
    );

    assert.deepEqual(
      result.slots,
      [],
      'active=false/generateSchedule=false precisa impedir a oferta de horários',
    );
  });
});

describe('UC-AGD-WA — confirmação manual com opt-in e idempotência', () => {
  const requestKey = '67df2ac6-fb04-4dd4-9712-1c02e7506848';

  function appointment(overrides: Record<string, unknown> = {}) {
    return {
      id: 'appt-1',
      companyId: 'company-a',
      customerId: 'customer-1',
      professionalId: 'pro-1',
      start: new Date('2026-07-30T19:00:00.000Z'),
      notifyConfirmation: false,
      company: { name: 'La Belle de Jour', timezone: 'America/Sao_Paulo' },
      customer: {
        name: 'Tais Silva',
        phone: '5585999999999',
        notificationsEnabled: true,
        whatsappOptIn: true,
      },
      items: [{ service: { name: 'cabelo' } }],
      ...overrides,
    };
  }

  function confirmationService(options: {
    appt?: ReturnType<typeof appointment>;
    previous?: {
      id: string;
      status: string;
      inboxMessage: { status: string } | null;
    } | null;
    priorRequest?: {
      id: string;
      appointmentId: string | null;
      status: string;
    } | null;
  } = {}) {
    const enqueued: unknown[] = [];
    const updates: unknown[] = [];
    const calls: string[] = [];
    const client = {
      whatsappOutbox: {
        findUnique: async () => {
          calls.push('request-key');
          return options.priorRequest ?? null;
        },
        findFirst: async () => options.previous ?? null,
      },
      appointment: {
        findFirst: async () => {
          calls.push('appointment-scope');
          return options.appt ?? appointment();
        },
        update: async (args: unknown) => {
          updates.push(args);
          return options.appt ?? appointment();
        },
      },
    };
    const whatsapp = {
      enqueueText: async (...args: unknown[]) => {
        enqueued.push(args);
        return { id: 'outbox-1', status: 'pending', deduplicated: false };
      },
    };
    const settings = {
      getConfirmationTemplates: async () => ({
        defaultTemplateId: BUILTIN_CONFIRMATION_TEMPLATES[0].id,
        templates: BUILTIN_CONFIRMATION_TEMPLATES.map((template) => ({
          ...template,
        })),
      }),
    };
    const service = new AppointmentsService(
      { client } as any,
      undefined as any,
      whatsapp as any,
      undefined as any,
      undefined as any,
      settings as any,
      undefined as any,
    );
    return { service, enqueued, updates, calls };
  }

  it('mantém toda automação desligada quando a empresa nunca autorizou', async () => {
    const settings = new NotificationSettingsService({
      client: {
        setting: {
          findUnique: async () => null,
        },
      },
    } as any);

    assert.deepEqual(await settings.get('company-a'), {
      confirmation: false,
      cancellation: false,
      reminder: false,
      followUp: false,
      notifyProfessional: false,
    });
  });

  it('renderiza exatamente o padrão carinhoso com amanhã e hora local', () => {
    const variables = confirmationTemplateVariables(
      {
        companyName: 'La Belle de Jour',
        timezone: 'America/Sao_Paulo',
        customerName: 'Tais Silva',
        professionalName: 'Vitória',
        serviceNames: ['cabelo'],
        start: new Date('2026-07-30T19:00:00.000Z'),
      },
      new Date('2026-07-29T12:00:00.000Z'),
    );
    const message = renderConfirmationTemplate(
      BUILTIN_CONFIRMATION_TEMPLATES[0].message,
      variables,
    );

    assert.equal(
      message,
      [
        'Olá, Tais! 💕',
        'Seu horário foi marcado com sucesso para amanhã às 16 horas, para o serviço de cabelo.',
        '',
        'Agradecemos a preferência, é sempre um prazer tê-la conosco e cuidar da sua beleza. ✨',
        '',
        'Nos vemos amanhã às 16hrs ✨🌸💖',
      ].join('\n'),
    );
  });

  it('bloqueia o envio quando a cliente retirou o opt-in', async () => {
    const { service, enqueued, updates } = confirmationService({
      appt: appointment({
        customer: {
          name: 'Tais',
          phone: '5585999999999',
          notificationsEnabled: true,
          whatsappOptIn: false,
        },
      }),
    });

    await assert.rejects(
      service.sendConfirmation('company-a', 'appt-1', {
        authorize: true,
        requestKey,
      }),
      /optou por não receber/,
    );
    assert.equal(enqueued.length, 0);
    assert.equal(updates.length, 0);
  });

  it('grava a autorização específica e enfileira uma única confirmação', async () => {
    const { service, enqueued, updates } = confirmationService();

    const result = await service.sendConfirmation('company-a', 'appt-1', {
      authorize: true,
      requestKey,
    });

    assert.deepEqual(result, {
      id: 'outbox-1',
      status: 'pending',
      deduplicated: false,
    });
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0], {
      where: { id: 'appt-1' },
      data: { notifyConfirmation: true },
    });
    assert.equal(enqueued.length, 1);
    assert.deepEqual((enqueued[0] as unknown[])[2], {
      companyId: 'company-a',
      customerId: 'customer-1',
      appointmentId: 'appt-1',
      kind: 'confirmation',
      requestKey,
      // Estudo 60: envio que uma PESSOA autorizou. É o que permite enfileirar
      // com o canal fechado e o que isenta a linha da revalidação de automação
      // na entrega — sem isso, o botão "Enviar confirmação" seria descartado
      // justamente quando o padrão da conta está desligado.
      authorized: true,
    });
  });

  it('não duplica uma confirmação que ainda está na fila', async () => {
    const { service, enqueued } = confirmationService({
      previous: {
        id: 'outbox-old',
        status: 'pending',
        inboxMessage: { status: 'pending' },
      },
    });

    await assert.rejects(
      service.sendConfirmation('company-a', 'appt-1', {
        authorize: true,
        requestKey,
      }),
      /já está na fila/,
    );
    assert.equal(enqueued.length, 0);
  });

  it('retry com a mesma requestKey devolve a linha existente sem novo envio', async () => {
    const { service, enqueued, updates, calls } = confirmationService({
      priorRequest: {
        id: 'outbox-existing',
        appointmentId: 'appt-1',
        status: 'pending',
      },
    });

    assert.deepEqual(
      await service.sendConfirmation('company-a', 'appt-1', {
        authorize: true,
        requestKey,
      }),
      {
        id: 'outbox-existing',
        status: 'pending',
        deduplicated: true,
      },
    );
    assert.deepEqual(calls.slice(0, 2), [
      'appointment-scope',
      'request-key',
    ]);
    assert.equal(enqueued.length, 0);
    assert.equal(updates.length, 0);
  });
});
