import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateOrderDto,
  AddItemDto,
  AddDiscountDto,
  AddPaymentDto,
  UpdateOrderDto,
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
  }

  /**
   * GET /orders/:id — enriched detail for the front.
   * Keeps the original included relations (items/discounts/payments/customer)
   * and adds resolved names: itemName + professionalName per item,
   * paymentMethodName/accountName per payment, and ordered statusHistory.
   */
  async findOne(companyId: string, id: string) {
    const found = await this.prisma.client.order.findFirst({
      where: { id, companyId },
      include: {
        items: { include: { professional: true } },
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
    }));

    const payments = found.payments.map((p) => ({
      ...p,
      paymentMethodName: p.paymentMethod?.name ?? null,
      accountName: p.account?.name ?? null,
    }));

    return {
      ...found,
      professionalName: found.professional?.name ?? null,
      customerName: found.customer?.name ?? null,
      items,
      payments,
      statusHistory: found.statusHistory,
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

  async removeItem(companyId: string, id: string, itemId: string) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    await this.prisma.client.orderItem.delete({ where: { id: itemId } });
    return this.recalculate(id);
  }

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
   * TODO Fase 1/2: generate transactions (income), commission_entries,
   * inventory_movements(out) for products, cash_movements, optional invoices (spec integrity rules).
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

  async remove(companyId: string, id: string) {
    await this.loadOrder(companyId, id);
    return this.prisma.client.order.update({ where: { id }, data: { status: 'canceled' } });
  }

  // TODO Fase 1: use-credit / use-cashback wiring.

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
