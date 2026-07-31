import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AppointmentStatus,
  NotificationChannel,
  type Prisma,
} from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { composeReminderMessage, type ReminderKind } from '../queues/reminder.templates';
import {
  dispatchWhatsapp,
  isOptedOut,
  readMessagingMode,
} from '../queues/messaging.helpers';
import { NotificationSettingsService } from './notification-settings.service';

const HOUR_MS = 60 * 60 * 1000;
/** Folga em volta do instante devido do lembrete (tick de 60s + parada curta). */
const TOLERANCIA_MS = 30 * 60 * 1000;
const DEFAULT_POLL_MS = 60_000;
const MIN_POLL_MS = 30_000;
const MAX_APPOINTMENTS_PER_TICK = 500;

const REMINDABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.scheduled,
  AppointmentStatus.confirmed,
  AppointmentStatus.unconfirmed,
  AppointmentStatus.waiting,
];

type ReminderCandidate = Prisma.AppointmentGetPayload<{
  include: {
    customer: true;
    professional: true;
    company: true;
    items: { include: { service: true } };
    notifications: true;
  };
}>;

/**
 * Durable fallback for appointment reminders when BullMQ producers or workers
 * are disabled. Production currently runs that way, so relying only on delayed
 * Redis jobs would silently lose the 24h/2h reminders.
 *
 * AppointmentNotification is claimed BEFORE enqueueing and has a unique
 * (appointmentId,type,channel) key. That makes the poller safe during retries,
 * restarts and App Runner blue/green overlap. The WhatsApp service still owns
 * the persistent outbox, humanized delay, cooldown and final delivery.
 */
