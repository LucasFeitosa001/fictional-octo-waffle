/**
 * PublicBookingService — escopo por CUSTOMER. Ver estudo 134.
 *
 * O portal de agendamento tem endpoints "meus" (`cancelMyAppointment`,
 * `reviewMyAppointment`, `updateMyProfile`) autenticados via sessão de
 * cliente. O risco é o usuário A conseguir mexer no `Appointment` do B
 * simplesmente colocando o id de B na URL.
 *
 * O código correto já filtra por `customerId: customer.id` no `findFirst`
 * (public-booking.service.ts:1099 e :980). Estes testes provam.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { PublicBookingService } from '../public-booking/public-booking.service';

interface Row {
  id: string;
  companyId?: string;
  customerId?: string;
  userId?: string;
  status?: string;
  start?: Date;
  slug?: string;
}

function fixture() {
  const state = {
    companies: [{ id: 'X', slug: 'designmoda' }],
    customers: [
      { id: 'cus-a', companyId: 'X', userId: 'user-a' },
      { id: 'cus-b', companyId: 'X', userId: 'user-b' },
    ],
    appointments: [
      { id: 'appt-a', companyId: 'X', customerId: 'cus-a', status: 'confirmed', start: new Date('2027-01-01T12:00:00Z') },
      { id: 'appt-b', companyId: 'X', customerId: 'cus-b', status: 'confirmed', start: new Date('2027-01-01T14:00:00Z') },
    ] as Row[],
  };
  const filtrar = <T extends Row>(arr: T[], where: Record<string, unknown>): T[] =>
    arr.filter((r) => {
      for (const [k, v] of Object.entries(where)) {
        if ((r as unknown as Record<string, unknown>)[k] !== v) return false;
      }
      return true;
    });
  const client = {
    // resolveCompanyId lê `bookingLink.findUnique({ where: { slug } })`.
    bookingLink: {
      findUnique: async (a: { where: { slug: string } }) => {
        const c = state.companies.find((x) => x.slug === a.where.slug);
        return c ? { companyId: c.id, active: true } : null;
      },
    },
    customer: {
      findFirst: async (a: { where: Record<string, unknown> }) =>
        filtrar(state.customers as unknown as Row[], a.where)[0] ?? null,
    },
    appointment: {
      findFirst: async (a: { where: Record<string, unknown> }) =>
        filtrar(state.appointments, a.where)[0] ?? null,
    },
    review: { findFirst: async () => null, create: async () => ({}) },
    $transaction: async (cb: unknown) => (typeof cb === 'function' ? (cb as (t: unknown) => unknown)(client) : cb),
  };

  const service = new PublicBookingService(
    { client } as never,
    // AppointmentsService: reviewMyAppointment não chega a chamar; cancel
    // chama setStatus, então mockamos com no-op.
    { setStatus: async () => ({}) } as never,
    {} as never, // EmailService
    { setInboundHandler: () => undefined } as never, // WhatsappService
    {} as never, // NotificationSettingsService
  );
  return { state, service };
}

const DE_A = { id: 'user-a', email: 'a@ex.com' };

describe('PublicBookingService — cliente só mexe no PRÓPRIO (estudo 134)', () => {
  it('1) cancelMyAppointment: A tentando cancelar appt de B → 404', async () => {
    const { service } = fixture();
    await assert.rejects(
      () => service.cancelMyAppointment('designmoda', DE_A as never, 'appt-b'),
      NotFoundException,
    );
  });

  it('2) cancelMyAppointment: A cancela o próprio → ok', async () => {
    const { service } = fixture();
    const r = await service.cancelMyAppointment('designmoda', DE_A as never, 'appt-a');
    assert.equal(r.id, 'appt-a');
    assert.equal(r.status, 'canceled');
  });

  it('3) reviewMyAppointment: A tentando avaliar appt de B → 404', async () => {
    const { service } = fixture();
    await assert.rejects(
      () => service.reviewMyAppointment('designmoda', DE_A as never, 'appt-b', { rating: 5 } as never),
      NotFoundException,
    );
  });

  it('4) usuário sem customer no salão: qualquer operação → 404 (não vaza existência)', async () => {
    const { service } = fixture();
    const ESTRANHO = { id: 'user-z', email: 'z@ex.com' };
    await assert.rejects(
      () => service.cancelMyAppointment('designmoda', ESTRANHO as never, 'appt-a'),
      NotFoundException,
    );
  });
});
