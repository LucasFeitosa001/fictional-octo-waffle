import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AppointmentSource, AppointmentStatus } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import {
  BOOKING_APPEARANCE_KEY,
  BOOKING_APPEARANCE_DEFAULTS,
  coerceBookingAppearance,
  type BookingAppearance,
} from '../marketing/marketing.service';
import { CreateBookingDto, CreateReviewDto, UpdateMyProfileDto } from './dto';

// Statuses that still occupy a professional's agenda (everything except
// `canceled`). Mirrors AppointmentsService.ACTIVE_STATUSES — kept local so the
// public agenda marks the same blocks as busy.
const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.scheduled,
  AppointmentStatus.confirmed,
  AppointmentStatus.unconfirmed,
  AppointmentStatus.waiting,
  AppointmentStatus.in_progress,
  AppointmentStatus.done,
  AppointmentStatus.finished,
];

// Auto-confirmation (marketplace style): an online booking that the salon never
// answered is confirmed by the system once it has waited long enough OR is about
// to happen — so a customer is never left hanging on a silent salon.
const AUTO_CONFIRM_AFTER_MS = 5 * 24 * 60 * 60 * 1000; // 5 days unanswered
const AUTO_CONFIRM_IMMINENT_MS = 24 * 60 * 60 * 1000; // …or the appointment is <24h away
const AUTO_CONFIRM_SWEEP_MS = 60 * 60 * 1000; // sweep hourly (+ once at boot)
const AUTO_CONFIRM_BATCH = 50; // cap per sweep so a backlog drains gradually

