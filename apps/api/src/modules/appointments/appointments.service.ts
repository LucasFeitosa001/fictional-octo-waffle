import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, AppointmentStatus, AppointmentSource } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateAppointmentDto,
  CreateAppointmentSeriesDto,
  UpdateAppointmentDto,
  StatusDto,
  SendAppointmentConfirmationDto,
} from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import { AppointmentEvent } from '../notifications/notifications.templates';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { QueuesService } from '../queues/queues.service';
import { FollowUpSenderService } from '../queues/follow-up-sender.service';
import {
  CONFIRMATION_TEMPLATE_VARIABLES,
  confirmationTemplateVariables,
  renderConfirmationTemplate,
  unresolvedConfirmationVariables,
} from '../notifications/confirmation.templates';

// Slot generation granularity (minutes) for the availability grid.
const SLOT_STEP_MIN = 15;

/**
 * Um horário da grade. `busy` só vem preenchido quando o chamador pediu
 * `includeBusy` ("Encaixar agendamento"): aí o horário OCUPADO volta na lista,
 * mas marcado — a recepção precisa ver que está marcando em cima de alguém.
 */
type Slot = { start: string; end: string; busy?: boolean };
// Default duration (minutes) when no service is provided.
const DEFAULT_DURATION_MIN = 30;

// Statuses that still occupy the professional's agenda (block overlaps).
// Everything except `canceled`.
const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.scheduled,
  AppointmentStatus.confirmed,
  AppointmentStatus.unconfirmed,
  AppointmentStatus.waiting,
  AppointmentStatus.in_progress,
  AppointmentStatus.done,
  AppointmentStatus.finished,
];

