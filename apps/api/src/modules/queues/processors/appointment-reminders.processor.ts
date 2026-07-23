import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppointmentStatus, NotificationChannel } from '@beautypass/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { NotificationSettingsService } from '../../notifications/notification-settings.service';
import { composeReminderMessage } from '../reminder.templates';
import {
  QUEUE_APPOINTMENT_REMINDERS,
  type AppointmentReminderJob,
} from '../queue-names';
import {
  readMessagingMode,
  isOptedOut,
  dispatchWhatsapp,
} from '../messaging.helpers';

// Statuses for which a reminder still makes sense at fire time. If the
// appointment was cancelled/finished/started, the delayed job is a no-op.
const REMINDABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.scheduled,
  AppointmentStatus.confirmed,
  AppointmentStatus.unconfirmed,
  AppointmentStatus.waiting,
];

/**
 * Fires appointment reminders (24h / 2h before start). The delay was applied when
 * the job was enqueued (appointments.service on create/confirm), so `process` runs
 * at (start - offset). It re-reads the appointment fresh — a job enqueued hours ago
 * must reflect the current state (cancelled? rescheduled? already reminded?).
 *
 * IDEMPOTENCY (business): an AppointmentNotification row of this `type` means the
 * reminder was already handled — we never send twice, even if BullMQ retries the
 * job after a partial failure or the same kind was somehow enqueued twice.
 *
 * MODE: dryrun/disabled → logs the would-be message and still records the marker
 * (so it isn't retried forever). live+enabled → enqueues to the WhatsApp outbox.
 */
@Processor(QUEUE_APPOINTMENT_REMINDERS)
export class AppointmentRemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(AppointmentRemindersProcessor.name);
  private readonly mode = readMessagingMode();

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly settings: NotificationSettingsService,
  ) {
    super();
  }

  async process(job: Job<AppointmentReminderJob>): Promise<void> {
    const { companyId, appointmentId, kind } = job.data;
    const tag = `[reminder ${this.mode.mode}] company=${companyId} appt=${appointmentId} kind=${kind}`;

    const appt = await this.prisma.client.appointment.findFirst({
      where: { id: appointmentId, companyId },
      include: {
        customer: true,
        professional: true,
        company: true,
        items: { include: { service: true } },
        notifications: { where: { type: kind } },
      },
    });

    // Appointment vanished (deleted) — nothing to do.
    if (!appt) {
      this.logger.debug(`${tag} agendamento não encontrado — ignorando.`);
      return;
    }

    // Already reminded (business idempotency) — stop.
    if (appt.notifications.length > 0) {
      this.logger.debug(`${tag} já lembrado anteriormente — ignorando.`);
      return;
    }

    // No longer in a remindable state (cancelled/finished/in-progress) — skip,
    // but DON'T mark, so if it flips back to a valid state a manual re-enqueue works.
    if (!REMINDABLE_STATUSES.includes(appt.status)) {
      this.logger.debug(`${tag} status=${appt.status} não lembrável — ignorando.`);
      return;
    }

    const msg = composeReminderMessage(kind, {
      companyName: appt.company.name,
      timezone: appt.company.timezone,
      customerName: appt.customer?.name ?? null,
      customerPhone: appt.customer?.phone ?? null,
      professionalName: appt.professional?.name ?? null,
      serviceNames: appt.items
        .map((it) => it.service?.name)
        .filter((n): n is string => !!n),
      start: appt.start,
    });

    const optedOut = appt.customer ? isOptedOut(appt.customer) : true;

    // SECOND LOCK (per-company toggle): reminders start OFF by default. When the
    // owner hasn't enabled them, don't send — but still record the marker below
    // (like no-phone/opt-out) so the delayed job isn't retried forever.
    const auto = await this.settings.get(companyId);

    let sent = false;
    if (msg && !optedOut && auto.reminder) {
      sent = await dispatchWhatsapp(
        this.logger,
        this.whatsapp,
        this.mode,
        tag,
        msg.to,
        msg.text,
        // Interações: lembrete de agendamento ao cliente.
        { companyId, customerId: appt.customerId ?? undefined, kind: 'reminder' },
      );
    } else {
      const why = !auto.reminder
        ? 'lembrete desativado na config'
        : !msg
          ? 'sem telefone'
          : 'opt-out';
      this.logger.debug(`${tag} sem envio (${why}), apenas marcado.`);
    }

    // Record the marker either way so we never re-send. sentAt is only set when a
    // real dispatch happened (live + enabled); null means "evaluated, not sent".
    // Fail-soft: if this insert throws AFTER a send already went to the outbox, a
    // job retry must not re-send — so we swallow the error rather than fail the
    // job (the send is the irreversible side effect; the marker is best-effort).
    await this.prisma.client.appointmentNotification
      .create({
        data: {
          appointmentId: appt.id,
          type: kind,
          channel: NotificationChannel.whatsapp,
          sentAt: sent ? new Date() : null,
        },
      })
      .catch((err) =>
        this.logger.warn(`${tag} falha ao gravar marcador: ${(err as Error).message}`),
      );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AppointmentReminderJob>, err: Error): void {
    this.logger.error(
      `Reminder job ${job?.id} falhou (tentativa ${job?.attemptsMade}): ${err?.message}`,
    );
  }
}
