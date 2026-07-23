import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AppointmentEvent,
  composeAppointmentMessages,
} from './notifications.templates';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { NotificationSettingsService } from './notification-settings.service';

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
  entityId: string | null;
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
    private readonly settings: NotificationSettingsService,
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
      // SECOND LOCK (per-company toggles): the owner can silence automatic
      // client messages by type. created/confirmed → `confirmation`,
      // canceled → `cancellation`. Default has both OFF (only follow-up on),
      // so out of the box the client is NOT spammed on booking/cancel.
      // The studio bell + club-app notification below are NOT gated here.
      const auto = await this.settings.get(companyId);
      const clientAllowed =
        event === 'canceled' ? auto.cancellation : auto.confirmation;
      if (clientAllowed) {
        await this.dispatchClient(event, companyId, messages, appt.customer?.id ?? undefined);
      } else {
        this.logger.debug(
          `[notify ${this.mode}] company=${companyId} event=${event} — envio ao cliente desativado na config, pulando dispatchClient.`,
        );
      }

      // Studio channel — always an in-app notification (the panel bell).
      // `entityId = appointmentId` habilita o deep-link do sino → drawer do
      // agendamento (o clique navega para /agenda?appointmentId=<id>).
      await this.prisma.client.notification.create({
        data: {
          companyId,
          type: `appointment.${event}`,
          title: messages.studio.title,
          body: messages.studio.body,
          entityId: appointmentId,
        },
      });

      // Studio owners que tem notifyEmail=true recebem por e-mail também.
      // Silent quando RESEND_API_KEY ausente (EmailService.send loga warning
      // e retorna sem falhar) — permite ativar depois só setando a chave.
      await this.dispatchStudioEmail(companyId, {
        subject: messages.studio.title,
        body: messages.studio.body,
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
            entityId: appointmentId,
          },
        });
      }
    } catch (err) {
      this.logger.error(
        `notifyAppointment(${event}, ${appointmentId}) failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Studio in-app notifications (the panel bell), newest first.
   *
   * `types` filtra por tipo exato (ex.: `appointment.canceled`) — usado pelas
   * páginas de categoria, que passam a lista de tipos daquela categoria.
   * `offset` habilita a paginação real ("Mostrar mais"). `total`/`unreadCount`
   * respeitam o filtro `types` (quando presente) para que a página de detalhe
   * mostre a contagem correta da categoria, não a global.
   */
  async listForCompany(
    companyId: string,
    opts: { unreadOnly?: boolean; limit?: number; offset?: number; types?: string[] } = {},
  ): Promise<{ data: NotificationRow[]; total: number; unreadCount: number }> {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
    const offset = Math.max(opts.offset ?? 0, 0);
    const typeFilter =
      opts.types && opts.types.length > 0 ? { type: { in: opts.types } } : {};
    const where = {
      companyId,
      ...typeFilter,
      ...(opts.unreadOnly ? { readAt: null } : {}),
    };
    const countWhere = { companyId, ...typeFilter };
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.client.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.client.notification.count({ where: countWhere }),
      this.prisma.client.notification.count({ where: { ...countWhere, readAt: null } }),
    ]);
    return { data, total, unreadCount };
  }

  /**
   * Contagem por tipo (total e não-lidas). Alimenta a página de categorias
   * (NotificacoesCategoriasPage) com números REAIS, sem precisar puxar a lista
   * inteira no front. Retorna só os tipos que de fato têm registro.
   */
  async summaryByType(
    companyId: string,
  ): Promise<{ types: { type: string; total: number; unread: number }[] }> {
    const [totals, unreads] = await Promise.all([
      this.prisma.client.notification.groupBy({
        by: ['type'],
        where: { companyId },
        _count: { _all: true },
      }),
      this.prisma.client.notification.groupBy({
        by: ['type'],
        where: { companyId, readAt: null },
        _count: { _all: true },
      }),
    ]);
    const unreadMap = new Map(unreads.map((u) => [u.type, u._count._all]));
    const types = totals.map((t) => ({
      type: t.type,
      total: t._count._all,
      unread: unreadMap.get(t.type) ?? 0,
    }));
    return { types };
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

  /**
   * Marca todas como lidas. Se `types` vier preenchido, marca só as daquela
   * categoria (usado pelo "marcar todas como lidas" da página de detalhe);
   * sem `types`, marca todas da empresa (usado pelo sino).
   */
  async markAllRead(companyId: string, types?: string[]): Promise<{ ok: true }> {
    const typeFilter = types && types.length > 0 ? { type: { in: types } } : {};
    await this.prisma.client.notification.updateMany({
      where: { companyId, readAt: null, ...typeFilter },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  /**
   * Envia o mesmo aviso do "studio bell" por e-mail para cada usuário da
   * empresa que ativou `notifyEmail` no drawer Minha conta. Silent-fail se
   * RESEND_API_KEY não estiver configurada — o EmailService loga um warning
   * mas não estoura, então o notifyAppointment segue funcionando in-app.
   */
  private async dispatchStudioEmail(
    companyId: string,
    msg: { subject: string; body: string },
  ): Promise<void> {
    try {
      const recipients = await this.prisma.client.user.findMany({
        where: { companyId, notifyEmail: true, email: { not: '' } },
        select: { email: true },
      });
      if (recipients.length === 0) return;
      const html = `<p>${msg.body.replace(/\n/g, '<br>')}</p>`;
      await Promise.all(
        recipients
          .filter((r): r is { email: string } => Boolean(r.email))
          .map((r) => this.email.send({ to: r.email, subject: msg.subject, html })),
      );
    } catch (err) {
      this.logger.warn(
        `dispatchStudioEmail(company=${companyId}) falhou: ${(err as Error).message}`,
      );
    }
  }

  private async dispatchClient(
    event: AppointmentEvent,
    companyId: string,
    messages: ReturnType<typeof composeAppointmentMessages>,
    customerId?: string,
  ): Promise<void> {
    const tag = `[notify ${this.mode}] company=${companyId} event=${event}`;
    // Interações: mapeia o evento do agendamento para o tipo de mensagem.
    // canceled → cancellation; created/confirmed → confirmation.
    const kind = event === 'canceled' ? 'cancellation' : 'confirmation';
    if (messages.clientWhatsapp) {
      this.logger.log(`${tag} WhatsApp -> ${messages.clientWhatsapp.to}: ${messages.clientWhatsapp.text}`);
      if (this.isLive) {
        await this.whatsapp.enqueueText(messages.clientWhatsapp.to, messages.clientWhatsapp.text, {
          companyId,
          customerId,
          kind,
        });
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
