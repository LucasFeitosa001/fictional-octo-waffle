import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AppointmentEvent,
  composeAppointmentMessages,
} from './notifications.templates';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';

/**
 * Appointment notifications.
 *
 * MODE (env NOTIFICATIONS_MODE):
 *   - 'dryrun' (default): nothing is sent externally. The would-be client
 *     WhatsApp/email messages are logged, and an in-app Notification (the panel
 *     bell) is created for the studio.
 *   - 'live': dispatches WhatsApp (via outbox queue) and email (via Resend) to
 *     the client, in addition to logging and creating in-app notifications.
 */
export interface NotificationRow {
  id: string;
  companyId: string;
  userId: string | null;
  type: string;
  title: string;
  body: string | null;
  readAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly mode = (process.env.NOTIFICATIONS_MODE ?? 'dryrun').toLowerCase();

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly email: EmailService,
  ) {}

  get isLive(): boolean {
    return this.mode === 'live';
  }

  /**
   * Fire-and-forget notification for an appointment lifecycle event. Safe to
   * `void` from the caller — it handles its own errors.
   */
  async notifyAppointment(
    event: AppointmentEvent,
    companyId: string,
    appointmentId: string,
  ): Promise<void> {
    try {
      const appt = await this.prisma.client.appointment.findFirst({
        where: { id: appointmentId, companyId },
        include: {
          customer: true,
          professional: true,
          company: true,
          items: { include: { service: true } },
        },
      });
      if (!appt) return;

      const messages = composeAppointmentMessages(event, {
        companyName: appt.company.name,
        timezone: appt.company.timezone,
        customerName: appt.customer?.name ?? null,
        customerPhone: appt.customer?.phone ?? null,
        customerEmail: appt.customer?.email ?? null,
        professionalName: appt.professional?.name ?? null,
        serviceNames: appt.items.map((it) => it.service?.name).filter((n): n is string => !!n),
        start: appt.start,
        end: appt.end,
      });

      // Client channels — dryrun logs only; live would dispatch here.
      await this.dispatchClient(event, companyId, messages);

      // Studio channel — always an in-app notification (the panel bell).
      await this.prisma.client.notification.create({
        data: {
          companyId,
          type: `appointment.${event}`,
          title: messages.studio.title,
          body: messages.studio.body,
        },
      });

      // Client channel — when the customer has a registered account (club app),
      // create a user-targeted in-app notification so they see it in their feed.
      if (appt.customer?.userId) {
        await this.prisma.client.notification.create({
          data: {
            companyId,
            userId: appt.customer.userId,
            type: `appointment.${event}`,
            title: messages.client.title,
            body: messages.client.body,
          },
        });
      }
    } catch (err) {
      this.logger.error(
        `notifyAppointment(${event}, ${appointmentId}) failed: ${(err as Error).message}`,
      );
    }
  }

  /** Studio in-app notifications (the panel bell), newest first. */
  async listForCompany(
    companyId: string,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<{ data: NotificationRow[]; total: number; unreadCount: number }> {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const where = {
      companyId,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.client.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      this.prisma.client.notification.count({ where: { companyId } }),
      this.prisma.client.notification.count({ where: { companyId, readAt: null } }),
    ]);
    return { data, total, unreadCount };
  }

  async unreadCount(companyId: string): Promise<{ unreadCount: number }> {
    const unreadCount = await this.prisma.client.notification.count({
      where: { companyId, readAt: null },
    });
    return { unreadCount };
  }

  async markRead(companyId: string, id: string): Promise<{ ok: true }> {
    await this.prisma.client.notification.updateMany({
      where: { id, companyId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(companyId: string): Promise<{ ok: true }> {
    await this.prisma.client.notification.updateMany({
      where: { companyId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  private async dispatchClient(
    event: AppointmentEvent,
    companyId: string,
    messages: ReturnType<typeof composeAppointmentMessages>,
  ): Promise<void> {
    const tag = `[notify ${this.mode}] company=${companyId} event=${event}`;
    if (messages.clientWhatsapp) {
      this.logger.log(`${tag} WhatsApp -> ${messages.clientWhatsapp.to}: ${messages.clientWhatsapp.text}`);
      if (this.isLive) {
        await this.whatsapp.enqueueText(messages.clientWhatsapp.to, messages.clientWhatsapp.text);
      }
    }
    if (messages.clientEmail) {
      this.logger.log(`${tag} Email -> ${messages.clientEmail.to}: ${messages.clientEmail.subject}`);
      if (this.isLive) {
        await this.email.send({
          to: messages.clientEmail.to,
          subject: messages.clientEmail.subject,
          html: `<p>${messages.clientEmail.body.replace(/\n/g, '<br>')}</p>`,
        });
      }
    }
  }
}
