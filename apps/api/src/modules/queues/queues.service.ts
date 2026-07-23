import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import {
  QUEUE_APPOINTMENT_REMINDERS,
  QUEUE_FOLLOW_UPS,
  QUEUE_CAMPAIGNS,
  JOB_REMINDER_24H,
  JOB_REMINDER_2H,
  JOB_FOLLOW_UP,
  JOB_APPOINTMENT_CUSTOM_FOLLOW_UP,
  JOB_CAMPAIGN_MESSAGE,
  JOB_BIRTHDAY_SCAN,
  BIRTHDAY_REPEAT_JOB_ID,
  reminderJobId,
  followUpJobId,
  appointmentCustomFollowUpJobId,
  campaignMessageJobId,
  type AppointmentReminderJob,
  type FollowUpJob,
  type AppointmentCustomFollowUpJob,
  type AppointmentCustomFollowUpConfig,
  type CampaignMessageJob,
  type ReminderKind,
} from './queue-names';

/**
 * Unidades de tempo do aviso personalizado (segundos → dias) — mesma tabela da
 * config global de follow-up, para que segundos funcionem em teste.
 */
export type CustomFollowUpUnit = 'seconds' | 'minutes' | 'hours' | 'days';
const UNIT_MS: Record<CustomFollowUpUnit, number> = {
  seconds: 1000,
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
};
/** Piso do atraso (5s), igual ao MIN_DELAY_SECONDS da config global. */
const CUSTOM_FOLLOWUP_MIN_DELAY_MS = 5 * 1000;

/** Âncora do atraso do aviso personalizado. */
export type CustomFollowUpWhen = 'before' | 'after' | 'from_now';

/** Parâmetros de agendamento do aviso personalizado vindos do drawer. */
export interface AppointmentCustomFollowUpParams {
  delayValue: number;
  delayUnit: CustomFollowUpUnit;
  /** Âncora: from_now = agora+delay; before = start−delay; after = end+delay. */
  when?: CustomFollowUpWhen;
  message?: string;
  templateId?: string;
  includeLink?: boolean;
}

/**
 * Producer facade over the three BullMQ queues. This is the ONLY thing the domain
 * services (appointments, orders, campaigns) touch — they enqueue/cancel through
 * here and never know about BullMQ details. Every method fails soft: enqueuing a
 * message must never break a booking or an order close, so errors are logged and
 * swallowed.
 *
 * Delayed jobs are the mechanism throughout:
 *   - reminders: delay = (start - now - 24h) and (start - now - 2h);
 *   - follow-up: delay = FOLLOWUP_DELAY_HOURS after the trigger.
 * Deterministic jobIds make re-enqueues idempotent while a job is pending, and
 * cancellation is just queue.remove(jobId).
 */
@Injectable()
export class QueuesService implements OnModuleInit {
  private readonly logger = new Logger(QueuesService.name);

