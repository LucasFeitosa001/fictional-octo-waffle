import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomerPackageDto,
  CreatePackageTemplateDto,
  UpdatePackageTemplateDto,
} from './dto';

@Injectable()
export class PackagesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- templates ----
  listTemplates(companyId: string) {
    return this.prisma.client.packageTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { service: { select: { id: true, name: true } } } } },
    });
  }

  createTemplate(companyId: string, dto: CreatePackageTemplateDto) {
    return this.prisma.client.packageTemplate.create({
      data: {
        companyId,
        name: dto.name,
        price: dto.price,
        validityDays: dto.validityDays ?? 0,
        discount: dto.discount ?? 0,
        items: {
          create: dto.items.map((i) => ({ serviceId: i.serviceId, sessions: i.sessions })),
        },
      },
      include: { items: true },
    });
  }

  async updateTemplate(companyId: string, id: string, dto: UpdatePackageTemplateDto) {
    const found = await this.prisma.client.packageTemplate.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Modelo de pacote não encontrado');

    return this.prisma.client.$transaction(async (tx) => {
      await tx.packageTemplate.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.price !== undefined ? { price: dto.price } : {}),
          ...(dto.validityDays !== undefined ? { validityDays: dto.validityDays } : {}),
          ...(dto.discount !== undefined ? { discount: dto.discount } : {}),
        },
      });
      if (dto.items) {
        await tx.packageTemplateItem.deleteMany({ where: { templateId: id } });
        await tx.packageTemplateItem.createMany({
          data: dto.items.map((i) => ({
            templateId: id,
            serviceId: i.serviceId,
            sessions: i.sessions,
          })),
        });
      }
      return tx.packageTemplate.findUnique({
        where: { id },
        include: { items: true },
      });
    });
  }

  async removeTemplate(companyId: string, id: string) {
    const found = await this.prisma.client.packageTemplate.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Modelo de pacote não encontrado');
    await this.prisma.client.$transaction(async (tx) => {
      await tx.packageTemplateItem.deleteMany({ where: { templateId: id } });
      await tx.packageTemplate.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  // ---- customer packages (sold) ----
  async listCustomerPackages(companyId: string, status?: string, customerId?: string) {
    const where: Prisma.CustomerPackageWhereInput = { companyId };
    if (status === 'active' || status === 'expired' || status === 'finished') {
      where.status = status;
    }
    if (customerId) where.customerId = customerId;

    const data = await this.prisma.client.customerPackage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
        items: { include: { service: { select: { id: true, name: true } } } },
      },
    });
    return { data: data.map((p) => this.withSessionStats(p)), total: data.length };
  }

  async findCustomerPackage(companyId: string, id: string) {
    const found = await this.prisma.client.customerPackage.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
        items: { include: { service: { select: { id: true, name: true } } } },
      },
    });
    if (!found) throw new NotFoundException('Pacote do cliente não encontrado');
    return this.withSessionStats(found);
  }

  async createCustomerPackage(companyId: string, dto: CreateCustomerPackageDto) {
    let price = dto.price ?? 0;
    let expiresAt: Date | null = null;
    let itemsCreate: { serviceId: string; sessionsTotal: number }[] = [];

    if (dto.templateId) {
      const template = await this.prisma.client.packageTemplate.findFirst({
        where: { id: dto.templateId, companyId },
        include: { items: true },
      });
      if (!template) throw new NotFoundException('Modelo de pacote não encontrado');
      if (dto.price === undefined) price = Number(template.price);
      if (template.validityDays > 0) {
        expiresAt = new Date(Date.now() + template.validityDays * 24 * 60 * 60 * 1000);
      }
      itemsCreate = template.items.map((i) => ({
        serviceId: i.serviceId,
        sessionsTotal: i.sessions,
      }));
    }

    // sequential number per company
    const last = await this.prisma.client.customerPackage.findFirst({
      where: { companyId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;

    const created = await this.prisma.client.customerPackage.create({
      data: {
        companyId,
        customerId: dto.customerId,
        templateId: dto.templateId ?? null,
        number,
        price,
        expiresAt,
        items: { create: itemsCreate },
      },
      include: {
        customer: { select: { id: true, name: true } },
        template: { select: { id: true, name: true } },
        items: { include: { service: { select: { id: true, name: true } } } },
      },
    });
    return this.withSessionStats(created);
  }

  async removeCustomerPackage(companyId: string, id: string) {
    const found = await this.prisma.client.customerPackage.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Pacote do cliente não encontrado');
    await this.prisma.client.$transaction(async (tx) => {
      await tx.customerPackageItem.deleteMany({ where: { customerPackageId: id } });
      await tx.customerPackage.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  // Derive sessions used/remaining + validity flags for the UI.
  private withSessionStats<
    T extends {
      expiresAt: Date | null;
      items: { sessionsTotal: number; sessionsUsed: number }[];
    },
  >(pkg: T) {
    const sessionsTotal = pkg.items.reduce((acc, i) => acc + i.sessionsTotal, 0);
    const sessionsUsed = pkg.items.reduce((acc, i) => acc + i.sessionsUsed, 0);
    const sessionsRemaining = sessionsTotal - sessionsUsed;
    const isExpired = pkg.expiresAt ? pkg.expiresAt.getTime() < Date.now() : false;
    return { ...pkg, sessionsTotal, sessionsUsed, sessionsRemaining, isExpired };
  }
}
