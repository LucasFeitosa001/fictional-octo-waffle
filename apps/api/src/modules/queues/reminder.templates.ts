/**
 * Pure message builders for time-based appointment reminders. No I/O — turns an
 * appointment + related rows into the WhatsApp text the client would receive.
 * Kept separate from `notifications.templates.ts` (lifecycle events) and
 * `follow-up.templates.ts` (post-service) because reminders are time-driven
 * ("faltam ~24h / ~2h"), fired by the appointment-reminders queue.
 */

import { confirmationTemplateVariables } from '../notifications/confirmation.templates';
import {
  renderMessageTemplate,
  type MessageTemplateKind,
} from '../notifications/message-templates';

export type ReminderKind = 'reminder_24h' | 'reminder_2h';

export interface ReminderData {
  companyName: string;
  timezone: string;
  customerName: string | null;
  customerPhone: string | null;
  professionalName: string | null;
  serviceNames: string[];
  start: Date;
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

/**
 * Builds the client-facing reminder text. Returns `null` when there is no phone
 * on file (nothing to enqueue).
 *
 * `template` (estudo 61): quando a empresa tem um modelo personalizado para
 * aquele lembrete, o texto vem dele. Sem modelo — ou se o modelo renderizar
 * vazio —, mantém o texto fixo abaixo, que é o que já saía antes.
 */
export function composeReminderMessage(
  kind: ReminderKind,
  data: ReminderData,
  template?: string | null,
): { to: string; text: string } | null {
  if (!data.customerPhone) return null;

  if (template?.trim()) {
    const modelKind: MessageTemplateKind =
      kind === 'reminder_24h' ? 'reminder24h' : 'reminder2h';
    const personalizado = renderMessageTemplate(
      modelKind,
      template,
      confirmationTemplateVariables({
        companyName: data.companyName,
        timezone: data.timezone,
        customerName: data.customerName,
        professionalName: data.professionalName,
        serviceNames: data.serviceNames,
        start: data.start,
      }) as unknown as Record<string, string>,
    );
    if (personalizado && personalizado.length <= 2_000) {
      return { to: data.customerPhone, text: personalizado };
    }
  }

  const services = data.serviceNames.length
    ? data.serviceNames.join(', ')
    : 'atendimento';
  const prof = data.professionalName ?? 'nossa equipe';
  const client = data.customerName ?? 'cliente';

  const text =
    kind === 'reminder_24h'
      ? `Olá, ${client}! Passando para lembrar do seu ${services} com ${prof} amanhã, ${fmtDateTime(
          data.start,
          data.timezone,
        )}, no ${data.companyName}. Até lá! 💕`
      : `Olá, ${client}! Seu ${services} com ${prof} é hoje às ${fmtTime(
          data.start,
          data.timezone,
        )} no ${data.companyName}. Estamos te esperando! 💕`;

  return { to: data.customerPhone, text };
}
