import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AppointmentStatus, OrderStatus } from '@beautypass/db';
import { computeFunnel, type FunnelAppointment, type FunnelOrder } from './dashboard.util';

// Day key = YYYY-MM-DD in UTC. The util only cares that dayInTz is deterministic
// per Date; the specific tz is a service concern.
const dayInTz = (d: Date): string => d.toISOString().slice(0, 10);

const dt = (iso: string): Date => new Date(iso);

describe('computeFunnel', () => {
  it('conta todos, confirmados e faturados conforme o funil Belasis', () => {
    const appointments: FunnelAppointment[] = [
      // c1 no dia 10 — casa com order finished (faturado + confirmado)
      { customerId: 'c1', status: AppointmentStatus.confirmed, start: dt('2026-06-10T14:00:00Z') },
      // c2 no dia 11 — casa com order finished (faturado + confirmado)
      { customerId: 'c2', status: AppointmentStatus.confirmed, start: dt('2026-06-11T15:30:00Z') },
      // c3 no dia 12 — confirmado, sem order finished no mesmo dia (não faturado)
      { customerId: 'c3', status: AppointmentStatus.confirmed, start: dt('2026-06-12T10:00:00Z') },
      // c4 no dia 13 — cancelado (não conta em confirmados; conta em todos)
      { customerId: 'c4', status: AppointmentStatus.canceled, start: dt('2026-06-13T09:00:00Z') },
      // sem cliente — nunca é faturado; status confirmed conta em confirmados
      { customerId: null, status: AppointmentStatus.confirmed, start: dt('2026-06-10T11:00:00Z') },
    ];

    const orders: FunnelOrder[] = [
      // match c1/2026-06-10
      { customerId: 'c1', status: OrderStatus.finished, date: dt('2026-06-10T18:00:00Z') },
      // match c2/2026-06-11
      { customerId: 'c2', status: OrderStatus.finished, date: dt('2026-06-11T20:00:00Z') },
      // finished mas sem appointment casando (customer/dia diferente)
      { customerId: 'c9', status: OrderStatus.finished, date: dt('2026-06-15T20:00:00Z') },
      // open no mesmo (c3, 2026-06-12) — NÃO deve faturar (status != finished)
      { customerId: 'c3', status: OrderStatus.open, date: dt('2026-06-12T12:00:00Z') },
    ];

    const funil = computeFunnel(appointments, orders, dayInTz);

    assert.equal(funil.todos, 5, 'todos = total de appointments');
    assert.equal(funil.confirmados, 4, 'confirmados = 4 (todos menos o canceled)');
    assert.equal(funil.faturados, 2, 'faturados = 2 (c1 e c2 casaram order finished)');
  });

  it('appointment sem customerId nunca vira faturado, mesmo com order finished no mesmo dia', () => {
    const appointments: FunnelAppointment[] = [
      { customerId: null, status: AppointmentStatus.confirmed, start: dt('2026-06-10T14:00:00Z') },
    ];
    const orders: FunnelOrder[] = [
      { customerId: null, status: OrderStatus.finished, date: dt('2026-06-10T18:00:00Z') },
      { customerId: 'cX', status: OrderStatus.finished, date: dt('2026-06-10T18:00:00Z') },
    ];

    const funil = computeFunnel(appointments, orders, dayInTz);

    assert.equal(funil.todos, 1);
    assert.equal(funil.confirmados, 1);
    assert.equal(funil.faturados, 0, 'appointment sem customer não casa; order sem customer também não');
  });

  it('order status open nunca conta como faturamento', () => {
    const appointments: FunnelAppointment[] = [
      { customerId: 'c1', status: AppointmentStatus.confirmed, start: dt('2026-06-10T14:00:00Z') },
    ];
    const orders: FunnelOrder[] = [
      { customerId: 'c1', status: OrderStatus.open, date: dt('2026-06-10T18:00:00Z') },
      { customerId: 'c1', status: OrderStatus.canceled, date: dt('2026-06-10T19:00:00Z') },
    ];

    assert.equal(computeFunnel(appointments, orders, dayInTz).faturados, 0);
  });
});
