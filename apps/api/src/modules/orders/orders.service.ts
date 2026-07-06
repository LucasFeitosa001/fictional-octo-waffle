import { Injectable, NotFoundException } from '@nestjs/common';
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

  async findOne(companyId: string, id: string) {
    const found = await this.prisma.client.order.findFirst({
      where: { id, companyId },
      include: { items: true, discounts: true, payments: true, customer: true },
    });
    if (!found) throw new NotFoundException('Comanda não encontrada');
    return found;
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
    await this.findOne(companyId, id);
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
    await this.findOne(companyId, id);
    await this.prisma.client.orderItem.delete({ where: { id: itemId } });
    return this.recalculate(id);
  }

  async addDiscount(companyId: string, id: string, dto: AddDiscountDto) {
    await this.findOne(companyId, id);
    await this.prisma.client.orderDiscount.create({
      data: { orderId: id, type: dto.type, value: dto.value, reason: dto.reason },
    });
    return this.recalculate(id);
  }

  async addPayment(companyId: string, id: string, dto: AddPaymentDto) {
    await this.findOne(companyId, id);
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

  async reversePayment(companyId: string, id: string, pid: string) {
    await this.findOne(companyId, id);
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
    const order = await this.recalculate(id);
    return this.prisma.client.order.update({
      where: { id },
      data: {
        status: 'finished',
        statusHistory: { create: { fromStatus: order.status, toStatus: 'finished', byUserId } },
      },
      include: { items: true, payments: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateOrderDto) {
    const order = await this.findOne(companyId, id);
    const data: Prisma.OrderUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status && dto.status !== order.status) {
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
    await this.findOne(companyId, id);
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
