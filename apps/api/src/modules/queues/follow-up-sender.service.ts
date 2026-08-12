import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import {
  composeFollowUpMessage,
  followUpTemplateById,
  FOLLOWUP_TEMPLATES,
} from './follow-up.templates';
import { resolveBookingLink } from './booking-link.helper';
import { type FollowUpJob } from './queue-names';
import { readMessagingMode, isOptedOut, dispatchWhatsapp } from './messaging.helpers';

// Marcadores duráveis de idempotência, na tabela genérica Notification. Mesmos
// nomes usados pelo processador da fila — as duas portas precisam enxergar o
// mesmo marcador, senão a mensagem sairia duas vezes.
const FOLLOW_UP_TYPE = 'automation.follow_up';
const FOLLOW_UP_CUSTOMER_TYPE = 'automation.follow_up.customer';
// Janela da mesma visita: o agendamento e a comanda fecham dentro deste intervalo.
const SAME_VISIT_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Modelos prontos oferecidos na tela. */
export const MODELOS_DE_ACOMPANHAMENTO = FOLLOWUP_TEMPLATES;

export interface ResultadoFollowUp {
  enviou: boolean;
  /** Índice da próxima repetição, ou null quando não cabe mais nenhuma. */
  recorrenciaProxima: number | null;
  intervaloMs: number;
}

const NAO_ENVIOU: ResultadoFollowUp = {
  enviou: false,
  recorrenciaProxima: null,
  intervaloMs: 0,
};

/**
 * O acompanhamento pós-atendimento, separado do BullMQ.
 *
 * Vive aqui porque em produção `QUEUES_ENABLED=false`: o processador da fila
 * nunca roda e o acompanhamento simplesmente não existia — ZERO envios em toda
 * a história, com a tela de configuração funcionando normalmente. Agora as duas
 * portas (worker da fila e poller de fallback) chamam este mesmo serviço, então
 * compartilham a idempotência por marcador, o dedupe entre agendamento e
 * comanda, a regra de parar quando o cliente já reagendou e a composição do
 * texto. Ver estudo 84.
 *
 * NÃO agenda a próxima recorrência: quem chamou decide como (o worker via
 * BullMQ, o poller derivando do marcador anterior).
 */
