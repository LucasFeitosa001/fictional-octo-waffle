import { AppointmentStatus, OrderStatus } from '@beautypass/db';

// Statuses that count as "confirmed" for the conversion funnel (confirmed and
// everything downstream of it).
export const CONFIRMED_ONWARDS: AppointmentStatus[] = [
  AppointmentStatus.confirmed,
  AppointmentStatus.waiting,
  AppointmentStatus.in_progress,
  AppointmentStatus.done,
  AppointmentStatus.finished,
];

export interface FunnelAppointment {
  customerId: string | null;
  status: AppointmentStatus;
  start: Date;
}

export interface FunnelOrder {
  customerId: string | null;
  status: OrderStatus;
  date: Date;
}

export interface FunnelResult {
  todos: number;
  confirmados: number;
  faturados: number;
}

// "Faturado" (Belasis) = o agendamento virou comanda. Como o export marca TODO
// agendamento como "Confirmado" (nunca "finished"), casamos o agendamento a uma
// comanda finalizada do MESMO cliente no MESMO dia.
export function computeFunnel(
  appointments: FunnelAppointment[],
  orders: FunnelOrder[],
  dayInTz: (d: Date) => string,
): FunnelResult {
  const faturadoKeys = new Set(
    orders
      .filter((o) => o.status === OrderStatus.finished && o.customerId)
      .map((o) => `${o.customerId}|${dayInTz(o.date)}`),
  );
  return {
    todos: appointments.length,
    confirmados: appointments.filter((a) => CONFIRMED_ONWARDS.includes(a.status)).length,
    faturados: appointments.filter(
      (a) => a.customerId != null && faturadoKeys.has(`${a.customerId}|${dayInTz(a.start)}`),
    ).length,
  };
}
