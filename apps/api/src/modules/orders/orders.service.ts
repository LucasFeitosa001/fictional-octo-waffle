import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
    const grossValue = new Prisma.Decimal(dto.unitPrice).mul(quantity);
    await this.prisma.client.orderItem.create({
      data: {
        orderId: id,
        kind: dto.kind,
        refId: dto.refId,
        professionalId: dto.professionalId,
        quantity,
        unitPrice: dto.unitPrice,
        grossValue,
        discount: dto.discount ?? 0,
      },
    });
    return this.recalculate(id);
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
   * POST /orders/:id/finish — recompute totals + close.
   * Estoque dos produtos consumidos já é baixado no "Salvar" do drawer
   * (addConsumedProduct), então o finish NÃO regenera inventory_movements(out)
   * para evitar dupla baixa.
   * TODO Fase 1/2: generate transactions (income), commission_entries, cash_movements.
   */
  async finish(companyId: string, id: string, byUserId?: string) {
    const current = await this.loadOrder(companyId, id);
    await this.recalculate(id);
    return this.prisma.client.order.update({
      where: { id },
      data: {
        status: 'finished',
        statusHistory: { create: { fromStatus: current.status, toStatus: 'finished', byUserId } },
      },
      include: { items: true, payments: true },
    });
  }

  /**
   * POST /orders/:id/reopen — finished → open, gravando histórico.
   * Não estorna estoque de consumidos: a baixa ocorre no add e permanece válida
   * enquanto a comanda estiver ativa (open/finished).
   */
  async reopen(companyId: string, id: string, byUserId?: string) {
    const order = await this.loadOrder(companyId, id);
    if (order.status !== 'finished') {
      throw new BadRequestException('Somente comandas finalizadas podem ser reabertas.');
    }
    return this.prisma.client.order.update({
      where: { id },
      data: {
        status: 'open',
        statusHistory: { create: { fromStatus: 'finished', toStatus: 'open', byUserId } },
      },
      include: { items: true, payments: true },
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
   * DELETE /orders/:id — cancela a comanda. Estorna estoque de todos os produtos
   * consumidos e devolve crédito/cashback ao cliente (remove os ledgers negativos).
   */
  async remove(companyId: string, id: string) {
    const order = await this.loadOrder(companyId, id);
    if (order.status === 'canceled') return order; // idempotente

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
