import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, search?: string) {
    const where: Prisma.SupplierWhereInput = {
      companyId,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.client.supplier.findMany({ where, orderBy: { name: 'asc' } }),
      this.prisma.client.supplier.count({ where }),
    ]);
    return { data, page: 1, pageSize: data.length, total };
  }

  async findOne(companyId: string, id: string) {
    const found = await this.prisma.client.supplier.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!found) throw new NotFoundException('Fornecedor não encontrado');
    return found;
  }

  create(companyId: string, dto: CreateSupplierDto) {
    const { addressJson, ...rest } = dto;
    return this.prisma.client.supplier.create({
      data: {
        ...rest,
        companyId,
        addressJson: addressJson as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateSupplierDto) {
    await this.findOne(companyId, id);
    const { addressJson, ...rest } = dto;
    return this.prisma.client.supplier.update({
      where: { id },
      data: {
        ...rest,
        ...(addressJson !== undefined
          ? { addressJson: addressJson as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    // Soft-delete: stamp deletedAt so the supplier disappears from admin lists
    // while preserving the row and its purchase history. `active` is untouched.
    return this.prisma.client.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
