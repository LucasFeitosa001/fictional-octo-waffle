import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCashbackRuleDto,
  CreateGalleryPhotoDto,
  CreatePromotionDto,
  HEX_COLOR,
  UpdateBookingAppearanceDto,
  UpdateBookingLinkDto,
  UpdateBusinessHoursDto,
  UpdateCashbackConfigDto,
  UpdateCashbackRuleDto,
  UpdatePromotionDto,
  UpdateReviewSettingsDto,
  UpdateWebProfileDto,
} from './dto';

// One normalized row of the salon's weekly opening hours.
export interface BusinessHoursDay {
  weekday: number; // 0 = Sunday … 6 = Saturday
  open: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

const REVIEW_SETTINGS_KEY = 'review_config';

// Setting key that stores each salon's public booking-page appearance.
export const BOOKING_APPEARANCE_KEY = 'booking.appearance';

// Aparência da página pública de agendamento. Cores em hex "#RRGGBB" (ou null
// quando não definidas → o web-club aplica seus defaults). `hideNavbar` esconde
// a barra preta do topo. Defaults sensatos: navbar visível, cores nulas (o
// front cai no tema da casa).
export interface BookingAppearance {
  hideNavbar: boolean;
  primaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
}

export const BOOKING_APPEARANCE_DEFAULTS: BookingAppearance = {
  hideNavbar: false,
  primaryColor: null,
  accentColor: null,
  backgroundColor: null,
};

// Coerce whatever is stored in the Setting JSON into a well-formed appearance,
// so a partial/legacy blob never breaks the public page. Exported so the public
// booking endpoint can reuse the exact same normalization.
export function coerceBookingAppearance(raw: unknown): BookingAppearance {
  const v = (raw ?? {}) as Record<string, unknown>;
  const hex = (x: unknown): string | null =>
    typeof x === 'string' && HEX_COLOR.test(x.trim()) ? x.trim().toUpperCase() : null;
  return {
    hideNavbar: v.hideNavbar === true,
    primaryColor: hex(v.primaryColor),
    accentColor: hex(v.accentColor),
    backgroundColor: hex(v.backgroundColor),
  };
}

// Salonpass defaults for the review-request texts (generic salon copy — no
// third-party branding). Placeholders %NOME% / %LINK% are filled at send time.
const REVIEW_SETTINGS_DEFAULTS = {
  moduleActive: true,
  headerTitle: 'Nós adoraríamos o seu feedback!',
  headerText:
    'Ficamos felizes por você ter nos escolhido. Avalie o atendimento dos nossos profissionais abaixo — leva menos de um minuto e será de grande ajuda!',
  successText: 'A sua opinião é muito importante para nós :)',
  footerText:
    'A sua opinião nos ajuda a sempre entregar os melhores serviços. Agradecemos a sua participação!',
  requestMessage:
    'Olá %NOME%! Adoraríamos saber como foi o seu atendimento. Avalie em: %LINK%',
};

type ReviewSettings = typeof REVIEW_SETTINGS_DEFAULTS;

type ReviewAggInput = {
  rating: number;
  comment: string | null;
  professional: { id: string; name: string } | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- booking link (one per company; auto-provisioned) ----
  async getBookingLink(companyId: string) {
    let link = await this.prisma.client.bookingLink.findFirst({ where: { companyId } });
    if (!link) {
      const company = await this.prisma.client.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      const base = slugify(company?.name ?? 'empresa') || 'empresa';
      let slug = base;
      // Ensure unique slug.
      for (let i = 0; i < 5; i++) {
        const exists = await this.prisma.client.bookingLink.findUnique({ where: { slug } });
        if (!exists) break;
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      }
      link = await this.prisma.client.bookingLink.create({
        data: { companyId, slug },
      });
    }
    return link;
  }

  async updateBookingLink(companyId: string, dto: UpdateBookingLinkDto) {
    const link = await this.getBookingLink(companyId);
    const data: { slug?: string; active?: boolean } = {};
    if (dto.slug !== undefined) data.slug = slugify(dto.slug);
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.client.bookingLink.update({ where: { id: link.id }, data });
  }

  // ---- business hours (Company.businessHoursJson) ----
  // Reads the salon's weekly opening hours, always returning a normalized
  // Sunday→Saturday array so the editor can render 7 fixed rows. When the salon
  // has never configured hours, every day comes back closed (honest empty state)
  // with a neutral 09:00–18:00 placeholder for when the manager opens a day.
  async getBusinessHours(companyId: string): Promise<{ days: BusinessHoursDay[] }> {
    const company = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: { businessHoursJson: true },
    });
    return { days: this.normalizeBusinessHours(company?.businessHoursJson) };
  }

  async updateBusinessHours(
    companyId: string,
    dto: UpdateBusinessHoursDto,
  ): Promise<{ days: BusinessHoursDay[] }> {
    const days = this.normalizeBusinessHours(dto.days);
    await this.prisma.client.company.update({
      where: { id: companyId },
      data: { businessHoursJson: days as unknown as Prisma.InputJsonValue },
    });
    return { days };
  }

  // Coerces any stored/incoming value into exactly 7 rows (weekday 0..6), so both
  // reads and writes are consistent regardless of what legacy shape was saved.
  private normalizeBusinessHours(raw: unknown): BusinessHoursDay[] {
    const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
    const byWeekday = new Map<number, Record<string, unknown>>();
    for (const row of list) {
      const wd = Number(row?.weekday);
      if (Number.isInteger(wd) && wd >= 0 && wd <= 6) byWeekday.set(wd, row);
    }
    const hhmm = (v: unknown, fallback: string) =>
      typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback;
    return Array.from({ length: 7 }, (_, weekday) => {
      const row = byWeekday.get(weekday);
      return {
        weekday,
        open: Boolean(row?.open),
        start: hhmm(row?.start, '09:00'),
        end: hhmm(row?.end, '18:00'),
      };
    });
  }

  // ---- web profile (SalonWebProfile: um por empresa, upsert por companyId) ----
  // Lê o perfil público do salão sempre com a forma completa/normalizada, para o
  // editor renderizar campos previsíveis. Quando o salão nunca configurou nada,
  // devolve os padrões honestos (strings vazias, comodidades desligadas) sem
  // persistir uma linha vazia — o registro só nasce no primeiro PATCH.
  async getWebProfile(companyId: string) {
    const p = await this.prisma.client.salonWebProfile.findUnique({
      where: { companyId },
    });
    return {
      description: p?.description ?? '',
      website: p?.website ?? '',
      facebook: p?.facebook ?? '',
      instagram: p?.instagram ?? '',
      wifi: p?.wifi ?? false,
      snackBar: p?.snackBar ?? false,
      parkingLot: p?.parkingLot ?? false,
      kids: p?.kids ?? false,
      accessibility: p?.accessibility ?? false,
      themePreference: p?.themePreference ?? 'auto',
      schedulingFlow: p?.schedulingFlow ?? 'service',
      requiredLogin: p?.requiredLogin ?? false,
      // Cor de destaque do agendamento online (hex "#RRGGBB") ou "" quando não
      // definida — o web-club cai no rosa padrão da casa.
      accentColor: p?.accentColor ?? '',
    };
  }

  async updateWebProfile(companyId: string, dto: UpdateWebProfileDto) {
    const data = {
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.website !== undefined ? { website: dto.website } : {}),
      ...(dto.facebook !== undefined ? { facebook: dto.facebook } : {}),
      ...(dto.instagram !== undefined ? { instagram: dto.instagram } : {}),
      ...(dto.wifi !== undefined ? { wifi: dto.wifi } : {}),
      ...(dto.snackBar !== undefined ? { snackBar: dto.snackBar } : {}),
      ...(dto.parkingLot !== undefined ? { parkingLot: dto.parkingLot } : {}),
      ...(dto.kids !== undefined ? { kids: dto.kids } : {}),
      ...(dto.accessibility !== undefined ? { accessibility: dto.accessibility } : {}),
      ...(dto.themePreference !== undefined ? { themePreference: dto.themePreference } : {}),
      ...(dto.schedulingFlow !== undefined ? { schedulingFlow: dto.schedulingFlow } : {}),
      ...(dto.requiredLogin !== undefined ? { requiredLogin: dto.requiredLogin } : {}),
      // "" limpa a cor (volta ao padrão); um hex normalizado em maiúsculas é persistido.
      ...(dto.accentColor !== undefined
        ? { accentColor: dto.accentColor.trim() ? dto.accentColor.trim().toUpperCase() : null }
        : {}),
    };
    await this.prisma.client.salonWebProfile.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
    return this.getWebProfile(companyId);
  }

  // ---- gallery (GalleryPhoto: fotos do perfil público) ----
  listGallery(companyId: string) {
    return this.prisma.client.galleryPhoto.findMany({
      where: { companyId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addGalleryPhoto(companyId: string, dto: CreateGalleryPhotoDto) {
    let order = dto.displayOrder;
    if (order === undefined) {
      const last = await this.prisma.client.galleryPhoto.findFirst({
        where: { companyId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      order = last ? last.displayOrder + 1 : 0;
    }
    return this.prisma.client.galleryPhoto.create({
      data: {
        companyId,
        url: dto.url,
        caption: dto.caption,
        displayOrder: order,
      },
    });
  }

  async removeGalleryPhoto(companyId: string, id: string) {
    const found = await this.prisma.client.galleryPhoto.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Foto não encontrada');
    await this.prisma.client.galleryPhoto.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ---- promotions ----
  listPromotions(companyId: string) {
    return this.prisma.client.promotion.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createPromotion(companyId: string, dto: CreatePromotionDto) {
    return this.prisma.client.promotion.create({
      data: {
        companyId,
        name: dto.name,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
        usageLimit: dto.usageLimit,
        appliesOnline: dto.appliesOnline ?? false,
      },
    });
  }

  async updatePromotion(companyId: string, id: string, dto: UpdatePromotionDto) {
    const found = await this.prisma.client.promotion.findFirst({ where: { id, companyId } });
    if (!found) throw new NotFoundException('Promoção não encontrada');
    return this.prisma.client.promotion.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.scopeType !== undefined ? { scopeType: dto.scopeType } : {}),
        ...(dto.scopeId !== undefined ? { scopeId: dto.scopeId } : {}),
        ...(dto.discountType !== undefined ? { discountType: dto.discountType } : {}),
        ...(dto.discountValue !== undefined ? { discountValue: dto.discountValue } : {}),
        ...(dto.validFrom !== undefined
          ? { validFrom: dto.validFrom ? new Date(dto.validFrom) : null }
          : {}),
        ...(dto.validTo !== undefined
          ? { validTo: dto.validTo ? new Date(dto.validTo) : null }
          : {}),
        ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
        ...(dto.appliesOnline !== undefined ? { appliesOnline: dto.appliesOnline } : {}),
      },
    });
  }

  async removePromotion(companyId: string, id: string) {
    const found = await this.prisma.client.promotion.findFirst({ where: { id, companyId } });
    if (!found) throw new NotFoundException('Promoção não encontrada');
    await this.prisma.client.promotion.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ---- reviews ----
  async listReviews(companyId: string, from?: string, to?: string) {
    const hasRange = Boolean(from || to);
    const range = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const where = { companyId, ...(hasRange ? { createdAt: range } : {}) };
    const reviews = await this.prisma.client.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        customer: { select: { id: true, name: true } },
        professional: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    });
    const count = reviews.length;
    const average =
      count > 0 ? reviews.reduce((acc, r) => acc + r.rating, 0) / count : 0;
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      if (r.rating >= 1 && r.rating <= 5) distribution[r.rating] += 1;
    }
    return { data: reviews, count, average, distribution };
  }

  // ---- reviews dashboard (Painel: métricas + comparativo + ranking) ----
  private async fetchReviewsForRange(
    companyId: string,
    gte?: Date,
    lt?: Date,
    lte?: Date,
  ): Promise<ReviewAggInput[]> {
    const createdAt: { gte?: Date; lt?: Date; lte?: Date } = {};
    if (gte) createdAt.gte = gte;
    if (lt) createdAt.lt = lt;
    if (lte) createdAt.lte = lte;
    const where = {
      companyId,
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
    };
    return this.prisma.client.review.findMany({
      where,
      select: {
        rating: true,
        comment: true,
        professional: { select: { id: true, name: true } },
      },
    });
  }

  private aggregate(reviews: ReviewAggInput[]) {
    const count = reviews.length;
    const average = count > 0 ? reviews.reduce((a, r) => a + r.rating, 0) / count : 0;
    const withComment = reviews.filter(
      (r) => r.comment != null && r.comment.trim().length > 0,
    ).length;
    const commentRate = count > 0 ? withComment / count : 0;
    return { count, average, commentRate };
  }

  private rankProfessionals(current: ReviewAggInput[], previous: ReviewAggInput[]) {
    const collect = (list: ReviewAggInput[]) => {
      const map = new Map<string, { id: string; name: string; sum: number; count: number }>();
      for (const r of list) {
        if (!r.professional) continue;
        const cur = map.get(r.professional.id) ?? {
          id: r.professional.id,
          name: r.professional.name,
          sum: 0,
          count: 0,
        };
        cur.sum += r.rating;
        cur.count += 1;
        map.set(r.professional.id, cur);
      }
      return map;
    };
    const curMap = collect(current);
    const prevMap = collect(previous);
    return [...curMap.values()]
      .map((p) => {
        const prev = prevMap.get(p.id);
        return {
          id: p.id,
          name: p.name,
          rating: p.count > 0 ? p.sum / p.count : 0,
          count: p.count,
          oldRating: prev && prev.count > 0 ? prev.sum / prev.count : 0,
        };
      })
      .sort((a, b) => b.rating - a.rating || b.count - a.count);
  }

  async getReviewsDashboard(companyId: string, from?: string, to?: string) {
    const fromD = from ? new Date(from) : undefined;
    const toD = to ? new Date(to) : undefined;
    const current = await this.fetchReviewsForRange(companyId, fromD, undefined, toD);

    // Comparativo com o período anterior de mesma duração (só quando há intervalo).
    let previous: ReviewAggInput[] = [];
    if (fromD && toD) {
      const span = Math.max(0, toD.getTime() - fromD.getTime());
      const prevFrom = new Date(fromD.getTime() - span);
      previous = await this.fetchReviewsForRange(companyId, prevFrom, fromD);
    }

    const cur = this.aggregate(current);
    const prev = this.aggregate(previous);
    const professionals = this.rankProfessionals(current, previous);
    const best = professionals[0] ?? null;

    return {
      current: cur,
      previous: prev,
      best: best ? { id: best.id, name: best.name, rating: best.rating } : null,
      professionals,
    };
  }

  // ---- review settings (Configurações: textos de solicitação) ----
  async getReviewSettings(companyId: string): Promise<ReviewSettings> {
    const row = await this.prisma.client.setting.findUnique({
      where: { companyId_key: { companyId, key: REVIEW_SETTINGS_KEY } },
    });
    const stored = (row?.valueJson as Partial<ReviewSettings> | null) ?? {};
    return { ...REVIEW_SETTINGS_DEFAULTS, ...stored };
  }

  async updateReviewSettings(companyId: string, dto: UpdateReviewSettingsDto): Promise<ReviewSettings> {
    const current = await this.getReviewSettings(companyId);
    const patch: Partial<ReviewSettings> = {};
    if (dto.moduleActive !== undefined) patch.moduleActive = dto.moduleActive;
    if (dto.headerTitle !== undefined) patch.headerTitle = dto.headerTitle;
    if (dto.headerText !== undefined) patch.headerText = dto.headerText;
    if (dto.successText !== undefined) patch.successText = dto.successText;
    if (dto.footerText !== undefined) patch.footerText = dto.footerText;
    if (dto.requestMessage !== undefined) patch.requestMessage = dto.requestMessage;
    const merged = { ...current, ...patch };
    await this.prisma.client.setting.upsert({
      where: { companyId_key: { companyId, key: REVIEW_SETTINGS_KEY } },
      create: { companyId, key: REVIEW_SETTINGS_KEY, valueJson: merged },
      update: { valueJson: merged },
    });
    return merged;
  }

  // ---- aparência do agendamento online (Setting `booking.appearance`) ----
  // Lida/gravada exatamente como review_config: Setting por (companyId, key),
  // com defaults sensatos quando não há linha — nunca quebra salões sem config.
  async getBookingAppearance(companyId: string): Promise<BookingAppearance> {
    const row = await this.prisma.client.setting.findUnique({
      where: { companyId_key: { companyId, key: BOOKING_APPEARANCE_KEY } },
    });
    if (!row) return { ...BOOKING_APPEARANCE_DEFAULTS };
    return coerceBookingAppearance(row.valueJson);
  }

  async updateBookingAppearance(
    companyId: string,
    dto: UpdateBookingAppearanceDto,
  ): Promise<BookingAppearance> {
    const current = await this.getBookingAppearance(companyId);
    // "" limpa a cor (volta ao default do web-club); um hex é normalizado em
    // maiúsculas. Campos ausentes no DTO preservam o valor atual.
    const hex = (v: string | undefined, fallback: string | null): string | null => {
      if (v === undefined) return fallback;
      const t = v.trim();
      if (!t) return null;
      return HEX_COLOR.test(t) ? t.toUpperCase() : fallback;
    };
    const merged: BookingAppearance = {
      hideNavbar: dto.hideNavbar !== undefined ? dto.hideNavbar : current.hideNavbar,
      primaryColor: hex(dto.primaryColor, current.primaryColor),
      accentColor: hex(dto.accentColor, current.accentColor),
      backgroundColor: hex(dto.backgroundColor, current.backgroundColor),
    };
    const valueJson = merged as unknown as Prisma.InputJsonValue;
    await this.prisma.client.setting.upsert({
      where: { companyId_key: { companyId, key: BOOKING_APPEARANCE_KEY } },
      create: { companyId, key: BOOKING_APPEARANCE_KEY, valueJson },
      update: { valueJson },
    });
    return merged;
  }

  // ---- cashback config (programa global da empresa) ----
  async getCashbackConfig(companyId: string) {
    const c = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: {
        cashbackActive: true,
        cashbackValueType: true,
        cashbackValue: true,
        cashbackCanRedeem: true,
        cashbackMinimum: true,
      },
    });
    return {
      cashbackActive: c?.cashbackActive ?? false,
      cashbackValueType: c?.cashbackValueType ?? 'percent',
      cashbackValue: c?.cashbackValue != null ? Number(c.cashbackValue) : 0,
      cashbackCanRedeem: c?.cashbackCanRedeem ?? true,
      cashbackMinimum: c?.cashbackMinimum != null ? Number(c.cashbackMinimum) : 0,
    };
  }

  async updateCashbackConfig(companyId: string, dto: UpdateCashbackConfigDto) {
    await this.prisma.client.company.update({
      where: { id: companyId },
      data: {
        ...(dto.cashbackActive !== undefined ? { cashbackActive: dto.cashbackActive } : {}),
        ...(dto.cashbackValueType !== undefined
          ? { cashbackValueType: dto.cashbackValueType }
          : {}),
        ...(dto.cashbackValue !== undefined ? { cashbackValue: dto.cashbackValue } : {}),
        ...(dto.cashbackCanRedeem !== undefined
          ? { cashbackCanRedeem: dto.cashbackCanRedeem }
          : {}),
        ...(dto.cashbackMinimum !== undefined ? { cashbackMinimum: dto.cashbackMinimum } : {}),
      },
    });
    return this.getCashbackConfig(companyId);
  }

  // ---- cashback rules ----
  listCashbackRules(companyId: string) {
    return this.prisma.client.cashbackRule.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createCashbackRule(companyId: string, dto: CreateCashbackRuleDto) {
    return this.prisma.client.cashbackRule.create({
      data: {
        companyId,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId,
        percent: dto.percent,
        validityDays: dto.validityDays ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async updateCashbackRule(companyId: string, id: string, dto: UpdateCashbackRuleDto) {
    const found = await this.prisma.client.cashbackRule.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Regra de cashback não encontrada');
    return this.prisma.client.cashbackRule.update({
      where: { id },
      data: {
        ...(dto.scopeType !== undefined ? { scopeType: dto.scopeType } : {}),
        ...(dto.scopeId !== undefined ? { scopeId: dto.scopeId } : {}),
        ...(dto.percent !== undefined ? { percent: dto.percent } : {}),
        ...(dto.validityDays !== undefined ? { validityDays: dto.validityDays } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });
  }

  async removeCashbackRule(companyId: string, id: string) {
    const found = await this.prisma.client.cashbackRule.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Regra de cashback não encontrada');
    await this.prisma.client.cashbackRule.delete({ where: { id } });
    return { id, deleted: true };
  }
}
