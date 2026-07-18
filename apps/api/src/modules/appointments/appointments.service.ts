import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, AppointmentStatus, AppointmentSource } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentDto, StatusDto } from './dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AppointmentEvent } from '../notifications/notifications.templates';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';

// Slot generation granularity (minutes) for the availability grid.
const SLOT_STEP_MIN = 15;
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

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsappService,
    private readonly email: EmailService,
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
  ) {
    const where: Prisma.AppointmentWhereInput = { companyId };

    // professionalId + status accept a single id OR a comma-separated list, so
    // the agenda can filter by several professionals/statuses at once.
    const professionalIds = this.splitCsv(filters.professionalId);
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
      include: { customer: true, professional: true, items: true },
      orderBy: { start: 'asc' },
    });
    return { data, page: 1, pageSize: data.length, total: data.length };
  }

  // GET /appointments/calendar?month — counters per day (stub aggregation).
  async calendar(companyId: string, month?: string) {
    const ref = month ? new Date(`${month}-01T00:00:00`) : new Date();
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1);
    const appts = await this.prisma.client.appointment.findMany({
      where: { companyId, start: { gte: start, lt: end } },
      select: { start: true, status: true },
    });
    const counts: Record<string, number> = {};
    for (const a of appts) {
      const day = a.start.toISOString().slice(0, 10);
      counts[day] = (counts[day] ?? 0) + 1;
    }
    return { month: start.toISOString().slice(0, 7), counts };
  }

  async findOne(companyId: string, id: string) {
    const found = await this.prisma.client.appointment.findFirst({
      where: { id, companyId },
      include: { items: true, statusHistory: true },
    });
    if (!found) throw new NotFoundException('Agendamento não encontrado');
    return found;
  }

  async create(
    companyId: string,
    dto: CreateAppointmentDto,
    opts?: { source?: AppointmentSource; status?: AppointmentStatus },
  ) {
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

    // Collision check + create run in a single transaction guarded by a Postgres
    // advisory lock keyed on (companyId, professionalId). Two concurrent creates
    // for the same professional serialize: the second waits for the first to
    // commit and then sees its row in assertNoOverlap, preventing double-booking.
    const created = await this.prisma.client.$transaction(async (tx) => {
      if (professionalId) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}), hashtext(${professionalId}))`;
        await this.assertNoOverlap(companyId, professionalId, start, end, undefined, tx);
      }
      return tx.appointment.create({
        data: {
          companyId,
          customerId: dto.customerId,
          professionalId,
          start,
          end,
          notes: dto.notes,
          source: opts?.source ?? AppointmentSource.admin,
          ...(opts?.status ? { status: opts.status } : {}),
          items: itemsData,
        },
        include: { items: true },
      });
    });

    void this.notifications.notifyAppointment('created', companyId, created.id);
    void this.sendProfessionalNewAppointment(companyId, created.id);
    return created;
  }

  async update(companyId: string, id: string, dto: UpdateAppointmentDto) {
    const current = await this.findOne(companyId, id);

    // Validate FK references up-front (clean 404 instead of a raw FK-violation 500).
    if (dto.customerId) await this.assertCustomerExists(companyId, dto.customerId);
    if (dto.professionalId) await this.assertProfessionalExists(companyId, dto.professionalId);

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
      await this.assertWithinSchedule(companyId, professionalId, start, end);
      await this.assertNoOverlap(companyId, professionalId, start, end, id);
    }

    return this.prisma.client.appointment.update({
      where: { id },
      data: {
        customerId: dto.customerId,
        professionalId: dto.professionalId,
        // Persist start only when the client moved it.
        start: dto.start ? start : undefined,
        // Persist end when given, or when start moved (duration preserved).
        end: dto.end || dto.start ? end : undefined,
        notes: dto.notes,
      },
    });
  }

  async setStatus(companyId: string, id: string, dto: StatusDto, byUserId?: string) {
    const current = await this.findOne(companyId, id);
    const statusChanged = dto.status !== current.status;

    // Re-entering an ACTIVE status (e.g. reactivating a canceled appointment) makes
    // it occupy the agenda again — re-check for overlaps to prevent double-booking
    // by way of a status flip.
    if (
      statusChanged &&
      current.professionalId &&
      ACTIVE_STATUSES.includes(dto.status)
    ) {
      await this.assertNoOverlap(
        companyId,
        current.professionalId,
        current.start,
        current.end,
        id,
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
    if (event && dto.status !== current.status) {
      void this.notifications.notifyAppointment(event, companyId, id);
      // Send WhatsApp + email to the customer (same as the WhatsApp handler).
      if (dto.status === AppointmentStatus.confirmed) {
        void this.sendCustomerConfirmation(companyId, id);
      } else if (dto.status === AppointmentStatus.canceled) {
        void this.sendCustomerCancellation(companyId, id, dto.reason);
      }
    }
    return updated;
  }

  // Send a suggested alternative time to the customer (admin action).
  async suggestTime(companyId: string, id: string, suggestion: string) {
    await this.findOne(companyId, id);
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
        company: { select: { name: true, timezone: true } },
        customer: { select: { name: true, email: true, phone: true } },
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
      salonName: appt.company.name,
      professionalName: appt.professional?.name ?? null,
      professionalPhone: appt.professional?.phone?.trim() || null,
      professionalNotify: appt.professional?.notifyWhatsapp ?? false,
      serviceNames: appt.items.map((it) => it.service.name).join(', ') || 'Serviço',
      customerName: (appt.customer?.name ?? '').trim() || 'Cliente',
      customerFirstName: (appt.customer?.name ?? '').trim().split(' ')[0] || 'cliente',
      customerEmail: appt.customer?.email?.trim() || null,
      customerPhone: appt.customer?.phone?.trim() || null,
      dateLabel,
      timeLabel,
    };
  }

  private async sendCustomerConfirmation(companyId: string, appointmentId: string): Promise<void> {
    try {
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v) return;
      if (v.customerPhone) {
        await this.whatsapp.enqueueText(v.customerPhone, [
          `Olá, ${v.customerFirstName}! ✨`,
          ``,
          `Seu agendamento no *${v.salonName}* está confirmado:`,
          ``,
          `💅 *Serviço:* ${v.serviceNames}`,
          v.professionalName ? `👩 *Profissional:* ${v.professionalName}` : null,
          `📅 *Data:* ${v.dateLabel}`,
          `⏰ *Horário:* ${v.timeLabel}`,
          ``,
          `O pagamento é feito no salão. Até logo! 💖`,
        ].filter((l): l is string => l !== null).join('\n'));
      }
      if (v.customerEmail) {
        await this.email.send({
          to: v.customerEmail,
          subject: `Agendamento confirmado — ${v.salonName}`,
          html: this.confirmationHtml(v),
        });
      }
    } catch (err) {
      this.logger.error(`Falha ao notificar cliente (confirmação): ${(err as Error).message}`);
    }
  }

  private async sendCustomerCancellation(companyId: string, appointmentId: string, reason?: string): Promise<void> {
    try {
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v) return;
      const reasonLine = reason ? `\n\nMotivo: ${reason}` : '';
      if (v.customerPhone) {
        await this.whatsapp.enqueueText(v.customerPhone, [
          `Olá, ${v.customerFirstName}.`,
          ``,
          `Infelizmente seu agendamento no *${v.salonName}* (${v.serviceNames} — ${v.dateLabel} às ${v.timeLabel}) foi *cancelado* pelo salão.${reasonLine}`,
          ``,
          `Se quiser, é só agendar um novo horário. 💖`,
        ].join('\n'));
      }
      if (v.customerEmail) {
        await this.email.send({
          to: v.customerEmail,
          subject: `Agendamento cancelado — ${v.salonName}`,
          html: `<p>Olá, ${v.customerFirstName}.</p><p>Infelizmente seu agendamento no <strong>${v.salonName}</strong> (${v.serviceNames} — ${v.dateLabel} às ${v.timeLabel}) foi cancelado pelo salão.${reason ? `<br>Motivo: ${reason}` : ''}</p><p>Se quiser, é só agendar um novo horário.</p>`,
        });
      }
    } catch (err) {
      this.logger.error(`Falha ao notificar cliente (cancelamento): ${(err as Error).message}`);
    }
  }

  private async sendCustomerSuggestion(companyId: string, appointmentId: string, suggestion: string): Promise<void> {
    try {
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v) return;
      if (v.customerPhone) {
        await this.whatsapp.enqueueText(v.customerPhone, [
          `Olá, ${v.customerFirstName}! ✨`,
          ``,
          `Sobre seu agendamento no *${v.salonName}* (${v.serviceNames} — ${v.dateLabel} às ${v.timeLabel}):`,
          ``,
          `O salão sugeriu outro horário:`,
          `*${suggestion}*`,
          ``,
          `Pode responder por aqui para combinar o melhor horário. 💖`,
        ].join('\n'));
      }
      if (v.customerEmail) {
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

  private confirmationHtml(v: { customerFirstName: string; salonName: string; serviceNames: string; professionalName: string | null; dateLabel: string; timeLabel: string }): string {
    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 0;color:#6b6b6b;font-size:14px;">${label}</td><td style="padding:6px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${value}</td></tr>`;
    return `<!doctype html><html><body style="margin:0;background:#faf6f4;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:480px;margin:0 auto;padding:32px 20px;"><div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 4px rgba(0,0,0,0.06);"><h1 style="margin:0 0 6px;font-size:20px;color:#1a1a1a;">Agendamento confirmado ✨</h1><p style="margin:0 0 20px;color:#6b6b6b;font-size:15px;line-height:1.5;">Olá, ${v.customerFirstName}! Seu horário no <strong>${v.salonName}</strong> está confirmado.</p><table style="width:100%;border-collapse:collapse;border-top:1px solid #efe7e3;border-bottom:1px solid #efe7e3;">${row('Serviço', v.serviceNames)}${v.professionalName ? row('Profissional', v.professionalName) : ''}${row('Data', v.dateLabel)}${row('Horário', v.timeLabel)}</table><p style="margin:20px 0 0;color:#9a9a9a;font-size:13px;line-height:1.5;">O pagamento é feito no salão.</p></div><p style="text-align:center;color:#b3aba7;font-size:12px;margin:18px 0 0;">Enviado por Salonpass</p></div></body></html>`;
  }

  private async sendProfessionalNewAppointment(companyId: string, appointmentId: string): Promise<void> {
    try {
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v?.professionalPhone || !v.professionalNotify) return;
      await this.whatsapp.enqueueText(v.professionalPhone, [
        `📋 Novo agendamento para você!`,
        ``,
        `👤 *Cliente:* ${v.customerName}`,
        `💅 *Serviço:* ${v.serviceNames}`,
        `📅 *Data:* ${v.dateLabel}`,
        `⏰ *Horário:* ${v.timeLabel}`,
      ].join('\n'));
    } catch (err) {
      this.logger.error(`Falha ao notificar profissional: ${(err as Error).message}`);
    }
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.appointment.delete({ where: { id } });
  }

  // GET /availability — real free slots honoring schedule + occupation + service duration.
  async availability(companyId: string, serviceId: string, professionalId?: string, date?: string, serviceIds?: string[]) {
    const day = date ?? this.todayInCompanyTz(await this.companyTimezone(companyId));
    const tz = await this.companyTimezone(companyId);

    const empty = { date: day, serviceId: serviceId ?? null, professionalId: professionalId ?? null, slots: [] as { start: string; end: string }[] };

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
      where: { professionalId, weekday, professional: { deletedAt: null } },
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

    const slots: { start: string; end: string }[] = [];
    const durationMs = durationMin * 60000;
    const stepMs = SLOT_STEP_MIN * 60000;
    const now = Date.now();

    for (const win of schedules) {
      const winStart = this.zonedWallClockToUtc(day, win.startTime, tz);
      const winEnd = this.zonedWallClockToUtc(day, win.endTime, tz);

      for (let t = winStart.getTime(); t + durationMs <= winEnd.getTime(); t += stepMs) {
        const slotStart = t;
        const slotEnd = t + durationMs;
        // Skip slots already in the past.
        if (slotEnd <= now) continue;
        slots.push({
          start: new Date(slotStart).toISOString(),
          end: new Date(slotEnd).toISOString(),
        });
      }
    }

    return { date: day, serviceId: serviceId ?? null, professionalId, slots };
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

  // Validate the referenced professional exists within the company.
  private async assertProfessionalExists(companyId: string, professionalId: string) {
    const found = await this.prisma.client.professional.findFirst({
      where: { id: professionalId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Profissional não encontrado');
  }

  private async assertNoOverlap(
    companyId: string,
    professionalId: string,
    start: Date,
    end: Date,
    ignoreId?: string,
    db: Prisma.TransactionClient = this.prisma.client,
  ) {
    const conflict = await db.appointment.findFirst({
      where: {
        companyId,
        professionalId,
        id: ignoreId ? { not: ignoreId } : undefined,
        status: { in: ACTIVE_STATUSES },
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
