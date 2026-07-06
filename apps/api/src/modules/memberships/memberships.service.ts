import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomerMembershipDto,
  CreateMembershipPlanDto,
  UpdateCustomerMembershipDto,
  UpdateMembershipPlanDto,
} from './dto';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- plans ----
  listPlans(companyId: string) {
    return this.prisma.client.membershipPlan.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { services: { include: { service: { select: { id: true, name: true } } } } },
    });
  }

  createPlan(companyId: string, dto: CreateMembershipPlanDto) {
    return this.prisma.client.membershipPlan.create({
      data: {
        companyId,
        name: dto.name,
        recurringPrice: dto.recurringPrice,
        intervalMonths: dto.intervalMonths ?? 1,
        services: {
          create: dto.services.map((s) => ({
            serviceId: s.serviceId,
            quantityPerCycle: s.quantityPerCycle,
          })),
        },
      },
      include: { services: true },
    });
  }

  async updatePlan(companyId: string, id: string, dto: UpdateMembershipPlanDto) {
    const found = await this.prisma.client.membershipPlan.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Plano de assinatura não encontrado');

    return this.prisma.client.$transaction(async (tx) => {
      await tx.membershipPlan.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.recurringPrice !== undefined ? { recurringPrice: dto.recurringPrice } : {}),
          ...(dto.intervalMonths !== undefined ? { intervalMonths: dto.intervalMonths } : {}),
        },
      });
      if (dto.services) {
        await tx.membershipService.deleteMany({ where: { membershipPlanId: id } });
        await tx.membershipService.createMany({
          data: dto.services.map((s) => ({
            membershipPlanId: id,
            serviceId: s.serviceId,
            quantityPerCycle: s.quantityPerCycle,
          })),
        });
      }
      return tx.membershipPlan.findUnique({
        where: { id },
        include: { services: true },
      });
    });
  }

  async removePlan(companyId: string, id: string) {
    const found = await this.prisma.client.membershipPlan.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Plano de assinatura não encontrado');
    const inUse = await this.prisma.client.customerMembership.count({
      where: { membershipPlanId: id },
    });
    if (inUse > 0) {
      throw new BadRequestException(
        'Não é possível remover um plano com assinantes vinculados',
      );
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.membershipService.deleteMany({ where: { membershipPlanId: id } });
      await tx.membershipPlan.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  // ---- customer memberships ----
  listCustomerMemberships(companyId: string, status?: string) {
    const where: Prisma.CustomerMembershipWhereInput = { companyId };
    if (status === 'active' || status === 'canceled' || status === 'overdue') {
      where.status = status;
    }
    return this.prisma.client.customerMembership.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
        membershipPlan: { select: { id: true, name: true, recurringPrice: true } },
      },
    });
  }

  async createCustomerMembership(companyId: string, dto: CreateCustomerMembershipDto) {
    const plan = await this.prisma.client.membershipPlan.findFirst({
      where: { id: dto.membershipPlanId, companyId },
    });
    if (!plan) throw new NotFoundException('Plano de assinatura não encontrado');

    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + plan.intervalMonths);

    return this.prisma.client.customerMembership.create({
      data: {
        companyId,
        customerId: dto.customerId,
        membershipPlanId: dto.membershipPlanId,
        nextDueDate,
        payments: {
          create: {
            amount: plan.recurringPrice,
            dueDate: new Date(),
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true } },
        membershipPlan: { select: { id: true, name: true, recurringPrice: true } },
      },
    });
  }

  async updateCustomerMembership(
    companyId: string,
    id: string,
    dto: UpdateCustomerMembershipDto,
  ) {
    const found = await this.prisma.client.customerMembership.findFirst({
      where: { id, companyId },
      include: { membershipPlan: true },
    });
    if (!found) throw new NotFoundException('Assinatura não encontrada');

    // renew: status active + push next due date one interval forward
    let nextDueDate: Date | undefined;
    if (dto.nextDueDate) {
      nextDueDate = new Date(dto.nextDueDate);
    } else if (dto.status === 'active') {
      const base = found.nextDueDate ?? new Date();
      const d = new Date(base);
      d.setMonth(d.getMonth() + found.membershipPlan.intervalMonths);
      nextDueDate = d;
    }

    return this.prisma.client.customerMembership.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(nextDueDate ? { nextDueDate } : {}),
      },
      include: {
        customer: { select: { id: true, name: true } },
        membershipPlan: { select: { id: true, name: true, recurringPrice: true } },
      },
    });
  }
}
