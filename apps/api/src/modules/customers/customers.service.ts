import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomerDebtDto,
  CreateCustomerDebtPaymentDto,
  CreateCustomerDto,
  UpdateCustomerDto,
} from './dto';

// Prisma Decimal | number | null -> number (0 when nullish).
const num = (v: unknown): number => (v == null ? 0 : Number(v));

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, search?: string, page = 1, pageSize = 20) {
    const where = {
      companyId,
      active: true,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.client.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
      }),
      this.prisma.client.customer.count({ where }),
    ]);
    return { data, page, pageSize, total };
  }

  async findOne(companyId: string, id: string) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { tags: true, dependents: true, socialProfiles: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    return customer;
  }

  create(companyId: string, dto: CreateCustomerDto) {
    const { birthday, tags, dependents, socialProfiles, ...rest } = dto;
    return this.prisma.client.customer.create({
      data: {
        ...rest,
        companyId,
        ...(birthday ? { birthday: new Date(birthday) } : {}),
        ...(tags
          ? {
              tags: {
                connectOrCreate: tags.map((name) => ({
                  where: { companyId_name: { companyId, name } },
                  create: { companyId, name },
                })),
              },
            }
          : {}),
        ...(dependents
          ? {
              dependents: {
                create: dependents.map((d) => ({ name: d.name, relationship: d.relationship })),
              },
            }
          : {}),
        ...(socialProfiles
          ? {
              socialProfiles: {
                create: socialProfiles.map((s) => ({ platform: s.platform, url: s.url })),
              },
            }
          : {}),
      },
      include: { tags: true, dependents: true, socialProfiles: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(companyId, id);
    const { birthday, tags, dependents, socialProfiles, ...rest } = dto;
    return this.prisma.client.customer.update({
      where: { id },
      data: {
        ...rest,
        ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}),
        // Tags: replace the whole set with the provided names (connectOrCreate).
        ...(tags
          ? {
              tags: {
                set: [],
                connectOrCreate: tags.map((name) => ({
                  where: { companyId_name: { companyId, name } },
                  create: { companyId, name },
                })),
              },
            }
          : {}),
        // Dependents/social profiles: if the collection is provided, replace it.
        ...(dependents
          ? {
              dependents: {
                deleteMany: {},
                create: dependents.map((d) => ({ name: d.name, relationship: d.relationship })),
              },
            }
          : {}),
        ...(socialProfiles
          ? {
              socialProfiles: {
                deleteMany: {},
                create: socialProfiles.map((s) => ({ platform: s.platform, url: s.url })),
              },
            }
          : {}),
      },
      include: { tags: true, dependents: true, socialProfiles: true },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    // Soft-delete: stamp deletedAt so the customer disappears from admin lists
    // while preserving the row and all of its history (appointments, orders,
    // packages, memberships, campaign messages). `active` is left untouched.
    return this.prisma.client.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // GET /customers/:id/panel — métricas reais do cliente (Cliente — profundidade).
  async panel(companyId: string, id: string) {
    const customer = await this.findOne(companyId, id);

    const [
      faturamentoAgg,
      debitosAgg,
      creditosAgg,
      cashbackAgg,
      pacotesEmAberto,
      appointments,
      orders,
    ] = await Promise.all([
      // Faturamento: comandas finalizadas do cliente.
      this.prisma.client.order.aggregate({
        _sum: { netTotal: true },
        where: { companyId, customerId: id, status: 'finished' },
      }),
      // Débitos em aberto.
      this.prisma.client.customerDebt.aggregate({
        _sum: { amount: true },
        where: { companyId, customerId: id, status: 'open' },
      }),
      // Saldo de créditos.
      this.prisma.client.customerCredit.aggregate({
        _sum: { amount: true },
        where: { customerId: id },
      }),
      // Saldo de cashback.
      this.prisma.client.customerCashback.aggregate({
        _sum: { amount: true },
        where: { customerId: id },
      }),
      // Pacotes ativos em aberto.
      this.prisma.client.customerPackage.count({
        where: { companyId, customerId: id, status: 'active' },
      }),
      // Histórico recente de agendamentos.
      this.prisma.client.appointment.findMany({
        where: { companyId, customerId: id },
        orderBy: { start: 'desc' },
        take: 10,
        include: { items: { include: { service: true } } },
      }),
      // Histórico recente de comandas.
      this.prisma.client.order.findMany({
        where: { companyId, customerId: id },
        orderBy: { date: 'desc' },
        take: 10,
        include: { items: true },
      }),
    ]);

    // Última visita: max entre agendamentos e comandas.
    const dates = [
      ...appointments.map((a) => a.start),
      ...orders.map((o) => o.date),
    ];
    const lastVisitAt =
      dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
    const diasSemVir =
      lastVisitAt != null
        ? Math.floor((Date.now() - lastVisitAt.getTime()) / 86_400_000)
        : null;

    // Últimos serviços/itens (comanda + agendamento), máx 10.
    const ultimosServicos = [
      ...appointments.flatMap((a) =>
        a.items.map((it) => ({
          source: 'appointment' as const,
          date: a.start,
          status: a.status as string,
          name: it.service?.name ?? null,
          serviceId: it.serviceId,
          price: num(it.price),
        })),
      ),
      ...orders.flatMap((o) =>
        o.items.map((it) => ({
          source: 'order' as const,
          date: o.date,
          status: o.status as string,
          name: null as string | null,
          kind: it.kind as string,
          refId: it.refId,
          price: num(it.grossValue),
        })),
      ),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);

    return {
      customer,
      faturamento: num(faturamentoAgg._sum.netTotal),
      lastVisitAt,
      diasSemVir,
      debitosTotal: num(debitosAgg._sum.amount),
      creditosSaldo: num(creditosAgg._sum.amount),
      cashbackSaldo: num(cashbackAgg._sum.amount),
      pacotesEmAberto,
      ultimosServicos,
    };
  }

  // ===== Débitos =====

  async listDebts(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerDebt.findMany({
      where: { companyId, customerId: id },
      orderBy: { createdAt: 'desc' },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
  }

  async createDebt(companyId: string, id: string, dto: CreateCustomerDebtDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerDebt.create({
      data: {
        companyId,
        customerId: id,
        amount: dto.amount,
        origin: dto.origin,
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        status: 'open',
      },
      include: { payments: true },
    });
  }

  async addDebtPayment(
    companyId: string,
    id: string,
    debtId: string,
    dto: CreateCustomerDebtPaymentDto,
  ) {
    await this.findOne(companyId, id);
    const debt = await this.prisma.client.customerDebt.findFirst({
      where: { id: debtId, companyId, customerId: id },
    });
    if (!debt) throw new NotFoundException('Débito não encontrado');

    await this.prisma.client.customerDebtPayment.create({
      data: { debtId, amount: dto.amount, method: dto.method },
    });

    // Recalcula status: paid quando o total pago cobre o valor do débito.
    const paidAgg = await this.prisma.client.customerDebtPayment.aggregate({
      _sum: { amount: true },
      where: { debtId },
    });
    const totalPaid = num(paidAgg._sum.amount);
    const status = totalPaid >= num(debt.amount) ? 'paid' : 'open';

    return this.prisma.client.customerDebt.update({
      where: { id: debtId },
      data: { status },
      include: { payments: { orderBy: { paidAt: 'desc' } } },
    });
  }

  // ===== Créditos =====

  async listCredits(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const [credits, cashback] = await Promise.all([
      this.prisma.client.customerCredit.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.customerCashback.findMany({
        where: { customerId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const creditosSaldo = credits.reduce((acc, c) => acc + num(c.amount), 0);
    const cashbackSaldo = cashback.reduce((acc, c) => acc + num(c.amount), 0);
    return { credits, cashback, creditosSaldo, cashbackSaldo };
  }
}
