import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseDto, PurchaseItemDto, UpdatePurchaseDto } from './dto';

/**
 * Onda 7: Purchase.status é uma coluna real. Toda compra, ao ser criada, já dá
 * entrada no estoque — portanto nasce "lançada". O valor persistido é a fonte
 * de verdade exposta à UI.
 */
const DEFAULT_STATUS = 'lancada' as const;

type TxClient = Prisma.TransactionClient;

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- listagem / detalhe ----
  async list(companyId: string, search?: string) {
    const searchDigits = search ? search.replace(/\D/g, '') : '';
    const searchNumber = searchDigits ? Number(searchDigits) : NaN;
    const where: Prisma.PurchaseWhereInput = {
      companyId,
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              {
                supplier: {
                  name: { contains: search, mode: 'insensitive' },
                },
              },
              ...(Number.isInteger(searchNumber)
                ? [{ number: searchNumber } as Prisma.PurchaseWhereInput]
                : []),
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.client.purchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.client.purchase.count({ where }),
    ]);

    const data = rows.map((p) => ({
      id: p.id,
      companyId: p.companyId,
      supplierId: p.supplierId,
      supplier: p.supplier,
      accountId: p.accountId,
      paymentMethodId: p.paymentMethodId,
      number: p.number,
      freight: p.freight,
      discount: p.discount,
      notes: p.notes,
      total: p.total,
      date: p.date,
      itemsCount: p._count.items,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return { data, page: 1, pageSize: data.length, total };
  }

  async findOne(companyId: string, id: string) {
    const purchase = await this.prisma.client.purchase.findFirst({
      where: { id, companyId },
      include: {
        supplier: true,
        account: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });
    if (!purchase) throw new NotFoundException('Compra não encontrada');
    return purchase;
  }

  // ---- criação ----
  async create(companyId: string, dto: CreatePurchaseDto) {
    await this.assertRefsBelongToCompany(companyId, dto);
    const products = await this.loadAndValidateProducts(companyId, dto.items);

    const total = this.computeTotal(dto.items, dto.freight, dto.discount);

    return this.prisma.client.$transaction(async (tx) => {
      // Número sequencial por empresa (maior number + 1), como Order.number.
      // _max ignora registros legados com number NULL.
      const agg = await tx.purchase.aggregate({
        where: { companyId },
        _max: { number: true },
      });
      const number = (agg._max.number ?? 0) + 1;

      const purchase = await tx.purchase.create({
        data: {
          companyId,
          supplierId: dto.supplierId ?? null,
          accountId: dto.accountId ?? null,
          paymentMethodId: dto.paymentMethodId ?? null,
          status: DEFAULT_STATUS,
          number,
          freight: new Prisma.Decimal(dto.freight ?? 0),
          discount: new Prisma.Decimal(dto.discount ?? 0),
          notes: dto.notes ?? null,
          total,
          date: dto.date ? new Date(dto.date) : undefined,
          items: {
            create: dto.items.map((it) => ({
              productId: it.productId,
              quantity: new Prisma.Decimal(it.quantity),
              unitCost: new Prisma.Decimal(it.unitCost),
              discount: new Prisma.Decimal(it.discount ?? 0),
              total: this.lineTotal(it),
            })),
          },
        },
      });

      await this.applyStockEntry(tx, purchase.id, dto.items, products);

      return this.findOneTx(tx, purchase.id);
    });
  }

  // ---- edição ----
  async update(companyId: string, id: string, dto: UpdatePurchaseDto) {
    const existing = await this.prisma.client.purchase.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Compra não encontrada');

    await this.assertRefsBelongToCompany(companyId, dto);

    // Se os itens forem alterados, precisamos reconciliar o estoque:
    // estornamos a entrada anterior e aplicamos a nova, dentro da transação.
    const products = dto.items
      ? await this.loadAndValidateProducts(companyId, dto.items)
      : null;

    return this.prisma.client.$transaction(async (tx) => {
      if (dto.items && products) {
        // 1) estorna a entrada anterior (bloqueia se deixar estoque negativo)
        await this.reverseStockEntry(
          tx,
          id,
          existing.items.map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity),
          })),
        );
        // 2) troca os itens
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        await tx.purchaseItem.createMany({
          data: dto.items.map((it) => ({
            purchaseId: id,
            productId: it.productId,
            quantity: new Prisma.Decimal(it.quantity),
            unitCost: new Prisma.Decimal(it.unitCost),
            discount: new Prisma.Decimal(it.discount ?? 0),
            total: this.lineTotal(it),
          })),
        });
        // 3) aplica a nova entrada
        await this.applyStockEntry(tx, id, dto.items, products);
      }

      // Recalcula o total quando itens/frete/desconto mudam. Frete e desconto
      // não enviados usam o valor já persistido (não zeram o total).
      const itemsForTotal: PurchaseItemDto[] =
        dto.items ??
        existing.items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitCost: Number(i.unitCost),
          discount: Number(i.discount),
        }));
      const freightForTotal = dto.freight ?? Number(existing.freight);
      const discountForTotal = dto.discount ?? Number(existing.discount);
      const total = this.computeTotal(
        itemsForTotal,
        freightForTotal,
        discountForTotal,
      );

      await tx.purchase.update({
        where: { id },
        data: {
          ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId || null } : {}),
          ...(dto.accountId !== undefined ? { accountId: dto.accountId || null } : {}),
          ...(dto.paymentMethodId !== undefined
            ? { paymentMethodId: dto.paymentMethodId || null }
            : {}),
          ...(dto.date ? { date: new Date(dto.date) } : {}),
          ...(dto.freight !== undefined
            ? { freight: new Prisma.Decimal(dto.freight) }
            : {}),
          ...(dto.discount !== undefined
            ? { discount: new Prisma.Decimal(dto.discount) }
            : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
          total,
        },
      });

      return this.findOneTx(tx, id);
    });
  }

  // ---- exclusão ----
  async remove(companyId: string, id: string) {
    const existing = await this.prisma.client.purchase.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!existing) throw new NotFoundException('Compra não encontrada');

    return this.prisma.client.$transaction(async (tx) => {
      // Estorna a entrada de estoque desta compra. Se algum produto ficaria com
      // estoque negativo (mercadoria já vendida/consumida), a exclusão é
      // BLOQUEADA para preservar a consistência do estoque.
      await this.reverseStockEntry(
        tx,
        id,
        existing.items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
        })),
      );
      // items caem por cascade (onDelete: Cascade em PurchaseItem.purchase)
      await tx.purchase.delete({ where: { id } });
      return { id, deleted: true };
    });
  }

  // =====================================================================
  // Helpers
  // =====================================================================

  /** total da linha = qtd·custo − descItem, nunca < 0 (PurchaseItem.total). */
  private lineTotal(it: PurchaseItemDto): Prisma.Decimal {
    const line = new Prisma.Decimal(it.quantity)
      .times(it.unitCost)
      .minus(it.discount ?? 0);
    return line.lessThan(0) ? new Prisma.Decimal(0) : line;
  }

  /** total = Σ(total da linha) + frete − descontoGeral, nunca < 0. */
  private computeTotal(
    items: PurchaseItemDto[],
    freight?: number,
    discount?: number,
  ): Prisma.Decimal {
    let total = items.reduce(
      (acc, it) => acc.plus(this.lineTotal(it)),
      new Prisma.Decimal(0),
    );

    total = total.plus(freight ?? 0).minus(discount ?? 0);
    return total.lessThan(0) ? new Prisma.Decimal(0) : total;
  }

  /** Aba "XMLs Importados": lista os ImportedXml reais da empresa. */
  async listXmls(companyId: string) {
    const data = await this.prisma.client.importedXml.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    return { data, available: true as const };
  }

  /** Dá entrada no estoque: +Product.stock e InventoryMovement tipo `in`. */
  private async applyStockEntry(
    tx: TxClient,
    purchaseId: string,
    items: PurchaseItemDto[],
    products: Map<string, { stock: Prisma.Decimal }>,
  ) {
    for (const it of items) {
      const product = products.get(it.productId)!;
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: new Prisma.Decimal(product.stock).plus(it.quantity) },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: it.productId,
          type: 'in',
          quantity: new Prisma.Decimal(it.quantity),
          reason: 'Entrada por compra',
          refType: 'purchase',
          refId: purchaseId,
        },
      });
      // mantém o mapa coerente caso o mesmo produto apareça em duas linhas
      product.stock = new Prisma.Decimal(product.stock).plus(it.quantity);
    }
  }

  /** Estorna a entrada: −Product.stock e InventoryMovement tipo `out`. */
  private async reverseStockEntry(
    tx: TxClient,
    purchaseId: string,
    items: { productId: string; quantity: number }[],
  ) {
    for (const it of items) {
      const product = await tx.product.findUnique({
        where: { id: it.productId },
        select: { id: true, name: true, stock: true },
      });
      if (!product) continue; // produto removido: nada a estornar
      const next = new Prisma.Decimal(product.stock).minus(it.quantity);
      if (next.lessThan(0)) {
        throw new ConflictException(
          `Não é possível estornar a compra: o produto "${product.name}" ` +
            'não tem estoque suficiente (a mercadoria já foi vendida ou consumida).',
        );
      }
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: next },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: it.productId,
          type: 'out',
          quantity: new Prisma.Decimal(it.quantity),
          reason: 'Estorno de compra',
          refType: 'purchase',
          refId: purchaseId,
        },
      });
    }
  }

  /** Carrega os produtos garantindo que pertencem à empresa. */
  private async loadAndValidateProducts(
    companyId: string,
    items: PurchaseItemDto[],
  ): Promise<Map<string, { stock: Prisma.Decimal }>> {
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.client.product.findMany({
      where: { id: { in: ids }, companyId, deletedAt: null },
      select: { id: true, stock: true },
    });
    if (products.length !== ids.length) {
      throw new BadRequestException(
        'Um ou mais produtos são inválidos ou não pertencem à empresa.',
      );
    }
    return new Map(
      products.map((p) => [p.id, { stock: new Prisma.Decimal(p.stock) }]),
    );
  }

  /** Valida que fornecedor/conta/forma de pagamento pertencem à empresa. */
  private async assertRefsBelongToCompany(
    companyId: string,
    dto: CreatePurchaseDto | UpdatePurchaseDto,
  ) {
    if (dto.supplierId) {
      const found = await this.prisma.client.supplier.findFirst({
        where: { id: dto.supplierId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!found) throw new BadRequestException('Fornecedor inválido.');
    }
    if (dto.accountId) {
      const found = await this.prisma.client.financialAccount.findFirst({
        where: { id: dto.accountId, companyId },
        select: { id: true },
      });
      if (!found) throw new BadRequestException('Conta financeira inválida.');
    }
    if (dto.paymentMethodId) {
      const found = await this.prisma.client.paymentMethod.findFirst({
        where: { id: dto.paymentMethodId, companyId },
        select: { id: true },
      });
      if (!found) throw new BadRequestException('Forma de pagamento inválida.');
    }
  }

  private async findOneTx(tx: TxClient, id: string) {
    const purchase = await tx.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        account: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, unit: true } },
          },
        },
      },
    });
    return purchase!;
  }
}
