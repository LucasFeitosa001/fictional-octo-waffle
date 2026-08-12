import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppointmentStatus } from '@beautypass/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { NotificationSettingsService } from '../../notifications/notification-settings.service';
import { composeFollowUpMessage, followUpTemplateById } from '../follow-up.templates';
import { resolveBookingLink } from '../booking-link.helper';
import { FollowUpSenderService } from '../follow-up-sender.service';
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
    private readonly sender: FollowUpSenderService,
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
    // A lógica mora em FollowUpSenderService: o poller de fallback chama o mesmo
    // método, então idempotência, dedupe e composição são compartilhados. Aqui
    // fica só o que é do BullMQ — agendar a próxima recorrência. Ver estudo 84.
    const r = await this.sender.executarFollowUp(data);
    if (r.enviou && r.recorrenciaProxima !== null) {
      await this.queues.enqueueFollowUp(
        data.companyId,
        { appointmentId: data.appointmentId, orderId: data.orderId },
        { delayMs: r.intervaloMs, recurrence: r.recorrenciaProxima },
      );
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


  @OnWorkerEvent('failed')
  onFailed(job: Job<FollowUpJob>, err: Error): void {
    this.logger.error(
      `Follow-up job ${job?.id} falhou (tentativa ${job?.attemptsMade}): ${err?.message}`,
    );
  }
}