  // Default retry policy for every enqueue: 3 attempts, exponential backoff.
  // Completed jobs are cleaned up; failed jobs are kept for inspection.
  private readonly defaultJobOptions = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 500,
  };

  constructor(
    @InjectQueue(QUEUE_APPOINTMENT_REMINDERS) private readonly reminders: Queue,
    @InjectQueue(QUEUE_FOLLOW_UPS) private readonly followUps: Queue,
    @InjectQueue(QUEUE_CAMPAIGNS) private readonly campaigns: Queue,
    private readonly notificationSettings: NotificationSettingsService,
  ) {}

  /**
   * On boot, ensure the daily birthday-campaign scan repeatable exists (idempotent).
   *
   * NÃO-BLOQUEANTE: fire-and-forget. Se o Redis estiver indisponível, o `add(...)`
   * falha (enableOfflineQueue:false → erro imediato em vez de pendurar) e é
   * engolido dentro de ensureBirthdayRepeatable — o boot da API NUNCA trava por
   * causa do Redis. Com Redis disponível, o repeatable é (re)registrado normal.
   */
  onModuleInit(): void {
    void this.ensureBirthdayRepeatable();
  }

  // ------------------------------------------------------------- reminders

  /**
   * Enqueues the 24h and 2h reminders for an appointment. Called when it's created
   * or confirmed. For each offset:
   *   - delay > 0 → schedule a delayed job that fires at (start - offset);
   *   - delay <= 0 but start still in the future → fire immediately (delay 0);
   *   - start already past → skip (nothing to remind).
   * Idempotent: deterministic jobIds mean a re-enqueue (create then confirm) does
   * not create duplicates.
   */
  async enqueueAppointmentReminders(
    companyId: string,
    appointmentId: string,
    start: Date,
  ): Promise<void> {
    const now = Date.now();
    const startMs = start.getTime();
    const offsets: { kind: ReminderKind; jobName: string; offsetMs: number }[] = [
      { kind: 'reminder_24h', jobName: JOB_REMINDER_24H, offsetMs: 24 * 60 * 60 * 1000 },
      { kind: 'reminder_2h', jobName: JOB_REMINDER_2H, offsetMs: 2 * 60 * 60 * 1000 },
    ];

    for (const { kind, jobName, offsetMs } of offsets) {
      const fireAt = startMs - offsetMs;
      // If the whole appointment is already in the past, there's nothing to send.
      if (startMs <= now) continue;
      const delay = Math.max(0, fireAt - now);
      const jobId = reminderJobId(appointmentId, kind);
      const data: AppointmentReminderJob = { companyId, appointmentId, kind };
      try {
        await this.reminders.add(jobName, data, {
          ...this.defaultJobOptions,
          jobId,
          delay,
        });
      } catch (err) {
        this.logger.error(
          `enqueueAppointmentReminders(${appointmentId}, ${kind}) falhou: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Cancels both pending reminders for an appointment (called on cancel/delete). */
  async cancelAppointmentReminders(appointmentId: string): Promise<void> {
    const ids: ReminderKind[] = ['reminder_24h', 'reminder_2h'];
    for (const kind of ids) {
      try {
        await this.reminders.remove(reminderJobId(appointmentId, kind));
      } catch (err) {
        // remove() throws if the job is locked/active or already gone — safe to ignore.
        this.logger.debug(
          `cancelAppointmentReminders(${appointmentId}, ${kind}): ${(err as Error).message}`,
        );
      }
    }
  }

  // ------------------------------------------------------------- follow-ups

  /**
   * Enqueues ONE delayed follow-up job. Triggered when an appointment is concluded
   * (done/finished) or when orders.finish() closes a comanda. The delay comes from
   * the company's FollowUpSettings.delayHours (falling back to FOLLOWUP_DELAY_HOURS,
   * default 24h). jobId keys on order/appointment so the two triggers for the same
   * visit don't double-send, and a re-fire is idempotent.
   *
   * `overrides` lets the processor re-enqueue the NEXT recurrence with an explicit
   * delay (recurringDays) and recurrence index — the first-send path leaves them
   * undefined and reads the configured delayHours.
   */
  async enqueueFollowUp(
    companyId: string,
    ref: { appointmentId?: string; orderId?: string },
    overrides?: { delayMs?: number; recurrence?: number },
  ): Promise<void> {
    const delay =
      overrides?.delayMs !== undefined
        ? Math.max(0, overrides.delayMs)
        : await this.resolveFollowUpDelayMs(companyId);
    const recurrence = overrides?.recurrence;
    const jobId = followUpJobId({ ...ref, recurrence });
    const data: FollowUpJob = { companyId, ...ref, ...(recurrence ? { recurrence } : {}) };
    try {
      await this.followUps.add(JOB_FOLLOW_UP, data, {
        ...this.defaultJobOptions,
        jobId,
        delay,
      });
    } catch (err) {
      this.logger.error(
        `enqueueFollowUp(${JSON.stringify(ref)}) falhou: ${(err as Error).message}`,
      );
    }
  }

  /**
   * First-send delay for the follow-up (in ms): the company's configured
   * delaySeconds (already unit-normalized and clamped by the settings service —
   * can be as low as a few seconds for testing), or the FOLLOWUP_DELAY_HOURS env
   * as a fallback (never throws — a config read failure must not block concluding
   * the visit).
   */
  private async resolveFollowUpDelayMs(companyId: string): Promise<number> {
    const envHours = Number(process.env.FOLLOWUP_DELAY_HOURS ?? 24);
    const fallbackHours = Number.isFinite(envHours) && envHours > 0 ? envHours : 24;
    const fallbackMs = fallbackHours * 60 * 60 * 1000;
    try {
      const cfg = await this.notificationSettings.getFollowUp(companyId);
      const seconds = cfg.delaySeconds > 0 ? cfg.delaySeconds : fallbackHours * 3600;
      return seconds * 1000;
    } catch (err) {
      this.logger.warn(
        `resolveFollowUpDelayMs(${companyId}) usando fallback: ${(err as Error).message}`,
      );
      return fallbackMs;
    }
  }

  // -------------------------------------------- aviso personalizado (drawer)

  /**
   * Enfileira UM job atrasado com o aviso PERSONALIZADO configurado no drawer de
   * agendamento ("Avisar o cliente"). Distinto dos lembretes fixos 24h/2h e do
   * follow-up global: a mensagem/template + link viajam no payload e o delay é
   * calculado a partir de (delayValue + delayUnit) ancorado por `when`:
   *   - from_now → agora + delay;
   *   - before   → start − delay;
   *   - after    → end   + delay  (default — "depois do atendimento").
   * O atraso final é `fireAt − agora`, com piso de 5s (como o follow-up global),
   * para que o job dispare mesmo quando a âncora já passou (ex.: teste com
   * segundos ou reagendamento). jobId determinístico por agendamento → um único
   * aviso pendente; reconfigurar (editar) cancela e re-enfileira limpo.
   */
  async enqueueAppointmentCustomFollowUp(
    companyId: string,
    appointmentId: string,
    cfg: AppointmentCustomFollowUpParams,
    anchor: { start: Date; end: Date },
  ): Promise<void> {
    const unit = UNIT_MS[cfg.delayUnit] ?? UNIT_MS.minutes;
    const delayMs = Math.max(1, Math.round(cfg.delayValue)) * unit;
    const when: CustomFollowUpWhen = cfg.when ?? 'after';

    const now = Date.now();
    let fireAt: number;
    if (when === 'from_now') fireAt = now + delayMs;
    else if (when === 'before') fireAt = anchor.start.getTime() - delayMs;
    else fireAt = anchor.end.getTime() + delayMs; // 'after'

    // Nunca no passado: piso de 5s a partir de agora.
    const delay = Math.max(CUSTOM_FOLLOWUP_MIN_DELAY_MS, fireAt - now);

    const jobId = appointmentCustomFollowUpJobId(appointmentId);
    const jobCfg: AppointmentCustomFollowUpConfig = {
      message: cfg.message,
      templateId: cfg.templateId,
      includeLink: cfg.includeLink,
    };
    const data: AppointmentCustomFollowUpJob = { companyId, appointmentId, cfg: jobCfg };
    try {
      // Substitui qualquer job pendente antigo deste agendamento antes de re-adicionar
      // (jobId só dedupa enquanto o job existe; remover garante o novo delay/config).
      await this.followUps.remove(jobId).catch(() => undefined);
      await this.followUps.add(JOB_APPOINTMENT_CUSTOM_FOLLOW_UP, data, {
        ...this.defaultJobOptions,
        jobId,
        delay,
      });
    } catch (err) {
      this.logger.error(
        `enqueueAppointmentCustomFollowUp(${appointmentId}) falhou: ${(err as Error).message}`,
      );
    }
  }

  /** Cancela o aviso personalizado pendente de um agendamento (cancel/delete/reagenda). */
  async cancelAppointmentCustomFollowUp(appointmentId: string): Promise<void> {
    try {
      await this.followUps.remove(appointmentCustomFollowUpJobId(appointmentId));
    } catch (err) {
      // remove() lança se o job está travado/ativo ou já sumiu — seguro ignorar.
      this.logger.debug(
        `cancelAppointmentCustomFollowUp(${appointmentId}): ${(err as Error).message}`,
      );
    }
  }

  // ------------------------------------------------------------- campaigns

  /**
   * Enqueues a single campaign message (one job per CampaignMessage row). The
   * dispatch loop materializes the rows synchronously (for auditability) and then
   * hands each one here, so the actual WhatsApp sends happen off the request with
   * per-message retry. jobId = the CampaignMessage id → exactly-once enqueue.
   */
  async enqueueCampaignMessage(job: CampaignMessageJob): Promise<void> {
    try {
      await this.campaigns.add(JOB_CAMPAIGN_MESSAGE, job, {
        ...this.defaultJobOptions,
        jobId: campaignMessageJobId(job.campaignMessageId),
      });
    } catch (err) {
      this.logger.error(
        `enqueueCampaignMessage(${job.campaignMessageId}) falhou: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Registers (or refreshes) the daily repeatable that scans birthdays across all
   * tenants and enqueues per-customer campaign sends. Runs every day at 09:00
   * (server tz). Idempotent: BullMQ dedupes a repeatable by its jobId + pattern.
   */
  async ensureBirthdayRepeatable(): Promise<void> {
    try {
      await this.campaigns.add(
        JOB_BIRTHDAY_SCAN,
        {},
        {
          jobId: BIRTHDAY_REPEAT_JOB_ID,
          repeat: { pattern: '0 0 9 * * *' },
          removeOnComplete: true,
          removeOnFail: 100,
        },
      );
    } catch (err) {
      this.logger.error(`ensureBirthdayRepeatable falhou: ${(err as Error).message}`);
    }
  }
}
