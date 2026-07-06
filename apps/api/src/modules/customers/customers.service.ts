import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto';

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
    const customer = await this.prisma.client.customer.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    return customer;
  }

  create(companyId: string, dto: CreateCustomerDto) {
    const { birthday, ...rest } = dto;
    return this.prisma.client.customer.create({
      data: { ...rest, companyId, ...(birthday ? { birthday: new Date(birthday) } : {}) },
    });
  }

  async update(companyId: string, id: string, dto: UpdateCustomerDto) {
    await this.findOne(companyId, id);
    const { birthday, ...rest } = dto;
    return this.prisma.client.customer.update({
      where: { id },
      data: { ...rest, ...(birthday !== undefined ? { birthday: birthday ? new Date(birthday) : null } : {}) },
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

  // GET /customers/:id/panel — débitos/créditos resumo (stub).
  async panel(companyId: string, id: string) {
    const customer = await this.findOne(companyId, id);
    const [credits, cashback, orders] = await Promise.all([
      this.prisma.client.customerCredit.findMany({ where: { customerId: id } }),
      this.prisma.client.customerCashback.findMany({ where: { customerId: id } }),
      this.prisma.client.order.count({ where: { customerId: id, companyId } }),
    ]);
    return { customer, credits, cashback, ordersCount: orders };
  }
}
