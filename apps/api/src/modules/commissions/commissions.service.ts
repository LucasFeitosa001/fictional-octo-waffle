import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BulkCommissionPaymentDto,
  CreateCommissionAdvanceDto,
  CreateCommissionPaymentDto,
  CreateCommissionRuleDto,
  UpdateCommissionEntryDto,
  UpdateCommissionRuleDto,
} from './dto';

/** Um item resolvido para pagamento (um profissional). */
interface PaymentItemInput {
  professionalId: string;
  entryIds?: string[];
  advanceIds?: string[];
  note?: string;
}

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

/**
 * O filtro de UI trabalha com datas civis (YYYY-MM-DD). O limite final precisa
 * incluir o dia inteiro; `new Date(to)` sozinho representa 00:00 e eliminava
 * comissões geradas no próprio dia final.
 */
function inclusiveDateRange(
  from?: string,
  to?: string,
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  const range: { gte?: Date; lt?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) {
    const nextDay = new Date(`${to}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    range.lt = nextDay;
  }
  return range;
}

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cadastro profissional ligado ao usuário autenticado. O controller usa este
   * vínculo para aplicar `comissoes:view_own` sem confiar em professionalId
   * recebido por query string.
   */
  async ownProfessionalId(companyId: string, userId: string): Promise<string> {
    const professional = await this.prisma.client.professional.findFirst({
      where: { companyId, userId },
      select: { id: true },
    });
    if (!professional) {
      throw new ForbiddenException(
        'Seu usuário não está vinculado a um profissional desta empresa.',
      );
    }
    return professional.id;
  }

  // ---- summary (per-professional totals) ----
  async summary(companyId: string, filters: SummaryFilters) {
    const where: Prisma.CommissionEntryWhereInput = { companyId };
    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.status === 'open' || filters.status === 'paid' || filters.status === 'reversed') {
      where.status = filters.status;
    }
    const dateRange = inclusiveDateRange(filters.from, filters.to);
    if (dateRange) where.competenceDate = dateRange;

    const [entries, professionals] = await Promise.all([
      this.prisma.client.commissionEntry.findMany({ where }),
      this.prisma.client.professional.findMany({
        where: { companyId },
        select: { id: true, name: true },
      }),
    ]);

    const nameById = new Map(professionals.map((p) => [p.id, p.name]));

    // Vales em aberto por profissional. O Belasis mostra Comissões · Vales ·
    // Bonificações · Líquido na tabela de Resumidas; sem isto a coluna Vales
    // viria vazia e o Líquido seria só comissão+bônus, que é outro número.
    // Adiantamento não tem competência: o que está `open` pesa no próximo
    // pagamento independentemente do período filtrado — por isso não recebe o
    // recorte de data.
    const openAdvances = await this.prisma.client.commissionAdvance.groupBy({
      by: ['professionalId'],
      where: {
        companyId,
        status: 'open',
        ...(filters.professionalId ? { professionalId: filters.professionalId } : {}),
      },
      _sum: { amount: true },
    });
    const valesById = new Map(
      openAdvances.map((a) => [a.professionalId, Number(a._sum.amount ?? 0)]),
    );

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

    const data = [...buckets.values()].map((b) => {
      const vales = valesById.get(b.professionalId) ?? 0;
      return {
        ...b,
        vales,
        // Mesma fórmula do pagamento (`payOne`): comissões + bônus − vales,
        // nunca negativo. Se divergisse daqui, a tela prometeria um valor e o
        // botão pagaria outro.
        liquido: Math.max(0, b.total - vales),
        // status pago/aberto: pago only when every entry is paid
        status: b.entryCount > 0 && b.openCount === 0 ? 'paid' : 'open',
        signed: b.entryCount > 0 && b.signedCount === b.entryCount,
      };
    });
    data.sort((a, b) => b.total - a.total);

    const totals = data.reduce(
      (acc, b) => {
        acc.valorVendido += b.valorVendido;
        acc.comissao += b.comissao;
        acc.bonus += b.bonus;
        acc.vales += b.vales;
        acc.total += b.total;
        acc.liquido += b.liquido;
        return acc;
      },
      { valorVendido: 0, comissao: 0, bonus: 0, vales: 0, total: 0, liquido: 0 },
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
    const dateRange = inclusiveDateRange(filters.from, filters.to);
    if (dateRange) where.competenceDate = dateRange;

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
    const dateRange = inclusiveDateRange(filters.from, filters.to);
    if (dateRange) where.competenceDate = dateRange;

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
            legacyId: true,
            date: true,
            customer: { select: { name: true } },
            items: {
              select: {
                kind: true,
                refId: true,
                professionalId: true,
                quantity: true,
                unitPrice: true,
                grossValue: true,
              },
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
      const ownOrderItems =
        order?.items.filter((item) => item.professionalId === professionalId) ?? [];
      // Imports muito antigos podem não ter FK no item. Nesse caso preservamos
      // os itens da comanda em vez de deixar o detalhamento vazio.
      const relevantOrderItems =
        ownOrderItems.length > 0 ? ownOrderItems : (order?.items ?? []);
      const legacyNumberMatch = order?.legacyId?.match(/^cmd:(\d+)$/);
      return {
        id: e.id,
        orderId: e.orderId ?? null,
        // Para lançamentos importados, exibe o número que consta nos relatórios
        // do Belasis; algumas comandas foram renumeradas internamente para
        // evitar colisões durante a migração.
        orderNumber: legacyNumberMatch
          ? Number(legacyNumberMatch[1])
          : (order?.number ?? null),
        customerName: order?.customer?.name ?? null,
        date: (e.competenceDate ?? order?.date ?? e.createdAt).toISOString(),
        baseAmount: Number(e.baseAmount),
        commissionAmount: Number(e.commissionAmount),
        bonusAmount: Number(e.bonusAmount),
        // Quanto desta comissão foi para auxiliares do item ("Desconto de
        // Auxiliares" do Belasis). Só é > 0 quando o auxiliar foi cadastrado com
        // "Desconto do: profissional" — se sai do estabelecimento, fica zero.
        auxiliaryDiscount: Number(e.auxiliaryDiscount),
        status: e.status,
        signed: e.signed,
        availableDate: e.availableDate?.toISOString() ?? null,
        orderItems: relevantOrderItems.map((it) => ({
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
        acc.auxiliares += it.auxiliaryDiscount;
        acc.total += it.commissionAmount + it.bonusAmount;
        if (it.status === 'paid') acc.pago += it.commissionAmount + it.bonusAmount;
        return acc;
      },
      { base: 0, comissao: 0, bonus: 0, auxiliares: 0, total: 0, pago: 0 },
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
  // Fórmula Belasis: amount = max(0, Comissões + Bonificações − Vales).
  //
  // Núcleo do pagamento de UM item (um profissional), executado dentro de uma
  // transação. Reaproveitado por createPayment (single) e payBulk (lote):
  //  1. entryIds vazio → pega TODAS as entries `open` do profissional (filtrando
  //     por closing se informado); senão, apenas as entries informadas que ainda
  //     estejam `open`.
  //  2. commissionTotal = Σ commissionAmount; bonusTotal = Σ bonusAmount.
  //  3. advanceIds vazio → desconta TODOS os vales `open` do profissional; senão,
  //     apenas os informados que ainda estejam `open`.
  //  4. amount = max(0, comissões + bônus − vales).
  //  5. cria CommissionPayment com a quebra; marca entries=paid+paymentId e
  //     vales=deducted+paymentId.
  private async payItem(
    tx: Prisma.TransactionClient,
    companyId: string,
    item: PaymentItemInput,
    opts: { closingId?: string; paidByUserId?: string },
  ) {
    // 1. Entries a quitar (apenas `open`).
    const entryWhere: Prisma.CommissionEntryWhereInput = {
      companyId,
      professionalId: item.professionalId,
      status: 'open',
    };
    if (item.entryIds && item.entryIds.length > 0) {
      entryWhere.id = { in: item.entryIds };
    }
    const entries = await tx.commissionEntry.findMany({
      where: entryWhere,
      select: { id: true, commissionAmount: true, bonusAmount: true },
    });

    // 3. Vales a descontar (apenas `open`).
    const advanceWhere: Prisma.CommissionAdvanceWhereInput = {
      companyId,
      professionalId: item.professionalId,
      status: 'open',
    };
    if (item.advanceIds && item.advanceIds.length > 0) {
      advanceWhere.id = { in: item.advanceIds };
    }
    const advances = await tx.commissionAdvance.findMany({
      where: advanceWhere,
      select: { id: true, amount: true },
    });

    // 2 + 4. Somatórios e fórmula.
    const zero = new Prisma.Decimal(0);
    const commissionTotal = entries.reduce(
      (acc, e) => acc.add(e.commissionAmount),
      zero,
    );
    const bonusTotal = entries.reduce((acc, e) => acc.add(e.bonusAmount), zero);
    const advancesTotal = advances.reduce((acc, a) => acc.add(a.amount), zero);
    const gross = commissionTotal.add(bonusTotal).sub(advancesTotal);
    const amount = gross.isNegative() ? zero : gross; // nunca negativo

    // 5. Cria o pagamento com a quebra.
    const payment = await tx.commissionPayment.create({
      data: {
        companyId,
        professionalId: item.professionalId,
        commissionTotal,
        bonusTotal,
        advancesTotal,
        amount,
        ...(opts.closingId ? { closingId: opts.closingId } : {}),
        ...(opts.paidByUserId ? { paidByUserId: opts.paidByUserId } : {}),
        ...(item.note ? { note: item.note } : {}),
      },
    });

    // Marca entries pagas e vinculadas ao pagamento (para permitir estorno).
    if (entries.length > 0) {
      await tx.commissionEntry.updateMany({
        where: { id: { in: entries.map((e) => e.id) } },
        data: { status: 'paid', paymentId: payment.id },
      });
    }
    // Marca vales deduzidos e vinculados ao pagamento.
    if (advances.length > 0) {
      await tx.commissionAdvance.updateMany({
        where: { id: { in: advances.map((a) => a.id) } },
        data: { status: 'deducted', paymentId: payment.id },
      });
    }

    return { ...payment, entriesCount: entries.length };
  }

  /** POST /commission-payments — pagamento de um único profissional. */
  async createPayment(
    companyId: string,
    dto: CreateCommissionPaymentDto,
    paidByUserId?: string,
  ) {
    return this.prisma.client.$transaction((tx) =>
      this.payItem(
        tx,
        companyId,
        {
          professionalId: dto.professionalId,
          entryIds: dto.entryIds,
          advanceIds: dto.advanceIds,
          note: dto.note,
        },
        { closingId: dto.closingId, paidByUserId },
      ),
    );
  }

  /** POST /commission-payments/bulk — paga vários profissionais numa transação. */
  async payBulk(
    companyId: string,
    dto: BulkCommissionPaymentDto,
    paidByUserId?: string,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const payments: Awaited<ReturnType<typeof this.payItem>>[] = [];
      for (const item of dto.items) {
        payments.push(
          await this.payItem(
            tx,
            companyId,
            {
              professionalId: item.professionalId,
              entryIds: item.entryIds,
              advanceIds: item.advanceIds,
              note: item.note,
            },
            { closingId: dto.closingId, paidByUserId },
          ),
        );
      }
      return { count: payments.length, payments };
    });
  }

  /** GET /commission-payments — histórico de pagamentos com quebra e responsável. */
  async listPayments(
    companyId: string,
    filters: { professionalId?: string; from?: string; to?: string },
  ) {
    const where: Prisma.CommissionPaymentWhereInput = { companyId };
    if (filters.professionalId) where.professionalId = filters.professionalId;
    const dateRange = inclusiveDateRange(filters.from, filters.to);
    if (dateRange) where.paidAt = dateRange;

    const payments = await this.prisma.client.commissionPayment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      include: {
        professional: { select: { id: true, name: true } },
        paidByUser: { select: { id: true, name: true } },
        _count: { select: { entries: true } },
      },
    });

    return payments.map((p) => ({
      id: p.id,
      paidAt: p.paidAt.toISOString(),
      professional: { id: p.professional.id, name: p.professional.name },
      paidByUser: p.paidByUser
        ? { id: p.paidByUser.id, name: p.paidByUser.name }
        : null,
      commissionTotal: Number(p.commissionTotal),
      bonusTotal: Number(p.bonusTotal),
      advancesTotal: Number(p.advancesTotal),
      amount: Number(p.amount),
      closingId: p.closingId,
      note: p.note,
      entriesCount: p._count.entries,
    }));
  }

  /**
   * DELETE /commission-payments/:id — estorna um pagamento (com justificativa).
   * Reabre as entries (status=open, paymentId=null) e os vales (status=open,
   * paymentId=null), grava auditoria (AuditLog) e remove o CommissionPayment.
   * Belasis permite estornar mesmo com o closing fechado, mas exige justificativa
   * — por isso registramos o closingId/estado na auditoria.
   */
  async deletePayment(
    companyId: string,
    id: string,
    justification: string,
    userId?: string,
  ) {
    const trimmed = (justification ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Justificativa é obrigatória para excluir o pagamento');
    }

    const payment = await this.prisma.client.commissionPayment.findFirst({
      where: { id, companyId },
      include: { closing: { select: { id: true, status: true } } },
    });
    if (!payment) throw new NotFoundException('Pagamento de comissão não encontrado');

    return this.prisma.client.$transaction(async (tx) => {
      // Reabre as entries quitadas por este pagamento.
      await tx.commissionEntry.updateMany({
        where: { paymentId: id, companyId },
        data: { status: 'open', paymentId: null },
      });
      // Reabre os vales deduzidos por este pagamento.
      await tx.commissionAdvance.updateMany({
        where: { paymentId: id, companyId },
        data: { status: 'open', paymentId: null },
      });

      // Auditoria (Belasis exige justificativa; registramos usuário, valor e
      // se o pagamento estava atrelado a um fechamento fechado).
      await tx.auditLog.create({
        data: {
          companyId,
          userId: userId ?? null,
          action: 'commission_payment.delete',
          entityType: 'CommissionPayment',
          entityId: id,
          dataJson: {
            justification: trimmed,
            professionalId: payment.professionalId,
            amount: Number(payment.amount),
            commissionTotal: Number(payment.commissionTotal),
            bonusTotal: Number(payment.bonusTotal),
            advancesTotal: Number(payment.advancesTotal),
            closingId: payment.closingId,
            closingStatus: payment.closing?.status ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.commissionPayment.delete({ where: { id } });
      return { id, deleted: true, justification: trimmed };
    });
  }

  // ---- advances (vales / adiantamentos) ----
  /** POST /commission-advances — concede um vale (status open). */
  async createAdvance(companyId: string, dto: CreateCommissionAdvanceDto) {
    const professional = await this.prisma.client.professional.findFirst({
      where: { id: dto.professionalId, companyId },
      select: { id: true },
    });
    if (!professional) throw new NotFoundException('Profissional não encontrado');

    return this.prisma.client.commissionAdvance.create({
      data: {
        companyId,
        professionalId: dto.professionalId,
        amount: dto.amount,
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.note ? { note: dto.note } : {}),
      },
    });
  }

  /** GET /commission-advances — lista vales (com nome do profissional). */
  async listAdvances(
    companyId: string,
    filters: { professionalId?: string; status?: string },
  ) {
    const where: Prisma.CommissionAdvanceWhereInput = { companyId };
    if (filters.professionalId) where.professionalId = filters.professionalId;
    if (filters.status === 'open' || filters.status === 'deducted') {
      where.status = filters.status;
    }

    const advances = await this.prisma.client.commissionAdvance.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { professional: { select: { id: true, name: true } } },
    });

    return advances.map((a) => ({
      id: a.id,
      professional: { id: a.professional.id, name: a.professional.name },
      amount: Number(a.amount),
      date: a.date.toISOString(),
      note: a.note,
      status: a.status,
      paymentId: a.paymentId,
    }));
  }

  /** DELETE /commission-advances/:id — remove um vale (só se ainda `open`). */
  async deleteAdvance(companyId: string, id: string) {
    const advance = await this.prisma.client.commissionAdvance.findFirst({
      where: { id, companyId },
    });
    if (!advance) throw new NotFoundException('Vale não encontrado');
    if (advance.status !== 'open') {
      throw new ForbiddenException('Vale já deduzido em um pagamento não pode ser excluído');
    }
    await this.prisma.client.commissionAdvance.delete({ where: { id } });
    return { id, deleted: true };
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
