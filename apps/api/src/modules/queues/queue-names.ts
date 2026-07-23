/**
 * Single source of truth for BullMQ queue names and job payloads.
 *
 * The whole message-automation engine is event-driven with delayed jobs:
 *   - appointment-reminders: 2 delayed jobs (24h / 2h before start), enqueued when
 *     an appointment is created/confirmed, cancelled by jobId on appointment cancel.
 *   - follow-ups: 1 delayed job (FOLLOWUP_DELAY_HOURS after an appointment is
 *     concluded or an order is closed) → "como foi seu atendimento?".
 *   - campaigns: one job per targeted customer (fan-out with retry), plus a daily
 *     repeatable that scans birthdays and enqueues per-customer sends.
 *
 * Job payloads carry `companyId` so every processor stays multi-tenant, and only
 * the ids they need — the processor re-reads fresh rows from Postgres so a delayed
 * job never acts on stale data (e.g. an appointment cancelled after enqueue).
 */

export const QUEUE_APPOINTMENT_REMINDERS = 'appointment-reminders';
export const QUEUE_FOLLOW_UPS = 'follow-ups';
export const QUEUE_CAMPAIGNS = 'campaigns';

/** Reminder kinds — mirror the `AppointmentNotification.type` markers. */
export type ReminderKind = 'reminder_24h' | 'reminder_2h';

/** Job names inside the appointment-reminders queue. */
export const JOB_REMINDER_24H = 'reminder_24h';
export const JOB_REMINDER_2H = 'reminder_2h';

export interface AppointmentReminderJob {
  companyId: string;
  appointmentId: string;
  kind: ReminderKind;
}

/** Job names inside the follow-ups queue. */
export const JOB_FOLLOW_UP = 'follow-up';
/**
 * Aviso PERSONALIZADO por agendamento, disparado a partir do drawer ("Avisar o
 * cliente"). Roda na MESMA fila de follow-ups, mas carrega sua própria config
 * (mensagem/template + tempo + link) no payload em vez de ler a config global.
 */
export const JOB_APPOINTMENT_CUSTOM_FOLLOW_UP = 'appointment-custom-follow-up';

/** Config embutida no job do aviso personalizado (snapshot no momento do enfileiramento). */
export interface AppointmentCustomFollowUpConfig {
  /** Mensagem custom (precede o template quando preenchida). */
  message?: string;
  /** Id de um modelo pronto (followupTemplates) usado quando não há message. */
  templateId?: string;
  /** Anexar/substituir o link público de reagendamento ({link}). */
  includeLink?: boolean;
}

export interface AppointmentCustomFollowUpJob {
  companyId: string;
  appointmentId: string;
  cfg: AppointmentCustomFollowUpConfig;
}

export interface FollowUpJob {
  companyId: string;
  /** The appointment that was concluded, when the trigger was an appointment. */
  appointmentId?: string;
  /** The order that was closed, when the trigger was orders.finish(). */
  orderId?: string;
  /**
   * Which recurrence this send is. 0 (or undefined) = the first follow-up; the
   * processor re-enqueues the next one with recurrence + 1 when recurring is on,
   * stopping at FollowUpSettings.maxRecurrences.
   */
  recurrence?: number;
}

/** Job names inside the campaigns queue. */
export const JOB_CAMPAIGN_MESSAGE = 'campaign-message';
export const JOB_BIRTHDAY_SCAN = 'birthday-scan';

/** One materialized CampaignMessage to deliver. */
export interface CampaignMessageJob {
  companyId: string;
  campaignId: string;
  campaignMessageId: string;
  customerId: string;
  /** Pre-rendered WhatsApp text (%NOME%/%ESTABELECIMENTO% already substituted). */
  text: string;
}

/** Daily birthday sweep — no per-tenant payload; the processor scans all companies. */
export type BirthdayScanJob = Record<string, never>;

/**
 * Deterministic jobIds for idempotency. Re-enqueuing the same logical job (a retry,
 * a duplicate lifecycle event, a process restart) reuses the id, so BullMQ dedupes
 * while the job is still pending/delayed. Business-level idempotency (never send
 * twice even after a job completes and its id frees up) is enforced separately via
 * `AppointmentNotification` / `CampaignMessage` rows.
 */
export const reminderJobId = (appointmentId: string, kind: ReminderKind): string =>
  `rem:${kind === 'reminder_24h' ? '24' : '2'}:${appointmentId}`;

export const followUpJobId = (opts: {
  appointmentId?: string;
  orderId?: string;
  recurrence?: number;
}): string => {
  const base = opts.orderId ? `fu:order:${opts.orderId}` : `fu:appt:${opts.appointmentId}`;
  // First send keeps the legacy id (no suffix) so any in-flight/old jobs stay
  // deduped; subsequent recurrences append their index.
  return opts.recurrence ? `${base}:r${opts.recurrence}` : base;
};

export const campaignMessageJobId = (campaignMessageId: string): string =>
  `cm:${campaignMessageId}`;

/**
 * Deterministic jobId for the per-appointment custom follow-up. One in-flight
 * job per appointment, so a re-schedule (edit) reuses the id — cancel then
 * re-add replaces the pending job cleanly.
 */
export const appointmentCustomFollowUpJobId = (appointmentId: string): string =>
  `acfu:${appointmentId}`;

/** Stable repeatable-job id for the daily birthday scan. */
export const BIRTHDAY_REPEAT_JOB_ID = 'birthday-daily-scan';