@Injectable()
export class WhatsappReminderPollerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WhatsappReminderPollerService.name);
  private readonly mode = readMessagingMode();
  private readonly fallbackEnabled =
    process.env.QUEUES_ENABLED === 'false' ||
    process.env.QUEUE_WORKERS_ENABLED === 'false';
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly settings: NotificationSettingsService,
  ) {}

  onModuleInit(): void {
    if (!this.fallbackEnabled) return;
    if (!this.mode.canSendWhatsapp) {
      this.logger.warn(
        'Fallback de lembretes aguardando NOTIFICATIONS_MODE=live e WHATSAPP_ENABLED=true.',
      );
      return;
    }

    const requested = Number(process.env.WHATSAPP_REMINDER_POLL_MS ?? DEFAULT_POLL_MS);
    const pollMs = Number.isFinite(requested)
      ? Math.max(MIN_POLL_MS, requested)
      : DEFAULT_POLL_MS;

    this.logger.log(
      `Fallback persistente de lembretes ativo (intervalo ${Math.round(pollMs / 1000)}s).`,
    );
    const kickoff = setTimeout(() => void this.runOnce(), 5_000);
    kickoff.unref();
    this.timer = setInterval(() => void this.runOnce(), pollMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Public so the behavior can be exercised deterministically in integration
   * tests and operational checks without waiting for the interval.
   */
  async runOnce(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const candidates = await this.prisma.client.appointment.findMany({
        where: {
          status: { in: REMINDABLE_STATUSES },
          // Só é candidato quem tem lembrete VENCENDO agora. A faixa aberta de
          // 24h fazia todo agendamento do dia seguinte virar candidato no ato —
          // e, com o socket reabrindo, todos de uma vez. ±30min cobrem o tick
          // de 60s e uma parada curta, sem ressuscitar lembrete de ontem.
          // Ver estudo 77.
          OR: [
            {
              start: {
                gte: new Date(now.getTime() + 24 * HOUR_MS - TOLERANCIA_MS),
                lte: new Date(now.getTime() + 24 * HOUR_MS + TOLERANCIA_MS),
              },
            },
            {
              start: {
                gte: new Date(now.getTime() + 2 * HOUR_MS - TOLERANCIA_MS),
                lte: new Date(now.getTime() + 2 * HOUR_MS + TOLERANCIA_MS),
              },
            },
          ],
        },
        include: {
          customer: true,
          professional: true,
          company: true,
          items: { include: { service: true } },
          notifications: {
            where: {
              type: { in: ['reminder_24h', 'reminder_2h'] },
              channel: NotificationChannel.whatsapp,
            },
          },
        },
        orderBy: { start: 'asc' },
        take: MAX_APPOINTMENTS_PER_TICK,
      });

      let handled = 0;
      const settingsByCompany = new Map<string, boolean>();
      for (const appointment of candidates) {
        const kind = this.dueKind(appointment.start, now);
        if (appointment.notifications.some((marker) => marker.type === kind)) {
          continue;
        }
        if (await this.handle(appointment, kind, settingsByCompany)) handled += 1;
      }
      return handled;
    } catch (error) {
      this.logger.error(
        `Falha no fallback de lembretes: ${(error as Error).message}`,
      );
      return 0;
    } finally {
      this.running = false;
    }
  }

  private dueKind(start: Date, now: Date): ReminderKind {
    return start.getTime() - now.getTime() <= 2 * HOUR_MS
      ? 'reminder_2h'
      : 'reminder_24h';
  }

  private async handle(
    appointment: ReminderCandidate,
    kind: ReminderKind,
    settingsByCompany: Map<string, boolean>,
  ): Promise<boolean> {
    const claimed = await this.claim(appointment.id, kind);
    if (!claimed) return false;

    const tag = `[reminder db-fallback] company=${appointment.companyId} appt=${appointment.id} kind=${kind}`;
    // O padrão da conta é VETO. O valor do agendamento vem congelado da
    // criação (appointments.service.ts:551), então dar prioridade a ele fazia o
    // interruptor da conta não alcançar nada já marcado. Ver estudo 77.
    if (!settingsByCompany.has(appointment.companyId)) {
      const settings = await this.settings.get(appointment.companyId);
      settingsByCompany.set(appointment.companyId, settings.reminder);
    }
    const padraoDaConta = settingsByCompany.get(appointment.companyId) ?? false;
    const shouldSend = padraoDaConta && appointment.remindClient !== false;

    if (!shouldSend) {
      this.logger.debug(`${tag} desativado por configuração.`);
      return true;
    }

    // Modelo personalizado da empresa (estudo 61); null mantém o texto fixo.
    const modelo = await this.settings.activeTemplateMessage(
      appointment.companyId,
      kind === 'reminder_24h' ? 'reminder24h' : 'reminder2h',
    );

    const message = composeReminderMessage(kind, {
      companyName: appointment.company.name,
      timezone: appointment.company.timezone,
      customerName: appointment.customer?.name ?? null,
      customerPhone: appointment.customer?.phone ?? null,
      professionalName: appointment.professional?.name ?? null,
      serviceNames: appointment.items
        .map((item) => item.service?.name)
        .filter((name): name is string => !!name),
      start: appointment.start,
    }, modelo);

    if (!message || !appointment.customer || isOptedOut(appointment.customer)) {
      this.logger.debug(`${tag} sem telefone ou opt-out; marcado sem envio.`);
      return true;
    }

    const enqueued = await dispatchWhatsapp(
      this.logger,
      this.whatsapp,
      this.mode,
      tag,
      message.to,
      message.text,
      {
        companyId: appointment.companyId,
        customerId: appointment.customerId ?? undefined,
        // Sem isto a trava de entrega não teria como saber que o horário já
        // passou — foi exatamente o lembrete atrasado que chegou ao cliente.
        appointmentId: appointment.id,
        kind: 'reminder',
      },
    );

    if (!enqueued) {
      // A dispatch failure is retryable. Release only this claim so the next
      // poll can try again; stable no-send decisions above keep their marker.
      await this.prisma.client.appointmentNotification.deleteMany({
        where: {
          appointmentId: appointment.id,
          type: kind,
          channel: NotificationChannel.whatsapp,
          sentAt: null,
        },
      });
      return false;
    }

    await this.prisma.client.appointmentNotification.update({
      where: {
        appointmentId_type_channel: {
          appointmentId: appointment.id,
          type: kind,
          channel: NotificationChannel.whatsapp,
        },
      },
      data: { sentAt: new Date() },
    });
    return true;
  }

  private async claim(
    appointmentId: string,
    kind: ReminderKind,
  ): Promise<boolean> {
    try {
      await this.prisma.client.appointmentNotification.create({
        data: {
          appointmentId,
          type: kind,
          channel: NotificationChannel.whatsapp,
          sentAt: null,
        },
      });
      return true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return false;
      }
      throw error;
    }
  }
}
