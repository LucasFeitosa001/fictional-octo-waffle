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
  id?: string;
  customerId: string | null;
  status: AppointmentStatus;
  start: Date;
}

export interface FunnelOrder {
  customerId: string | null;
  status: OrderStatus;
  date: Date;
  /** Agendamento que originou a comanda (vínculo real, estudo 52). */
  appointmentId?: string | null;
}

export interface FunnelResult {
  todos: number;
  confirmados: number;
  faturados: number;
}

/**
 * "Faturado" (Belasis) = o agendamento virou comanda.
 *
 * O VÍNCULO manda (`Order.appointmentId`, estudo 52). O par cliente+dia fica só
 * como reserva para o histórico IMPORTADO, que não tem vínculo — adivinhar por
 * ele marcava como faturado o agendamento de quem veio duas vezes no mesmo dia,
 * ou de quem tinha uma comanda avulsa naquela data. Ver estudo 56.
 */
export function computeFunnel(
  appointments: FunnelAppointment[],
  orders: FunnelOrder[],
  dayInTz: (d: Date) => string,
): FunnelResult {
  const finalizadas = orders.filter((o) => o.status === OrderStatus.finished);
  const porVinculo = new Set(
    finalizadas.map((o) => o.appointmentId).filter((x): x is string => Boolean(x)),
  );
  const porClienteEDia = new Set(
    finalizadas
      .filter((o) => o.customerId && !o.appointmentId)
      .map((o) => `${o.customerId}|${dayInTz(o.date)}`),
  );
  return {
    todos: appointments.length,
    confirmados: appointments.filter((a) => CONFIRMED_ONWARDS.includes(a.status)).length,
    faturados: appointments.filter((a) => {
      if (a.id && porVinculo.has(a.id)) return true;
      return a.customerId != null && porClienteEDia.has(`${a.customerId}|${dayInTz(a.start)}`);
    }).length,
  };
}