// Identity of the logged-in customer, when the public request carried a valid
// Better Auth customer session. Guest bookings pass `null`.
export interface BookingUser {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

@Injectable()
export class PublicBookingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PublicBookingService.name);
  private autoConfirmTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly appointments: AppointmentsService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsappService,
    private readonly settings: NotificationSettingsService,
  ) {}

  // Wire the WhatsApp inbound listener so the salon's "1/2/3" replies drive the
  // booking confirmation. Registered once at boot.
  onModuleInit() {
    this.whatsapp.setInboundHandler((msg) => void this.handleManagerReply(msg));
    // Auto-confirm stale/imminent unanswered bookings. App Runner runs a single
    // instance (the WhatsApp socket requires it), so one in-process timer is the
    // whole cluster — no distributed-lock needed. Run once at boot, then hourly.
    void this.autoConfirmStaleBookings();
    this.autoConfirmTimer = setInterval(
      () => void this.autoConfirmStaleBookings(),
      AUTO_CONFIRM_SWEEP_MS,
    );
  }

  onModuleDestroy() {
    if (this.autoConfirmTimer) clearInterval(this.autoConfirmTimer);
  }

  /**
   * Confirms online bookings the salon never answered. A booking is auto-confirmed
   * when it is still `unconfirmed`, hasn't started yet, and EITHER has waited more
   * than AUTO_CONFIRM_AFTER_MS OR is now within AUTO_CONFIRM_IMMINENT_MS of its
   * start — so an imminent appointment is never left pending into the day-of.
   * Each booking is handled independently (one failure can't stall the batch);
   * the customer gets the normal confirmation and the manager a heads-up.
   */
  private async autoConfirmStaleBookings(): Promise<void> {
    const now = Date.now();
    let due: { id: string; companyId: string }[];
    try {
      due = await this.prisma.client.appointment.findMany({
        where: {
          status: AppointmentStatus.unconfirmed,
          source: AppointmentSource.online,
          start: { gte: new Date(now) },
          OR: [
            { createdAt: { lte: new Date(now - AUTO_CONFIRM_AFTER_MS) } },
            { start: { lte: new Date(now + AUTO_CONFIRM_IMMINENT_MS) } },
          ],
        },
        orderBy: { start: 'asc' },
        take: AUTO_CONFIRM_BATCH,
        select: { id: true, companyId: true },
      });
    } catch (err) {
      this.logger.error(`Falha ao varrer agendamentos pendentes: ${(err as Error).message}`);
      return;
    }
    if (due.length === 0) return;

    // One manager-phone lookup per company, reused across that salon's bookings.
    const managerPhones = new Map<string, string | null>();
    // Same for the per-company "notify professional/manager" opt-in toggle.
    const notifyManager = new Map<string, boolean>();
    for (const appt of due) {
      try {
        await this.appointments.setStatus(
          appt.companyId,
          appt.id,
          { status: AppointmentStatus.confirmed },
          undefined,
        );
        await this.sendBookingConfirmation(appt.companyId, appt.id);
        if (!managerPhones.has(appt.companyId)) {
          managerPhones.set(appt.companyId, await this.whatsapp.getManagerPhone(appt.companyId));
        }
        if (!notifyManager.has(appt.companyId)) {
          const auto = await this.settings.get(appt.companyId);
          notifyManager.set(appt.companyId, auto.notifyProfessional);
        }
        const managerPhone = managerPhones.get(appt.companyId);
        // OPT-IN: só avisa o gerente se o salão ativou `notifyProfessional`.
        if (managerPhone && notifyManager.get(appt.companyId)) {
          const v = await this.loadApptView(appt.companyId, appt.id);
          if (v) {
            await this.whatsapp.enqueueText(
              managerPhone,
              [
                `✅ *Agendamento confirmado automaticamente*`,
                `🔖 *Código:* ${this.apptCode(appt.id)}`,
                ``,
                `👤 *Cliente:* ${v.customerName}`,
                `💅 *Serviço:* ${v.serviceNames}`,
                `📅 *Data:* ${v.dateLabel}`,
                `⏰ *Horário:* ${v.timeLabel}`,
                ``,
                `Não houve resposta a tempo, então confirmamos pra você. Avisamos ${v.customerFirstName}.`,
              ].join('\n'),
              // Interações: aviso ao gestor (não ao cliente).
              { companyId: appt.companyId, kind: 'manager' },
            );
          }
        }
        this.logger.log(`Agendamento ${appt.id} confirmado automaticamente (sem resposta do salão).`);
      } catch (err) {
        this.logger.error(
          `Falha ao auto-confirmar agendamento ${appt.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  // Resolve the active booking link → owning company. Throws if missing/disabled.
  private async resolveCompanyId(slug: string): Promise<string> {
    const link = await this.prisma.client.bookingLink.findUnique({
      where: { slug },
      select: { companyId: true, active: true },
    });
    if (!link || !link.active) {
      throw new NotFoundException('Página de agendamento não encontrada');
    }
    return link.companyId;
  }

  // Public salon info shown at the top of the portal.
  async getPortal(slug: string) {
    const companyId = await this.resolveCompanyId(slug);
    const company = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: { name: true, logoUrl: true, timezone: true, addressJson: true },
    });
    const tz = company?.timezone ?? 'America/Sao_Paulo';
    const [status, rating, plan, webProfile, appearanceRow] = await Promise.all([
      this.openStatus(companyId, tz),
      this.ratingSummary(companyId),
      this.planLabel(companyId),
      this.prisma.client.salonWebProfile.findUnique({
        where: { companyId },
        select: { accentColor: true },
      }),
      this.prisma.client.setting.findUnique({
        where: { companyId_key: { companyId, key: BOOKING_APPEARANCE_KEY } },
      }),
    ]);
    // Aparência da página pública. Defaults sensatos quando não há Setting, para
    // nunca quebrar salões sem config.
    const appearance: BookingAppearance = appearanceRow
      ? coerceBookingAppearance(appearanceRow.valueJson)
      : { ...BOOKING_APPEARANCE_DEFAULTS };
    return {
      slug,
      name: company?.name ?? 'Salão',
      logoUrl: company?.logoUrl ?? null,
      timezone: tz,
      open: status.open,
      todayHours: status.todayHours,
      rating,
      location: this.formatLocation(company?.addressJson ?? null),
      plan,
      whatsapp: this.formatWhatsApp(company?.addressJson ?? null),
      googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      // Cor de destaque (marca) do agendamento online, "#RRGGBB". Null → o
      // web-club aplica o rosa padrão da casa. Mantida por compatibilidade; a
      // fonte preferida da cor primária agora é `appearance` (Setting
      // `booking.appearance`), que também carrega accent/background e hideNavbar.
      accentColor: appearance.primaryColor ?? webProfile?.accentColor ?? null,
      // Aparência personalizável da página pública (por empresa). Sempre presente
      // com defaults, então o web-club nunca precisa lidar com ausência.
      appearance,
    };
  }

  // Best-effort WhatsApp number from the company's free-form addressJson. Returns
  // digits only, normalized with the Brazilian country code (55) when missing, so
  // the client can build a wa.me link. Null when no usable phone is present → the
  // UI omits the WhatsApp button.
  private formatWhatsApp(address: unknown): string | null {
    if (!address || typeof address !== 'object') return null;
    const a = address as Record<string, unknown>;
    const raw = [a.phone, a.whatsapp, a.telefone, a.celular].find(
      (v) => typeof v === 'string' && v.trim(),
    );
    if (typeof raw !== 'string') return null;
    let digits = raw.replace(/\D/g, '');
    if (!digits) return null;
    // Local Brazilian numbers (10–11 digits) → prefix the country code.
    if (digits.length <= 11) digits = `55${digits}`;
    return digits;
  }

  // Average review score + count, shown as a ⭐ pill. Null when there are no
  // reviews so the UI omits the rating entirely (no "0.0" / "sem avaliações").
  private async ratingSummary(
    companyId: string,
  ): Promise<{ average: number; count: number } | null> {
    const agg = await this.prisma.client.review.aggregate({
      where: { companyId },
      _avg: { rating: true },
      _count: true,
    });
    if (!agg._count || agg._avg.rating == null) return null;
    return { average: Math.round(agg._avg.rating * 10) / 10, count: agg._count };
  }

  // Salon plan/subscription badge ("Profissional"/"Premium"). Null when the
  // salon has no active-ish subscription, so the badge is hidden.
  private async planLabel(companyId: string): Promise<string | null> {
    const sub = await this.prisma.client.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { plan: { select: { name: true } } },
    });
    switch (sub?.plan?.name) {
      case 'pro':
        return 'Profissional';
      case 'premium':
        return 'Premium';
      case 'basic':
        return 'Essencial';
      default:
        return null;
    }
  }

  // Best-effort human label from the company's free-form addressJson. The shape
  // is not strictly typed, so we read the usual fields defensively and return
  // null when nothing usable is present (UI then omits the location).
  private formatLocation(address: unknown): string | null {
    if (!address || typeof address !== 'object') return null;
    const a = address as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const neighborhood = str(a.neighborhood) ?? str(a.district) ?? str(a.bairro);
    const city = str(a.city) ?? str(a.cidade) ?? str(a.municipality);
    const state = str(a.state) ?? str(a.uf) ?? str(a.estado);
    const parts = [neighborhood, city].filter(Boolean);
    const head = parts.join(', ');
    if (head && state) return `${head} · ${state}`;
    return head || city || state || null;
  }

  // Whether the salon is open right now, derived from the real working hours of
  // its active professionals (ProfessionalSchedule). The salon is "open" when at
  // least one professional is scheduled to work over the current wall-clock time
  // in the salon timezone. Returns `open: null` when no schedules exist at all
  // (hours unknown) so the UI can omit the status instead of guessing "closed".
  private async openStatus(
    companyId: string,
    tz: string,
  ): Promise<{
    open: boolean | null;
    todayHours: { start: string; end: string } | null;
  }> {
    const now = new Date();
    const { weekday, minutes: nowMin } = this.tzNow(now, tz);

    const schedules = await this.prisma.client.professionalSchedule.findMany({
      where: { professional: { companyId, active: true, onlineBookable: true, deletedAt: null } },
      select: { weekday: true, startTime: true, endTime: true },
    });
    if (!schedules.length) return { open: null, todayHours: null };

    const today = schedules.filter((s) => s.weekday === weekday);
    if (!today.length) return { open: false, todayHours: null };

    // Merge today's windows into the salon's overall open span for the day.
    const start = today.reduce((m, s) => (s.startTime < m ? s.startTime : m), today[0].startTime);
    const end = today.reduce((m, s) => (s.endTime > m ? s.endTime : m), today[0].endTime);

    const open = today.some(
      (s) => this.hhmmToMin(s.startTime) <= nowMin && nowMin < this.hhmmToMin(s.endTime),
    );
    return { open, todayHours: { start, end } };
  }

  // Current weekday (0=Sun..6=Sat) and minutes-since-midnight in a given IANA tz.
  private tzNow(d: Date, tz: string): { weekday: number; minutes: number } {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    });
    const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
    return { weekday, minutes: Number(p.hour) * 60 + Number(p.minute) };
  }

  private hhmmToMin(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  // Bookable services: online-enabled, active and visible.
  async getServices(slug: string) {
    const companyId = await this.resolveCompanyId(slug);
    const services = await this.prisma.client.service.findMany({
      where: { companyId, onlineBookable: true, active: true, visible: true, deletedAt: null },
      select: {
        id: true,
        name: true,
        price: true,
        durationMin: true,
        description: true,
        imageUrl: true,
        imageUrls: true,
        categoryId: true,
        favorite: true,
        createdAt: true,
        category: { select: { name: true } },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    // "Novidade" badge: created within the last 30 days.
    const NEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return {
      data: services.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        durationMin: s.durationMin,
        description: s.description,
        imageUrl: s.imageUrl,
        imageUrls: s.imageUrls.length > 0 ? s.imageUrls : s.imageUrl ? [s.imageUrl] : [],
        categoryId: s.categoryId,
        categoryName: s.category?.name ?? null,
        favorite: s.favorite,
        isNew: now - s.createdAt.getTime() < NEW_WINDOW_MS,
      })),
    };
  }

  // Professionals that perform a given service (or ALL services when multiple
  // are selected) and accept online bookings.
  async getProfessionals(slug: string, serviceId: string, serviceIds?: string[]) {
    const companyId = await this.resolveCompanyId(slug);
    if (!serviceId) throw new BadRequestException('serviceId é obrigatório');

    const ids = serviceIds?.length ? serviceIds : [serviceId];

    // When multiple services are selected, find professionals who perform ALL of them.
    const professionals = await this.prisma.client.professional.findMany({
      where: {
        companyId,
        onlineBookable: true,
        active: true,
        deletedAt: null,
        // Each service must have a link to this professional.
        AND: ids.map((sid) => ({ services: { some: { serviceId: sid } } })),
      },
      select: { id: true, name: true, nickname: true, avatarUrl: true, profession: true },
      orderBy: { name: 'asc' },
    });
    return { data: professionals };
  }

  // Free slots for the chosen service(s)/professional/day. When multiple
  // services are selected the engine uses the combined duration so the slot
  // is large enough to fit them all back-to-back.
  async getAvailability(
    slug: string,
    serviceId: string,
    professionalId: string,
    date?: string,
    serviceIds?: string[],
  ) {
    const companyId = await this.resolveCompanyId(slug);
    if (!serviceIds || serviceIds.length <= 1) {
      return this.appointments.availability(companyId, serviceId, professionalId, date);
    }
    // Multi-service: sum durations and pass as override.
    return this.appointments.availability(companyId, serviceId, professionalId, date, serviceIds);
  }

  // Public availability view for the agenda grid. Returns online-bookable
  // professionals, their occupied blocks within [from, to) and their working
  // windows. PRIVACY: busy blocks carry only the time window and professionalId
  // — never the customer, service or any note — so the public view can show
  // free/busy without leaking who is booked.
  async getAgenda(slug: string, from?: string, to?: string) {
    const companyId = await this.resolveCompanyId(slug);

    // Default range: now → +7 days, in case the client omits the window. The
    // client normally sends an explicit [from, to) for the week it renders.
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 7 * 24 * 60 * 60000);

    const professionals = await this.prisma.client.professional.findMany({
      where: { companyId, onlineBookable: true, active: true, deletedAt: null },
      select: { id: true, name: true, nickname: true, avatarUrl: true, profession: true },
      orderBy: { name: 'asc' },
    });
    const proIds = professionals.map((p) => p.id);
    if (!proIds.length) return { professionals, busy: [], schedules: [] };

    const [busyRows, scheduleRows] = await Promise.all([
      this.prisma.client.appointment.findMany({
        where: {
          companyId,
          professionalId: { in: proIds },
          status: { in: ACTIVE_STATUSES },
          start: { lt: end },
          end: { gt: start },
        },
        select: { professionalId: true, start: true, end: true },
      }),
      this.prisma.client.professionalSchedule.findMany({
        where: { professionalId: { in: proIds } },
        select: { professionalId: true, weekday: true, startTime: true, endTime: true },
      }),
    ]);

    return {
      professionals,
      busy: busyRows
        .filter((b): b is typeof b & { professionalId: string } => !!b.professionalId)
        .map((b) => ({
          professionalId: b.professionalId,
          start: b.start.toISOString(),
          end: b.end.toISOString(),
        })),
      schedules: scheduleRows,
    };
  }

  // Create an online appointment. Pay-at-salon (no gateway in v1).
  async book(slug: string, dto: CreateBookingDto, user: BookingUser | null) {
    const companyId = await this.resolveCompanyId(slug);

    // Validate all requested services are online-bookable for this salon.
    const allServiceIds = dto.serviceIds?.length ? dto.serviceIds : [dto.serviceId];
    for (const sid of allServiceIds) {
      const service = await this.prisma.client.service.findFirst({
        where: {
          id: sid,
          companyId,
          onlineBookable: true,
          active: true,
          visible: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!service) throw new NotFoundException('Serviço indisponível para agendamento');
    }

    const customerId = user
      ? await this.resolveLoggedCustomer(companyId, user)
      : await this.resolveGuestCustomer(companyId, dto);

    // A logged-in customer (e.g. a Google sign-up) may have no phone on file —
    // they supply it at booking time. Persist it on the Customer (so the WhatsApp
    // confirmation can reach them) and on the User (so it pre-fills next time).
    if (user && dto.phone?.trim()) {
      const phone = dto.phone.trim();
      await this.prisma.client.customer.update({ where: { id: customerId }, data: { phone } });
      await this.prisma.client.user
        .update({ where: { id: user.id }, data: { phone } })
        .catch(() => undefined);
    }

    // The salon-confirms-first flow kicks in when a manager phone is on file.
    // The message is enqueued (outbox) regardless of socket status — it'll be
    // sent once WhatsApp reconnects. autoConfirmStaleBookings() catches any
    // booking that goes unanswered.
    const managerPhone = await this.whatsapp.getManagerPhone(companyId);
    const salonConfirms = Boolean(managerPhone);

    // Build items from the validated serviceIds list.
    const items = allServiceIds.map((sid) => ({
      serviceId: sid,
      professionalId: dto.professionalId,
    }));

    const appointment = await this.appointments.create(
      companyId,
      {
        customerId,
        professionalId: dto.professionalId,
        start: dto.start,
        notes: dto.notes,
        items,
      },
      {
        source: AppointmentSource.online,
        ...(salonConfirms ? { status: AppointmentStatus.unconfirmed } : {}),
      },
    );

    if (salonConfirms && managerPhone) {
      // Ask the salon to confirm; the CLIENT is only told once the salon replies.
      void this.sendSalonConfirmationRequest(companyId, appointment.id, managerPhone);
    } else {
      // No salon gatekeeper → confirm immediately and notify the client.
      void this.sendBookingConfirmation(companyId, appointment.id);
    }

    return { id: appointment.id, status: appointment.status, payment: 'pay_at_salon' };
  }

  // ---------------------------------------------------------------------------
  // Salon-confirms-first WhatsApp flow
  // ---------------------------------------------------------------------------

  // Loads the appointment display fields (salon-facing copy needs the client's
  // name + contact too) for both the salon prompt and the client notifications.
  private async loadApptView(companyId: string, appointmentId: string) {
    const appt = await this.prisma.client.appointment.findFirst({
      where: { id: appointmentId, companyId },
      select: {
        start: true,
        // customerId exposto p/ vincular as mensagens ao histórico "Interações".
        customerId: true,
        company: { select: { name: true, timezone: true } },
        customer: { select: { name: true, email: true, phone: true } },
        professional: { select: { name: true } },
        items: { select: { service: { select: { name: true } } } },
      },
    });
    if (!appt) return null;
    const tz = appt.company.timezone || 'America/Sao_Paulo';
    const dateLabel = new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
    }).format(appt.start);
    const timeLabel = new Intl.DateTimeFormat('pt-BR', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
    }).format(appt.start);
    return {
      customerId: appt.customerId ?? null,
      salonName: appt.company.name,
      professionalName: appt.professional?.name ?? null,
      serviceNames: appt.items.map((it) => it.service.name).join(', ') || 'Serviço',
      customerName: (appt.customer?.name ?? '').trim() || 'Cliente',
      customerFirstName: (appt.customer?.name ?? '').trim().split(' ')[0] || 'cliente',
      customerEmail: appt.customer?.email?.trim() || null,
      customerPhone: appt.customer?.phone?.trim() || null,
      dateLabel,
      timeLabel,
    };
  }

  // Short, human-typable id for an appointment (last 4 chars of the cuid, upper-
  // cased). Shown in the manager prompt so a 1/2/3 reply can target a SPECIFIC
  // booking when several are pending at once — otherwise "1" is ambiguous.
  private apptCode(id: string): string {
    return id.slice(-4).toUpperCase();
  }

  private async findPendingByCode(companyId: string, code: string): Promise<{ id: string } | null> {
    const candidates = await this.prisma.client.appointment.findMany({
      where: {
        companyId,
        status: AppointmentStatus.unconfirmed,
        source: AppointmentSource.online,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return candidates.find((a) => this.apptCode(a.id) === code) ?? null;
  }

  // Sends the manager the "confirm / cancel / suggest" prompt. Plain text with
  // numbered replies — WhatsApp interactive buttons are unreliable/blocked for
  // unofficial clients, so 1/2/3 it is.
  private async sendSalonConfirmationRequest(
    companyId: string,
    appointmentId: string,
    managerPhone: string,
  ): Promise<void> {
    try {
      // OPT-IN: só manda o pedido de confirmação ao gerente se o salão ativou
      // `notifyProfessional`. Sem o toggle, o agendamento fica pendente e o
      // auto-confirm cuida dele — nenhuma mensagem sai ao gerente.
      const auto = await this.settings.get(companyId);
      if (!auto.notifyProfessional) return;
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v) return;
      const code = this.apptCode(appointmentId);
      const lines = [
        `🔔 *Novo agendamento para confirmar*`,
        `🔖 *Código:* ${code}`,
        ``,
        `👤 *Cliente:* ${v.customerName}`,
        `💅 *Serviço:* ${v.serviceNames}`,
        v.professionalName ? `👩 *Profissional:* ${v.professionalName}` : null,
        `📅 *Data:* ${v.dateLabel}`,
        `⏰ *Horário:* ${v.timeLabel}`,
        ``,
        `Responda com:`,
        `*1* — Confirmar`,
        `*2* — Cancelar _(opcional: escreva o motivo, ex.: "2 sem horário")_`,
        `*3* — Sugerir outro horário _(escreva a sugestão, ex.: "3 que tal quinta às 15h?")_`,
        ``,
        `_Se houver mais de um pendente, inclua o código, ex.: "1 ${code}"._`,
      ].filter((l): l is string => l !== null);
      // Interações: pedido de confirmação enviado ao gestor.
      await this.whatsapp.enqueueText(managerPhone, lines.join('\n'), {
        companyId,
        kind: 'manager',
      });
    } catch (err) {
      this.logger.error(`Falha ao pedir confirmação ao salão: ${(err as Error).message}`);
    }
  }

  // Handles a plain-text reply from a salon's manager number. Resolves which
  // salon it belongs to, acts on that salon's OLDEST pending (unconfirmed,
  // online) appointment, and notifies the client only when appropriate.
  private async handleManagerReply(msg: {
    fromDigits: string;
    text: string;
    quotedText?: string;
    companyId?: string;
  }): Promise<void> {
    try {
      // Multi-tenant: cada socket é de UMA empresa, então o companyId da mensagem
      // (empresa dona do socket em que a resposta chegou) é a fonte de verdade.
      // Fallback ao lookup por dígitos do gerente para manter compat/robustez.
      const companyId =
        msg.companyId ?? (await this.whatsapp.findCompanyByManagerDigits(msg.fromDigits));
      if (!companyId) return; // not a known manager number — ignore

      const trimmed = msg.text.trim();
      const action = trimmed[0];
      if (action !== '1' && action !== '2' && action !== '3') {
        await this.whatsapp.enqueueText(
          msg.fromDigits,
          'Não entendi. Responda *1* para confirmar, *2* para cancelar ou *3* para sugerir outro horário.',
          { companyId, kind: 'manager' },
        );
        return;
      }
      let rest = trimmed.slice(1).replace(/^[\s.:,-]+/, '').trim();

      // Resolve which pending appointment this reply targets. Three strategies,
      // in priority order:
      // 1. Quoted reply: the manager swiped on a prompt → extract the code from
      //    the quoted text ("🔖 *Código:* XXXX").
      // 2. Inline code: "1 XXXX" in the reply text itself.
      // 3. Fallback: most recent pending booking.
      let pending: { id: string } | null = null;

      // Strategy 1: code from the quoted (swiped) message
      if (!pending && msg.quotedText) {
        const qm = msg.quotedText.match(/Código:\*?\s*([A-Z0-9]{4,8})/i);
        if (qm) {
          pending = await this.findPendingByCode(companyId, qm[1].toUpperCase());
        }
      }

      // Strategy 2: explicit code typed in the reply
      const codeMatch = rest.match(/^([A-Za-z0-9]{4,8})\b/);
      if (!pending && codeMatch) {
        const hit = await this.findPendingByCode(companyId, codeMatch[1].toUpperCase());
        if (hit) {
          pending = hit;
          rest = rest.slice(codeMatch[1].length).replace(/^[\s.:,-]+/, '').trim();
        }
      }

      // Strategy 3: most recent pending
      if (!pending) {
        pending = await this.prisma.client.appointment.findFirst({
          where: {
            companyId,
            status: AppointmentStatus.unconfirmed,
            source: AppointmentSource.online,
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
      }
      // Free-text remainder after the digit (and optional code) — reason/suggestion.
      const extra = rest;
      if (!pending) {
        await this.whatsapp.enqueueText(msg.fromDigits, 'Não há agendamentos pendentes de confirmação. ✅', {
          companyId,
          kind: 'manager',
        });
        return;
      }

      const v = await this.loadApptView(companyId, pending.id);
      const clientName = v?.customerName ?? 'cliente';

      if (action === '1') {
        await this.appointments.setStatus(
          companyId,
          pending.id,
          { status: AppointmentStatus.confirmed },
          undefined,
        );
        await this.sendBookingConfirmation(companyId, pending.id);
        await this.whatsapp.enqueueText(msg.fromDigits, `✅ Confirmado! Avisamos ${clientName}.`, {
          companyId,
          kind: 'manager',
        });
        return;
      }

      if (action === '2') {
        await this.appointments.setStatus(
          companyId,
          pending.id,
          { status: AppointmentStatus.canceled },
          undefined,
        );
        await this.notifyClientCanceled(companyId, pending.id, extra);
        await this.whatsapp.enqueueText(msg.fromDigits, `❌ Cancelado. Avisamos ${clientName}.`, {
          companyId,
          kind: 'manager',
        });
        return;
      }

      // action === '3': suggest another time. Keep it pending so the salon can
      // still confirm/cancel later; just relay the suggestion to the client.
      if (!extra) {
        await this.whatsapp.enqueueText(
          msg.fromDigits,
          'Para sugerir, escreva a sugestão junto, ex.: "3 que tal quinta às 15h?".',
          { companyId, kind: 'manager' },
        );
        return;
      }
      await this.notifyClientSuggestion(companyId, pending.id, extra);
      await this.whatsapp.enqueueText(
        msg.fromDigits,
        `📨 Sugestão enviada a ${clientName}. O agendamento segue *pendente* até você confirmar (responda 1) ou cancelar (responda 2).`,
        { companyId, kind: 'manager' },
      );
    } catch (err) {
      this.logger.error(`Falha ao processar resposta do salão: ${(err as Error).message}`);
    }
  }

  // Tells the client their booking was canceled by the salon, relaying the
  // optional reason the manager typed.
  private async notifyClientCanceled(
    companyId: string,
    appointmentId: string,
    reason: string,
  ): Promise<void> {
    try {
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v) return;
      const reasonLine = reason ? `\n\nMotivo: ${reason}` : '';
      if (v.customerPhone) {
        const lines = [
          `Olá, ${v.customerFirstName}.`,
          ``,
          `Infelizmente seu agendamento no *${v.salonName}* (${v.serviceNames} — ${v.dateLabel} às ${v.timeLabel}) foi *cancelado* pelo salão.${reasonLine}`,
          ``,
          `Se quiser, é só agendar um novo horário. 💖`,
        ];
        // Interações: cancelamento avisado ao cliente.
        await this.whatsapp.enqueueText(v.customerPhone, lines.join('\n'), {
          companyId,
          customerId: v.customerId ?? undefined,
          kind: 'cancellation',
        });
      }
      if (v.customerEmail) {
        await this.email.send({
          to: v.customerEmail,
          subject: `Agendamento cancelado — ${v.salonName}`,
          html:
            `<p>Olá, ${v.customerFirstName}.</p>` +
            `<p>Infelizmente seu agendamento no <strong>${v.salonName}</strong> ` +
            `(${v.serviceNames} — ${v.dateLabel} às ${v.timeLabel}) foi cancelado pelo salão.` +
            (reason ? `<br>Motivo: ${reason}` : '') +
            `</p><p>Se quiser, é só agendar um novo horário.</p>`,
        });
      }
    } catch (err) {
      this.logger.error(`Falha ao avisar cliente do cancelamento: ${(err as Error).message}`);
    }
  }

  // Relays the salon's alternative-time suggestion to the client. The booking
  // stays pending; the client is asked to get back in touch.
  private async notifyClientSuggestion(
    companyId: string,
    appointmentId: string,
    suggestion: string,
  ): Promise<void> {
    try {
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v) return;
      if (v.customerPhone) {
        const lines = [
          `Olá, ${v.customerFirstName}! ✨`,
          ``,
          `Sobre seu agendamento no *${v.salonName}* (${v.serviceNames} — ${v.dateLabel} às ${v.timeLabel}):`,
          ``,
          `O salão sugeriu outro horário:`,
          `*${suggestion}*`,
          ``,
          `Pode responder por aqui para combinar o melhor horário. 💖`,
        ];
        // Interações: sugestão de novo horário ao cliente (fluxo de confirmação).
        await this.whatsapp.enqueueText(v.customerPhone, lines.join('\n'), {
          companyId,
          customerId: v.customerId ?? undefined,
          kind: 'confirmation',
        });
      }
      if (v.customerEmail) {
        await this.email.send({
          to: v.customerEmail,
          subject: `Sugestão de novo horário — ${v.salonName}`,
          html:
            `<p>Olá, ${v.customerFirstName}!</p>` +
            `<p>Sobre seu agendamento no <strong>${v.salonName}</strong> ` +
            `(${v.serviceNames} — ${v.dateLabel} às ${v.timeLabel}), o salão sugeriu outro horário:</p>` +
            `<p><strong>${suggestion}</strong></p>` +
            `<p>Entre em contato com o salão para combinar o melhor horário.</p>`,
        });
      }
    } catch (err) {
      this.logger.error(`Falha ao enviar sugestão ao cliente: ${(err as Error).message}`);
    }
  }

  // Loads the just-created appointment's display data and notifies the customer
  // by e-mail and WhatsApp. Wrapped so any failure (no contact on file, Resend
  // or WhatsApp down) is swallowed: the appointment already exists and must
  // stand on its own.
  private async sendBookingConfirmation(
    companyId: string,
    appointmentId: string,
  ): Promise<void> {
    try {
      // OPT-IN: só envia a confirmação ao cliente quando o salão ativou
      // `confirmation` (default OFF). Sem o toggle, nada é enviado ao cliente.
      const auto = await this.settings.get(companyId);
      if (!auto.confirmation) return;

      const appt = await this.prisma.client.appointment.findFirst({
        where: { id: appointmentId, companyId },
        select: {
          start: true,
          customerId: true,
          company: { select: { name: true, timezone: true } },
          customer: { select: { name: true, email: true, phone: true } },
          professional: { select: { name: true } },
          items: { select: { service: { select: { name: true } } } },
        },
      });
      if (!appt) return;

      const tz = appt.company.timezone || 'America/Sao_Paulo';
      const dateLabel = new Intl.DateTimeFormat('pt-BR', {
        timeZone: tz,
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }).format(appt.start);
      const timeLabel = new Intl.DateTimeFormat('pt-BR', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
      }).format(appt.start);
      const serviceNames = appt.items.map((it) => it.service.name).join(', ') || 'Serviço';
      const salonName = appt.company.name;
      const professionalName = appt.professional?.name ?? null;
      const firstName = (appt.customer?.name ?? '').trim().split(' ')[0] || 'cliente';

      const email = appt.customer?.email?.trim();
      if (email) {
        await this.email.send({
          to: email,
          subject: `Agendamento confirmado — ${salonName}`,
          html: this.bookingEmailHtml({
            firstName,
            salonName,
            serviceNames,
            professionalName,
            dateLabel,
            timeLabel,
          }),
        });
      }

      const phone = appt.customer?.phone?.trim();
      if (phone) {
        await this.whatsapp.enqueueText(
          phone,
          this.bookingWhatsappText({
            firstName,
            salonName,
            serviceNames,
            professionalName,
            dateLabel,
            timeLabel,
          }),
          // Interações: confirmação de agendamento enviada ao cliente.
          { companyId, customerId: appt.customerId ?? undefined, kind: 'confirmation' },
        );
      }
    } catch {
      // Intentionally swallowed — booking succeeds regardless of notifications.
    }
  }

  // Plain-text WhatsApp confirmation (uses WhatsApp markdown: *bold*).
  private bookingWhatsappText(p: {
    firstName: string;
    salonName: string;
    serviceNames: string;
    professionalName: string | null;
    dateLabel: string;
    timeLabel: string;
  }): string {
    const lines = [
      `Olá, ${p.firstName}! ✨`,
      ``,
      `Seu agendamento no *${p.salonName}* está confirmado:`,
      ``,
      `💅 *Serviço:* ${p.serviceNames}`,
      p.professionalName ? `👩 *Profissional:* ${p.professionalName}` : null,
      `📅 *Data:* ${p.dateLabel}`,
      `⏰ *Horário:* ${p.timeLabel}`,
      ``,
      `O pagamento é feito no salão. Até logo! 💖`,
    ].filter((l): l is string => l !== null);
    return lines.join('\n');
  }

  // Minimal, inline-styled HTML so it renders consistently across e-mail clients.
  private bookingEmailHtml(p: {
    firstName: string;
    salonName: string;
    serviceNames: string;
    professionalName: string | null;
    dateLabel: string;
    timeLabel: string;
  }): string {
    const row = (label: string, value: string) =>
      `<tr><td style="padding:6px 0;color:#6b6b6b;font-size:14px;">${label}</td>` +
      `<td style="padding:6px 0;color:#1a1a1a;font-size:14px;font-weight:600;text-align:right;">${value}</td></tr>`;
    return `<!doctype html><html><body style="margin:0;background:#faf6f4;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border-radius:16px;padding:28px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <h1 style="margin:0 0 6px;font-size:20px;color:#1a1a1a;">Agendamento confirmado ✨</h1>
      <p style="margin:0 0 20px;color:#6b6b6b;font-size:15px;line-height:1.5;">
        Olá, ${p.firstName}! Seu horário no <strong>${p.salonName}</strong> está confirmado.
      </p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #efe7e3;border-bottom:1px solid #efe7e3;">
        ${row('Serviço', p.serviceNames)}
        ${p.professionalName ? row('Profissional', p.professionalName) : ''}
        ${row('Data', p.dateLabel)}
        ${row('Horário', p.timeLabel)}
      </table>
      <p style="margin:20px 0 0;color:#9a9a9a;font-size:13px;line-height:1.5;">
        O pagamento é feito no salão. Em caso de imprevisto, entre em contato para reagendar.
      </p>
    </div>
    <p style="text-align:center;color:#b3aba7;font-size:12px;margin:18px 0 0;">Enviado por Salonpass</p>
  </div>
</body></html>`;
  }

  // Appointments of the logged-in customer at this salon (most recent first).
  async getMyAppointments(slug: string, user: BookingUser) {
    const companyId = await this.resolveCompanyId(slug);
    const customer = await this.prisma.client.customer.findFirst({
      where: { companyId, userId: user.id },
      select: { id: true },
    });
    if (!customer) return { data: [] };

    const appointments = await this.prisma.client.appointment.findMany({
      where: { companyId, customerId: customer.id },
      orderBy: { start: 'desc' },
      take: 50,
      select: {
        id: true,
        start: true,
        end: true,
        status: true,
        professional: { select: { name: true } },
        items: { select: { service: { select: { name: true } } } },
        review: { select: { rating: true } },
      },
    });

    return {
      data: appointments.map((a) => {
        const reviewed = !!a.review;
        return {
          id: a.id,
          start: a.start.toISOString(),
          end: a.end.toISOString(),
          status: a.status,
          professionalName: a.professional?.name ?? null,
          serviceNames: a.items.map((it) => it.service.name),
          canCancel: this.isCancelable(a.status, a.start),
          // Reviewable once the service is complete and not already rated.
          canReview: this.isReviewable(a.status) && !reviewed,
          reviewed,
          rating: a.review?.rating ?? null,
        };
      }),
    };
  }

  // Only completed appointments can be reviewed by the customer.
  private isReviewable(status: AppointmentStatus): boolean {
    return status === AppointmentStatus.finished || status === AppointmentStatus.done;
  }

  // The customer leaves a star rating (+ optional comment) for a finished
  // appointment of theirs. One review per appointment (enforced by the unique
  // appointmentId). Nothing is ever deleted — a Review row is simply created.
  async reviewMyAppointment(
    slug: string,
    user: BookingUser,
    appointmentId: string,
    dto: CreateReviewDto,
  ) {
    const companyId = await this.resolveCompanyId(slug);
    const customer = await this.prisma.client.customer.findFirst({
      where: { companyId, userId: user.id },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Agendamento não encontrado');

    const appointment = await this.prisma.client.appointment.findFirst({
      where: { id: appointmentId, companyId, customerId: customer.id },
      select: {
        id: true,
        status: true,
        professionalId: true,
        items: { select: { serviceId: true }, take: 1 },
        review: { select: { id: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado');
    if (!this.isReviewable(appointment.status)) {
      throw new BadRequestException('Só é possível avaliar um atendimento concluído');
    }
    if (appointment.review) {
      throw new BadRequestException('Este atendimento já foi avaliado');
    }

    await this.prisma.client.review.create({
      data: {
        companyId,
        customerId: customer.id,
        professionalId: appointment.professionalId,
        serviceId: appointment.items[0]?.serviceId ?? null,
        appointmentId: appointment.id,
        rating: dto.rating,
        comment: dto.comment?.trim() || null,
      },
    });
    return { id: appointment.id, rating: dto.rating, reviewed: true as const };
  }

  // In-app notification feed for the logged-in customer (the club app bell).
  // These rows are written by NotificationsService.notifyAppointment whenever
  // one of the customer's appointments is created/confirmed/canceled.
  async getMyNotifications(slug: string, user: BookingUser, limit = 30) {
    const companyId = await this.resolveCompanyId(slug);
    const take = Math.min(Math.max(limit, 1), 100);
    const where = { companyId, userId: user.id };
    const [data, unreadCount] = await Promise.all([
      this.prisma.client.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.client.notification.count({ where: { ...where, readAt: null } }),
    ]);
    return {
      data: data.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    };
  }

  async markMyNotificationRead(slug: string, user: BookingUser, id: string) {
    const companyId = await this.resolveCompanyId(slug);
    await this.prisma.client.notification.updateMany({
      where: { id, companyId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true as const };
  }

  async markAllMyNotificationsRead(slug: string, user: BookingUser) {
    const companyId = await this.resolveCompanyId(slug);
    await this.prisma.client.notification.updateMany({
      where: { companyId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true as const };
  }

  // The logged-in customer's editable profile (name + WhatsApp). Read from the
  // auth User (the global identity), which is what pre-fills the booking form.
  async getMyProfile(slug: string, user: BookingUser) {
    await this.resolveCompanyId(slug); // 404s on a bad/disabled slug, like the rest
    const u = await this.prisma.client.user.findUnique({
      where: { id: user.id },
      select: { name: true, phone: true, email: true },
    });
    return {
      name: u?.name ?? user.name ?? '',
      phone: u?.phone ?? null,
      email: u?.email ?? user.email ?? null,
    };
  }

  // Edit name/WhatsApp from the club account page. Writes to the auth User (so it
  // pre-fills future bookings and the greeting) and mirrors onto this salon's
  // Customer row when one exists (so the salon sees the up-to-date contact).
  async updateMyProfile(slug: string, user: BookingUser, dto: UpdateMyProfileDto) {
    const companyId = await this.resolveCompanyId(slug);
    const name = dto.name?.trim();
    const phone = dto.phone?.trim();
    // Only the fields the form actually sent; ignore empty patches.
    const data: { name?: string; phone?: string | null } = {};
    if (name) data.name = name;
    if (phone !== undefined) data.phone = phone || null;
    if (Object.keys(data).length === 0) {
      return this.getMyProfile(slug, user);
    }
    await this.prisma.client.user.update({ where: { id: user.id }, data });
    // Keep this salon's customer record in sync (best-effort; never blocks).
    await this.prisma.client.customer
      .updateMany({ where: { companyId, userId: user.id }, data })
      .catch(() => undefined);
    return this.getMyProfile(slug, user);
  }

  // Customer cancels their own upcoming appointment.
  async cancelMyAppointment(slug: string, user: BookingUser, appointmentId: string) {
    const companyId = await this.resolveCompanyId(slug);
    const customer = await this.prisma.client.customer.findFirst({
      where: { companyId, userId: user.id },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Agendamento não encontrado');

    const appointment = await this.prisma.client.appointment.findFirst({
      where: { id: appointmentId, companyId, customerId: customer.id },
      select: { id: true, status: true, start: true },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado');
    if (!this.isCancelable(appointment.status, appointment.start)) {
      throw new BadRequestException('Este agendamento não pode mais ser cancelado');
    }

    await this.appointments.setStatus(
      companyId,
      appointmentId,
      { status: AppointmentStatus.canceled },
      undefined,
    );
    // Ping the salon's WhatsApp (owner/manager are the same number) so the salon
    // sees a client-initiated cancellation immediately — the in-app bell alone is
    // easy to miss. Fire-and-forget: the cancel must succeed regardless.
    void this.notifySalonClientCanceled(companyId, appointmentId);
    return { id: appointmentId, status: AppointmentStatus.canceled };
  }

  // Tells the salon (manager WhatsApp) that the CLIENT canceled their own booking
  // from the club app. Mirrors the booking-request prompt, minus the 1/2/3 reply
  // (there is nothing for the salon to act on — the slot is already freed).
  private async notifySalonClientCanceled(
    companyId: string,
    appointmentId: string,
  ): Promise<void> {
    try {
      // OPT-IN: só avisa o salão (gerente) do cancelamento do cliente quando o
      // salão ativou `notifyProfessional`. Sem o toggle, nada é enviado.
      const auto = await this.settings.get(companyId);
      if (!auto.notifyProfessional) return;
      const managerPhone = await this.whatsapp.getManagerPhone(companyId);
      if (!managerPhone) return; // salon hasn't configured a WhatsApp number
      const v = await this.loadApptView(companyId, appointmentId);
      if (!v) return;
      const lines = [
        `❌ *Agendamento cancelado pelo cliente*`,
        `🔖 *Código:* ${this.apptCode(appointmentId)}`,
        ``,
        `👤 *Cliente:* ${v.customerName}`,
        v.customerPhone ? `📱 *Telefone:* ${v.customerPhone}` : null,
        `💅 *Serviço:* ${v.serviceNames}`,
        v.professionalName ? `👩 *Profissional:* ${v.professionalName}` : null,
        `📅 *Data:* ${v.dateLabel}`,
        `⏰ *Horário:* ${v.timeLabel}`,
        ``,
        `O horário foi liberado na sua agenda.`,
      ].filter((l): l is string => l !== null);
      // Interações: aviso ao gestor de cancelamento feito pelo cliente.
      await this.whatsapp.enqueueText(managerPhone, lines.join('\n'), {
        companyId,
        kind: 'manager',
      });
    } catch (err) {
      this.logger.error(`Falha ao avisar salão do cancelamento: ${(err as Error).message}`);
    }
  }

  // An appointment can be canceled by the customer if it is still upcoming and
  // not already in a terminal state.
  private isCancelable(status: AppointmentStatus, start: Date): boolean {
    const terminal: AppointmentStatus[] = [
      AppointmentStatus.canceled,
      AppointmentStatus.finished,
      AppointmentStatus.done,
    ];
    if (terminal.includes(status)) return false;
    return start.getTime() > Date.now();
  }

  // Find or create the Customer record linked to a logged-in portal user,
  // scoped to the salon being booked.
  private async resolveLoggedCustomer(
    companyId: string,
    user: BookingUser,
  ): Promise<string> {
    const existing = await this.prisma.client.customer.findFirst({
      where: { companyId, userId: user.id },
      select: { id: true },
    });
    if (existing) return existing.id;

    const created = await this.prisma.client.customer.create({
      data: {
        companyId,
        userId: user.id,
        name: user.name?.trim() || user.email || 'Cliente',
        email: user.email ?? null,
        phone: user.phone ?? null,
      },
      select: { id: true },
    });
    return created.id;
  }

  // Guest quick-booking: reuse a customer matched by phone, else create one.
  private async resolveGuestCustomer(
    companyId: string,
    dto: CreateBookingDto,
  ): Promise<string> {
    const guest = dto.guest;
    if (!guest?.name) {
      throw new BadRequestException('Informe seu nome para agendar');
    }
    if (!guest.phone && !guest.email) {
      throw new BadRequestException('Informe telefone ou e-mail para contato');
    }

    if (guest.phone) {
      const match = await this.prisma.client.customer.findFirst({
        where: { companyId, phone: guest.phone },
        select: { id: true },
      });
      if (match) return match.id;
    }

    const created = await this.prisma.client.customer.create({
      data: {
        companyId,
        name: guest.name.trim(),
        phone: guest.phone ?? null,
        email: guest.email ?? null,
      },
      select: { id: true },
    });
    return created.id;
  }
}
