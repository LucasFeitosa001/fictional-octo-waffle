import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppointmentStatus } from '@beautypass/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { NotificationSettingsService } from '../../notifications/notification-settings.service';
import { composeFollowUpMessage, followUpTemplateById } from '../follow-up.templates';
import { resolveBookingLink } from '../booking-link.helper';
import { QueuesService } from '../queues.service';
import {
  QUEUE_FOLLOW_UPS,
  JOB_APPOINTMENT_CUSTOM_FOLLOW_UP,
  type FollowUpJob,
  type AppointmentCustomFollowUpJob,
} from '../queue-names';
import {
  readMessagingMode,
  isOptedOut,
  dispatchWhatsapp,
} from '../messaging.helpers';

// Durable idempotency markers live in the generic Notification table (type +
// entityId), independent of BullMQ job retention:
//   - FOLLOW_UP_TYPE (entityId = order/appointment id): "this exact entity was
//     already followed up" — stops retries and re-fires of the same trigger.
//   - FOLLOW_UP_CUSTOMER_TYPE (entityId = customer id): "this customer got a
//     follow-up recently" — dedupes the same visit reaching us via BOTH the
//     appointment-done and the order-finish triggers (there is no appt↔order link
//     in the schema to correlate them directly).
const FOLLOW_UP_TYPE = 'automation.follow_up';
const FOLLOW_UP_CUSTOMER_TYPE = 'automation.follow_up.customer';
// Same-visit window: an appointment and its comanda close within this span.
const SAME_VISIT_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Post-service follow-up ("como foi seu atendimento? agende seu retorno").
 *
 * THIS IS THE PRIMARY FLOW: an appointment is concluded (done/finished) or an
 * order is closed (orders.finish) → a single delayed job (FOLLOWUP_DELAY_HOURS,
 * default 24h) is enqueued → this processor fires it and messages the customer.
 *
 * It resolves the customer + services from whichever id it was given (appointment
 * or order), re-reading fresh rows so a cancellation after enqueue is respected.
 *
 * IDEMPOTENCY: two Notification markers (see FOLLOW_UP_TYPE /
 * FOLLOW_UP_CUSTOMER_TYPE below) cover both a job retry/re-fire of the same
 * trigger AND the same visit arriving via both the appointment-done and the
 * order-finish triggers, so the client is messaged at most once per visit.
 *
 * MODE: dryrun/disabled → logs + marks; live+enabled → enqueues to the outbox.
 */
