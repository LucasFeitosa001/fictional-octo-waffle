import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdjustCashbackDto,
  CreateCustomerAnamnesisDto,
  CreateCustomerDebtDto,
  CreateCustomerDebtPaymentDto,
  CreateCustomerDto,
  CreateCustomerFileDto,
  CreateCustomerNoteDto,
  RedeemCashbackDto,
  UpdateCustomerAnamnesisDto,
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

  // Valida indicação: o referredById precisa existir, pertencer à mesma empresa
  // e não pode ser o próprio cliente (auto-indicação).
  private async assertValidReferral(
    companyId: string,
    referredById?: string,
    selfId?: string,
  ) {
    if (!referredById) return;
    if (selfId && referredById === selfId) {
      throw new BadRequestException('Cliente não pode indicar a si mesmo');
    }
    const referrer = await this.prisma.client.customer.findFirst({
      where: { id: referredById, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!referrer) throw new NotFoundException('Cliente indicador não encontrado');
  }

  async create(companyId: string, dto: CreateCustomerDto) {
    await this.assertValidReferral(companyId, dto.referredById);
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
    await this.assertValidReferral(companyId, dto.referredById, id);
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
      debitosAbertos,
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
      // Débitos em aberto — com pagamentos para calcular o saldo real.
      this.prisma.client.customerDebt.findMany({
        where: { companyId, customerId: id, status: 'open' },
        include: { payments: { select: { amount: true } } },
      }),
      // Saldo de créditos (escopado pela empresa via relação do cliente).
      this.prisma.client.customerCredit.aggregate({
        _sum: { amount: true },
        where: { customerId: id, customer: { companyId } },
      }),
      // Saldo de cashback (escopado pela empresa via relação do cliente).
      this.prisma.client.customerCashback.aggregate({
        _sum: { amount: true },
        where: { customerId: id, customer: { companyId } },
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

    // Débitos: saldo real (amount - pagamentos) de cada débito em aberto,
    // alinhado com a aba Débitos.
    const debitosTotal = debitosAbertos.reduce((acc, debt) => {
      const paid = debt.payments.reduce((sum, pmt) => sum + num(pmt.amount), 0);
      return acc + Math.max(num(debt.amount) - paid, 0);
    }, 0);

    return {
      customer,
      faturamento: num(faturamentoAgg._sum.netTotal),
      lastVisitAt,
      diasSemVir,
      debitosTotal,
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

    // Trava de overpayment: pagamento não pode exceder o saldo devedor restante.
    const prevPaidAgg = await this.prisma.client.customerDebtPayment.aggregate({
      _sum: { amount: true },
      where: { debtId },
    });
    const saldo = num(debt.amount) - num(prevPaidAgg._sum.amount);
    if (saldo <= 0) {
      throw new BadRequestException('Débito já está quitado');
    }
    if (dto.amount > saldo) {
      throw new BadRequestException(
        'Pagamento excede o saldo devedor restante do débito',
      );
    }

    await this.prisma.client.customerDebtPayment.create({
      data: { debtId, amount: dto.amount, method: dto.method },
    });

    // Recalcula status: paid quando o total pago cobre o valor do débito.
    const totalPaid = num(prevPaidAgg._sum.amount) + dto.amount;
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
        where: { customerId: id, customer: { companyId } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.customerCashback.findMany({
        where: { customerId: id, customer: { companyId } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const creditosSaldo = credits.reduce((acc, c) => acc + num(c.amount), 0);
    const cashbackSaldo = cashback.reduce((acc, c) => acc + num(c.amount), 0);
    return { credits, cashback, creditosSaldo, cashbackSaldo };
  }

  /**
   * GET /customers/:id/balance — helper p/ a comanda exibir "Crédito"/"Cashback".
   * creditBalance = soma de todo o ledger de crédito.
   * cashbackBalance = soma somente das linhas de cashback não vencidas (expiresAt >= now).
   */
  async balance(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const now = new Date();
    const [creditAgg, cashbackRows] = await Promise.all([
      this.prisma.client.customerCredit.aggregate({
        _sum: { amount: true },
        where: { customerId: id, customer: { companyId } },
      }),
      this.prisma.client.customerCashback.findMany({
        where: {
          customerId: id,
          customer: { companyId },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        select: { amount: true },
      }),
    ]);
    const creditBalance = num(creditAgg._sum.amount);
    const cashbackBalance = cashbackRows.reduce((acc, r) => acc + num(r.amount), 0);
    return { creditBalance, cashbackBalance };
  }

  // ===== Cashback (extrato dedicado) =====

  async listCashback(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const cashback = await this.prisma.client.customerCashback.findMany({
      where: { customerId: id, customer: { companyId } },
      orderBy: { createdAt: 'desc' },
    });
    const saldo = cashback.reduce((acc, c) => acc + num(c.amount), 0);
    return { cashback, saldo };
  }

  /** Saldo de cashback válido (linhas não vencidas) do cliente. */
  private async cashbackBalance(companyId: string, id: string): Promise<number> {
    const rows = await this.prisma.client.customerCashback.findMany({
      where: {
        customerId: id,
        customer: { companyId },
        OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      },
      select: { amount: true },
    });
    return rows.reduce((acc, r) => acc + num(r.amount), 0);
  }

  /**
   * POST /customers/:id/cashback/redeem — resgata cashback do cliente.
   * Insere uma linha NEGATIVA no ledger. Respeita o programa global da empresa
   * (cashbackCanRedeem) e valida saldo suficiente.
   */
  async redeemCashback(companyId: string, id: string, dto: RedeemCashbackDto) {
    await this.findOne(companyId, id);
    const company = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: { cashbackCanRedeem: true },
    });
    if (company && company.cashbackCanRedeem === false) {
      throw new BadRequestException('Resgate de cashback desativado no programa.');
    }
    const saldo = await this.cashbackBalance(companyId, id);
    if (dto.amount > saldo) {
      throw new BadRequestException('Saldo de cashback insuficiente.');
    }
    const entry = await this.prisma.client.customerCashback.create({
      data: {
        customerId: id,
        amount: new Prisma.Decimal(-Math.abs(dto.amount)),
        sourceType: 'redeem',
      },
    });
    return { entry, saldo: saldo - Math.abs(dto.amount) };
  }

  /**
   * POST /customers/:id/cashback/adjust — ajuste manual (crédito ou débito).
   * amount positivo credita, negativo debita. expiresAt opcional (crédito).
   */
  async adjustCashback(companyId: string, id: string, dto: AdjustCashbackDto) {
    await this.findOne(companyId, id);
    const entry = await this.prisma.client.customerCashback.create({
      data: {
        customerId: id,
        amount: new Prisma.Decimal(dto.amount),
        sourceType: 'adjust',
        ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}),
      },
    });
    const saldo = await this.cashbackBalance(companyId, id);
    return { entry, saldo };
  }

  // ===== Agendamentos =====

  async listAppointments(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.appointment.findMany({
      where: { companyId, customerId: id },
      orderBy: { start: 'desc' },
      take: 100,
      include: {
        items: { include: { service: { select: { id: true, name: true } } } },
        professional: { select: { id: true, name: true } },
      },
    });
  }

  // ===== Vendas / Comandas =====

  async listOrders(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.order.findMany({
      where: { companyId, customerId: id },
      orderBy: { date: 'desc' },
      take: 100,
      include: {
        items: true,
        professional: { select: { id: true, name: true } },
      },
    });
  }

  // ===== Pacotes =====

  async listPackages(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerPackage.findMany({
      where: { companyId, customerId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true } },
        items: { include: { service: { select: { id: true, name: true } } } },
      },
    });
  }

  // ===== Anotações =====

  async listNotes(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerNote.findMany({
      where: { customerId: id, customer: { companyId } },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async createNote(
    companyId: string,
    id: string,
    authorId: string | undefined,
    dto: CreateCustomerNoteDto,
  ) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerNote.create({
      data: { customerId: id, text: dto.text, authorId: authorId ?? null },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  // ===== Imagens e Arquivos =====

  async listFiles(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerFile.findMany({
      where: { customerId: id, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addFile(companyId: string, id: string, dto: CreateCustomerFileDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerFile.create({
      data: {
        companyId,
        customerId: id,
        url: dto.url,
        name: dto.name,
        mimeType: dto.mimeType ?? null,
        size: dto.size ?? null,
      },
    });
  }

  async removeFile(companyId: string, id: string, fileId: string) {
    await this.findOne(companyId, id);
    const found = await this.prisma.client.customerFile.findFirst({
      where: { id: fileId, customerId: id, companyId },
    });
    if (!found) throw new NotFoundException('Arquivo não encontrado');
    await this.prisma.client.customerFile.delete({ where: { id: fileId } });
    return { id: fileId, deleted: true };
  }

  // ===== Anamneses =====

  async listAnamneses(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerAnamnesis.findMany({
      where: { customerId: id, customer: { companyId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAnamnesis(
    companyId: string,
    id: string,
    dto: CreateCustomerAnamnesisDto,
  ) {
    await this.findOne(companyId, id);
    return this.prisma.client.customerAnamnesis.create({
      data: {
        customerId: id,
        templateId: dto.templateId ?? null,
        ...(dto.answersJson
          ? { answersJson: dto.answersJson as Prisma.InputJsonValue }
          : {}),
        ...(dto.signedAt ? { signedAt: new Date(dto.signedAt) } : {}),
      },
    });
  }

  /** Garante que a ficha pertence a um cliente da empresa; senão 404. */
  private async ensureAnamnesis(companyId: string, id: string, anamId: string) {
    const found = await this.prisma.client.customerAnamnesis.findFirst({
      where: { id: anamId, customerId: id, customer: { companyId } },
    });
    if (!found) throw new NotFoundException('Ficha de anamnese não encontrada');
    return found;
  }

  /**
   * PATCH /customers/:id/anamneses/:anamId — atualiza respostas e/ou assinatura.
   * signedAt === null "des-assina"; string ISO assina; undefined mantém.
   */
  async updateAnamnesis(
    companyId: string,
    id: string,
    anamId: string,
    dto: UpdateCustomerAnamnesisDto,
  ) {
    await this.findOne(companyId, id);
    await this.ensureAnamnesis(companyId, id, anamId);
    return this.prisma.client.customerAnamnesis.update({
      where: { id: anamId },
      data: {
        ...(dto.answersJson !== undefined
          ? { answersJson: dto.answersJson as Prisma.InputJsonValue }
          : {}),
        ...(dto.signedAt !== undefined
          ? { signedAt: dto.signedAt ? new Date(dto.signedAt) : null }
          : {}),
      },
    });
  }

  /** DELETE /customers/:id/anamneses/:anamId */
  async removeAnamnesis(companyId: string, id: string, anamId: string) {
    await this.findOne(companyId, id);
    await this.ensureAnamnesis(companyId, id, anamId);
    await this.prisma.client.customerAnamnesis.delete({ where: { id: anamId } });
    return { id: anamId, deleted: true };
  }
}
