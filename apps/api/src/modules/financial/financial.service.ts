import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateFinancialAccountDto,
  CreateFinancialCategoryDto,
  CreatePaymentMethodDto,
  CreateTransactionDto,
  ListTransactionsQueryDto,
  UpdateFinancialAccountDto,
  UpdateFinancialCategoryDto,
  UpdatePaymentMethodDto,
  UpdateTransactionDto,
} from './dto';

@Injectable()
export class FinancialService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================== Summary =====================
  // Entradas (income), saídas (expense), saldo acumulado e recebimentos por
  // forma de pagamento. Considera apenas transações com status `paid` (e paidAt
  // dentro do período, quando informado).
  async summary(companyId: string, from?: string, to?: string) {
    const range = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const hasRange = Boolean(from || to);

    const paidWhere = {
      companyId,
      status: 'paid' as const,
      ...(hasRange ? { paidAt: range } : {}),
    };

    const [income, expense, byMethodRaw, paymentMethods] = await Promise.all([
      this.prisma.client.transaction.aggregate({
        _sum: { grossAmount: true },
        where: { ...paidWhere, kind: 'income' },
      }),
      this.prisma.client.transaction.aggregate({
        _sum: { grossAmount: true },
        where: { ...paidWhere, kind: 'expense' },
      }),
      this.prisma.client.transaction.groupBy({
        by: ['paymentMethodId'],
        _sum: { grossAmount: true },
        where: { ...paidWhere, kind: 'income' },
      }),
      this.prisma.client.paymentMethod.findMany({
        where: { companyId },
        select: { id: true, name: true },
      }),
    ]);

    const methodName = new Map(paymentMethods.map((m) => [m.id, m.name]));

    const totalIncome = Number(income._sum.grossAmount ?? 0);
    const totalExpense = Number(expense._sum.grossAmount ?? 0);

    const byPaymentMethod = byMethodRaw
      .map((g) => ({
        paymentMethodId: g.paymentMethodId,
        paymentMethodName: g.paymentMethodId
          ? (methodName.get(g.paymentMethodId) ?? 'Outros')
          : 'Sem forma',
        total: Number(g._sum.grossAmount ?? 0),
      }))
      .sort((a, b) => b.total - a.total);

    return {
      period: { from: from ?? null, to: to ?? null },
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      byPaymentMethod,
    };
  }

  // ===================== Transactions =====================
  async listTransactions(companyId: string, q: ListTransactionsQueryDto) {
    const hasRange = Boolean(q.from || q.to);
    const range = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to ? { lte: new Date(q.to) } : {}),
    };
    const where = {
      companyId,
      ...(q.type ? { kind: q.type } : {}),
      ...(q.status ? { status: q.status } : {}),
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
        },
      }),
      this.prisma.client.transaction.count({ where }),
    ]);
    return { data, page: 1, pageSize: data.length, total };
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