@Injectable()
export class FollowUpSenderService {
  private readonly logger = new Logger(FollowUpSenderService.name);
  private readonly mode = readMessagingMode();

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly settings: NotificationSettingsService,
  ) {}

  async executarFollowUp(data: FollowUpJob): Promise<ResultadoFollowUp> {
    const { companyId, appointmentId, orderId } = data;
    const recurrence = data.recurrence ?? 0;
    const entityId = orderId ?? appointmentId;
    if (!entityId) return NAO_ENVIOU;
    // Per-recurrence marker id so the 2nd/3rd sends aren't blocked by the 1st's
    // marker (idempotency #1 keys on this composite).
    const markerEntityId = recurrence > 0 ? `${entityId}:r${recurrence}` : entityId;
    const tag = `[follow-up ${this.mode.mode}] company=${companyId} entity=${entityId} r=${recurrence}`;

    // Durable idempotency #1: already followed up for THIS exact entity+recurrence? stop.
    const already = await this.prisma.client.notification.findFirst({
      where: { companyId, type: FOLLOW_UP_TYPE, entityId: markerEntityId },
      select: { id: true },
    });
    if (already) {
      this.logger.debug(`${tag} follow-up já enviado para esta entidade — ignorando.`);
      return NAO_ENVIOU;
    }

    const view = orderId
      ? await this.loadFromOrder(companyId, orderId)
      : await this.loadFromAppointment(companyId, appointmentId!);

    if (!view) {
      this.logger.debug(`${tag} origem não encontrada — ignorando.`);
      return NAO_ENVIOU;
    }
    if (view.skip) {
      this.logger.debug(`${tag} ${view.skipReason} — ignorando.`);
      return NAO_ENVIOU;
    }

    // Durable idempotency #2 (same-visit dedupe): the appointment-done and the
    // order-finish triggers can both fire for one visit. Skip if this customer got
    // a follow-up within SAME_VISIT_WINDOW_MS. Keyed on a dedicated per-customer
    // marker (entityId = customerId) so no User FK is involved. Only guards the
    // FIRST send — later recurrences are intentional repeats.
    if (recurrence === 0 && view.customerId) {
      const recent = await this.prisma.client.notification.findFirst({
        where: {
          companyId,
          type: FOLLOW_UP_CUSTOMER_TYPE,
          entityId: view.customerId,
          createdAt: { gte: new Date(Date.now() - SAME_VISIT_WINDOW_MS) },
        },
        select: { id: true },
      });
      if (recent) {
        this.logger.debug(`${tag} cliente já recebeu follow-up recente — ignorando.`);
        // Still record the entity marker so this exact job isn't retried forever.
        await this.writeMarker(companyId, markerEntityId, view, null, false);
        return NAO_ENVIOU;
      }
    }

    // Rich per-company follow-up config: template text, recurrence, booking link.
    // `enabled` mirrors automation.followUp (kept in sync by the settings service).
    const cfg = await this.settings.getFollowUp(companyId);

    // If the customer already booked again AFTER this visit, stop chasing them —
    // they've come back, so nothing (not even the first follow-up) should fire.
    if (view.customerId && (await this.hasRebookedSince(companyId, view.customerId, view.since))) {
      this.logger.debug(`${tag} cliente já reagendou após a visita — encerrando follow-up.`);
      await this.writeMarker(companyId, markerEntityId, view, null, false);
      return NAO_ENVIOU;
    }

    // Resolve the public re-booking link only when the owner wants it attached and
    // the company actually has an active booking link; otherwise {link} is omitted.
    const bookingLink = cfg.includeBookingLink
      ? await resolveBookingLink(this.prisma, companyId)
      : null;

    const msg = composeFollowUpMessage({
      companyName: view.companyName,
      customerName: view.customerName,
      customerPhone: view.customerPhone,
      serviceNames: view.serviceNames,
      template: cfg.message,
      bookingLink,
    });

    const optedOut = isOptedOut(view.optOut);

    let sent = false;
    if (msg && !optedOut && cfg.enabled) {
      sent = await dispatchWhatsapp(
        this.logger,
        this.whatsapp,
        this.mode,
        tag,
        msg.to,
        msg.text,
        // Interações: follow-up ao cliente.
        { companyId, customerId: view.customerId ?? undefined, kind: 'followup' },
      );
    } else {
      const why = !cfg.enabled
        ? 'follow-up desativado na config'
        : !msg
          ? 'sem telefone'
          : 'opt-out';
      this.logger.debug(`${tag} sem envio (${why}), apenas marcado.`);
    }

    await this.writeMarker(companyId, markerEntityId, view, msg?.text ?? null, sent);

    // Quem chamou decide COMO agendar a próxima: o worker usa BullMQ, o poller
    // deriva do marcador. Aqui só se informa se cabe uma e com que intervalo.
    const proxima = recurrence + 1;
    const cabeMais = sent && cfg.enabled && cfg.recurring && proxima < cfg.maxRecurrences;
    return {
      enviou: sent,
      recorrenciaProxima: cabeMais ? proxima : null,
      // `recurringSeconds` já vem normalizado pela config (segundos/minutos/
      // horas/dias), então intervalos curtos de teste funcionam.
      intervaloMs: cfg.recurringSeconds * 1000,
    };
  }

  /**
   * True if the customer created a NEW appointment after `since` (the visit that
   * triggered this follow-up). Used to stop chasing someone who already re-booked.
   * Compares against Appointment.createdAt so it counts bookings made after the
   * visit regardless of when they're scheduled for. `since` null → don't block.
   */
  /**
   * Envio MANUAL do acompanhamento, pedido por uma pessoa no visualizador do
   * agendamento. Ver estudo 84.
   *
   * Difere da automação de propósito:
   *  - não olha `cfg.enabled` — quem clicou está autorizando este envio;
   *  - não olha os marcadores de idempotência nem a regra de "já reagendou";
   *    são travas para não PERSEGUIR o cliente sozinho, e aqui é decisão humana,
   *    inclusive para reenviar depois de já ter mandado;
   *  - vai com `authorized: true`, então entra na fila mesmo com o canal fechado
   *    (a pessoa está olhando a tela e vê o estado).
   *
   * O que continua valendo: opt-out do cliente, telefone válido e o texto é o
   * MESMO da automação, montado aqui para não divergir.
   */
  async enviarManual(
    companyId: string,
    appointmentId: string,
    requestKey?: string,
    escolha?: { templateId?: string; message?: string },
  ): Promise<{ ok: true; texto: string }> {
    const view = await this.loadFromAppointment(companyId, appointmentId);
    if (!view) throw new NotFoundException('Agendamento não encontrado.');
    if (view.skip) throw new BadRequestException('Este agendamento não tem cliente.');
    if (isOptedOut(view.optOut)) {
      throw new BadRequestException(
        'A cliente optou por não receber mensagens no WhatsApp.',
      );
    }

    const cfg = await this.settings.getFollowUp(companyId);
    const bookingLink = cfg.includeBookingLink
      ? await resolveBookingLink(this.prisma, companyId)
      : null;
    const msg = composeFollowUpMessage({
      companyName: view.companyName,
      customerName: view.customerName,
      customerPhone: view.customerPhone,
      serviceNames: view.serviceNames,
      // Precedência: o que a pessoa escreveu > o modelo que ela escolheu > o
      // texto da config da empresa. Igual ao envio manual de confirmação.
      template:
        escolha?.message?.trim() ||
        followUpTemplateById(escolha?.templateId) ||
        cfg.message,
      bookingLink,
    });
    if (!msg) {
      throw new BadRequestException(
        'Cadastre um telefone para a cliente antes de enviar o acompanhamento.',
      );
    }

    const fila = await this.whatsapp.enqueueText(msg.to, msg.text, {
      companyId,
      customerId: view.customerId ?? undefined,
      appointmentId,
      kind: 'followup',
      requestKey,
      authorized: true,
    });
    if (!fila) {
      throw new BadRequestException(
        'O telefone da cliente é inválido para envio no WhatsApp.',
      );
    }
    return { ok: true, texto: msg.text };
  }

  /**
   * O texto que sairia, SEM enviar — alimenta a prévia do drawer. Ver estudo 86.
   *
   * Devolve `null` (em vez de lançar) quando não há cliente ou telefone: a tela
   * precisa poder abrir e explicar o motivo, não quebrar.
   */
  async previaManual(
    companyId: string,
    appointmentId: string,
    escolha?: { templateId?: string; message?: string },
  ): Promise<string | null> {
    const view = await this.loadFromAppointment(companyId, appointmentId);
    if (!view || view.skip) return null;
    const cfg = await this.settings.getFollowUp(companyId);
    const bookingLink = cfg.includeBookingLink
      ? await resolveBookingLink(this.prisma, companyId)
      : null;
    const msg = composeFollowUpMessage({
      companyName: view.companyName,
      customerName: view.customerName,
      customerPhone: view.customerPhone,
      serviceNames: view.serviceNames,
      template:
        escolha?.message?.trim() ||
        followUpTemplateById(escolha?.templateId) ||
        cfg.message,
      bookingLink,
    });
    return msg?.text ?? null;
  }

  private async hasRebookedSince(
    companyId: string,
    customerId: string,
    since: Date | null,
  ): Promise<boolean> {
    if (!since) return false;
    const later = await this.prisma.client.appointment.findFirst({
      where: {
        companyId,
        customerId,
        createdAt: { gt: since },
        status: { not: 'canceled' },
      },
      select: { id: true },
    });
    return !!later;
  }

  /**
   * Writes the durable follow-up markers:
   *   - the per-entity marker (entityId = order/appt id) — always, so this exact
   *     job is never retried/re-fired;
   *   - the per-customer marker (entityId = customerId) — only when a real send
   *     happened, so the same-visit dedupe window (#2) is armed without blocking
   *     legitimately-skipped visits (no phone / opt-out) forever.
   * `entityId` holds ids only (never a User FK), so no referential constraint is
   * touched. Fail-soft: a send already happened, so a marker write failure must
   * not fail the job (which would retry and re-send).
   */
  private async writeMarker(
    companyId: string,
    entityId: string,
    view: { customerId: string | null; customerName: string | null },
    text: string | null,
    sent: boolean,
  ): Promise<void> {
    await this.prisma.client.notification
      .create({
        data: {
          companyId,
          type: FOLLOW_UP_TYPE,
          title: `Follow-up ${sent ? 'enviado' : 'avaliado'}: ${view.customerName ?? 'cliente'}`,
          body: text ?? 'Sem telefone/opt-out — não enviado.',
          entityId,
        },
      })
      .catch((err) =>
        this.logger.warn(`follow-up marker (${entityId}) falhou: ${(err as Error).message}`),
      );

    if (sent && view.customerId) {
      await this.prisma.client.notification
        .create({
          data: {
            companyId,
            type: FOLLOW_UP_CUSTOMER_TYPE,
            title: `Follow-up enviado ao cliente`,
            entityId: view.customerId,
          },
        })
        .catch((err) =>
          this.logger.warn(
            `follow-up customer marker (${view.customerId}) falhou: ${(err as Error).message}`,
          ),
        );
    }
  }

  /**
   * Resolves the follow-up view from a closed order. Only messages when the order
   * is actually finished and has a customer; the service names come from the
   * order's service items (best-effort — falls back to a generic phrasing).
   */
  private async loadFromOrder(companyId: string, orderId: string) {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, companyId },
      include: {
        customer: true,
        company: { select: { name: true } },
        items: true,
      },
    });
    if (!order) return null;
    if (order.status !== 'finished') {
      return { skip: true as const, skipReason: `order status=${order.status}` };
    }
    if (!order.customer) {
      return { skip: true as const, skipReason: 'order sem cliente' };
    }

    // Resolve service names for the order's service items (nice-to-have).
    const serviceIds = order.items
      .filter((it) => it.kind === 'service')
      .map((it) => it.refId);
    const services = serviceIds.length
      ? await this.prisma.client.service.findMany({
          where: { id: { in: serviceIds } },
          select: { name: true },
        })
      : [];

    return {
      skip: false as const,
      customerId: order.customer.id,
      companyName: order.company.name,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      serviceNames: services.map((s) => s.name),
      optOut: order.customer,
      // Reference point for the "already re-booked?" check.
      since: order.createdAt,
    };
  }

  /** Resolves the follow-up view from a concluded appointment. */
  private async loadFromAppointment(companyId: string, appointmentId: string) {
    const appt = await this.prisma.client.appointment.findFirst({
      where: { id: appointmentId, companyId },
      include: {
        customer: true,
        company: { select: { name: true } },
        items: { include: { service: true } },
      },
    });
    if (!appt) return null;
    if (!appt.customer) {
      return { skip: true as const, skipReason: 'agendamento sem cliente' };
    }
    return {
      skip: false as const,
      customerId: appt.customer.id,
      companyName: appt.company.name,
      customerName: appt.customer.name,
      customerPhone: appt.customer.phone,
      serviceNames: appt.items
        .map((it) => it.service?.name)
        .filter((n): n is string => !!n),
      optOut: appt.customer,
      // The visit time — a re-booking made later (createdAt > start) means the
      // client already came back, so we stop chasing them.
      since: appt.start,
    };
  }
}
