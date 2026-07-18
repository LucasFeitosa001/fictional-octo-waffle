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

interface DetailFilters {
  from?: string;
  to?: string;
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

  // ---- overview (totais agregados por status: em aberto / a liberar / pagas) ----
  // "a liberar" = lançamento em aberto cuja data de disponibilidade ainda não
  // chegou. "em aberto" = disponível para pagamento (sem availableDate ou já
  // vencida). "pagas" = status paid. Estornados são ignorados nos totais.
  async overview(companyId: string, filters: SummaryFilters) {
    const where: Prisma.CommissionEntryWhereInput = { companyId };
    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.from || filters.to) {
      where.competenceDate = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const entries = await this.prisma.client.commissionEntry.findMany({
      where,
      select: {
        commissionAmount: true,
        bonusAmount: true,
        status: true,
        availableDate: true,
      },
    });

    const now = new Date();
    const mk = () => ({ total: 0, count: 0 });
    const emAberto = mk();
    const aLiberar = mk();
    const pagas = mk();

    for (const e of entries) {
      const value = Number(e.commissionAmount) + Number(e.bonusAmount);
      if (e.status === 'paid') {
        pagas.total += value;
        pagas.count += 1;
      } else if (e.status === 'open') {
        if (e.availableDate && new Date(e.availableDate) > now) {
          aLiberar.total += value;
          aLiberar.count += 1;
        } else {
          emAberto.total += value;
          emAberto.count += 1;
        }
      }
      // 'reversed' não entra em nenhum bucket
    }

    return { emAberto, aLiberar, pagas };
  }

  // ---- detail (itens que geraram comissão de um profissional no período) ----
  // Cada lançamento aponta para uma comanda (Order); trazemos cliente, número
  // da comanda, data e os itens (serviço/produto + qtd) que a compõem.
  async detail(companyId: string, professionalId: string, filters: DetailFilters) {
    const professional = await this.prisma.client.professional.findFirst({
      where: { id: professionalId, companyId },
      select: { id: true, name: true },
    });
    if (!professional) throw new NotFoundException('Profissional não encontrado');

    const where: Prisma.CommissionEntryWhereInput = { companyId, professionalId };
    if (filters.status === 'open' || filters.status === 'paid' || filters.status === 'reversed') {
      where.status = filters.status;
    }
    if (filters.from || filters.to) {
      where.competenceDate = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const entries = await this.prisma.client.commissionEntry.findMany({
      where,
      orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
    });

    const orderIds = [...new Set(entries.map((e) => e.orderId).filter((id): id is string => !!id))];
    const orders = orderIds.length
      ? await this.prisma.client.order.findMany({
          where: { id: { in: orderIds }, companyId },
          select: {
            id: true,
            number: true,
            date: true,
            customer: { select: { name: true } },
            items: {
              select: { kind: true, refId: true, quantity: true, unitPrice: true, grossValue: true },
            },
          },
        })
      : [];
    const orderById = new Map(orders.map((o) => [o.id, o]));

    // Nomes de serviços/produtos referenciados pelos itens
    const serviceIds = new Set<string>();
    const productIds = new Set<string>();
    for (const o of orders) {
      for (const it of o.items) {
        if (it.kind === 'service') serviceIds.add(it.refId);
        else if (it.kind === 'product') productIds.add(it.refId);
      }
    }
    const [services, products] = await Promise.all([
      serviceIds.size
        ? this.prisma.client.service.findMany({
            where: { id: { in: [...serviceIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      productIds.size
        ? this.prisma.client.product.findMany({
            where: { id: { in: [...productIds] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const nameByRef = new Map<string, string>();
    for (const s of services) nameByRef.set(`service:${s.id}`, s.name);
    for (const p of products) nameByRef.set(`product:${p.id}`, p.name);

    const items = entries.map((e) => {
      const order = e.orderId ? orderById.get(e.orderId) : undefined;
      return {
        id: e.id,
        orderId: e.orderId ?? null,
        orderNumber: order?.number ?? null,
        customerName: order?.customer?.name ?? null,
        date: (e.competenceDate ?? order?.date ?? e.createdAt).toISOString(),
        baseAmount: Number(e.baseAmount),
        commissionAmount: Number(e.commissionAmount),
        bonusAmount: Number(e.bonusAmount),
        status: e.status,
        signed: e.signed,
        orderItems: (order?.items ?? []).map((it) => ({
          kind: it.kind,
          name: nameByRef.get(`${it.kind}:${it.refId}`) ?? '—',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          grossValue: Number(it.grossValue),
        })),
      };
    });

    const totals = items.reduce(
      (acc, it) => {
        acc.base += it.baseAmount;
        acc.comissao += it.commissionAmount;
        acc.bonus += it.bonusAmount;
        acc.total += it.commissionAmount + it.bonusAmount;
        if (it.status === 'paid') acc.pago += it.commissionAmount + it.bonusAmount;
        return acc;
      },
      { base: 0, comissao: 0, bonus: 0, total: 0, pago: 0 },
    );

    const signed = entries.length > 0 && entries.every((e) => e.signed);

    return {
      professional,
      period: { from: filters.from ?? null, to: filters.to ?? null },
      totals,
      signed,
      count: items.length,
      items,
    };
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
