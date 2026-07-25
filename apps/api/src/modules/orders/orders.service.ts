import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { QueuesService } from '../queues/queues.service';
import {
  CreateOrderDto,
  AddItemDto,
  AddDiscountDto,
  AddPaymentDto,
  UpdateOrderDto,
  UpdateOrderItemDto,
  AddAuxiliaryDto,
  AddConsumedProductDto,
  UseBalanceDto,
} from './dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService,
  ) {}

  async list(companyId: string, status?: string) {
    const where = { companyId, ...(status ? { status: status as never } : {}) };
    const data = await this.prisma.client.order.findMany({
      where,
      include: { customer: true },
      orderBy: { date: 'desc' },
    });
    return { data, page: 1, pageSize: data.length, total: data.length };
  }

  /**
   * Lightweight guard: fetches the order scoped by company (status + basics),
   * throwing NotFound when missing. Used by mutation endpoints before writing.
   */
  private async loadOrder(companyId: string, id: string) {
    const order = await this.prisma.client.order.findFirst({ where: { id, companyId } });
    if (!order) throw new NotFoundException('Comanda não encontrada');
    return order;
  }

  private assertEditable(order: { status: string }) {
    if (order.status === 'finished') {
      throw new BadRequestException('Comanda finalizada — reabra para editar.');
    }
    if (order.status === 'canceled') {
      throw new BadRequestException('Comanda cancelada — não pode ser editada.');
    }
  }

  /** Carrega o item garantindo que pertence à comanda; lança NotFound quando ausente. */
  private async loadItem(orderId: string, itemId: string) {
    const item = await this.prisma.client.orderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!item) throw new NotFoundException('Item da comanda não encontrado');
    return item;
  }

  /**
   * Saldo de crédito e cashback do cliente (derivado dos ledgers).
   * Cashback filtra linhas vencidas (expiresAt < now); crédito não expira.
   */
  private async customerBalance(companyId: string, customerId: string) {
    const now = new Date();
    const [creditAgg, cashbackRows] = await Promise.all([
      this.prisma.client.customerCredit.aggregate({
        _sum: { amount: true },
        where: { customerId, customer: { companyId } },
      }),
      this.prisma.client.customerCashback.findMany({
        where: {
          customerId,
          customer: { companyId },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        select: { amount: true },
      }),
    ]);
    const creditBalance = new Prisma.Decimal(creditAgg._sum.amount ?? 0);
    const cashbackBalance = cashbackRows.reduce(
      (acc, r) => acc.add(r.amount),
      new Prisma.Decimal(0),
    );
    return { creditBalance, cashbackBalance };
  }

  /**
   * GET /orders/:id — enriched detail for the front.
   * Inclui por item: auxiliaries (com professionalName) e consumedProducts
   * (com productName + batch code). Também retorna os saldos do cliente.
   */
  async findOne(companyId: string, id: string) {
    const found = await this.prisma.client.order.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            professional: true,
            batch: true,
            auxiliaries: { include: { professional: true } },
            consumedProducts: { include: { product: true, batch: true } },
          },
        },
        discounts: true,
        payments: { include: { paymentMethod: true, account: true } },
        customer: true,
        professional: true,
        statusHistory: { orderBy: { at: 'asc' }, include: { byUser: true } },
      },
    });
    if (!found) throw new NotFoundException('Comanda não encontrada');

    // Resolve item names in batch (Service or Product per kind/refId).
    const serviceIds = found.items.filter((i) => i.kind === 'service').map((i) => i.refId);
    const productIds = found.items.filter((i) => i.kind === 'product').map((i) => i.refId);
    const [services, products] = await Promise.all([
      serviceIds.length
        ? this.prisma.client.service.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      productIds.length
        ? this.prisma.client.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const serviceName = new Map(services.map((s): [string, string] => [s.id, s.name]));
    const productName = new Map(products.map((p): [string, string] => [p.id, p.name]));

    const items = found.items.map((it) => ({
      ...it,
      itemName:
        it.kind === 'service'
          ? serviceName.get(it.refId) ?? null
          : productName.get(it.refId) ?? null,
      professionalName: it.professional?.name ?? null,
      batchCode: it.batch?.code ?? null,
      auxiliaries: it.auxiliaries.map((a) => ({
        ...a,
        professionalName: a.professional?.name ?? null,
      })),
      consumedProducts: it.consumedProducts.map((c) => ({
        ...c,
        productName: c.product?.name ?? null,
        batchCode: c.batch?.code ?? null,
      })),
    }));

    const payments = found.payments.map((p) => ({
      ...p,
      paymentMethodName: p.paymentMethod?.name ?? null,
      accountName: p.account?.name ?? null,
    }));

    const balance = found.customerId
      ? await this.customerBalance(companyId, found.customerId)
      : { creditBalance: new Prisma.Decimal(0), cashbackBalance: new Prisma.Decimal(0) };

    return {
      ...found,
      professionalName: found.professional?.name ?? null,
      customerName: found.customer?.name ?? null,
      items,
      payments,
      statusHistory: found.statusHistory,
      customerBalance: {
        creditBalance: balance.creditBalance,
        cashbackBalance: balance.cashbackBalance,
      },
    };
  }

  async create(companyId: string, dto: CreateOrderDto) {
    const last = await this.prisma.client.order.findFirst({
      where: { companyId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return this.prisma.client.order.create({
      data: {
        companyId,
        number: (last?.number ?? 0) + 1,
        customerId: dto.customerId,
        professionalId: dto.professionalId,
        notes: dto.notes,
        date: dto.date ? new Date(dto.date) : new Date(),
      },
    });
  }

  async addItem(companyId: string, id: string, dto: AddItemDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    const quantity = dto.quantity ?? 1;
    // Preço unitário: usa o informado; se ausente/zero, cai no catálogo (preço do
    // serviço / preço de venda do produto) para que o item nunca entre com R$0
    // por falta de prefill na tela. O ref é validado pertencer à empresa.
    const unitPrice = await this.resolveUnitPrice(companyId, dto);
    const grossValue = unitPrice.mul(quantity);
    await this.prisma.client.orderItem.create({
      data: {
        orderId: id,
        kind: dto.kind,
        refId: dto.refId,
        professionalId: dto.professionalId,
        quantity,
        unitPrice,
        grossValue,
        discount: dto.discount ?? 0,
      },
    });
    return this.recalculate(id);
  }

  /**
   * Resolve o preço unitário de um item da comanda. Prioriza o valor enviado pelo
   * cliente; quando ausente ou 0, busca o preço no catálogo (Service.price para
   * serviços, Product.salePrice para produtos), sempre com escopo da empresa.
   * Garante que "adicionar serviço/produto" nunca crie item a R$0 só porque a
   * superfície de UI não pré-preencheu o campo de preço.
   */
  private async resolveUnitPrice(
    companyId: string,
    dto: AddItemDto,
  ): Promise<Prisma.Decimal> {
    const provided =
      dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : null;
    if (provided && provided.gt(0)) return provided;

    if (dto.kind === 'service') {
      const service = await this.prisma.client.service.findFirst({
        where: { id: dto.refId, companyId },
        select: { price: true },
      });
      if (service) return service.price;
    } else {
      const product = await this.prisma.client.product.findFirst({
        where: { id: dto.refId, companyId },
        select: { salePrice: true },
      });
      if (product) return product.salePrice;
    }

    // Sem catálogo correspondente: mantém o valor informado (0) para não quebrar.
    return provided ?? new Prisma.Decimal(0);
  }

  /**
   * PATCH /orders/:id/items/:itemId — aba "Dados" (Salvar) + set de batchId (aba "Lote").
   * Recalcula grossValue com base nos novos unitPrice/quantity e chama recalculate().
   */
  async updateItem(companyId: string, id: string, itemId: string, dto: UpdateOrderItemDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    const item = await this.loadItem(id, itemId);

    const unitPrice =
      dto.unitPrice !== undefined ? new Prisma.Decimal(dto.unitPrice) : item.unitPrice;
    const quantity =
      dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : item.quantity;

    // Valida o lote (aba "Lote"): deve pertencer ao mesmo produto/empresa.
    if (dto.batchId) {
      const batch = await this.prisma.client.productBatch.findFirst({
        where: { id: dto.batchId, companyId },
      });
      if (!batch) throw new NotFoundException('Lote não encontrado');
      if (item.kind === 'product' && batch.productId !== item.refId) {
        throw new BadRequestException('Lote não pertence a este produto');
      }
    }

    const data: Prisma.OrderItemUpdateInput = {
      unitPrice,
      quantity,
      grossValue: unitPrice.mul(quantity),
    };
    if (dto.professionalId !== undefined) {
      data.professional = dto.professionalId
        ? { connect: { id: dto.professionalId } }
        : { disconnect: true };
    }
    if (dto.discount !== undefined) data.discount = dto.discount;
    if (dto.batchId !== undefined) {
      data.batch = dto.batchId ? { connect: { id: dto.batchId } } : { disconnect: true };
    }

    await this.prisma.client.orderItem.update({ where: { id: itemId }, data });
    return this.recalculate(id);
  }

  async removeItem(companyId: string, id: string, itemId: string) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    await this.loadItem(id, itemId);
    // Estorna estoque dos produtos consumidos deste item antes de removê-lo.
    await this.revertConsumedForItem(order, itemId);
    await this.prisma.client.orderItem.delete({ where: { id: itemId } });
    return this.recalculate(id);
  }

  // ===================== Auxiliares (rateio de comissão) =====================

  async addAuxiliary(companyId: string, id: string, itemId: string, dto: AddAuxiliaryDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    const item = await this.loadItem(id, itemId);
    if (item.kind !== 'service') {
      throw new BadRequestException('Auxiliares só são permitidos em itens de serviço.');
    }
    const professional = await this.prisma.client.professional.findFirst({
      where: { id: dto.professionalId, companyId },
    });
    if (!professional) throw new NotFoundException('Profissional auxiliar não encontrado');

    await this.prisma.client.orderItemAuxiliary.create({
      data: {
        orderItemId: itemId,
        professionalId: dto.professionalId,
        discountFrom: dto.discountFrom,
        valueType: dto.valueType,
        value: dto.value,
      },
    });
    // Não altera totais (é rateio de comissão) — retorna a comanda enriquecida.
    return this.findOne(companyId, id);
  }

  async removeAuxiliary(companyId: string, id: string, itemId: string, auxId: string) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    await this.loadItem(id, itemId);
    const aux = await this.prisma.client.orderItemAuxiliary.findFirst({
      where: { id: auxId, orderItemId: itemId },
    });
    if (!aux) throw new NotFoundException('Auxiliar não encontrado');
    await this.prisma.client.orderItemAuxiliary.delete({ where: { id: auxId } });
    return this.findOne(companyId, id);
  }

  // ===================== Produtos consumidos (baixa de estoque) =====================

  async addConsumedProduct(
    companyId: string,
    id: string,
    itemId: string,
    dto: AddConsumedProductDto,
  ) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    const item = await this.loadItem(id, itemId);
    if (item.kind !== 'service') {
      throw new BadRequestException('Produtos consumidos só em itens de serviço.');
    }

    const product = await this.prisma.client.product.findFirst({
      where: { id: dto.productId, companyId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    if (dto.batchId) {
      const batch = await this.prisma.client.productBatch.findFirst({
        where: { id: dto.batchId, companyId, productId: dto.productId },
      });
      if (!batch) throw new NotFoundException('Lote não encontrado para este produto');
    }

    // Baixa = campo "Unidade" (quantity). "Extra" fica armazenado mas não afeta o estoque no MVP.
    const qty = new Prisma.Decimal(dto.quantity);
    const nextStock = new Prisma.Decimal(product.stock).minus(qty);
    if (nextStock.lessThan(0)) {
      throw new BadRequestException('Estoque insuficiente para este consumo');
    }

    // Nome do serviço para o "reason" (Comanda #<n> – <serviço>).
    const service = await this.prisma.client.service.findUnique({
      where: { id: item.refId },
      select: { name: true },
    });
    const reason = `Comanda #${order.number} – ${service?.name ?? 'serviço'}`;

    const consumed = await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.orderItemConsumedProduct.create({
        data: {
          orderItemId: itemId,
          productId: dto.productId,
          batchId: dto.batchId ?? null,
          quantity: qty,
          extraQuantity: dto.extraQuantity ?? 0,
          unitValue: dto.unitValue ?? 0,
          unit: dto.unit ?? product.unit ?? null,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: dto.productId,
          type: 'out',
          quantity: qty,
          reason,
          refType: 'order_consumed',
          refId: row.id,
        },
      });
      await tx.product.update({
        where: { id: dto.productId },
        data: { stock: nextStock },
      });
      if (dto.batchId) {
        await tx.productBatch.update({
          where: { id: dto.batchId },
          data: { quantity: { decrement: qty } },
        });
      }
      return row;
    });

    // NÃO chama recalculate (consumido não entra no total da comanda).
    return consumed;
  }

  async removeConsumedProduct(
    companyId: string,
    id: string,
    itemId: string,
    consumedId: string,
  ) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    await this.loadItem(id, itemId);
    const consumed = await this.prisma.client.orderItemConsumedProduct.findFirst({
      where: { id: consumedId, orderItemId: itemId },
    });
    if (!consumed) throw new NotFoundException('Produto consumido não encontrado');

    await this.restockConsumed(order.number, consumed);
    return { id: consumedId, removed: true };
  }

  /**
   * Estorno de um consumido: InventoryMovement(in) + incrementa Product.stock e
   * ProductBatch.quantity, depois deleta a linha. Usado no remove e no cancel.
   */
  private async restockConsumed(
    orderNumber: number,
    consumed: { id: string; productId: string; batchId: string | null; quantity: Prisma.Decimal },
  ) {
    const qty = new Prisma.Decimal(consumed.quantity);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.inventoryMovement.create({
        data: {
          productId: consumed.productId,
          type: 'in',
          quantity: qty,
          reason: `Estorno consumo – Comanda #${orderNumber}`,
          refType: 'order_consumed',
          refId: consumed.id,
        },
      });
      await tx.product.update({
        where: { id: consumed.productId },
        data: { stock: { increment: qty } },
      });
      if (consumed.batchId) {
        await tx.productBatch.update({
          where: { id: consumed.batchId },
          data: { quantity: { increment: qty } },
        });
      }
      await tx.orderItemConsumedProduct.delete({ where: { id: consumed.id } });
    });
  }

  /** Estorna todos os consumidos de um item (usado ao remover o item). */
  private async revertConsumedForItem(order: { number: number }, itemId: string) {
    const rows = await this.prisma.client.orderItemConsumedProduct.findMany({
      where: { orderItemId: itemId },
    });
    for (const row of rows) await this.restockConsumed(order.number, row);
  }

  // ===================== Crédito / Cashback =====================

  async applyCredit(companyId: string, id: string, dto: UseBalanceDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    if (!order.customerId) {
      throw new BadRequestException('Comanda sem cliente — não é possível usar crédito.');
    }
    const customerId = order.customerId;
    const amount = new Prisma.Decimal(dto.amount);

    await this.prisma.client.$transaction(async (tx) => {
      // Reverte aplicação anterior desta comanda (idempotente).
      await tx.customerCredit.deleteMany({ where: { customerId, reason: `order:${id}` } });
      const agg = await tx.customerCredit.aggregate({
        _sum: { amount: true },
        where: { customerId, customer: { companyId } },
      });
      const available = new Prisma.Decimal(agg._sum.amount ?? 0);
      if (amount.greaterThan(available)) {
        throw new BadRequestException('Saldo de crédito insuficiente.');
      }
      await tx.customerCredit.create({
        data: { customerId, amount: amount.negated(), reason: `order:${id}` },
      });
      await tx.order.update({ where: { id }, data: { creditUsed: amount } });
    });

    return this.recalculate(id);
  }

  async removeCredit(companyId: string, id: string) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    if (order.customerId) {
      await this.prisma.client.customerCredit.deleteMany({
        where: { customerId: order.customerId, reason: `order:${id}` },
      });
    }
    await this.prisma.client.order.update({ where: { id }, data: { creditUsed: 0 } });
    return this.recalculate(id);
  }

  async applyCashback(companyId: string, id: string, dto: UseBalanceDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    if (!order.customerId) {
      throw new BadRequestException('Comanda sem cliente — não é possível usar cashback.');
    }
    const customerId = order.customerId;
    const amount = new Prisma.Decimal(dto.amount);
    const now = new Date();

    await this.prisma.client.$transaction(async (tx) => {
      await tx.customerCashback.deleteMany({
        where: { customerId, sourceType: 'order', sourceId: id },
      });
      // Saldo de cashback = soma das linhas não vencidas.
      const rows = await tx.customerCashback.findMany({
        where: {
          customerId,
          customer: { companyId },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        select: { amount: true },
      });
      const available = rows.reduce((acc, r) => acc.add(r.amount), new Prisma.Decimal(0));
      if (amount.greaterThan(available)) {
        throw new BadRequestException('Saldo de cashback insuficiente.');
      }
      await tx.customerCashback.create({
        data: {
          customerId,
          amount: amount.negated(),
          sourceType: 'order',
          sourceId: id,
        },
      });
      await tx.order.update({ where: { id }, data: { cashbackUsed: amount } });
    });

    return this.recalculate(id);
  }

  async removeCashback(companyId: string, id: string) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    if (order.customerId) {
      await this.prisma.client.customerCashback.deleteMany({
        where: { customerId: order.customerId, sourceType: 'order', sourceId: id },
      });
    }
    await this.prisma.client.order.update({ where: { id }, data: { cashbackUsed: 0 } });
    return this.recalculate(id);
  }

  // ===================== Discounts / Payments =====================

  async addDiscount(companyId: string, id: string, dto: AddDiscountDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    await this.prisma.client.orderDiscount.create({
      data: { orderId: id, type: dto.type, value: dto.value, reason: dto.reason },
    });
    return this.recalculate(id);
  }

  async addPayment(companyId: string, id: string, dto: AddPaymentDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    return this.prisma.client.orderPayment.create({
      data: {
        orderId: id,
        paymentMethodId: dto.paymentMethodId,
        accountId: dto.accountId,
        amount: dto.amount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        description: dto.description,
      },
    });
  }

  /** Estorno permanece permitido mesmo com a comanda finalizada. */
  async reversePayment(companyId: string, id: string, pid: string) {
    await this.loadOrder(companyId, id);
    return this.prisma.client.orderPayment.update({
      where: { id: pid },
      data: { status: 'reversed' },
    });
  }

  /**
   * POST /orders/:id/finish — recompute totals + close, reconciliando com
   * Financeiro (Transaction), Caixa (CashMovement), Comissões (CommissionEntry)
   * e Estoque (InventoryMovement) — tudo em UMA transação Prisma, atômica e
   * idempotente.
   *
   * Estoque dos produtos CONSUMIDOS em serviço já é baixado no "Salvar" do drawer
   * (addConsumedProduct); aqui só baixamos o produto VENDIDO direto (item de
   * produto da comanda), sem duplicar.
   *
   * Idempotência: comanda já `finished` retorna sem reprocessar; cada gerador
   * checa a existência dos seus registros (por orderId / refType+refId / legacyId)
   * antes de criar, de modo que um retry parcial não duplica lançamentos.
   */
  async finish(companyId: string, id: string, byUserId?: string) {
    const current = await this.loadOrder(companyId, id);
    if (current.status === 'canceled') {
      throw new BadRequestException('Comanda cancelada — não pode ser finalizada.');
    }
    // Idempotente: já finalizada → apenas retorna (não reprocessa lançamentos).
    if (current.status === 'finished') {
      return this.prisma.client.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, payments: true },
      });
    }

    await this.recalculate(id);

    // Carrega o estado consolidado da comanda para os geradores (dentro do escopo
    // da empresa). Tudo o que segue roda numa única $transaction.
    const order = await this.prisma.client.order.findUniqueOrThrow({
      where: { id },
      include: {
        items: { include: { professional: true } },
        payments: true,
      },
    });

    // Categoria financeira de receita (kind=credit). Resolvida FORA da transação
    // (é read-only e reaproveitável); nullable quando a empresa não tem seed.
    const incomeCategory = await this.prisma.client.financialCategory.findFirst({
      where: { companyId, kind: 'credit', active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    // Caixa aberto (se houver) — só pagamentos goesToCash geram CashMovement.
    const openCash = await this.prisma.client.cashRegister.findFirst({
      where: { companyId, status: 'open' },
      orderBy: { openedAt: 'desc' },
      select: { id: true },
    });

    const finished = await this.prisma.client.$transaction(async (tx) => {
      await this.generateIncomeTransactions(tx, companyId, order, incomeCategory?.id ?? null);
      await this.generateCashMovements(tx, companyId, order, openCash?.id ?? null);
      await this.generateCommissionEntries(tx, companyId, order);
      await this.decrementSoldStock(tx, order);

      return tx.order.update({
        where: { id },
        data: {
          status: 'finished',
          statusHistory: {
            create: { fromStatus: current.status, toStatus: 'finished', byUserId },
          },
        },
        include: { items: true, payments: true },
      });
    });

    // Event-driven: closing the comanda schedules the post-service follow-up
    // (delayed FOLLOWUP_DELAY_HOURS). Only when there's a customer to message.
    // Idempotent per order via the follow-up job's deterministic jobId + marker.
    if (order.customerId) {
      void this.queues.enqueueFollowUp(companyId, { orderId: id });
    }
    return finished;
  }

  // ===================== Reconciliação do fechamento =====================

  /**
   * Receita → uma Transaction (income/paid) por OrderPayment não estornado,
   * preservando método/conta/valor de cada pagamento (o DRE agrupa por
   * paymentMethodId/accountId). `legacyId = order:{id}:pay:{paymentId}` garante
   * idempotência via @@unique([companyId, legacyId]).
   */
  private async generateIncomeTransactions(
    tx: Prisma.TransactionClient,
    companyId: string,
    order: {
      id: string;
      customerId: string | null;
      payments: {
        id: string;
        amount: Prisma.Decimal;
        paymentMethodId: string | null;
        accountId: string | null;
        status: string;
      }[];
    },
    categoryId: string | null,
  ) {
    // Resolve contas-default dos métodos de pagamento sem accountId explícito.
    const methodIds = [
      ...new Set(
        order.payments
          .filter((p) => !p.accountId && p.paymentMethodId)
          .map((p) => p.paymentMethodId as string),
      ),
    ];
    const methods = methodIds.length
      ? await tx.paymentMethod.findMany({
          where: { id: { in: methodIds }, companyId },
          select: { id: true, defaultAccountId: true },
        })
      : [];
    const defaultAccountByMethod = new Map(
      methods.map((m) => [m.id, m.defaultAccountId] as const),
    );

    for (const p of order.payments) {
      if (p.status === 'reversed') continue; // pagamento estornado não vira receita
      const legacyId = `order:${order.id}:pay:${p.id}`;
      // Idempotência baseada em ESTADO ATIVO: pula só se já existe uma Transaction
      // ATIVA (não estornada) para este pagamento. Transactions estornadas por um
      // reopen/cancel anterior têm o legacyId zerado (ver reverseFinishReconciliation),
      // liberando o slot único p/ um novo lançamento neste re-finish.
      const active = await tx.transaction.findFirst({
        where: { companyId, legacyId, status: { not: 'reversed' } },
        select: { id: true },
      });
      if (active) continue;

      const accountId =
        p.accountId ??
        (p.paymentMethodId ? defaultAccountByMethod.get(p.paymentMethodId) ?? null : null);
      const now = new Date();

      await tx.transaction.create({
        data: {
          companyId,
          kind: 'income',
          grossAmount: p.amount,
          accountId,
          categoryId,
          paymentMethodId: p.paymentMethodId,
          partyType: order.customerId ? 'customer' : null,
          partyId: order.customerId,
          orderId: order.id,
          description: 'Recebimento de comanda',
          dueDate: now,
          paidAt: now,
          status: 'paid',
          legacyId,
          legacySource: 'order_finish',
        },
      });
    }
  }

  /**
   * Caixa → CashMovement(in) para cada pagamento cujo método `goesToCash=true`
   * (só o que entra fisicamente no caixa). Sem caixa aberto, não faz nada.
   * Idempotência: pula se já há movimento (refType='order', refId=order.id) para
   * o mesmo pagamento (rastreado em `description`).
   */
  private async generateCashMovements(
    tx: Prisma.TransactionClient,
    companyId: string,
    order: {
      id: string;
      payments: {
        id: string;
        amount: Prisma.Decimal;
        paymentMethodId: string | null;
        status: string;
      }[];
    },
    cashRegisterId: string | null,
  ) {
    if (!cashRegisterId) return;

    const methodIds = [
      ...new Set(
        order.payments
          .filter((p) => p.paymentMethodId)
          .map((p) => p.paymentMethodId as string),
      ),
    ];
    const cashMethods = methodIds.length
      ? await tx.paymentMethod.findMany({
          where: { id: { in: methodIds }, companyId, goesToCash: true },
          select: { id: true },
        })
      : [];
    const goesToCash = new Set(cashMethods.map((m) => m.id));

    // Idempotência por NET, por pagamento: um `in` (description=paymentId) só
    // conta se ainda não foi compensado por um `out` (description=reversal:paymentId).
    // Assim, um pagamento estornado por reopen anterior volta a entrar no caixa.
    const existing = await tx.cashMovement.findMany({
      where: { cashRegisterId, refType: 'order', refId: order.id },
      select: { type: true, description: true },
    });
    const netInByPay = new Map<string, number>();
    for (const m of existing) {
      const payId = (m.description ?? '').replace(/^reversal:/, '');
      if (!payId) continue;
      netInByPay.set(payId, (netInByPay.get(payId) ?? 0) + (m.type === 'in' ? 1 : -1));
    }

    for (const p of order.payments) {
      if (p.status === 'reversed') continue;
      if (!p.paymentMethodId || !goesToCash.has(p.paymentMethodId)) continue;
      if ((netInByPay.get(p.id) ?? 0) > 0) continue; // entrada ativa → não duplica

      await tx.cashMovement.create({
        data: {
          cashRegisterId,
          type: 'in',
          paymentMethodId: p.paymentMethodId,
          amount: p.amount,
          refType: 'order',
          refId: order.id,
          // `description` guarda o paymentId para idempotência por pagamento.
          description: p.id,
        },
      });
    }
  }

  /**
   * Comissão → CommissionEntry por OrderItem com profissional que recebe comissão.
   * baseAmount = grossValue − discount do item. Percentual resolvido pela regra
   * aplicável (ProfessionalCommissionRule: item específico → categoria → all),
   * com fallback em Product.defaultCommissionPercent para produtos.
   * Idempotência: se a comanda já tem entries, não recria.
   */
  private async generateCommissionEntries(
    tx: Prisma.TransactionClient,
    companyId: string,
    order: {
      id: string;
      date: Date;
      items: {
        kind: string;
        refId: string;
        professionalId: string | null;
        grossValue: Prisma.Decimal;
        discount: Prisma.Decimal;
        professional: { id: string; receivesCommission: boolean } | null;
      }[];
    },
  ) {
    // Idempotência por ESTADO ATIVO: só não recria se já houver lançamentos ativos
    // (open/paid) para esta comanda. Entries `reversed` de um reopen anterior são
    // ignoradas, permitindo gerar novas comissões neste re-finish.
    const activeEntry = await tx.commissionEntry.findFirst({
      where: { companyId, orderId: order.id, status: { not: 'reversed' } },
      select: { id: true },
    });
    if (activeEntry) return;

    const now = new Date();

    for (const item of order.items) {
      const professionalId = item.professionalId;
      if (!professionalId) continue;
      if (!item.professional?.receivesCommission) continue;

      const baseAmount = new Prisma.Decimal(item.grossValue).sub(item.discount);
      if (baseAmount.lessThanOrEqualTo(0)) continue;

      const percent = await this.resolveCommissionPercent(tx, professionalId, item);
      if (percent.lessThanOrEqualTo(0)) continue;

      const commissionAmount = baseAmount.mul(percent).div(100);

      await tx.commissionEntry.create({
        data: {
          companyId,
          professionalId,
          orderId: order.id,
          baseAmount,
          commissionAmount,
          status: 'open',
          // Competência é a data da venda/comanda, não o instante em que alguém
          // clicou em "Finalizar". Isso mantém os filtros e backfills corretos.
          competenceDate: order.date,
          availableDate: now,
        },
      });
    }
  }

  /**
   * Resolve o percentual de comissão aplicável a um item.
   * Precedência (mais específico → mais genérico):
   *   1. ProfessionalCommissionRule scope=service|product por scopeId (o item)
   *   2. ProfessionalCommissionRule scope=category (categoria do serviço/produto)
   *   3. ProfessionalCommissionRule scope=all
   *   4. Fallback: Service/Product.defaultCommissionPercent.
   * Regras `fixed` são convertidas para percentual efetivo sobre a base do item,
   * pois CommissionEntry armazena base+valor (evita distorcer o "valorVendido").
   */
  private async resolveCommissionPercent(
    tx: Prisma.TransactionClient,
    professionalId: string,
    item: { kind: string; refId: string; grossValue: Prisma.Decimal; discount: Prisma.Decimal },
  ): Promise<Prisma.Decimal> {
    const scopeType = item.kind === 'service' ? 'service' : 'product';
    const base = new Prisma.Decimal(item.grossValue).sub(item.discount);

    const rules = await tx.professionalCommissionRule.findMany({
      where: {
        professionalId,
        OR: [
          { scopeType, scopeId: item.refId },
          { scopeType: 'category' },
          { scopeType: 'all' },
        ],
      },
    });

    // Categoria do item (para casar regras scope=category).
    let categoryId: string | null = null;
    if (item.kind === 'service') {
      const svc = await tx.service.findUnique({
        where: { id: item.refId },
        select: { categoryId: true },
      });
      categoryId = svc?.categoryId ?? null;
    } else {
      const prod = await tx.product.findUnique({
        where: { id: item.refId },
        select: { categoryId: true },
      });
      categoryId = prod?.categoryId ?? null;
    }

    const toPercent = (rule: { type: string; value: Prisma.Decimal }): Prisma.Decimal => {
      const value = new Prisma.Decimal(rule.value);
      if (rule.type === 'percent') return value;
      // fixed → percentual efetivo sobre a base (0 quando base=0).
      if (base.lessThanOrEqualTo(0)) return new Prisma.Decimal(0);
      return value.div(base).mul(100);
    };

    // 1. item específico
    const specific = rules.find((r) => r.scopeType === scopeType && r.scopeId === item.refId);
    if (specific) return toPercent(specific);
    // 2. categoria
    if (categoryId) {
      const byCat = rules.find((r) => r.scopeType === 'category' && r.scopeId === categoryId);
      if (byCat) return toPercent(byCat);
    }
    // 3. all
    const all = rules.find((r) => r.scopeType === 'all');
    if (all) return toPercent(all);

    // 4. fallback: comissão padrão do item no catálogo.
    if (item.kind === 'service') {
      const service = await tx.service.findUnique({
        where: { id: item.refId },
        select: { defaultCommissionPercent: true },
      });
      return new Prisma.Decimal(service?.defaultCommissionPercent ?? 0);
    }
    if (item.kind === 'product') {
      const prod = await tx.product.findUnique({
        where: { id: item.refId },
        select: { defaultCommissionPercent: true },
      });
      return new Prisma.Decimal(prod?.defaultCommissionPercent ?? 0);
    }
    return new Prisma.Decimal(0);
  }

  /**
   * Estoque → baixa dos produtos VENDIDOS direto na comanda (item kind=product).
   * Produtos CONSUMIDOS em serviço já baixaram no addConsumedProduct — aqui é só
   * o gap da venda. Cria InventoryMovement(out, refType='order') + decrementa
   * Product.stock e, se houver batchId, ProductBatch.quantity.
   * Idempotência: pula item cujo movimento (refType='order', refId=order.id,
   * productId, e o próprio orderItem em `reason`) já exista.
   */
  private async decrementSoldStock(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      number: number;
      items: {
        id: string;
        kind: string;
        refId: string;
        quantity: Prisma.Decimal;
        batchId: string | null;
      }[];
    },
  ) {
    const productItems = order.items.filter((it) => it.kind === 'product');
    if (!productItems.length) return;

    // Idempotência por NET: um item só é considerado "já baixado" se ainda houver
    // saída ativa (out) não compensada por um estorno (in) — ambos com o mesmo
    // orderItemId no `reason`. Assim, um item cuja baixa foi revertida por um
    // reopen anterior volta a ser baixado neste re-finish.
    const moves = await tx.inventoryMovement.findMany({
      where: { refType: 'order', refId: order.id },
      select: { type: true, reason: true },
    });
    const netOutByItem = new Map<string, number>();
    for (const m of moves) {
      const itemId = m.reason?.split('item:')[1];
      if (!itemId) continue;
      const delta = m.type === 'out' ? 1 : -1;
      netOutByItem.set(itemId, (netOutByItem.get(itemId) ?? 0) + delta);
    }

    for (const it of productItems) {
      if ((netOutByItem.get(it.id) ?? 0) > 0) continue; // baixa ativa → não duplica
      const qty = new Prisma.Decimal(it.quantity);
      if (qty.lessThanOrEqualTo(0)) continue;

      await tx.inventoryMovement.create({
        data: {
          productId: it.refId,
          type: 'out',
          quantity: qty,
          reason: `Venda – Comanda #${order.number}|item:${it.id}`,
          refType: 'order',
          refId: order.id,
        },
      });
      await tx.product.update({
        where: { id: it.refId },
        data: { stock: { decrement: qty } },
      });
      if (it.batchId) {
        await tx.productBatch.update({
          where: { id: it.batchId },
          data: { quantity: { decrement: qty } },
        });
      }
    }
  }

  /**
   * Estorna TODA a reconciliação gerada pelo finish (usado no reopen e no remove):
   * — Transactions da comanda: marca original como `reversed` + cria contrapartida
   *   `reversed` (mesmo padrão de financial.reverseTransaction — some do DRE);
   * — CommissionEntry `open` da comanda → `reversed` (some dos totais de comissão);
   * — CashMovement(in, refType='order') da comanda → CashMovement(out) contrário;
   * — Estoque vendido: InventoryMovement(in) + devolve Product.stock/ProductBatch.
   * Idempotente: se já estornado, não duplica.
   */
  private async reverseFinishReconciliation(
    tx: Prisma.TransactionClient,
    companyId: string,
    order: { id: string; number: number },
  ) {
    const now = new Date();

    // 1. Transactions (income) — estorna as ativas (não estornadas) da comanda.
    const txns = await tx.transaction.findMany({
      where: { companyId, orderId: order.id, status: { not: 'reversed' }, reversalOfId: null },
    });
    for (const t of txns) {
      await tx.transaction.update({
        where: { id: t.id },
        // Zera o legacyId ao estornar: preserva a linha (histórico/DRE), mas libera
        // o slot @@unique([companyId, legacyId]) para um eventual re-finish.
        data: { status: 'reversed', reversedAt: now, legacyId: null },
      });
      await tx.transaction.create({
        data: {
          companyId,
          kind: t.kind === 'income' ? 'expense' : 'income',
          grossAmount: t.grossAmount,
          accountId: t.accountId,
          categoryId: t.categoryId,
          paymentMethodId: t.paymentMethodId,
          partyType: t.partyType,
          partyId: t.partyId,
          orderId: order.id,
          reversalOfId: t.id,
          description: `Estorno: Recebimento de comanda #${order.number}`,
          dueDate: now,
          paidAt: now,
          status: 'reversed',
        },
      });
    }

    // 2. Comissões — entries em aberto viram reversed (some dos totais).
    await tx.commissionEntry.updateMany({
      where: { companyId, orderId: order.id, status: 'open' },
      data: { status: 'reversed' },
    });

    // 3. Caixa — neutraliza por NET, por pagamento: para cada `in` ainda ativo
    //    (não compensado por um `out`), cria o movimento contrário (out). Assim
    //    o saldo do caixa referente à comanda volta a zero e ciclos repetidos de
    //    finish/reopen não geram estornos duplicados.
    const cashMoves = await tx.cashMovement.findMany({
      where: { cashRegister: { companyId }, refType: 'order', refId: order.id },
    });
    const netInByPay = new Map<string, number>();
    for (const m of cashMoves) {
      const payId = (m.description ?? m.id).replace(/^reversal:/, '');
      netInByPay.set(payId, (netInByPay.get(payId) ?? 0) + (m.type === 'in' ? 1 : -1));
    }
    for (const m of cashMoves) {
      if (m.type !== 'in') continue;
      const payId = m.description ?? m.id;
      if ((netInByPay.get(payId) ?? 0) <= 0) continue; // já compensado
      // Consome uma unidade do net para não estornar o mesmo `in` duas vezes.
      netInByPay.set(payId, (netInByPay.get(payId) ?? 0) - 1);
      await tx.cashMovement.create({
        data: {
          cashRegisterId: m.cashRegisterId,
          type: 'out',
          paymentMethodId: m.paymentMethodId,
          amount: m.amount,
          refType: 'order',
          refId: order.id,
          description: `reversal:${payId}`,
        },
      });
    }

    // 4. Estoque vendido — devolve o que o finish baixou, por NET: para cada
    //    orderItem, só estorna se ainda houver saída ativa (sum(out) > sum(in)).
    //    Isso torna o estorno idempotente e correto mesmo após ciclos repetidos
    //    de finish/reopen.
    const invMoves = await tx.inventoryMovement.findMany({
      where: { refType: 'order', refId: order.id },
      select: { type: true, reason: true, productId: true },
    });
    const netOutByItem = new Map<string, number>();
    const productByItem = new Map<string, string>();
    for (const m of invMoves) {
      const itemId = m.reason?.split('item:')[1];
      if (!itemId) continue;
      netOutByItem.set(itemId, (netOutByItem.get(itemId) ?? 0) + (m.type === 'out' ? 1 : -1));
      if (m.type === 'out') productByItem.set(itemId, m.productId);
    }
    // Itens de produto vendidos (quantidade + lote) para dimensionar o estorno.
    const soldItems = await tx.orderItem.findMany({
      where: { orderId: order.id, kind: 'product' },
      select: { id: true, refId: true, batchId: true, quantity: true },
    });
    const soldById = new Map(soldItems.map((it) => [it.id, it] as const));

    for (const [itemId, net] of netOutByItem) {
      if (net <= 0) continue; // sem saída ativa → nada a estornar
      const sold = soldById.get(itemId);
      const productId = sold?.refId ?? productByItem.get(itemId);
      if (!productId) continue;
      const qty = new Prisma.Decimal(sold?.quantity ?? 0);
      if (qty.lessThanOrEqualTo(0)) continue;

      await tx.inventoryMovement.create({
        data: {
          productId,
          type: 'in',
          quantity: qty,
          reason: `Estorno venda – Comanda #${order.number}|item:${itemId}`,
          refType: 'order',
          refId: order.id,
        },
      });
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: qty } },
      });
      if (sold?.batchId) {
        await tx.productBatch.update({
          where: { id: sold.batchId },
          data: { quantity: { increment: qty } },
        });
      }
    }
  }

  /**
   * POST /orders/:id/reopen — finished → open, gravando histórico.
   * ESTORNA a reconciliação do finish (receita, caixa, comissão e estoque
   * VENDIDO) numa única transação, para que a comanda volte a ser editável sem
   * deixar lançamentos financeiros/estoque órfãos. Não mexe no estoque de
   * CONSUMIDOS: a baixa deles ocorre no add e permanece válida enquanto a comanda
   * estiver ativa (open/finished).
   */
  async reopen(companyId: string, id: string, byUserId?: string) {
    const order = await this.loadOrder(companyId, id);
    if (order.status !== 'finished') {
      throw new BadRequestException('Somente comandas finalizadas podem ser reabertas.');
    }
    return this.prisma.client.$transaction(async (tx) => {
      await this.reverseFinishReconciliation(tx, companyId, order);
      return tx.order.update({
        where: { id },
        data: {
          status: 'open',
          statusHistory: { create: { fromStatus: 'finished', toStatus: 'open', byUserId } },
        },
        include: { items: true, payments: true },
      });
    });
  }

  async update(companyId: string, id: string, dto: UpdateOrderDto) {
    const order = await this.loadOrder(companyId, id);
    const data: Prisma.OrderUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status && dto.status !== order.status) {
      // Editing status of a finished order must go through reopen().
      if (order.status === 'finished') {
        throw new BadRequestException('Comanda finalizada — reabra para editar.');
      }
      data.status = dto.status as never;
      data.statusHistory = {
        create: { fromStatus: order.status, toStatus: dto.status as never },
      };
    }
    return this.prisma.client.order.update({
      where: { id },
      data,
      include: { customer: true },
    });
  }

  /**
   * DELETE /orders/:id — cancela a comanda. Se estava FINALIZADA, estorna a
   * reconciliação do finish (receita, caixa, comissão e estoque VENDIDO) numa
   * transação atômica. Além disso, estorna o estoque de todos os produtos
   * CONSUMIDOS e devolve crédito/cashback ao cliente (remove os ledgers negativos).
   */
  async remove(companyId: string, id: string) {
    const order = await this.loadOrder(companyId, id);
    if (order.status === 'canceled') return order; // idempotente

    // Se estava finalizada, estorna primeiro os lançamentos do finish (atômico).
    if (order.status === 'finished') {
      await this.prisma.client.$transaction(async (tx) => {
        await this.reverseFinishReconciliation(tx, companyId, order);
      });
    }

    // Estorna consumidos (todos os itens da comanda).
    const consumed = await this.prisma.client.orderItemConsumedProduct.findMany({
      where: { orderItem: { orderId: id } },
    });
    for (const row of consumed) await this.restockConsumed(order.number, row);

    // Devolve crédito/cashback aplicados nesta comanda.
    if (order.customerId) {
      await this.prisma.client.customerCredit.deleteMany({
        where: { customerId: order.customerId, reason: `order:${id}` },
      });
      await this.prisma.client.customerCashback.deleteMany({
        where: { customerId: order.customerId, sourceType: 'order', sourceId: id },
      });
    }

    return this.prisma.client.order.update({
      where: { id },
      data: { status: 'canceled', creditUsed: 0, cashbackUsed: 0 },
    });
  }

  private async recalculate(id: string) {
    const order = await this.prisma.client.order.findUniqueOrThrow({
      where: { id },
      include: { items: true, discounts: true },
    });
    const gross = order.items.reduce(
      (acc, it) => acc.add(it.grossValue).sub(it.discount),
      new Prisma.Decimal(0),
    );
    let discountTotal = new Prisma.Decimal(0);
    for (const d of order.discounts) {
      discountTotal =
        d.type === 'percent'
          ? discountTotal.add(gross.mul(d.value).div(100))
          : discountTotal.add(d.value);
    }
    const net = gross.sub(discountTotal).sub(order.creditUsed).sub(order.cashbackUsed);
    return this.prisma.client.order.update({
      where: { id },
      data: {
        grossTotal: gross,
        discountTotal,
        netTotal: net.lessThan(0) ? new Prisma.Decimal(0) : net,
      },
    });
  }
}
