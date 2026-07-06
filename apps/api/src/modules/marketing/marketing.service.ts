import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCashbackRuleDto,
  CreatePromotionDto,
  UpdateBookingLinkDto,
  UpdateCashbackRuleDto,
  UpdatePromotionDto,
} from './dto';

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
