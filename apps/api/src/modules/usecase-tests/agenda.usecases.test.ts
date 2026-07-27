import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppointmentsService } from '../appointments/appointments.service';

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
