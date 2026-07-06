import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBrandDto,
  CreateProductCategoryDto,
  CreateProductDto,
  StockMovementDto,
  StockMovementType,
  UpdateBrandDto,
  UpdateProductCategoryDto,
  UpdateProductDto,
} from './dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- products ----
  async list(
    companyId: string,
    opts: { categoryId?: string; search?: string; lowStock?: boolean } = {},
  ) {
    const where: Prisma.ProductWhereInput = {
      companyId,
      deletedAt: null,
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(opts.search
        ? { name: { contains: opts.search, mode: 'insensitive' } }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.product.findMany({
        where,
        include: { category: true, brand: true },
        orderBy: [{ favorite: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.client.product.count({ where }),
    ]);

    // lowStock is computed (stock <= minStock) — easiest done in app layer.
    const data = opts.lowStock
      ? rows.filter((p) => Number(p.stock) <= Number(p.minStock))
      : rows;

    return { data, page: 1, pageSize: data.length, total };
  }

  async findOne(companyId: string, id: string) {
    const found = await this.prisma.client.product.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { category: true, brand: true },
    });
    if (!found) throw new NotFoundException('Produto não encontrado');
    return found;
  }

  create(companyId: string, dto: CreateProductDto) {
    return this.prisma.client.product.create({
      data: { ...dto, companyId },
      include: { category: true, brand: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(companyId, id);
    return this.prisma.client.product.update({
      where: { id },
      data: dto,
      include: { category: true, brand: true },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    // Soft-delete: stamp deletedAt so the product disappears from the admin catalog
    // while preserving the row and its history (purchases, stock movements).
    // `active` is left untouched.
    return this.prisma.client.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ---- stock movements ----
  async createMovement(companyId: string, id: string, dto: StockMovementDto) {
    const product = await this.findOne(companyId, id);

    const current = new Prisma.Decimal(product.stock);
    const qty = new Prisma.Decimal(dto.quantity);

    let nextStock: Prisma.Decimal;
    if (dto.type === StockMovementType.in) {
      nextStock = current.plus(qty);
    } else if (dto.type === StockMovementType.out) {
      nextStock = current.minus(qty);
      if (nextStock.lessThan(0)) {
        throw new BadRequestException(
          'Estoque insuficiente para esta saída',
        );
      }
    } else {
      // adjust → set stock to the provided quantity
      nextStock = qty;
    }

    return this.prisma.client.$transaction(async (tx) => {
      await tx.inventoryMovement.create({
        data: {
          productId: id,
          type: dto.type,
          quantity: qty,
          reason: dto.reason,
        },
      });
      return tx.product.update({
        where: { id },
        data: { stock: nextStock },
        include: { category: true, brand: true },
      });
    });
  }

  // ---- product categories ----
  listCategories(companyId: string) {
    return this.prisma.client.productCategory.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  createCategory(companyId: string, dto: CreateProductCategoryDto) {
    return this.prisma.client.productCategory.create({
      data: { ...dto, companyId },
    });
  }

  async updateCategory(
    companyId: string,
    id: string,
    dto: UpdateProductCategoryDto,
  ) {
    const found = await this.prisma.client.productCategory.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Categoria não encontrada');
    return this.prisma.client.productCategory.update({
      where: { id },
      data: dto,
    });
  }

  async removeCategory(companyId: string, id: string) {
    const found = await this.prisma.client.productCategory.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Categoria não encontrada');

    const productCount = await this.prisma.client.product.count({
      where: { categoryId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        'Não é possível excluir: existem produtos vinculados a esta categoria',
      );
    }
    return this.prisma.client.productCategory.delete({ where: { id } });
  }

  // ---- brands ----
  async listBrands(companyId: string) {
    const brands = await this.prisma.client.brand.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
    return brands.map((b) => ({
      id: b.id,
      companyId: b.companyId,
      name: b.name,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
      productCount: b._count.products,
    }));
  }

  createBrand(companyId: string, dto: CreateBrandDto) {
    return this.prisma.client.brand.create({ data: { ...dto, companyId } });
  }

  async updateBrand(companyId: string, id: string, dto: UpdateBrandDto) {
    const found = await this.prisma.client.brand.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Marca não encontrada');
    return this.prisma.client.brand.update({ where: { id }, data: dto });
  }

  async removeBrand(companyId: string, id: string) {
    const found = await this.prisma.client.brand.findFirst({
      where: { id, companyId },
    });
    if (!found) throw new NotFoundException('Marca não encontrada');

    const productCount = await this.prisma.client.product.count({
      where: { brandId: id },
    });
    if (productCount > 0) {
      throw new ConflictException(
        'Não é possível excluir: existem produtos vinculados a esta marca',
      );
    }
    return this.prisma.client.brand.delete({ where: { id } });
  }
}
