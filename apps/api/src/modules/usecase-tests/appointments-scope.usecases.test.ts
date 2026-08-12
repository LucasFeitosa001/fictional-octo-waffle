/**
 * AppointmentsService — escopo por profissional em setStatus/remove. Ver
 * estudo 130.
 *
 * Prova que `findOne` — que é chamado por `setStatus`, `remove` e outras
 * mutações — respeita `scopeProfessionalId`. Um profissional com escopo
 * próprio (`agenda:manage` sem `agenda:view_all`) não altera nem apaga
 * agendamento de outro profissional.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { AppointmentsService } from '../appointments/appointments.service';

interface Appt {
  id: string;
  companyId: string;
  professionalId: string;
  status: string;
}

function prismaCom(appts: Appt[]) {
  const filtrar = (where: Record<string, unknown>): Appt[] => {
    return appts.filter((a) => {
      if (where.id && a.id !== where.id) return false;
      if (where.companyId && a.companyId !== where.companyId) return false;
      if (where.professionalId && a.professionalId !== where.professionalId) return false;
      return true;
    });
  };
  return {
    appointment: {
      findFirst: async (arg: { where: Record<string, unknown> }) =>
        filtrar(arg.where)[0] ?? null,
      findMany: async (arg: { where: Record<string, unknown> }) => filtrar(arg.where),
      update: async (arg: { where: { id: string } }) =>
        appts.find((a) => a.id === arg.where.id) ?? null,
      delete: async (arg: { where: { id: string } }) => {
        const i = appts.findIndex((a) => a.id === arg.where.id);
        if (i >= 0) appts.splice(i, 1);
        return {};
      },
    },
    order: {
      findFirst: async () => null,
    },
    $transaction: async <T,>(cb: unknown): Promise<T> => {
      if (typeof cb === 'function') return (cb as (tx: unknown) => Promise<T>)(mockClient);
      return null as never;
    },
  } as const;
}

let mockClient: ReturnType<typeof prismaCom>;

function servicoCom(appts: Appt[]) {
  mockClient = prismaCom(appts);
  return new AppointmentsService(
    { client: mockClient } as never,
    // Notifications/Whatsapp/Email/Queues/Settings/FollowUpSender: stubs vazios.
    // O teste exercita apenas findOne/remove, que não usam esses módulos.
    {} as never,
    {} as never,
    {} as never,
    {
      cancelAppointmentReminders: () => undefined,
      cancelAppointmentCustomFollowUp: () => undefined,
    } as never,
    {} as never,
    {} as never,
  );
}

const DA_PRO_A: Appt = {
  id: 'appt-1',
  companyId: 'X',
  professionalId: 'pro-a',
  status: 'confirmed',
};
const DA_PRO_B: Appt = {
  id: 'appt-2',
  companyId: 'X',
  professionalId: 'pro-b',
  status: 'confirmed',
};

describe('AppointmentsService.findOne — escopo por profissional (estudo 130)', () => {
  it('1) sem scope (dono/agenda:view_all): acha qualquer agendamento da empresa', async () => {
    const service = servicoCom([DA_PRO_A, DA_PRO_B]);
    const a = await service.findOne('X', 'appt-1');
    assert.equal(a.id, 'appt-1');
    const b = await service.findOne('X', 'appt-2');
    assert.equal(b.id, 'appt-2');
  });

  it('2) profissional A: acha o próprio', async () => {
    const service = servicoCom([DA_PRO_A, DA_PRO_B]);
    const a = await service.findOne('X', 'appt-1', 'pro-a');
    assert.equal(a.id, 'appt-1');
  });

  it('3) profissional A tentando ver agendamento de B: 404', async () => {
    const service = servicoCom([DA_PRO_A, DA_PRO_B]);
    await assert.rejects(() => service.findOne('X', 'appt-2', 'pro-a'), NotFoundException);
  });

  it('4) empresa Y tentando ver agendamento da X: 404 (isolamento cross-tenant)', async () => {
    const service = servicoCom([DA_PRO_A]);
    await assert.rejects(() => service.findOne('Y', 'appt-1'), NotFoundException);
  });

  it('5) profissional A tentando REMOVER agendamento de B: 404 antes do delete', async () => {
    const appts = [{ ...DA_PRO_A }, { ...DA_PRO_B }];
    const service = servicoCom(appts);
    await assert.rejects(() => service.remove('X', 'appt-2', 'pro-a'), NotFoundException);
    // E nada foi apagado.
    assert.equal(appts.length, 2);
    assert.ok(appts.find((a) => a.id === 'appt-2'));
  });
});
