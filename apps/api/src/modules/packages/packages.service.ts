import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConsumePackageItemDto,
  CreateCustomerPackageDto,
  CreatePackageTemplateDto,
  UpdatePackageTemplateDto,
} from './dto';

// Full include used to build the enriched detail view (item balances + usages).
const customerPackageDetailInclude = {
  customer: { select: { id: true, name: true } },
  template: { select: { id: true, name: true } },
  items: {
    include: {
      service: { select: { id: true, name: true } },
      usages: { orderBy: { usedAt: 'desc' as const } },
    },
  },
} satisfies Prisma.CustomerPackageInclude;

type CustomerPackageDetail = Prisma.CustomerPackageGetPayload<{
  include: typeof customerPackageDetailInclude;
}>;

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
      include: customerPackageDetailInclude,
    });
    if (!found) throw new NotFoundException('Pacote do cliente não encontrado');
    return this.enrichDetail(found);
  }

  async createCustomerPackage(companyId: string, dto: CreateCustomerPackageDto) {
    // The customer must exist and belong to this company — otherwise the
    // create() would fail with a foreign-key 500 (or silently attach a package
    // to a customer from another tenant).
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, companyId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

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

    // Preserve history: refuse to hard-delete a package that already has
    // consumption registered. The caller must undo the usages first.
    const usageCount = await this.prisma.client.packageUsage.count({
      where: { customerPackageItem: { customerPackageId: id } },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        'Não é possível excluir um pacote com consumos registrados. Desfaça os consumos primeiro para preservar o histórico.',
      );
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.customerPackageItem.deleteMany({ where: { customerPackageId: id } });
      await tx.customerPackage.delete({ where: { id } });
    });
    return { id, deleted: true };
  }

  // ---- consumption cycle ----

  // Consume one session of a package item: records a PackageUsage and increments
  // sessionsUsed. Blocks on expired/vencido packages and on zero balance.
  async consumePackageItem(
    companyId: string,
    id: string,
    itemId: string,
    dto: ConsumePackageItemDto,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      const pkg = await tx.customerPackage.findFirst({
        where: { id, companyId },
        include: { items: true },
      });
      if (!pkg) throw new NotFoundException('Pacote do cliente não encontrado');

      const isExpired = pkg.expiresAt ? pkg.expiresAt.getTime() < Date.now() : false;
      if (pkg.status === 'expired' || isExpired) {
        throw new BadRequestException('Pacote vencido: não é possível consumir sessões.');
      }

      const item = pkg.items.find((i) => i.id === itemId);
      if (!item) throw new NotFoundException('Item do pacote não encontrado');

      // Atomic compare-and-set: only bump sessionsUsed when there is still
      // balance. The conditional updateMany runs as a single locking UPDATE, so
      // its WHERE is re-evaluated against the committed row — two concurrent
      // consumes on the same item can never push sessionsUsed past
      // sessionsTotal (no negative balance). If nothing was updated, the item
      // was already exhausted.
      const consumed = await tx.customerPackageItem.updateMany({
        where: { id: item.id, sessionsUsed: { lt: item.sessionsTotal } },
        data: { sessionsUsed: { increment: 1 } },
      });
      if (consumed.count === 0) {
        throw new BadRequestException('Sem saldo: todas as sessões deste item já foram utilizadas.');
      }

      await tx.packageUsage.create({
        data: {
          customerPackageItemId: item.id,
          orderId: dto?.orderId ?? null,
        },
      });

      // If every item is now exhausted, finish the package.
      const allExhausted = pkg.items.every((i) => {
        const used = i.id === item.id ? i.sessionsUsed + 1 : i.sessionsUsed;
        return used >= i.sessionsTotal;
      });
      if (allExhausted && pkg.status !== 'finished') {
        await tx.customerPackage.update({
          where: { id: pkg.id },
          data: { status: 'finished' },
        });
      }

      const refreshed = await tx.customerPackage.findFirstOrThrow({
        where: { id, companyId },
        include: customerPackageDetailInclude,
      });
      return this.enrichDetail(refreshed);
    });
  }

  // Undo a consumption: remove the PackageUsage, decrement sessionsUsed (min 0),
  // and reactivate the package if it had been marked finished.
  async removePackageUsage(companyId: string, id: string, usageId: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const pkg = await tx.customerPackage.findFirst({
        where: { id, companyId },
      });
      if (!pkg) throw new NotFoundException('Pacote do cliente não encontrado');

      const usage = await tx.packageUsage.findFirst({
        where: { id: usageId, customerPackageItem: { customerPackageId: id } },
        include: { customerPackageItem: true },
      });
      if (!usage) throw new NotFoundException('Consumo não encontrado');

      await tx.packageUsage.delete({ where: { id: usageId } });

      if (usage.customerPackageItem.sessionsUsed > 0) {
        await tx.customerPackageItem.update({
          where: { id: usage.customerPackageItemId },
          data: { sessionsUsed: { decrement: 1 } },
        });
      }

      // Undoing a usage frees at least one session, so a finished package is
      // no longer exhausted — revert it to active.
      if (pkg.status === 'finished') {
        await tx.customerPackage.update({
          where: { id: pkg.id },
          data: { status: 'active' },
        });
      }

      const refreshed = await tx.customerPackage.findFirstOrThrow({
        where: { id, companyId },
        include: customerPackageDetailInclude,
      });
      return this.enrichDetail(refreshed);
    });
  }

  // Enriched detail view: per-item serviceName/saldo/usages plus package-level
  // customerName, isExpired and effective status.
  private enrichDetail(pkg: CustomerPackageDetail) {
    const isExpired = pkg.expiresAt ? pkg.expiresAt.getTime() < Date.now() : false;
    const effectiveStatus =
      pkg.status === 'finished' ? 'finished' : isExpired ? 'expired' : pkg.status;

    const items = pkg.items.map((i) => ({
      ...i,
      serviceName: i.service?.name ?? null,
      saldo: i.sessionsTotal - i.sessionsUsed,
      usages: i.usages.map((u) => ({
        id: u.id,
        usedAt: u.usedAt,
        orderId: u.orderId,
      })),
    }));

    const sessionsTotal = pkg.items.reduce((acc, i) => acc + i.sessionsTotal, 0);
    const sessionsUsed = pkg.items.reduce((acc, i) => acc + i.sessionsUsed, 0);

    return {
      ...pkg,
      customerName: pkg.customer?.name ?? null,
      isExpired,
      effectiveStatus,
      sessionsTotal,
      sessionsUsed,
      sessionsRemaining: sessionsTotal - sessionsUsed,
      items,
    };
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
