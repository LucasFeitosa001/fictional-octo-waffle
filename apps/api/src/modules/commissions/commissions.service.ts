import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCommissionPaymentDto,
  CreateCommissionRuleDto,
  UpdateCommissionEntryDto,
  UpdateCommissionRuleDto,
} from './dto';

interface SummaryFilters {
  from?: string;
  to?: string;
  professionalId?: string;
  status?: string;
}

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- summary (per-professional totals) ----
  async summary(companyId: string, filters: SummaryFilters) {
    const where: Prisma.CommissionEntryWhereInput = { companyId };
    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.status === 'open' || filters.status === 'paid' || filters.status === 'reversed') {
      where.status = filters.status;
    }
    if (filters.from || filters.to) {
      where.competenceDate = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const [entries, professionals] = await Promise.all([
      this.prisma.client.commissionEntry.findMany({ where }),
      this.prisma.client.professional.findMany({
        where: { companyId },
        select: { id: true, name: true },
      }),
    ]);

    const nameById = new Map(professionals.map((p) => [p.id, p.name]));

    interface Bucket {
      professionalId: string;
      professionalName: string;
      valorVendido: number;
      comissao: number;
      bonus: number;
      total: number;
      entryCount: number;
      openCount: number;
      paidCount: number;
      signedCount: number;
    }
    const buckets = new Map<string, Bucket>();

    for (const e of entries) {
      let b = buckets.get(e.professionalId);
      if (!b) {
        b = {
          professionalId: e.professionalId,
          professionalName: nameById.get(e.professionalId) ?? '—',
          valorVendido: 0,
          comissao: 0,
          bonus: 0,
          total: 0,
          entryCount: 0,
          openCount: 0,
          paidCount: 0,
          signedCount: 0,
        };
        buckets.set(e.professionalId, b);
      }
      b.valorVendido += Number(e.baseAmount);
      b.comissao += Number(e.commissionAmount);
      b.bonus += Number(e.bonusAmount);
      b.total += Number(e.commissionAmount) + Number(e.bonusAmount);
      b.entryCount += 1;
      if (e.status === 'paid') b.paidCount += 1;
      if (e.status === 'open') b.openCount += 1;
      if (e.signed) b.signedCount += 1;
    }

    const data = [...buckets.values()].map((b) => ({
      ...b,
      // status pago/aberto: pago only when every entry is paid
      status: b.entryCount > 0 && b.openCount === 0 ? 'paid' : 'open',
      signed: b.entryCount > 0 && b.signedCount === b.entryCount,
    }));
    data.sort((a, b) => b.total - a.total);

    const totals = data.reduce(
      (acc, b) => {
        acc.valorVendido += b.valorVendido;
        acc.comissao += b.comissao;
        acc.bonus += b.bonus;
        acc.total += b.total;
        return acc;
      },
      { valorVendido: 0, comissao: 0, bonus: 0, total: 0 },
    );

    return { data, totals };
  }

  // ---- entries ----
  listEntries(companyId: string, status?: string, professionalId?: string) {
    const where: Prisma.CommissionEntryWhereInput = { companyId };
    if (status === 'open' || status === 'paid' || status === 'reversed') where.status = status;
    if (professionalId) where.professionalId = professionalId;
    return this.prisma.client.commissionEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { professional: { select: { id: true, name: true } } },
    });
  }

  async updateEntry(companyId: string, id: string, dto: UpdateCommissionEntryDto) {
    const found = await this.prisma.client.commissionEntry.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Lançamento de comissão não encontrado');
    return this.prisma.client.commissionEntry.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.signed !== undefined ? { signed: dto.signed } : {}),
      },
    });
  }

  // ---- payments ----
  async createPayment(companyId: string, dto: CreateCommissionPaymentDto) {
    return this.prisma.client.$transaction(async (tx) => {
      const payment = await tx.commissionPayment.create({
        data: {
          companyId,
          professionalId: dto.professionalId,
          amount: dto.amount,
          ...(dto.closingId ? { closingId: dto.closingId } : {}),
        },
      });
      if (dto.entryIds && dto.entryIds.length > 0) {
        await tx.commissionEntry.updateMany({
          where: { id: { in: dto.entryIds }, companyId },
          data: { status: 'paid' },
        });
      }
      return payment;
    });
  }

  // ---- rules ----
  listRules(companyId: string) {
    return this.prisma.client.commissionRule.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createRule(companyId: string, dto: CreateCommissionRuleDto) {
    return this.prisma.client.commissionRule.create({
      data: {
        companyId,
        scopeType: dto.scopeType,
        scopeId: dto.scopeId ?? null,
        type: dto.type,
        value: dto.value,
        settingsJson: (dto.settingsJson ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async updateRule(companyId: string, id: string, dto: UpdateCommissionRuleDto) {
    const found = await this.prisma.client.commissionRule.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Regra de comissão não encontrada');
    return this.prisma.client.commissionRule.update({
      where: { id },
      data: {
        ...(dto.scopeType ? { scopeType: dto.scopeType } : {}),
        ...(dto.scopeId !== undefined ? { scopeId: dto.scopeId } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.settingsJson !== undefined
          ? { settingsJson: dto.settingsJson as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async removeRule(companyId: string, id: string) {
    const found = await this.prisma.client.commissionRule.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Regra de comissão não encontrada');
    await this.prisma.client.commissionRule.delete({ where: { id } });
    return { id, deleted: true };
  }
}
