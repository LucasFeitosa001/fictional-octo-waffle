import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto, CreateServiceCategoryDto } from './dto';

/**
 * Keep the single `imageUrl` (used as the card cover / legacy field) in sync
 * with the `imageUrls` gallery: whenever a gallery is provided, the first photo
 * becomes the cover. If the gallery is omitted we leave both fields untouched.
 */
function withCover<T extends { imageUrls?: string[]; imageUrl?: string | null }>(
  dto: T,
): T {
  if (dto.imageUrls === undefined) return dto;
  return { ...dto, imageUrl: dto.imageUrls[0] ?? null };
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, categoryId?: string) {
    const where = { companyId, deletedAt: null, ...(categoryId ? { categoryId } : {}) };
    const [data, total] = await Promise.all([
      this.prisma.client.service.findMany({
        where,
        include: { category: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.client.service.count({ where }),
    ]);
    return { data, page: 1, pageSize: data.length, total };
  }

  async findOne(companyId: string, id: string) {
    const found = await this.prisma.client.service.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!found) throw new NotFoundException('Serviço não encontrado');
    return found;
  }

  create(companyId: string, dto: CreateServiceDto) {
    return this.prisma.client.service.create({
      data: { ...withCover(dto), companyId },
    });
  }

  async update(companyId: string, id: string, dto: UpdateServiceDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.service.update({ where: { id }, data: withCover(dto) });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    // Soft-delete: stamp deletedAt so the service disappears from the admin catalog
    // and the public booking portal, while preserving the row and its history
    // (appointment items, packages, memberships). `active`/`visible` are untouched.
    return this.prisma.client.service.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ---- categories ----
  listCategories(companyId: string) {
    return this.prisma.client.serviceCategory.findMany({
      where: { companyId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  createCategory(companyId: string, dto: CreateServiceCategoryDto) {
    return this.prisma.client.serviceCategory.create({ data: { ...dto, companyId } });
  }
}
