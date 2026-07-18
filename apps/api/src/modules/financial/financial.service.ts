import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateFinancialAccountDto,
  CreateFinancialCategoryDto,
  CreatePaymentMethodDto,
  CreateTransactionDto,
  CreateTransferDto,
  ListTransactionsQueryDto,
  UpdateFinancialAccountDto,
  UpdateFinancialCategoryDto,
  UpdatePaymentMethodDto,
  UpdateTransactionDto,
} from './dto';

/** "YYYY-MM-DD" (UTC) para agrupar lançamentos por dia. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Início do dia (UTC) de uma string ISO/data. */
function startOfDay(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

/** Fim do dia (UTC) — se a string é só data (YYYY-MM-DD), estica até 23:59:59.999. */
function endOfDay(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  if (iso.length <= 10) d.setUTCHours(23, 59, 59, 999);
  return d;
}

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================== Summary =====================
  // Painel financeiro (equivalente ao /finance/dashboard do Belasis):
  //  - A receber / A pagar HOJE (pendentes com vencimento no dia).
  //  - Totais do período: Recebidos, A Receber, Pagos, A Pagar.
  //  - Saldo CORRENTE por conta = saldo inicial + movimentos pagos (todo o histórico).
  //  - Fluxo de caixa por dia (entrada, saída, saldo acumulado).
  //  - Vendas por dia (comandas do período).
  //  - Recebimentos por forma de pagamento (mantido).
  async summary(companyId: string, from?: string, to?: string) {
    const c = this.prisma.client;

    const fromStart = startOfDay(from);
    const toEnd = endOfDay(to);
    const periodPaidAt = {
      ...(fromStart ? { gte: fromStart } : {}),
      ...(toEnd ? { lte: toEnd } : {}),
    };
    const periodDueDate = { ...periodPaidAt };
    const hasRange = Boolean(fromStart || toEnd);

    // Janela dos gráficos (fallback: últimos 15 dias quando não há período).
    const chartTo = toEnd ?? new Date();
    const chartFrom =
      fromStart ??
      new Date(chartTo.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Limites de "hoje" (UTC).
    const now = new Date();
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const todayEnd = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const [
      received,
      paidOut,
      toReceive,
      toPay,
      recvToday,
      payToday,
      byMethodRaw,
      paymentMethods,
      accounts,
      movementsRaw,
      paidTx,
      orders,
    ] = await Promise.all([
      // Recebidos: receitas pagas no período (por baixa).
      c.transaction.aggregate({
        _sum: { grossAmount: true },
        where: {
          companyId,
          kind: 'income',
          status: 'paid',
          ...(hasRange ? { paidAt: periodPaidAt } : {}),
        },
      }),
      // Pagos: despesas pagas no período.
      c.transaction.aggregate({
        _sum: { grossAmount: true },
        where: {
          companyId,
          kind: 'expense',
          status: 'paid',
          ...(hasRange ? { paidAt: periodPaidAt } : {}),
        },
      }),
      // A Receber: receitas pendentes com vencimento no período.
      c.transaction.aggregate({
        _sum: { grossAmount: true },
        where: {
          companyId,
          kind: 'income',
          status: 'pending',
          ...(hasRange ? { dueDate: periodDueDate } : {}),
        },
      }),
      // A Pagar: despesas pendentes com vencimento no período.
      c.transaction.aggregate({
        _sum: { grossAmount: true },
        where: {
          companyId,
          kind: 'expense',
          status: 'pending',
          ...(hasRange ? { dueDate: periodDueDate } : {}),
        },
      }),
      // A receber hoje.
      c.transaction.aggregate({
        _sum: { grossAmount: true },
        where: {
          companyId,
          kind: 'income',
          status: 'pending',
          dueDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      // A pagar hoje.
      c.transaction.aggregate({
        _sum: { grossAmount: true },
        where: {
          companyId,
          kind: 'expense',
          status: 'pending',
          dueDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      // Recebimentos por forma de pagamento (receitas pagas no período).
      c.transaction.groupBy({
        by: ['paymentMethodId'],
        _sum: { grossAmount: true },
        where: {
          companyId,
          kind: 'income',
          status: 'paid',
          ...(hasRange ? { paidAt: periodPaidAt } : {}),
        },
      }),
      c.paymentMethod.findMany({
        where: { companyId },
        select: { id: true, name: true },
      }),
      c.financialAccount.findMany({
        where: { companyId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, type: true, initialBalance: true, active: true },
      }),
      // Movimentos pagos por conta (todo o histórico) -> saldo corrente.
      c.transaction.groupBy({
        by: ['accountId', 'kind'],
        _sum: { grossAmount: true },
        where: { companyId, status: 'paid', accountId: { not: null } },
      }),
      // Transações pagas até o fim da janela (fluxo de caixa + saldo de abertura).
      c.transaction.findMany({
        where: {
          companyId,
          status: 'paid',
          paidAt: { not: null, lte: chartTo },
        },
        select: { paidAt: true, kind: true, grossAmount: true },
      }),
      // Vendas (comandas) na janela.
      c.order.findMany({
        where: { companyId, date: { gte: chartFrom, lte: chartTo } },
        select: { date: true, netTotal: true },
      }),
    ]);

    const methodName = new Map(paymentMethods.map((m) => [m.id, m.name]));

    const totalReceived = Number(received._sum.grossAmount ?? 0);
    const totalPaidOut = Number(paidOut._sum.grossAmount ?? 0);
    const totalToReceive = Number(toReceive._sum.grossAmount ?? 0);
    const totalToPay = Number(toPay._sum.grossAmount ?? 0);

    const byPaymentMethod = byMethodRaw
      .map((g) => ({
        paymentMethodId: g.paymentMethodId,
        paymentMethodName: g.paymentMethodId
          ? (methodName.get(g.paymentMethodId) ?? 'Outros')
          : 'Sem forma',
        total: Number(g._sum.grossAmount ?? 0),
      }))
      .sort((a, b) => b.total - a.total);

    // Saldo corrente por conta.
    const movByAccount = new Map<string, { income: number; expense: number }>();
    for (const m of movementsRaw) {
      if (!m.accountId) continue;
      const entry = movByAccount.get(m.accountId) ?? { income: 0, expense: 0 };
      if (m.kind === 'income') entry.income += Number(m._sum.grossAmount ?? 0);
      else entry.expense += Number(m._sum.grossAmount ?? 0);
      movByAccount.set(m.accountId, entry);
    }
    const accountBalances = accounts.map((a) => {
      const mv = movByAccount.get(a.id) ?? { income: 0, expense: 0 };
      const initial = Number(a.initialBalance);
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        active: a.active,
        initialBalance: initial,
        currentBalance: initial + mv.income - mv.expense,
      };
    });

    // Fluxo de caixa por dia (entrada/saída/saldo acumulado).
    const inflowByDay = new Map<string, number>();
    const outflowByDay = new Map<string, number>();
    let openingBalance = accounts.reduce(
      (acc, a) => acc + Number(a.initialBalance),
      0,
    );
    for (const t of paidTx) {
      if (!t.paidAt) continue;
      const amount = Number(t.grossAmount);
      if (t.paidAt < chartFrom) {
        // Movimentos anteriores à janela entram no saldo de abertura.
        openingBalance += t.kind === 'income' ? amount : -amount;
        continue;
      }
      const key = dayKey(t.paidAt);
      if (t.kind === 'income') {
        inflowByDay.set(key, (inflowByDay.get(key) ?? 0) + amount);
      } else {
        outflowByDay.set(key, (outflowByDay.get(key) ?? 0) + amount);
      }
    }

    // Vendas por dia.
    const salesByDayMap = new Map<string, { total: number; count: number }>();
    for (const o of orders) {
      const key = dayKey(o.date);
      const entry = salesByDayMap.get(key) ?? { total: 0, count: 0 };
      entry.total += Number(o.netTotal);
      entry.count += 1;
      salesByDayMap.set(key, entry);
    }

    // Série de dias contínua entre chartFrom e chartTo.
    const cashFlow: {
      date: string;
      inflow: number;
      outflow: number;
      balance: number;
    }[] = [];
    const salesByDay: { date: string; total: number; count: number }[] = [];
    let running = openingBalance;
    const cursor = new Date(
      Date.UTC(
        chartFrom.getUTCFullYear(),
        chartFrom.getUTCMonth(),
        chartFrom.getUTCDate(),
      ),
    );
    const lastKey = dayKey(chartTo);
    // Limite de segurança para não gerar séries absurdas.
    for (let i = 0; i < 400; i += 1) {
      const key = dayKey(cursor);
      const inflow = inflowByDay.get(key) ?? 0;
      const outflow = outflowByDay.get(key) ?? 0;
      running += inflow - outflow;
      cashFlow.push({ date: key, inflow, outflow, balance: running });
      const sale = salesByDayMap.get(key) ?? { total: 0, count: 0 };
      salesByDay.push({ date: key, total: sale.total, count: sale.count });
      if (key === lastKey) break;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return {
      period: { from: from ?? null, to: to ?? null },
      // Compatibilidade com consumidores anteriores.
      totalIncome: totalReceived,
      totalExpense: totalPaidOut,
      balance: totalReceived - totalPaidOut,
      byPaymentMethod,
      // Cards "hoje".
      receivableToday: Number(recvToday._sum.grossAmount ?? 0),
      payableToday: Number(payToday._sum.grossAmount ?? 0),
      // Totais do período.
      totals: {
        received: totalReceived,
        toReceive: totalToReceive,
        paid: totalPaidOut,
        toPay: totalToPay,
      },
      accounts: accountBalances,
      cashFlow,
      salesByDay,
    };
  }

  // ===================== Transactions =====================
  async listTransactions(companyId: string, q: ListTransactionsQueryDto) {
    const fromStart = startOfDay(q.from);
    const toEnd = endOfDay(q.to);
    const hasRange = Boolean(fromStart || toEnd);
    const range = {
      ...(fromStart ? { gte: fromStart } : {}),
      ...(toEnd ? { lte: toEnd } : {}),
    };
    const where = {
      companyId,
      ...(q.type ? { kind: q.type } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.paymentMethodId ? { paymentMethodId: q.paymentMethodId } : {}),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(hasRange ? { dueDate: range } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.client.transaction.findMany({
        where,
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          account: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          paymentMethod: { select: { id: true, name: true } },
          // Para descrição automática: "Referente à comanda #N para CLIENTE".
          order: {
            select: {
              id: true,
              number: true,
              customer: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.client.transaction.count({ where }),
    ]);
    return { data, page: 1, pageSize: data.length, total };
  }

  /**
   * Estorna uma transação SEM excluí-la: marca a original como `reversed` e
   * cria uma contrapartida (lançamento de sinal oposto, também `reversed`)
   * referenciando a original, preservando o histórico e neutralizando o efeito
   * no caixa.
   */
  async reverseTransaction(companyId: string, id: string) {
    const original = await this.findTransaction(companyId, id);
    if (original.status === 'reversed') {
      throw new BadRequestException('Transação já estornada');
    }
    const counterKind = original.kind === 'income' ? 'expense' : 'income';
    const label =
      original.description?.trim() || `lançamento ${original.id.slice(0, 8)}`;
    const [reversed, counter] = await this.prisma.client.$transaction([
      this.prisma.client.transaction.update({
        where: { id },
        data: { status: 'reversed' },
      }),
      this.prisma.client.transaction.create({
        data: {
          companyId,
          kind: counterKind,
          grossAmount: original.grossAmount,
          accountId: original.accountId,
          categoryId: original.categoryId,
          paymentMethodId: original.paymentMethodId,
          partyType: original.partyType,
          partyId: original.partyId,
          orderId: original.orderId,
          description: `Estorno: ${label}`,
          dueDate: new Date(),
          paidAt: new Date(),
          status: 'reversed',
        },
      }),
    ]);
    return { reversed, counter };
  }

  /**
   * Transferência entre contas: cria um par de lançamentos pagos — saída
   * (expense) na conta de origem e entrada (income) na conta de destino.
   */
  async createTransfer(companyId: string, dto: CreateTransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException(
        'Conta de origem e destino devem ser diferentes',
      );
    }
    const accounts = await this.prisma.client.financialAccount.findMany({
      where: { companyId, id: { in: [dto.fromAccountId, dto.toAccountId] } },
      select: { id: true, name: true },
    });
    const fromAcc = accounts.find((a) => a.id === dto.fromAccountId);
    const toAcc = accounts.find((a) => a.id === dto.toAccountId);
    if (!fromAcc || !toAcc) {
      throw new NotFoundException('Conta financeira não encontrada');
    }
    const when = dto.date ? new Date(dto.date) : new Date();
    const baseDesc =
      dto.description?.trim() ||
      `Transferência: ${fromAcc.name} → ${toAcc.name}`;
    const [out, income] = await this.prisma.client.$transaction([
      this.prisma.client.transaction.create({
        data: {
          companyId,
          kind: 'expense',
          grossAmount: dto.amount,
          accountId: dto.fromAccountId,
          categoryId: dto.categoryId ?? null,
          description: baseDesc,
          dueDate: when,
          paidAt: when,
          status: 'paid',
        },
      }),
      this.prisma.client.transaction.create({
        data: {
          companyId,
          kind: 'income',
          grossAmount: dto.amount,
          accountId: dto.toAccountId,
          categoryId: dto.categoryId ?? null,
          description: baseDesc,
          dueDate: when,
          paidAt: when,
          status: 'paid',
        },
      }),
    ]);
    return { out, income };
  }

  createTransaction(companyId: string, dto: CreateTransactionDto) {
    const { dueDate, paidAt, ...rest } = dto;
    return this.prisma.client.transaction.create({
      data: {
        ...rest,
        companyId,
        ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
        ...(paidAt ? { paidAt: new Date(paidAt) } : {}),
      },
    });
  }

  async updateTransaction(companyId: string, id: string, dto: UpdateTransactionDto) {
    await this.findTransaction(companyId, id);
    const { dueDate, paidAt, ...rest } = dto;
    return this.prisma.client.transaction.update({
      where: { id },
      data: {
        ...rest,
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
      },
    });
  }

  async removeTransaction(companyId: string, id: string) {
    await this.findTransaction(companyId, id);
    return this.prisma.client.transaction.delete({ where: { id } });
  }

  private async findTransaction(companyId: string, id: string) {
    const found = await this.prisma.client.transaction.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Transação não encontrada');
    return found;
  }

  // ===================== Financial accounts =====================
  listAccounts(companyId: string) {
    return this.prisma.client.financialAccount.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  createAccount(companyId: string, dto: CreateFinancialAccountDto) {
    return this.prisma.client.financialAccount.create({
      data: { ...dto, companyId },
    });
  }

  async updateAccount(companyId: string, id: string, dto: UpdateFinancialAccountDto) {
    const found = await this.prisma.client.financialAccount.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Conta financeira não encontrada');
    return this.prisma.client.financialAccount.update({ where: { id }, data: dto });
  }

  async removeAccount(companyId: string, id: string) {
    const found = await this.prisma.client.financialAccount.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Conta financeira não encontrada');
    await this.prisma.client.financialAccount.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ===================== Payment methods =====================
  listPaymentMethods(companyId: string) {
    return this.prisma.client.paymentMethod.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  createPaymentMethod(companyId: string, dto: CreatePaymentMethodDto) {
    return this.prisma.client.paymentMethod.create({
      data: { ...dto, companyId },
    });
  }

  async updatePaymentMethod(companyId: string, id: string, dto: UpdatePaymentMethodDto) {
    const found = await this.prisma.client.paymentMethod.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Forma de pagamento não encontrada');
    return this.prisma.client.paymentMethod.update({ where: { id }, data: dto });
  }

  async removePaymentMethod(companyId: string, id: string) {
    const found = await this.prisma.client.paymentMethod.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Forma de pagamento não encontrada');
    await this.prisma.client.paymentMethod.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ===================== Financial categories =====================
  listCategories(companyId: string) {
    return this.prisma.client.financialCategory.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  createCategory(companyId: string, dto: CreateFinancialCategoryDto) {
    return this.prisma.client.financialCategory.create({
      data: { ...dto, companyId },
    });
  }

  async updateCategory(companyId: string, id: string, dto: UpdateFinancialCategoryDto) {
    const found = await this.prisma.client.financialCategory.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Categoria financeira não encontrada');
    return this.prisma.client.financialCategory.update({ where: { id }, data: dto });
  }

  async removeCategory(companyId: string, id: string) {
    const found = await this.prisma.client.financialCategory.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Categoria financeira não encontrada');
    await this.prisma.client.financialCategory.delete({ where: { id } });
    return { id, deleted: true };
  }
}