@Processor(QUEUE_FOLLOW_UPS)
export class FollowUpsProcessor extends WorkerHost {
  private readonly logger = new Logger(FollowUpsProcessor.name);
  private readonly mode = readMessagingMode();

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly settings: NotificationSettingsService,
    private readonly queues: QueuesService,
  ) {
    super();
  }

  async process(
    job: Job<FollowUpJob | AppointmentCustomFollowUpJob>,
  ): Promise<void> {
    // O aviso PERSONALIZADO do drawer roda na mesma fila, mas com job name e
    // payload próprios (mensagem/template + link embutidos). Desvia para o
    // handler dedicado — nenhuma idempotência por Notification/recorrência aqui.
    if (job.name === JOB_APPOINTMENT_CUSTOM_FOLLOW_UP) {
      await this.processCustom(job as Job<AppointmentCustomFollowUpJob>);
      return;
    }

    const data = job.data as FollowUpJob;
    const { companyId, appointmentId, orderId } = data;
    const recurrence = data.recurrence ?? 0;
    const entityId = orderId ?? appointmentId;
    if (!entityId) return;
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
      return;
    }

    const view = orderId
      ? await this.loadFromOrder(companyId, orderId)
      : await this.loadFromAppointment(companyId, appointmentId!);

    if (!view) {
      this.logger.debug(`${tag} origem não encontrada — ignorando.`);
      return;
    }
    if (view.skip) {
      this.logger.debug(`${tag} ${view.skipReason} — ignorando.`);
      return;
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
        return;
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
      return;
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

    // Recurrence: if enabled and we actually sent, schedule the NEXT follow-up
    // unless we've hit the cap. maxRecurrences counts total sends, so we compare
    // the NEXT index (recurrence + 1) against it. The next run re-checks rebooking
    // and opt-out, so it self-stops if the client comes back or opts out.
    if (sent && cfg.enabled && cfg.recurring) {
      const nextIndex = recurrence + 1;
      if (nextIndex < cfg.maxRecurrences) {
        // recurringSeconds is unit-normalized (seconds/minutes/hours/days) by the
        // settings service — use it directly so fast test intervals work.
        const delayMs = cfg.recurringSeconds * 1000;
        await this.queues.enqueueFollowUp(
          companyId,
          { appointmentId, orderId },
          { delayMs, recurrence: nextIndex },
        );
        this.logger.debug(
          `${tag} próxima recorrência r${nextIndex} agendada em ${cfg.recurringValue}${cfg.recurringUnit} (${cfg.recurringSeconds}s).`,
        );
      } else {
        this.logger.debug(`${tag} limite de recorrências (${cfg.maxRecurrences}) atingido.`);
      }
    }
  }

  /**
   * Handler do aviso PERSONALIZADO agendado no drawer ("Avisar o cliente").
   *
   * Diferente do follow-up global: a config (mensagem custom OU templateId +
   * incluir link) viaja no próprio job — não lê FollowUpSettings nem grava
   * marcadores de idempotência/recorrência. Ainda assim re-lê o agendamento
   * fresco (respeita cancelamento/exclusão pós-enfileiramento) e honra opt-out +
   * o modo de mensageria (dryrun só loga; live enfileira no outbox). NÃO checa a
   * automation.followUp: este aviso é uma ação explícita do atendente, não a
   * automação global.
   */
  private async processCustom(
    job: Job<AppointmentCustomFollowUpJob>,
  ): Promise<void> {
    const { companyId, appointmentId, cfg } = job.data;
    const tag = `[custom-follow-up ${this.mode.mode}] company=${companyId} appt=${appointmentId}`;

    const appt = await this.prisma.client.appointment.findFirst({
      where: { id: appointmentId, companyId },
      include: {
        customer: true,
        company: { select: { name: true } },
        items: { include: { service: true } },
      },
    });
    if (!appt) {
      this.logger.debug(`${tag} agendamento não encontrado — ignorando.`);
      return;
    }
    // Cancelado depois do enfileiramento → não avisa.
    if (appt.status === AppointmentStatus.canceled) {
      this.logger.debug(`${tag} agendamento cancelado — ignorando.`);
      return;
    }
    if (!appt.customer) {
      this.logger.debug(`${tag} agendamento sem cliente — ignorando.`);
      return;
    }

    // Mensagem: custom tem precedência; senão o texto do template escolhido;
    // vazio → composeFollowUpMessage cai no texto padrão.
    const custom = cfg.message?.trim();
    const template = custom || followUpTemplateById(cfg.templateId) || '';

    // Link só quando o atendente pediu e a empresa tem link ativo.
    const bookingLink = cfg.includeLink
      ? await resolveBookingLink(this.prisma, companyId)
      : null;

    const msg = composeFollowUpMessage({
      companyName: appt.company.name,
      customerName: appt.customer.name,
      customerPhone: appt.customer.phone,
      serviceNames: appt.items
        .map((it) => it.service?.name)
        .filter((n): n is string => !!n),
      template,
      bookingLink,
    });

    const optedOut = isOptedOut(appt.customer);
    if (!msg) {
      this.logger.debug(`${tag} sem telefone — ignorando.`);
      return;
    }
    if (optedOut) {
      this.logger.debug(`${tag} cliente opt-out — ignorando.`);
      return;
    }

    await dispatchWhatsapp(
      this.logger,
      this.whatsapp,
      this.mode,
      tag,
      msg.to,
      msg.text,
      // Interações: aviso personalizado ao cliente.
      { companyId, customerId: appt.customer.id, kind: 'followup' },
    );
  }

  /**
   * True if the customer created a NEW appointment after `since` (the visit that
   * triggered this follow-up). Used to stop chasing someone who already re-booked.
   * Compares against Appointment.createdAt so it counts bookings made after the
   * visit regardless of when they're scheduled for. `since` null → don't block.
   */
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

  @OnWorkerEvent('failed')
  onFailed(job: Job<FollowUpJob>, err: Error): void {
    this.logger.error(
      `Follow-up job ${job?.id} falhou (tentativa ${job?.attemptsMade}): ${err?.message}`,
    );
  }
}