// Statuses that COMMIT the slot (exclude `unconfirmed`, which is só um pedido
// provisório de agendamento online). Usado ao CONFIRMAR: um `unconfirmed` irmão
// no mesmo horário não pode barrar a confirmação — quem confirma primeiro fica
// com o slot (aí ele vira `confirmed` e passa a bloquear os demais). Evita que
// dois pedidos online no mesmo horário travem o auto-confirm mutuamente.
const COMMITTED_STATUSES: AppointmentStatus[] = ACTIVE_STATUSES.filter(
  (s) => s !== AppointmentStatus.unconfirmed,
);

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsappService,
    private readonly email: EmailService,
    private readonly queues: QueuesService,
    private readonly settings: NotificationSettingsService,
    private readonly followUpSender: FollowUpSenderService,
  ) {}

  async list(
    companyId: string,
    filters: {
      from?: string;
      to?: string;
      professionalId?: string;
      status?: string;
      serviceId?: string;
      q?: string;
    },
    scopeProfessionalId?: string,
  ) {
    const where: Prisma.AppointmentWhereInput = { companyId };

    // professionalId + status accept a single id OR a comma-separated list, so
    // the agenda can filter by several professionals/statuses at once.
    const professionalIds = scopeProfessionalId
      ? [scopeProfessionalId]
      : this.splitCsv(filters.professionalId);
    if (professionalIds.length === 1) where.professionalId = professionalIds[0];
    else if (professionalIds.length > 1) where.professionalId = { in: professionalIds };

    const statuses = this.splitCsv(filters.status) as AppointmentStatus[];
    if (statuses.length === 1) where.status = statuses[0];
    else if (statuses.length > 1) where.status = { in: statuses };

    if (filters.from || filters.to) {
      where.start = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    // Filter by an appointment that includes a given service.
    if (filters.serviceId) {
      where.items = { some: { serviceId: filters.serviceId } };
    }

    // Free-text search by customer name.
    const q = filters.q?.trim();
    if (q) {
      where.customer = { is: { name: { contains: q, mode: 'insensitive' } } };
    }

    const data = await this.prisma.client.appointment.findMany({
      where,
      include: {
        customer: true,
        professional: true,
        items: true,
        // Comanda já gerada por este agendamento. É o que permite a tela
        // dizer "Acessar comanda #N" em vez de oferecer "acessar" o que não
        // existe. Ver estudo 52.
        order: { select: { id: true, number: true, status: true } },
      },
      orderBy: { start: 'asc' },
    });
    return { data, page: 1, pageSize: data.length, total: data.length };
  }

  // GET /appointments/calendar?month — counters per day (stub aggregation).
  async calendar(
    companyId: string,
    month?: string,
    scopeProfessionalId?: string,
  ) {
    const ref = month ? new Date(`${month}-01T00:00:00`) : new Date();
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const appts = await this.prisma.client.appointment.findMany({
      where: {
        companyId,
        start: { gte: start, lt: end },
        ...(scopeProfessionalId
          ? { professionalId: scopeProfessionalId }
          : {}),
      },
      select: { start: true, status: true },
    });
    const counts: Record<string, number> = {};
    for (const a of appts) {
      const day = a.start.toISOString().slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;
    }
    return { month: start.toISOString().slice(0, 7), counts };
  }

  async findOne(
    companyId: string,
    id: string,
    scopeProfessionalId?: string,
  ) {
    const found = await this.prisma.client.appointment.findFirst({
      where: {
        id,
        companyId,
        ...(scopeProfessionalId
          ? { professionalId: scopeProfessionalId }
          : {}),
      },
      include: {
        items: true,
        statusHistory: true,
        order: { select: { id: true, number: true, status: true } },
        // Cliente e profissional: sem eles o deep-link do sino
        // (/agenda?appointmentId=…) abria o drawer com "Sem cliente" e "Sem
        // telefone" num agendamento que TEM cliente. Ver estudo 59.
        customer: true,
        professional: true,
      },
    });
    if (!found) throw new NotFoundException('Agendamento não encontrado');
    return found;
  }

  /**
   * Dados do drawer de confirmação: autorização efetiva, modelos, preview e
   * histórico com ACK real do WhatsApp. Tudo escopado por company/profissional.
   */
  async confirmationSetup(
    companyId: string,
    id: string,
    scopeProfessionalId?: string,
  ) {
    const appointment = await this.loadConfirmationAppointment(
      companyId,
      id,
      scopeProfessionalId,
    );
    const [automation, templateSettings, logs] = await Promise.all([
      this.settings.get(companyId),
      this.settings.getConfirmationTemplates(companyId),
      this.confirmationLogs(companyId, id),
    ]);
    const variables = confirmationTemplateVariables({
      companyName: appointment.company.name,
      timezone: appointment.company.timezone,
      customerName: appointment.customer?.name ?? null,
      professionalName: appointment.professional?.name ?? null,
      serviceNames: appointment.items.map((item) => item.service.name),
      start: appointment.start,
    });
    const selectedTemplate =
      templateSettings.templates.find(
        (template) => template.id === templateSettings.defaultTemplateId,
      ) ?? templateSettings.templates[0];
    return {
      authorization: {
        companyDefault: automation.confirmation,
        appointment: appointment.notifyConfirmation,
        allowed:
          appointment.notifyConfirmation ?? automation.confirmation,
      },
      recipient: {
        customerId: appointment.customerId,
        name: appointment.customer?.name ?? null,
        phone: appointment.customer?.phone ?? null,
        notificationsEnabled:
          appointment.customer?.notificationsEnabled ?? null,
        whatsappOptIn: appointment.customer?.whatsappOptIn ?? null,
      },
      variables,
      ...templateSettings,
      preview: selectedTemplate
        ? renderConfirmationTemplate(selectedTemplate.message, variables)
        : '',
      logs,
    };
  }

  /**
   * Enfileira UMA confirmação explicitamente autorizada. O requestKey torna
   * retries idempotentes; uma confirmação anterior exige confirmação adicional
   * de reenvio e uma linha ainda pendente nunca é duplicada.
   */
  async sendConfirmation(
    companyId: string,
    id: string,
    dto: SendAppointmentConfirmationDto,
    scopeProfessionalId?: string,
  ) {
    // Valida tenant e escopo profissional antes até mesmo de responder a um
    // retry idempotente. A requestKey é opaca, mas nunca deve contornar acesso.
    const appointment = await this.loadConfirmationAppointment(
      companyId,
      id,
      scopeProfessionalId,
    );
    const priorRequest =
      await this.prisma.client.whatsappOutbox.findUnique({
        where: {
          companyId_requestKey: {
            companyId,
            requestKey: dto.requestKey,
          },
        },
        select: { id: true, appointmentId: true, status: true },
      });
    if (priorRequest) {
      if (priorRequest.appointmentId !== id) {
        throw new ConflictException(
          'Esta chave de envio já foi usada em outro agendamento.',
        );
      }
      return {
        id: priorRequest.id,
        status: priorRequest.status,
        deduplicated: true,
      };
    }

    const customer = appointment.customer;
    if (!customer?.phone?.trim()) {
      throw new BadRequestException(
        'Cadastre um telefone para a cliente antes de enviar a confirmação.',
      );
    }
    if (
      customer.notificationsEnabled === false ||
      customer.whatsappOptIn === false
    ) {
      throw new BadRequestException(
        'A cliente optou por não receber mensagens no WhatsApp.',
      );
    }

    const templateSettings =
      await this.settings.getConfirmationTemplates(companyId);
    const templateId =
      dto.templateId?.trim() || templateSettings.defaultTemplateId;
    const selectedTemplate = templateSettings.templates.find(
      (template) => template.id === templateId,
    );
    if (!selectedTemplate && !dto.message?.trim()) {
      throw new BadRequestException('Selecione um modelo de confirmação válido.');
    }
    const source = dto.message?.trim() || selectedTemplate?.message || '';
    if (!source) {
      throw new BadRequestException('Escreva a mensagem de confirmação.');
    }
    const allowedVariables = new Set<string>(CONFIRMATION_TEMPLATE_VARIABLES);
    const unknownVariables = unresolvedConfirmationVariables(source).filter(
      (variable) => !allowedVariables.has(variable),
    );
    if (unknownVariables.length > 0) {
      throw new BadRequestException(
        `Variável não reconhecida na mensagem: {${unknownVariables[0]}}.`,
      );
    }
    const variables = confirmationTemplateVariables({
      companyName: appointment.company.name,
      timezone: appointment.company.timezone,
      customerName: customer.name,
      professionalName: appointment.professional?.name ?? null,
      serviceNames: appointment.items.map((item) => item.service.name),
      start: appointment.start,
    });
    const message = renderConfirmationTemplate(source, variables);
    if (!message || message.length > 2_000) {
      throw new BadRequestException(
        'A mensagem final deve ter entre 1 e 2000 caracteres.',
      );
    }

    const previous =
      await this.prisma.client.whatsappOutbox.findFirst({
        where: {
          companyId,
          appointmentId: id,
          kind: 'confirmation',
          text: message,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          inboxMessage: { select: { status: true } },
        },
      });
    const previousStatus =
      previous?.inboxMessage?.status ?? previous?.status ?? null;
    if (previousStatus === 'pending') {
      throw new ConflictException(
        'Esta confirmação já está na fila. Aguarde o envio antes de tentar novamente.',
      );
    }
    if (
      previous &&
      ['sent', 'delivered', 'read'].includes(previousStatus ?? '') &&
      dto.allowResend !== true
    ) {
      throw new ConflictException(
        'Esta confirmação já foi enviada. Confirme o reenvio somente se a cliente solicitar.',
      );
    }

    // A ação autenticada + authorize=true fixa a autorização específica do
    // agendamento. Isso não altera o default da empresa nem outras mensagens.
    if (appointment.notifyConfirmation !== true) {
      await this.prisma.client.appointment.update({
        where: { id },
        data: { notifyConfirmation: true },
      });
    }

    const queued = await this.whatsapp.enqueueText(customer.phone, message, {
      companyId,
      customerId: appointment.customerId ?? undefined,
      appointmentId: id,
      kind: 'confirmation',
      requestKey: dto.requestKey,
      // Uma PESSOA clicou "Enviar confirmação" para ESTE agendamento: a linha
      // nasce autorizada e não passa pela revalidação de automação na entrega
      // (estudo 60).
      authorized: true,
    });
    if (!queued) {
      throw new BadRequestException(
        'O telefone da cliente é inválido para envio no WhatsApp.',
      );
    }
    return queued;
  }

  /**
   * Reenvia, por decisão de uma PESSOA, um aviso que não saiu.
   *
   * Existe por causa do estudo 82: a trava 1 recusa automação com o WhatsApp
   * desconectado (e faz bem — é o que impede a rajada no reconnect), mas até
   * então a recusa sumia e não havia como recuperar o aviso depois que a
   * conexão voltava. Reenviar é MANUAL de propósito: automático no reconnect é
   * exatamente o incidente que a trava previne.
   */
  async reenviarMensagem(
    companyId: string,
    appointmentId: string,
    messageId: string,
    requestKey: string | undefined,
    scopeProfessionalId?: string,
  ) {
    const appointment = await this.loadConfirmationAppointment(
      companyId,
      appointmentId,
      scopeProfessionalId,
    );
    const linha = await this.prisma.client.whatsappOutbox.findFirst({
      // companyId e appointmentId no WHERE, não só o id: o id sozinho deixaria
      // reenviar mensagem de outro salão passando o identificador certo.
      where: { id: messageId, companyId, appointmentId },
      select: { id: true, text: true, kind: true, toPhone: true, status: true },
    });
    if (!linha) {
      throw new NotFoundException('Mensagem não encontrada neste agendamento.');
    }
    if (!['failed', 'expired'].includes(linha.status)) {
      throw new ConflictException(
        linha.status === 'pending'
          ? 'Esta mensagem ainda está na fila. Aguarde o envio.'
          : 'Esta mensagem já foi enviada.',
      );
    }
    const customer = appointment.customer;
    if (
      customer?.notificationsEnabled === false ||
      customer?.whatsappOptIn === false
    ) {
      throw new BadRequestException(
        'A cliente optou por não receber mensagens no WhatsApp.',
      );
    }

    const queued = await this.whatsapp.enqueueText(linha.toPhone, linha.text, {
      companyId,
      customerId: appointment.customerId ?? undefined,
      appointmentId,
      kind: linha.kind ?? undefined,
      requestKey,
      // Uma pessoa clicou "Reenviar": isenta da trava 1 e da revalidação de
      // automação na entrega, igual ao "Enviar confirmação" (estudo 60).
      authorized: true,
    });
    if (!queued) {
      throw new BadRequestException(
        'Não foi possível reenviar: o telefone da cliente é inválido para o WhatsApp.',
      );
    }
    return queued;
  }

  /**
   * "Enviar acompanhamento agora" no visualizador do agendamento. O dono pediu
   * poder mandar mesmo depois de finalizado, sem esperar o prazo. Estudo 84.
   *
   * O escopo do profissional é checado ANTES de tocar no envio — sem isto,
   * alguém com agenda restrita mandaria mensagem de agendamento alheio.
   */
  async enviarAcompanhamento(
    companyId: string,
    id: string,
    requestKey: string | undefined,
    scopeProfessionalId?: string,
  ) {
    await this.loadConfirmationAppointment(companyId, id, scopeProfessionalId);
    return this.followUpSender.enviarManual(companyId, id, requestKey);
  }

  private async loadConfirmationAppointment(
    companyId: string,
    id: string,
    scopeProfessionalId?: string,
  ) {
    const appointment =
      await this.prisma.client.appointment.findFirst({
        where: {
          id,
          companyId,
          ...(scopeProfessionalId
            ? { professionalId: scopeProfessionalId }
            : {}),
        },
        select: {
          id: true,
          companyId: true,
          customerId: true,
          professionalId: true,
          start: true,
          notifyConfirmation: true,
          company: { select: { name: true, timezone: true } },
          customer: {
            select: {
              name: true,
              phone: true,
              notificationsEnabled: true,
              whatsappOptIn: true,
            },
          },
          // {profissional} é variável de modelo desde o estudo 61.
          professional: { select: { name: true } },
          items: { select: { service: { select: { name: true } } } },
        },
      });
    if (!appointment) {
      throw new NotFoundException('Agendamento não encontrado');
    }
    return appointment;
  }

  private async confirmationLogs(companyId: string, appointmentId: string) {
    const rows = await this.prisma.client.whatsappOutbox.findMany({
      // Os TRÊS avisos do agendamento, não só a confirmação. Filtrar por
      // 'confirmation' escondia justamente o caso que o dono foi cobrar: o
      // cancelamento recusado pela trava 1 não aparecia em lugar nenhum da
      // tela. Ver estudo 82.
      where: {
        companyId,
        appointmentId,
        kind: { in: ['confirmation', 'cancellation', 'reminder'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        kind: true,
        toPhone: true,
        text: true,
        status: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        sentAt: true,
        inboxMessage: {
          select: {
            status: true,
            sentAt: true,
            deliveredAt: true,
            readAt: true,
          },
        },
      },
    });
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      phone: row.toPhone,
      text: row.text,
      status: row.inboxMessage?.status ?? row.status,
      attempts: row.attempts,
      error: row.lastError,
      // A tela decide se oferece "Reenviar": só faz sentido no que não saiu.
      podeReenviar: row.status === 'failed' || row.status === 'expired',
      createdAt: row.createdAt,
      sentAt: row.inboxMessage?.sentAt ?? row.sentAt,
      deliveredAt: row.inboxMessage?.deliveredAt ?? null,
      readAt: row.inboxMessage?.readAt ?? null,
    }));
  }

  async create(
    companyId: string,
    dto: CreateAppointmentDto,
    opts?: {
      source?: AppointmentSource;
      status?: AppointmentStatus;
      /**
       * Painel: o operador escolheu o horário numa grade que MOSTRA os ocupados,
       * então marcar em cima é decisão consciente e não pode ser recusada.
       * O agendamento online do cliente não passa isto — lá a proteção contra
       * dupla marcação continua valendo integralmente.
       */
      allowOverlap?: boolean;
    },
    scopeProfessionalId?: string,
  ) {
    this.assertProfessionalScope(scopeProfessionalId, dto, true);
    const start = new Date(dto.start);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Data de início inválida');
    }

    // Validate FK references up-front so a missing customer/professional surfaces
    // as a clean 404 instead of a raw Prisma FK-violation 500.
    if (dto.customerId) await this.assertCustomerExists(companyId, dto.customerId);
    if (dto.professionalId) await this.assertProfessionalExists(companyId, dto.professionalId);

    // Resolve the services selected (from items) to snapshot price + duration.
    const serviceIds = (dto.items ?? []).map((it) => it.serviceId);
    const services = await this.loadServices(companyId, serviceIds);

    // Required duration = sum of service durations; fallback to explicit end or default.
    const durationMin = services.length
      ? services.reduce((sum, s) => sum + s.durationMin, 0)
      : undefined;
    const end = dto.end
      ? new Date(dto.end)
      : new Date(start.getTime() + (durationMin ?? DEFAULT_DURATION_MIN) * 60000);

    if (Number.isNaN(end.getTime())) {
      throw new BadRequestException('Data de término inválida');
    }
    if (end <= start) {
      throw new BadRequestException('O término deve ser depois do início');
    }

    // Schedule validation (read-only, safe outside the transaction).
    const professionalId = dto.professionalId;
    if (professionalId) {
      await this.assertWithinSchedule(companyId, professionalId, start, end);
    }

    const itemsData = dto.items
      ? {
          create: dto.items.map((it) => {
            const svc = services.find((s) => s.id === it.serviceId);
            return {
              serviceId: it.serviceId,
              professionalId: it.professionalId ?? professionalId,
              durationMin: svc?.durationMin ?? DEFAULT_DURATION_MIN,
              price: svc?.price ?? new Prisma.Decimal(0),
            };
          }),
        }
      : undefined;

    // Os três controles guardam SÓ a decisão explícita de uma pessoa. Quem não
    // mexeu no toggle fica NULL, e aí quem manda é o padrão do salão lido na
    // hora da entrega.
    //
    // Antes daqui saía `dto.X ?? notificationDefaults.X`, que congelava o padrão
    // dentro da linha. Consequência: o campo nunca nascia NULL, desligar a conta
    // não alcançava nada já criado (o dono desligou 13:27, saiu lembrete 13:30)
    // e não dava para distinguir "autorizei este agendamento" de "o padrão era
    // esse quando criei". Estudo 81.
    const remindClient = dto.remindClient ?? null;
    const notifyConfirmation = dto.notifyConfirmation ?? null;
    const notifyCancellation = dto.notifyCancellation ?? null;

    // Collision check + create run in a single transaction guarded by a Postgres
    // advisory lock keyed on (companyId, professionalId). Two concurrent creates
    // for the same professional serialize: the second waits for the first to
    // commit and then sees its row in assertNoOverlap, preventing double-booking.
    const created = await this.prisma.client.$transaction(async (tx) => {
      if (professionalId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}), hashtext(${professionalId}))`;
        // Encaixe. `allowOverlap` vem do PAINEL (a recepção escolheu o horário
        // vendo que estava ocupado); `dto.squeezeIn` é o pedido explícito de
        // quem chama. Fora esses dois casos, a proteção contra dupla marcação
        // acidental continua de pé — é ela que segura o agendamento online.
        if (!dto.squeezeIn && !opts?.allowOverlap) {
          await this.assertNoOverlap(companyId, professionalId, start, end, undefined, tx);
        }
      }
      return tx.appointment.create({
        data: {
          companyId,
          customerId: dto.customerId,
          professionalId,
          start,
          end,
          notes: dto.notes,
          remindClient,
          notifyConfirmation,
          notifyCancellation,
          source: opts?.source ?? AppointmentSource.admin,
          ...(opts?.status ? { status: opts.status } : {}),
          items: itemsData,
        },
        include: { items: true },
      });
    });

    void this.notifications.notifyAppointment('created', companyId, created.id);
    void this.sendProfessionalNewAppointment(companyId, created.id);
    // Event-driven: schedule the 24h/2h delayed reminders for this appointment.
    void this.queues.enqueueAppointmentReminders(companyId, created.id, created.start);
    // Aviso PERSONALIZADO do drawer ("Avisar o cliente"): job atrasado dedicado,
    // ancorado no start/end recém-criados (before/after/from_now).
    if (dto.followUp?.enabled) {
      void this.queues.enqueueAppointmentCustomFollowUp(
        companyId,
        created.id,
        dto.followUp,
        { start, end },
      );
    }
    return created;
  }

  /**
   * Cria a primeira ocorrência e todas as repetições em uma única transação.
   * Qualquer conflito, horário inválido ou FK inválida aborta a série inteira;
   * notificações e filas só são disparadas depois do commit.
   */
  async createSeries(
    companyId: string,
    dto: CreateAppointmentSeriesDto,
    scopeProfessionalId?: string,
    opts?: { allowOverlap?: boolean },
  ) {
    this.assertProfessionalScope(scopeProfessionalId, dto, true);
    const firstStart = new Date(dto.start);
    if (Number.isNaN(firstStart.getTime())) {
      throw new BadRequestException('Data de início inválida');
    }
    const starts = [
      firstStart,
      ...dto.additionalStarts.map((value) => new Date(value)),
    ];
    if (starts.some((value) => Number.isNaN(value.getTime()))) {
      throw new BadRequestException('Uma das datas da recorrência é inválida');
    }
    const uniqueStarts = new Set(starts.map((value) => value.toISOString()));
    if (uniqueStarts.size !== starts.length) {
      throw new BadRequestException(
        'A recorrência contém horários duplicados.',
      );
    }

    if (dto.customerId) {
      await this.assertCustomerExists(companyId, dto.customerId);
    }
    if (dto.professionalId) {
      await this.assertProfessionalExists(companyId, dto.professionalId);
    }

    const itemProfessionalIds = [
      ...new Set(
        (dto.items ?? [])
          .map((item) => item.professionalId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    for (const professionalId of itemProfessionalIds) {
      await this.assertProfessionalExists(companyId, professionalId);
    }

    const serviceIds = (dto.items ?? []).map((item) => item.serviceId);
    const services = await this.loadServices(companyId, serviceIds);
    const serviceDuration = services.length
      ? services.reduce((sum, service) => sum + service.durationMin, 0)
      : DEFAULT_DURATION_MIN;
    const firstEnd = dto.end
      ? new Date(dto.end)
      : new Date(firstStart.getTime() + serviceDuration * 60_000);
    if (Number.isNaN(firstEnd.getTime()) || firstEnd <= firstStart) {
      throw new BadRequestException(
        'O término deve ser uma data válida depois do início.',
      );
    }
    const durationMs = firstEnd.getTime() - firstStart.getTime();
    const occurrences = starts.map((start) => ({
      start,
      end: new Date(start.getTime() + durationMs),
    }));

    const professionalId = dto.professionalId;
    if (professionalId) {
      for (const occurrence of occurrences) {
        await this.assertWithinSchedule(
          companyId,
          professionalId,
          occurrence.start,
          occurrence.end,
        );
      }
    }

    // Mesma regra do agendamento avulso: só a decisão explícita fica gravada;
    // NULL deixa o padrão da conta decidir na entrega. Ver estudo 81.
    const remindClient = dto.remindClient ?? null;
    const notifyConfirmation = dto.notifyConfirmation ?? null;
    const notifyCancellation = dto.notifyCancellation ?? null;
    const status = dto.status as AppointmentStatus | undefined;

    const created = await this.prisma.client.$transaction(async (tx) => {
      if (professionalId) {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtext(${companyId}),
            hashtext(${professionalId})
          )
        `;
      }

      const rows: Prisma.AppointmentGetPayload<{
        include: { items: true };
      }>[] = [];
      for (const occurrence of occurrences) {
        // Encaixe: mesma regra do create simples — painel escolhe, painel manda.
        if (professionalId && !dto.squeezeIn && !opts?.allowOverlap) {
          await this.assertNoOverlap(
            companyId,
            professionalId,
            occurrence.start,
            occurrence.end,
            undefined,
            tx,
          );
        }
        const row = await tx.appointment.create({
          data: {
            companyId,
            customerId: dto.customerId,
            professionalId,
            start: occurrence.start,
            end: occurrence.end,
            notes: dto.notes,
            remindClient,
            notifyConfirmation,
            notifyCancellation,
            source: AppointmentSource.admin,
            ...(status ? { status } : {}),
            items: dto.items
              ? {
                  create: dto.items.map((item) => {
                    const service = services.find(
                      (candidate) => candidate.id === item.serviceId,
                    );
                    return {
                      serviceId: item.serviceId,
                      professionalId:
                        item.professionalId ?? professionalId,
                      durationMin:
                        service?.durationMin ?? DEFAULT_DURATION_MIN,
                      price: service?.price ?? new Prisma.Decimal(0),
                    };
                  }),
                }
              : undefined,
          },
          include: { items: true },
        });
        rows.push(row);
      }
      return rows;
    });

    for (let index = 0; index < created.length; index += 1) {
      const row = created[index];
      const occurrence = occurrences[index];
      void this.notifications.notifyAppointment(
        'created',
        companyId,
        row.id,
      );
      void this.sendProfessionalNewAppointment(companyId, row.id);
      void this.queues.enqueueAppointmentReminders(
        companyId,
        row.id,
        row.start,
      );
      if (dto.followUp?.enabled) {
        void this.queues.enqueueAppointmentCustomFollowUp(
          companyId,
          row.id,
          dto.followUp,
          occurrence,
        );
      }
    }

    return { data: created, count: created.length };
  }

  // POST /appointments/block — "Ocupar horários": cria um bloqueio de agenda.
  // Um bloqueio é um Appointment sem cliente e sem itens que ocupa o horário do
  // profissional (status `scheduled` entra na checagem de colisão, então nenhum
  // agendamento pode ser marcado por cima). Não dispara notificações/lembretes
  // porque não há cliente envolvido.
  async block(
    companyId: string,
    dto: { professionalId: string; start: string; end: string; reason?: string },
    scopeProfessionalId?: string,
  ) {
    this.assertProfessionalScope(scopeProfessionalId, dto, true);
    const start = new Date(dto.start);
    const end = new Date(dto.end);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Data de início inválida');
    }
    if (Number.isNaN(end.getTime())) {
      throw new BadRequestException('Data de término inválida');
    }
    if (end <= start) {
      throw new BadRequestException('O término deve ser depois do início');
    }

    await this.assertProfessionalExists(companyId, dto.professionalId);

    const reason = dto.reason?.trim();
    // Prefixo padronizado para o front reconhecer o registro como bloqueio
    // (o modelo Appointment não tem um tipo dedicado — reaproveitamos o notes).
    const notes = reason ? `[Bloqueio] ${reason}` : '[Bloqueio]';

    // Mesma proteção contra double-booking do create: advisory lock por
    // (companyId, professionalId) + checagem de sobreposição na transação.
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}), hashtext(${dto.professionalId}))`;
      await this.assertNoOverlap(
        companyId,
        dto.professionalId,
        start,
        end,
        undefined,
        tx,
      );
      return tx.appointment.create({
        data: {
          companyId,
          professionalId: dto.professionalId,
          start,
          end,
          notes,
          status: AppointmentStatus.scheduled,
          source: AppointmentSource.admin,
        },
        include: { items: true },
      });
    });
  }

  async update(
    companyId: string,
    id: string,
    dto: UpdateAppointmentDto,
    scopeProfessionalId?: string,
    opts?: { allowOverlap?: boolean },
  ) {
    const current = await this.findOne(companyId, id, scopeProfessionalId);
    this.assertProfessionalScope(scopeProfessionalId, dto);

    // Validate FK references up-front (clean 404 instead of a raw FK-violation 500).
    if (dto.customerId) await this.assertCustomerExists(companyId, dto.customerId);
    // Só exige profissional ATIVO quando ele está de fato mudando: reeditar um
    // agendamento antigo (data, notas) cujo profissional foi desativado depois
    // continua funcionando.
    if (dto.professionalId) {
      await this.assertProfessionalExists(
        companyId,
        dto.professionalId,
        dto.professionalId !== current.professionalId,
      );
    }

    const professionalId = dto.professionalId ?? current.professionalId ?? undefined;
    const start = dto.start ? new Date(dto.start) : current.start;
    let end = dto.end ? new Date(dto.end) : current.end;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Datas inválidas');
    }

    // If start moved but end not provided, preserve the original duration.
    if (dto.start && !dto.end) {
      const originalMs = current.end.getTime() - current.start.getTime();
      end = new Date(start.getTime() + originalMs);
    }
    if (end <= start) {
      throw new BadRequestException('O término deve ser depois do início');
    }

    // Re-validate schedule + collision when time/professional changed.
    const timeChanged = Boolean(dto.start || dto.end || dto.professionalId);
    if (professionalId && timeChanged) {
      // Expediente vale sempre; encaixe autoriza sobrepor OUTRO agendamento, não
      // marcar fora do horário de trabalho.
      await this.assertWithinSchedule(companyId, professionalId, start, end);
      if (!dto.squeezeIn && !opts?.allowOverlap) {
        await this.assertNoOverlap(companyId, professionalId, start, end, id);
      }
    }

    const saved = await this.prisma.client.appointment.update({
      where: { id },
      data: {
        customerId: dto.customerId,
        professionalId: dto.professionalId,
        // Persist start only when the client moved it.
        start: dto.start ? start : undefined,
        // Persist end when given, or when start moved (duration preserved).
        end: dto.end || dto.start ? end : undefined,
        notes: dto.notes,
        ...(dto.remindClient !== undefined ? { remindClient: dto.remindClient } : {}),
        ...(dto.notifyConfirmation !== undefined
          ? { notifyConfirmation: dto.notifyConfirmation }
          : {}),
        ...(dto.notifyCancellation !== undefined
          ? { notifyCancellation: dto.notifyCancellation }
          : {}),
      },
    });

    // Rescheduled → the pending reminders point at the old time. Cancel and
    // re-enqueue against the new start so 24h/2h fire at the right moment.
    if (dto.start) {
      void this.queues
        .cancelAppointmentReminders(id)
        .then(() =>
          this.queues.enqueueAppointmentReminders(companyId, id, saved.start),
        );
    }

    // Aviso personalizado do drawer: reconfigura de forma coerente.
    //   - followUp presente + enabled → cancela o pendente e re-enfileira com a
    //     nova config, ancorado no start/end atualizados;
    //   - followUp presente + !enabled → cancela o pendente (atendente desligou);
    //   - followUp ausente mas o horário mudou → re-ancora o job pendente (se
    //     houver) cancelando-o — sem config nova não há o que reprogramar, então
    //     apenas cancelamos para não disparar no horário antigo.
    if (dto.followUp) {
      if (dto.followUp.enabled) {
        void this.queues
          .cancelAppointmentCustomFollowUp(id)
          .then(() =>
            this.queues.enqueueAppointmentCustomFollowUp(companyId, id, dto.followUp!, {
              start,
              end,
            }),
          );
      } else {
        void this.queues.cancelAppointmentCustomFollowUp(id);
      }
    } else if (dto.start || dto.end) {
      // Reagendou sem reenviar a config do aviso: o job pendente ficaria no
      // horário antigo. Cancela para evitar disparo desalinhado (o atendente
      // pode reconfigurar o aviso ao reabrir o drawer).
      void this.queues.cancelAppointmentCustomFollowUp(id);
    }
    return saved;
  }

  async setStatus(
    companyId: string,
    id: string,
    dto: StatusDto,
    byUserId?: string,
    scopeProfessionalId?: string,
  ) {
    const current = await this.findOne(companyId, id, scopeProfessionalId);
    const statusChanged = dto.status !== current.status;

    // Cancelar o agendamento com comanda viva deixaria receita presa num
    // atendimento que "não aconteceu". Mesma recusa do excluir. Ver estudo 56.
    if (statusChanged && dto.status === AppointmentStatus.canceled) {
      await this.assertSemComandaViva(companyId, id, 'cancelar');
    }

    // Re-entering an ACTIVE status (e.g. reactivating a canceled appointment) makes
    // it occupy the agenda again — re-check for overlaps to prevent double-booking
    // by way of a status flip.
    if (
      statusChanged &&
      current.professionalId &&
      ACTIVE_STATUSES.includes(dto.status)
    ) {
      // Ao (re)ativar/confirmar, bloqueia só contra slots COMPROMETIDOS — um
      // `unconfirmed` irmão (pedido online provisório) não trava a transição.
      await this.assertNoOverlap(
        companyId,
        current.professionalId,
        current.start,
        current.end,
        id,
        undefined,
        COMMITTED_STATUSES,
      );
    }

    const updated = await this.prisma.client.appointment.update({
      where: { id },
      data: {
        status: dto.status,
        // Only record history on an actual transition (skip no-op re-sets).
        statusHistory: statusChanged
          ? { create: { fromStatus: current.status, toStatus: dto.status, byUserId } }
          : undefined,
      },
    });

    // Notify the client + studio when the appointment is confirmed or canceled.
    const STATUS_EVENT: Partial<Record<AppointmentStatus, AppointmentEvent>> = {
      [AppointmentStatus.confirmed]: 'confirmed',
      [AppointmentStatus.canceled]: 'canceled',
    };
    const event = STATUS_EVENT[dto.status];
    // `created` já representa "horário marcado". Uma transição comum
    // scheduled → confirmed não deve mandar uma segunda mensagem logo depois.
    // Só existe aviso de confirmed separado quando o pedido online estava
    // realmente pendente (unconfirmed) e o salão o aprovou.
    const shouldNotifyEvent =
      event &&
      dto.status !== current.status &&
      (event !== 'confirmed' || current.status === AppointmentStatus.unconfirmed);
    if (shouldNotifyEvent) {
      // O envio ao cliente (WhatsApp + e-mail) é feito SOMENTE por
      // notifyAppointment, que respeita o opt-in do salão
      // (auto.confirmation / auto.cancellation). Removemos o segundo envio via
      // antigos caminhos diretos de confirmação/cancelamento: eram NÃO-gated,
      // vazavam mensagem com o toggle OFF e DUPLICAVAM quando ON.
      void this.notifications.notifyAppointment(event, companyId, id, {
        reason: dto.reason,
      });
    }

    // Event-driven queue side effects on status transitions:
    if (statusChanged) {
      if (dto.status === AppointmentStatus.confirmed) {
        // Re-enqueue reminders (idempotent by jobId) — a confirm may happen before
        // any were scheduled, or reaffirms the existing ones.
        void this.queues.enqueueAppointmentReminders(companyId, id, current.start);
      } else if (dto.status === AppointmentStatus.canceled) {
        // Cancelling the appointment cancels its pending reminders + custom warn.
        void this.queues.cancelAppointmentReminders(id);
        void this.queues.cancelAppointmentCustomFollowUp(id);
      } else if (
        dto.status === AppointmentStatus.done ||
        dto.status === AppointmentStatus.finished
      ) {
        // Concluded → reminders are moot; schedule the post-service follow-up.
        void this.queues.cancelAppointmentReminders(id);
        void this.queues.enqueueFollowUp(companyId, { appointmentId: id });
      }
    }
    return updated;
  }

  // Send a suggested alternative time to the customer (admin action).
  async suggestTime(
    companyId: string,
    id: string,
    suggestion: string,
    scopeProfessionalId?: string,
  ) {
    await this.findOne(companyId, id, scopeProfessionalId);
    void this.sendCustomerSuggestion(companyId, id, suggestion);
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Customer notifications (WhatsApp + email)
  // ---------------------------------------------------------------------------

  private async loadApptView(companyId: string, appointmentId: string) {
    const appt = await this.prisma.client.appointment.findFirst({
      where: { id: appointmentId, companyId },
      select: {
        start: true,
        // customerId exposto p/ vincular as mensagens ao histórico "Interações".
        customerId: true,
        company: { select: { name: true, timezone: true } },
        customer: {
          select: {
            name: true,
            email: true,
            phone: true,
            notificationsEnabled: true,
            whatsappOptIn: true,
          },
        },
        professional: { select: { name: true, phone: true, notifyWhatsapp: true } },
        items: { select: { service: { select: { name: true } } } },
      },
    });
    if (!appt) return null;
    const tz = appt.company.timezone || 'America/Sao_Paulo';
    const dateLabel = new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz, weekday: 'long', day: '2-digit', month: 'long',
    }).format(appt.start);
    const timeLabel = new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz, hour: '2-digit', minute: '2-digit',
    }).format(appt.start);
    return {
      customerId: appt.customerId ?? null,
      salonName: appt.company.name,
      professionalName: appt.professional?.name ?? null,
      professionalPhone: appt.professional?.phone?.trim() || null,
      professionalNotify: appt.professional?.notifyWhatsapp ?? false,
      serviceNames: appt.items.map((it) => it.service.name).join(', ') || 'Serviço',
      customerName: (appt.customer?.name ?? '').trim() || 'Cliente',
      customerFirstName: (appt.customer?.name ?? '').trim().split(' ')[0] || 'cliente',
      customerEmail: appt.customer?.email?.trim() || null,
      customerPhone: appt.customer?.phone?.trim() || null,
      customerNotificationsEnabled: appt.customer?.notificationsEnabled ?? null,
      customerWhatsappOptIn: appt.customer?.whatsappOptIn ?? null,
      dateLabel,
      timeLabel,
    };
  }

  private async sendCustomerSuggestion(companyId: string, appointmentId: string, suggestion: string): Promise<void> {
    try {
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v) return;
      const notificationsAllowed = v.customerNotificationsEnabled !== false;
      const whatsappAllowed =
        notificationsAllowed && v.customerWhatsappOptIn !== false;
      if (v.customerPhone && whatsappAllowed) {
        await this.whatsapp.enqueueText(v.customerPhone, [
          `Olá, ${v.customerFirstName}! ✨`,
          ``,
          `Sobre seu agendamento no *${v.salonName}* (${v.serviceNames} — ${v.dateLabel} às ${v.timeLabel}):`,
          ``,
          `O salão sugeriu outro horário:`,
          `*${suggestion}*`,
          ``,
          `Pode responder por aqui para combinar o melhor horário. 💖`,
        ].join('\n'),
        // Interações: sugestão de novo horário ao cliente (parte do fluxo de
        // confirmação). Ação humana explícita do painel → autorizada (estudo 60).
        { companyId, customerId: v.customerId ?? undefined, kind: 'confirmation', authorized: true });
      }
      if (v.customerEmail && notificationsAllowed) {
        await this.email.send({
          to: v.customerEmail,
          subject: `Sugestão de novo horário — ${v.salonName}`,
          html: `<p>Olá, ${v.customerFirstName}!</p><p>Sobre seu agendamento no <strong>${v.salonName}</strong> (${v.serviceNames} — ${v.dateLabel} às ${v.timeLabel}), o salão sugeriu outro horário:</p><p><strong>${suggestion}</strong></p><p>Entre em contato com o salão para combinar.</p>`,
        });
      }
    } catch (err) {
      this.logger.error(`Falha ao enviar sugestão ao cliente: ${(err as Error).message}`);
    }
  }

  private async sendProfessionalNewAppointment(companyId: string, appointmentId: string): Promise<void> {
    try {
      // OPT-IN: só avisa o profissional se o salão ativou `notifyProfessional`
      // (default OFF). Sem o toggle, nenhuma mensagem sai — nem para o
      // profissional que tem notifyWhatsapp/telefone.
      const auto = await this.settings.get(companyId);
      if (!auto.notifyProfessional) return;
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v?.professionalPhone || !v.professionalNotify) return;
      await this.whatsapp.enqueueText(v.professionalPhone, [
        `📋 Novo agendamento para você!`,
        ``,
        `👤 *Cliente:* ${v.customerName}`,
        `💅 *Serviço:* ${v.serviceNames}`,
        `📅 *Data:* ${v.dateLabel}`,
        `⏰ *Horário:* ${v.timeLabel}`,
      ].join('\n'),
      // Interações: aviso ao profissional (não ao cliente) — sem customerId.
      { companyId, kind: 'manager' });
    } catch (err) {
      this.logger.error(`Falha ao notificar profissional: ${(err as Error).message}`);
    }
  }

  /**
   * Recusa a operação quando o agendamento tem comanda NÃO cancelada.
   * Usado por excluir e por cancelar — ver estudo 56.
   */
  private async assertSemComandaViva(
    companyId: string,
    id: string,
    acao: 'excluir' | 'cancelar',
  ) {
    const comanda = await this.prisma.client.order.findFirst({
      where: { companyId, appointmentId: id, status: { not: 'canceled' } },
      select: { number: true, status: true },
    });
    if (!comanda) return;
    const situacao = comanda.status === 'finished' ? 'já foi faturada' : 'está aberta';
    throw new ConflictException(
      `Este agendamento tem a comanda #${comanda.number}, que ${situacao}. ` +
        `Cancele ou exclua a comanda antes de ${acao} o agendamento.`,
    );
  }

  async remove(
    companyId: string,
    id: string,
    scopeProfessionalId?: string,
  ) {
    await this.findOne(companyId, id, scopeProfessionalId);
    // Comanda é documento com dinheiro: apagar o agendamento dela desligaria o
    // vínculo em silêncio (FK onDelete: SetNull) e a comanda ficaria órfã — o
    // histórico do cliente volta a duplicar a visita e ninguém fica sabendo.
    // Quem quer apagar, cancela a comanda antes. Ver estudo 56.
    await this.assertSemComandaViva(companyId, id, 'excluir');
    // Cancel any pending reminders + custom warning before the appt is gone.
    void this.queues.cancelAppointmentReminders(id);
    void this.queues.cancelAppointmentCustomFollowUp(id);
    return this.prisma.client.appointment.delete({ where: { id } });
  }

  // GET /availability — real free slots honoring schedule + occupation + service duration.
  //
  // `includePast` (default FALSE) controla se horários já passados entram. O
  // agendamento online precisa do default: cliente não marca no passado. Já o
  // PAINEL passa true — o salão lança atendimento retroativo direto (esqueceram
  // de registrar, estão migrando dados), e sem isso qualquer data anterior a
  // hoje devolvia zero slots e a tela dizia "Nenhum horário disponível nesta
  // data.", como se a profissional estivesse sem agenda.
  async availability(
    companyId: string,
    serviceId: string,
    professionalId?: string,
    date?: string,
    serviceIds?: string[],
    opts?: { includePast?: boolean; includeBusy?: boolean },
  ) {
    const day = date ?? this.todayInCompanyTz(await this.companyTimezone(companyId));
    const tz = await this.companyTimezone(companyId);

    const empty = { date: day, serviceId: serviceId ?? null, professionalId: professionalId ?? null, slots: [] as Slot[] };

    // A professional is required to compute a concrete agenda.
    if (!professionalId) return empty;

    // Determine required duration from the requested service(s).
    let durationMin = DEFAULT_DURATION_MIN;
    const allIds = serviceIds?.length ? serviceIds : serviceId ? [serviceId] : [];
    if (allIds.length) {
      const services = await this.loadServices(companyId, allIds).catch(() => []);
      if (!services.length) return empty; // unknown service → no slots
      durationMin = services.reduce((sum, s) => sum + s.durationMin, 0);

      // Validate the professional actually performs ALL requested services.
      for (const sid of allIds) {
        const performs = await this.prisma.client.professionalService.findUnique({
          where: { professionalId_serviceId: { professionalId, serviceId: sid } },
        });
        if (!performs) return empty;
      }
    }

    // Weekday (0=Sun..6=Sat) of the requested day in the company timezone.
    const weekday = this.weekdayOf(day, tz);

    const schedules = await this.prisma.client.professionalSchedule.findMany({
      // `active: true` — profissional desativado não oferece horário nenhum.
      where: { professionalId, weekday, professional: { deletedAt: null, active: true } },
      orderBy: { startTime: 'asc' },
    });
    if (!schedules.length) return empty;

    // Existing non-canceled appointments overlapping the requested day.
    const dayStart = this.zonedWallClockToUtc(day, '00:00', tz);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60000);
    const busy = await this.prisma.client.appointment.findMany({
      where: {
        companyId,
        professionalId,
        status: { in: ACTIVE_STATUSES },
        start: { lt: dayEnd },
        end: { gt: dayStart },
      },
      select: { start: true, end: true },
    });

    const slots: Slot[] = [];
    const durationMs = durationMin * 60000;
    const stepMs = SLOT_STEP_MIN * 60000;
    const now = Date.now();

    for (const win of schedules) {
      const winStart = this.zonedWallClockToUtc(day, win.startTime, tz);
      const winEnd = this.zonedWallClockToUtc(day, win.endTime, tz);

      for (let t = winStart.getTime(); t + durationMs <= winEnd.getTime(); t += stepMs) {
        const slotStart = t;
        const slotEnd = t + durationMs;
        // Skip slots already in the past — salvo lançamento retroativo do painel.
        if (!opts?.includePast && slotEnd <= now) continue;
        // Um horário só está disponível quando não sobrepõe nenhum
        // agendamento ativo do profissional. Sem este filtro a API listava
        // janelas já ocupadas e a recepcionista virtual podia oferecer um
        // horário impossível.
        const ocupado = busy.some(
          (appointment) =>
            appointment.start.getTime() < slotEnd &&
            appointment.end.getTime() > slotStart,
        );
        // `includeBusy` = "Encaixar agendamento" ligado. Sem esta saída o
        // encaixe era inútil na prática: o horário ocupado nem aparecia na
        // lista, então não havia o que encaixar. O slot volta MARCADO como
        // ocupado — a recepção precisa ver que está marcando em cima.
        if (ocupado && !opts?.includeBusy) continue;
        slots.push({
          start: new Date(slotStart).toISOString(),
          end: new Date(slotEnd).toISOString(),
          ...(ocupado ? { busy: true } : {}),
        });
      }
    }

    return { date: day, serviceId: serviceId ?? null, professionalId, slots };
  }

  async professionalForUser(
    companyId: string,
    userId: string,
  ): Promise<string> {
    const professional = await this.prisma.client.professional.findFirst({
      where: { companyId, userId, active: true },
      select: { id: true },
    });
    if (!professional) {
      // Acontece de verdade: usuário criado com o papel "profissional" mas sem
      // vínculo com um registro de Profissional. Como TODA rota da agenda passa
      // por aqui, o usuário fica sem abrir a agenda e sem cancelar nada. A
      // mensagem antiga só descrevia o sintoma; esta diz como sair.
      throw new ForbiddenException(
        'Seu usuário não está vinculado a um profissional ativo. Peça a um administrador para abrir Cadastros → Profissionais, editar o seu cadastro e vincular este acesso — ou conceder a permissão "Ver agenda completa" (agenda:view_all) ao seu papel.',
      );
    }
    return professional.id;
  }

  private assertProfessionalScope(
    scopeProfessionalId: string | undefined,
    dto: {
      professionalId?: string | null;
      items?: { professionalId?: string | null }[];
    },
    requireTopLevel = false,
  ): void {
    if (!scopeProfessionalId) return;
    const requested = [
      dto.professionalId,
      ...(dto.items ?? []).map((item) => item.professionalId),
    ].filter((id): id is string => Boolean(id));
    if (
      (requireTopLevel && !dto.professionalId) ||
      requested.some((id) => id !== scopeProfessionalId)
    ) {
      throw new ForbiddenException(
        'Você só pode gerenciar a própria agenda.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  // Split a comma-separated query value ("a,b,c") into a trimmed, non-empty list.
  private splitCsv(value?: string): string[] {
    if (!value) return [];
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  private async loadServices(companyId: string, serviceIds: string[]) {
    const unique = [...new Set(serviceIds)];
    if (!unique.length) return [] as { id: string; durationMin: number; price: Prisma.Decimal }[];
    const services = await this.prisma.client.service.findMany({
      where: { companyId, id: { in: unique }, deletedAt: null },
      select: { id: true, durationMin: true, price: true },
    });
    const found = new Set(services.map((s) => s.id));
    const missing = unique.filter((id) => !found.has(id));
    if (missing.length) {
      throw new BadRequestException(`Serviço(s) não encontrado(s): ${missing.join(', ')}`);
    }
    return services;
  }

  private async assertWithinSchedule(
    companyId: string,
    professionalId: string,
    start: Date,
    end: Date,
  ) {
    const tz = await this.companyTimezone(companyId);
    const weekday = this.weekdayOfInstant(start, tz);
    const schedules = await this.prisma.client.professionalSchedule.findMany({
      where: { professionalId, weekday },
    });
    if (!schedules.length) {
      throw new BadRequestException(
        'Profissional não atende neste dia da semana',
      );
    }
    const day = this.dayInTz(start, tz);
    const fits = schedules.some((win) => {
      const winStart = this.zonedWallClockToUtc(day, win.startTime, tz);
      const winEnd = this.zonedWallClockToUtc(day, win.endTime, tz);
      return start.getTime() >= winStart.getTime() && end.getTime() <= winEnd.getTime();
    });
    if (!fits) {
      throw new BadRequestException(
        'Horário fora do expediente do profissional',
      );
    }
  }

  // Validate the referenced customer exists within the company (avoids a raw FK
  // violation surfacing as a 500 on create/update).
  private async assertCustomerExists(companyId: string, customerId: string) {
    const found = await this.prisma.client.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Cliente não encontrado');
  }

  /**
   * Valida que o profissional existe na empresa.
   *
   * `requireActive` (padrão true) recusa profissional DESATIVADO: esconder do
   * `<select>` não impede uma chamada direta nem um formulário com estado velho.
   * Passe `false` quando o profissional não está sendo escolhido agora — reeditar
   * um agendamento antigo cujo profissional foi desativado DEPOIS não pode quebrar.
   */
  private async assertProfessionalExists(
    companyId: string,
    professionalId: string,
    requireActive = true,
  ) {
    const found = await this.prisma.client.professional.findFirst({
      where: { id: professionalId, companyId, deletedAt: null },
      select: { id: true, active: true },
    });
    if (!found) throw new NotFoundException('Profissional não encontrado');
    if (requireActive && !found.active) {
      throw new BadRequestException(
        'Profissional desativado — reative em Equipe > Profissionais para usá-lo.',
      );
    }
  }

  private async assertNoOverlap(
    companyId: string,
    professionalId: string,
    start: Date,
    end: Date,
    ignoreId?: string,
    db: Prisma.TransactionClient = this.prisma.client,
    statuses: AppointmentStatus[] = ACTIVE_STATUSES,
  ) {
    const conflict = await db.appointment.findFirst({
      where: {
        companyId,
        professionalId,
        id: ignoreId ? { not: ignoreId } : undefined,
        status: { in: statuses },
        start: { lt: end },
        end: { gt: start },
      },
      select: { id: true },
    });
    if (conflict) {
      throw new ConflictException(
        'Já existe um agendamento neste horário para o profissional',
      );
    }
  }

  private async companyTimezone(companyId: string): Promise<string> {
    const company = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    return company?.timezone ?? 'America/Sao_Paulo';
  }

  // Parts of an instant rendered in a given IANA timezone.
  private tzParts(d: Date, tz: string) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
    return parts as Record<string, string>;
  }

  // "YYYY-MM-DD" wall-clock day of an instant in the given timezone.
  private dayInTz(d: Date, tz: string): string {
    const p = this.tzParts(d, tz);
    return `${p.year}-${p.month}-${p.day}`;
  }

  // Weekday 0=Sun..6=Sat of an instant in the given timezone.
  private weekdayOfInstant(d: Date, tz: string): number {
    const wd = this.tzParts(d, tz).weekday;
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  }

  // Weekday 0=Sun..6=Sat of a "YYYY-MM-DD" calendar day in the given timezone.
  private weekdayOf(day: string, tz: string): number {
    // Noon UTC of that calendar day is safe from DST edge cases for weekday.
    const noon = this.zonedWallClockToUtc(day, '12:00', tz);
    return this.weekdayOfInstant(noon, tz);
  }

  private todayInCompanyTz(tz: string): string {
    return this.dayInTz(new Date(), tz);
  }

  // Convert a wall-clock (YYYY-MM-DD, HH:mm) in IANA tz to the UTC instant.
  // Uses the offset of a provisional UTC guess, then corrects for it.
  private zonedWallClockToUtc(day: string, hhmm: string, tz: string): Date {
    const [y, mo, d] = day.split('-').map(Number);
    const [h, mi] = hhmm.split(':').map(Number);
    // Provisional: treat the wall-clock as if it were UTC.
    const provisional = Date.UTC(y, mo - 1, d, h, mi, 0);
    // What wall-clock does that instant render as in tz? Diff = the tz offset.
    const asTz = this.tzParts(new Date(provisional), tz);
    const renderedUtc = Date.UTC(
      Number(asTz.year),
      Number(asTz.month) - 1,
      Number(asTz.day),
      Number(asTz.hour),
      Number(asTz.minute),
      Number(asTz.second),
    );
    const offset = renderedUtc - provisional;
    return new Date(provisional - offset);
  }
}
