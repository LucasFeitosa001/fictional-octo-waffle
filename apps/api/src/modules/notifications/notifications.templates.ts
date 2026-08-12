/**
 * Pure message builders for appointment notifications. No I/O here — these just
 * turn an appointment + related rows into the text that each channel would send.
 * Keeping them pure makes them trivial to unit-test and reuse once live sending
 * is wired up.
 */

export type AppointmentEvent = 'created' | 'confirmed' | 'canceled';

export interface AppointmentNotificationData {
  companyName: string;
  timezone: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  professionalName: string | null;
  serviceNames: string[];
  start: Date;
  end: Date;
  /** Motivo opcional informado ao cancelar. */
  reason?: string | null;
}

export interface ComposedMessages {
  /** WhatsApp text for the client (null when no phone on file). */
  clientWhatsapp: { to: string; text: string } | null;
  /** Email for the client (null when no email on file). */
  clientEmail: { to: string; subject: string; body: string } | null;
  /** Internal message for the studio (always built). */
  studio: { title: string; body: string };
  /** In-app message for the logged-in customer (the club app bell). */
  client: { title: string; body: string };
}

function fmtDateTime(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function fmtTime(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

const EVENT_LABEL: Record<AppointmentEvent, string> = {
  created: 'agendado',
  confirmed: 'confirmado',
  canceled: 'cancelado',
};

export function composeAppointmentMessages(
  event: AppointmentEvent,
  data: AppointmentNotificationData,
): ComposedMessages {
  const when = fmtDateTime(data.start, data.timezone);
  const endTime = fmtTime(data.end, data.timezone);
  const services = data.serviceNames.length ? data.serviceNames.join(', ') : 'atendimento';
  const prof = data.professionalName ?? 'nossa equipe';
  const label = EVENT_LABEL[event];
  const client = data.customerName ?? 'cliente';

  const reason = data.reason?.trim();
  const clientLine =
    event === 'canceled'
      ? `Olá, ${client}! Seu ${services} com ${prof} em ${when} foi cancelado.${reason ? ` Motivo: ${reason}.` : ''} Qualquer dúvida, fale com a gente. 💕`
      : `Olá, ${client}! Seu ${services} com ${prof} está ${label} para ${when} (até ${endTime}) no ${data.companyName}. Até lá! 💕`;

  return {
    clientWhatsapp: data.customerPhone
      ? { to: data.customerPhone, text: clientLine }
      : null,
    clientEmail: data.customerEmail
      ? {
          to: data.customerEmail,
          subject: `${data.companyName} — atendimento ${label}`,
          body: clientLine,
        }
      : null,
    studio: {
      title: `Agendamento ${label}: ${client}`,
      body: `${services} com ${prof} em ${when} (até ${endTime}).`,
    },
    client: {
      title:
        event === 'canceled'
          ? `Agendamento cancelado`
          : `Agendamento ${label}`,
      body: clientLine,
    },
  };
}
