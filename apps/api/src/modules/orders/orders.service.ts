import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { QueuesService } from '../queues/queues.service';
import {
  CreateOrderDto,
  AddItemDto,
  AddDiscountDto,
  AddPaymentDto,
  UpdateOrderDto,
  UpdateOrderItemDto,
  AddAuxiliaryDto,
  AddConsumedProductDto,
  UseBalanceDto,
} from './dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService,
  ) {}

  async list(companyId: string, status?: string) {
    const where = { companyId, ...(status ? { status: status as never } : {}) };
    const data = await this.prisma.client.order.findMany({
      where,
      include: {
        // A LISTA só usa id/name do cliente (ver ComandasPage) — o objeto
        // completo tem 55 colunas e era devolvido para cada comanda, inflando a
        // resposta em megabytes. Os dados ricos do cliente vêm do DETALHE.
        customer: { select: { id: true, name: true } },
        payments: {
          where: { status: { not: 'reversed' } },
          select: { paymentMethodId: true },
        },
      },
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

  /**
   * Garante que o profissional é DESTA empresa antes de vincular a um item.
   * Sem isso, `connect: { id }` com id inexistente estoura P2025 (500) e um id de
   * outra empresa era aceito — item de um tenant atribuído a profissional de outro
   * (e a comissão indo para a pessoa errada). O create() já fazia essa checagem.
   */
  private async assertProfessionalOfCompany(
    companyId: string,
    professionalId: string | null | undefined,
    // Recusa profissional DESATIVADO ao escolher um agora. `false` quando o
    // valor não está mudando — editar preço de um item antigo cujo profissional
    // foi desativado depois não pode quebrar.
    requireActive = true,
  ) {
    if (!professionalId) return;
    const found = await this.prisma.client.professional.findFirst({
      where: { id: professionalId, companyId, deletedAt: null },
      select: { id: true, active: true },
    });
    if (!found) throw new NotFoundException('Profissional não encontrado');
    if (requireActive && !found.active) {
      throw new BadRequestException(
        'Profissional desativado — reative em Equipe > Profissionais para usá-lo.',
      );
    }
  }

  private assertEditable(order: { status: string }) {
    if (order.status === 'finished') {
      throw new BadRequestException('Comanda finalizada — reabra para editar.');
    }
    if (order.status === 'canceled') {
      throw new BadRequestException('Comanda cancelada — não pode ser editada.');
    }
  }

  /** Carrega o item garantindo que pertence à comanda; lança NotFound quando ausente. */
  private async loadItem(orderId: string, itemId: string) {
    const item = await this.prisma.client.orderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!item) throw new NotFoundException('Item da comanda não encontrado');
    return item;
  }

  /**
   * Saldo de crédito e cashback do cliente (derivado dos ledgers).
   * Cashback filtra linhas vencidas (expiresAt < now); crédito não expira.
   */
  private async customerBalance(companyId: string, customerId: string) {
    const now = new Date();
    const [creditAgg, cashbackRows] = await Promise.all([
      this.prisma.client.customerCredit.aggregate({
        _sum: { amount: true },
        where: { customerId, customer: { companyId } },
      }),
      this.prisma.client.customerCashback.findMany({
        where: {
          customerId,
          customer: { companyId },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        select: { amount: true },
      }),
    ]);
    const creditBalance = new Prisma.Decimal(creditAgg._sum.amount ?? 0);
    const cashbackBalance = cashbackRows.reduce(
      (acc, r) => acc.add(r.amount),
      new Prisma.Decimal(0),
    );
    return { creditBalance, cashbackBalance };
  }

  /**
   * GET /orders/:id — enriched detail for the front.
   * Inclui por item: auxiliaries (com professionalName) e consumedProducts
   * (com productName + batch code). Também retorna os saldos do cliente.
   */
  async findOne(companyId: string, id: string) {
    const found = await this.prisma.client.order.findFirst({
      where: { id, companyId },
      include: {
        items: {
          include: {
            professional: true,
            batch: true,
            auxiliaries: { include: { professional: true } },
            consumedProducts: { include: { product: true, batch: true } },
          },
        },
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
      batchCode: it.batch?.code ?? null,
      auxiliaries: it.auxiliaries.map((a) => ({
        ...a,
        professionalName: a.professional?.name ?? null,
      })),
      consumedProducts: it.consumedProducts.map((c) => ({
        ...c,
        productName: c.product?.name ?? null,
        batchCode: c.batch?.code ?? null,
      })),
    }));

    const payments = found.payments.map((p) => ({
      ...p,
      paymentMethodName: p.paymentMethod?.name ?? null,
      accountName: p.account?.name ?? null,
    }));

    const balance = found.customerId
      ? await this.customerBalance(companyId, found.customerId)
      : { creditBalance: new Prisma.Decimal(0), cashbackBalance: new Prisma.Decimal(0) };

    return {
      ...found,
      professionalName: found.professional?.name ?? null,
      customerName: found.customer?.name ?? null,
      items,
      payments,
      statusHistory: found.statusHistory,
      customerBalance: {
        creditBalance: balance.creditBalance,
        cashbackBalance: balance.cashbackBalance,
      },
    };
  }

  async create(companyId: string, dto: CreateOrderDto) {
    const preparedItems = await Promise.all(
      (dto.items ?? []).map(async (item) => {
        const quantity = new Prisma.Decimal(item.quantity ?? 1);
        const unitPrice = await this.resolveUnitPrice(companyId, item);
        const grossValue = unitPrice.mul(quantity);
        const discount = new Prisma.Decimal(item.discount ?? 0);
        return { item, quantity, unitPrice, grossValue, discount };
      }),
    );
    // MESMA definição do recalculate() (a canônica do resto do ciclo de vida):
    // o bruto já entra com o desconto DO ITEM abatido, e discountTotal guarda só
    // os descontos DA COMANDA (que na criação ainda não existem). Antes create()
    // usava outra definição e os campos "Total bruto"/"Descontos" mudavam de
    // significado sozinhos no primeiro recalculate.
    const grossTotal = preparedItems.reduce(
      (sum, current) => sum.add(current.grossValue).sub(current.discount),
      new Prisma.Decimal(0),
    );
    const discountTotal = new Prisma.Decimal(0);
    const netTotal = Prisma.Decimal.max(
      grossTotal.sub(discountTotal),
      new Prisma.Decimal(0),
    );

    return this.prisma.client.$transaction(async (tx) => {
      // $executeRaw (NÃO $queryRaw): pg_advisory_xact_lock() retorna `void` e o
      // $queryRaw tenta desserializar a coluna → PrismaClientKnownRequestError
      // P2010 ("Failed to deserialize column of type 'void'"), que derrubava
      // TODA criação de comanda com 500. O $executeRaw não lê o resultado.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:orders`}))
      `;

      if (dto.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, companyId, deletedAt: null },
          select: { id: true },
        });
        if (!customer) throw new NotFoundException('Cliente não encontrado');
      }

      const professionalIds = [
        dto.professionalId,
        ...preparedItems.map((current) => current.item.professionalId),
      ].filter((id): id is string => Boolean(id));
      if (professionalIds.length) {
        const uniqueIds = [...new Set(professionalIds)];
        // Além da empresa, exige não-excluído E ativo: comanda nova não pode
        // nascer atribuída a quem foi desativado.
        const count = await tx.professional.count({
          where: { companyId, id: { in: uniqueIds }, deletedAt: null, active: true },
        });
        if (count !== uniqueIds.length) {
          throw new BadRequestException(
            'Profissional não encontrado ou desativado — reative em Equipe > Profissionais.',
          );
        }
      }

      const last = await tx.order.findFirst({
        where: { companyId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      return tx.order.create({
        data: {
          companyId,
          number: (last?.number ?? 0) + 1,
          customerId: dto.customerId,
          professionalId: dto.professionalId,
          notes: dto.notes,
          date: dto.date ? new Date(dto.date) : new Date(),
          grossTotal,
          discountTotal,
          netTotal,
          items: preparedItems.length
            ? {
                create: preparedItems.map((current) => ({
                  kind: current.item.kind,
                  refId: current.item.refId,
                  professionalId: current.item.professionalId,
                  quantity: current.quantity,
                  unitPrice: current.unitPrice,
                  grossValue: current.grossValue,
                  discount: current.discount,
                })),
              }
            : undefined,
        },
        include: { items: true },
      });
    });
  }

  async addItem(companyId: string, id: string, dto: AddItemDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    await this.assertProfessionalOfCompany(companyId, dto.professionalId);
    const quantity = dto.quantity ?? 1;
    // Preço unitário: usa o informado (inclusive 0, que é cortesia); só cai no
    // catálogo quando o campo NÃO vem. O ref é validado pertencer à empresa.
    const unitPrice = await this.resolveUnitPrice(companyId, dto);
    const grossValue = unitPrice.mul(quantity);
    await this.prisma.client.orderItem.create({
      data: {
        orderId: id,
        kind: dto.kind,
        refId: dto.refId,
        professionalId: dto.professionalId,
        quantity,
        unitPrice,
        grossValue,
        discount: dto.discount ?? 0,
      },
    });
    return this.recalculate(id);
  }

  /**
   * Resolve o preço unitário de um item da comanda. Prioriza o valor enviado pelo
   * cliente; quando ausente ou 0, busca o preço no catálogo (Service.price para
   * serviços, Product.salePrice para produtos), sempre com escopo da empresa.
   * Garante que "adicionar serviço/produto" nunca crie item a R$0 só porque a
   * superfície de UI não pré-preencheu o campo de preço.
   */
  private async resolveUnitPrice(
    companyId: string,
    dto: AddItemDto,
  ): Promise<Prisma.Decimal> {
    const provided =
      dto.unitPrice != null ? new Prisma.Decimal(dto.unitPrice) : null;

    if (dto.kind === 'service') {
      const service = await this.prisma.client.service.findFirst({
        where: { id: dto.refId, companyId },
        select: { price: true },
      });
      if (!service) throw new NotFoundException('Serviço não encontrado');
      // `!= null` (não `.gt(0)`): preço 0 é cortesia/brinde legítimo. Com o gt(0)
      // o item voltava para o preço cheio do catálogo e a cortesia era cobrada.
      return provided != null ? provided : service.price;
    } else {
      const product = await this.prisma.client.product.findFirst({
        where: { id: dto.refId, companyId },
        select: { salePrice: true },
      });
      if (!product) throw new NotFoundException('Produto não encontrado');
      // idem serviço: 0 informado é cortesia, não "usar catálogo".
      return provided != null ? provided : product.salePrice;
    }
  }

  /**
   * PATCH /orders/:id/items/:itemId — aba "Dados" (Salvar) + set de batchId (aba "Lote").
   * Recalcula grossValue com base nos novos unitPrice/quantity e chama recalculate().
   */
  async updateItem(companyId: string, id: string, itemId: string, dto: UpdateOrderItemDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    const item = await this.loadItem(id, itemId);
    await this.assertProfessionalOfCompany(
      companyId,
      dto.professionalId,
      dto.professionalId !== item.professionalId,
    );

    const unitPrice =
      dto.unitPrice !== undefined ? new Prisma.Decimal(dto.unitPrice) : item.unitPrice;
    const quantity =
      dto.quantity !== undefined ? new Prisma.Decimal(dto.quantity) : item.quantity;

    // Valida o lote (aba "Lote"): deve pertencer ao mesmo produto/empresa.
    if (dto.batchId) {
      const batch = await this.prisma.client.productBatch.findFirst({
        where: { id: dto.batchId, companyId },
      });
      if (!batch) throw new NotFoundException('Lote não encontrado');
      if (item.kind === 'product' && batch.productId !== item.refId) {
        throw new BadRequestException('Lote não pertence a este produto');
      }
    }

    const data: Prisma.OrderItemUpdateInput = {
      unitPrice,
      quantity,
      grossValue: unitPrice.mul(quantity),
    };
    if (dto.professionalId !== undefined) {
      data.professional = dto.professionalId
        ? { connect: { id: dto.professionalId } }
        : { disconnect: true };
    }
    if (dto.discount !== undefined) data.discount = dto.discount;
    if (dto.batchId !== undefined) {
      data.batch = dto.batchId ? { connect: { id: dto.batchId } } : { disconnect: true };
    }

    await this.prisma.client.orderItem.update({ where: { id: itemId }, data });
    return this.recalculate(id);
  }

  async removeItem(companyId: string, id: string, itemId: string) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    await this.loadItem(id, itemId);
    // Estorna estoque dos produtos consumidos deste item antes de removê-lo.
    await this.revertConsumedForItem(order, itemId);
    await this.prisma.client.orderItem.delete({ where: { id: itemId } });
    return this.recalculate(id);
  }

  // ===================== Auxiliares (rateio de comissão) =====================

  async addAuxiliary(companyId: string, id: string, itemId: string, dto: AddAuxiliaryDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    const item = await this.loadItem(id, itemId);
    if (item.kind !== 'service') {
      throw new BadRequestException('Auxiliares só são permitidos em itens de serviço.');
    }
    const professional = await this.prisma.client.professional.findFirst({
      where: { id: dto.professionalId, companyId },
    });
    if (!professional) throw new NotFoundException('Profissional auxiliar não encontrado');

    await this.prisma.client.orderItemAuxiliary.create({
      data: {
        orderItemId: itemId,
        professionalId: dto.professionalId,
        discountFrom: dto.discountFrom,
        valueType: dto.valueType,
        value: dto.value,
      },
    });
    // Não altera totais (é rateio de comissão) — retorna a comanda enriquecida.
    return this.findOne(companyId, id);
  }

  async removeAuxiliary(companyId: string, id: string, itemId: string, auxId: string) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    await this.loadItem(id, itemId);
    const aux = await this.prisma.client.orderItemAuxiliary.findFirst({
      where: { id: auxId, orderItemId: itemId },
    });
    if (!aux) throw new NotFoundException('Auxiliar não encontrado');
    await this.prisma.client.orderItemAuxiliary.delete({ where: { id: auxId } });
    return this.findOne(companyId, id);
  }

  // ===================== Produtos consumidos (baixa de estoque) =====================

  async addConsumedProduct(
    companyId: string,
    id: string,
    itemId: string,
    dto: AddConsumedProductDto,
  ) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    const item = await this.loadItem(id, itemId);
    if (item.kind !== 'service') {
      throw new BadRequestException('Produtos consumidos só em itens de serviço.');
    }

    const product = await this.prisma.client.product.findFirst({
      where: { id: dto.productId, companyId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Produto não encontrado');

    if (dto.batchId) {
      const batch = await this.prisma.client.productBatch.findFirst({
        where: { id: dto.batchId, companyId, productId: dto.productId },
      });
      if (!batch) throw new NotFoundException('Lote não encontrado para este produto');
    }

    // Baixa = campo "Unidade" (quantity). "Extra" fica armazenado mas não afeta o estoque no MVP.
    const qty = new Prisma.Decimal(dto.quantity);
    const nextStock = new Prisma.Decimal(product.stock).minus(qty);
    if (nextStock.lessThan(0)) {
      throw new BadRequestException('Estoque insuficiente para este consumo');
    }

    // Nome do serviço para o "reason" (Comanda #<n> – <serviço>).
    const service = await this.prisma.client.service.findUnique({
      where: { id: item.refId },
      select: { name: true },
    });
    const reason = `Comanda #${order.number} – ${service?.name ?? 'serviço'}`;

    const consumed = await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.orderItemConsumedProduct.create({
        data: {
          orderItemId: itemId,
          productId: dto.productId,
          batchId: dto.batchId ?? null,
          quantity: qty,
          extraQuantity: dto.extraQuantity ?? 0,
          unitValue: dto.unitValue ?? 0,
          unit: dto.unit ?? product.unit ?? null,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: dto.productId,
          type: 'out',
          quantity: qty,
          reason,
          refType: 'order_consumed',
          refId: row.id,
        },
      });
      await tx.product.update({
        where: { id: dto.productId },
        data: { stock: nextStock },
      });
      if (dto.batchId) {
        await tx.productBatch.update({
          where: { id: dto.batchId },
          data: { quantity: { decrement: qty } },
        });
      }
      return row;
    });

    // NÃO chama recalculate (consumido não entra no total da comanda).
    return consumed;
  }

  async removeConsumedProduct(
    companyId: string,
    id: string,
    itemId: string,
    consumedId: string,
  ) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    await this.loadItem(id, itemId);
    const consumed = await this.prisma.client.orderItemConsumedProduct.findFirst({
      where: { id: consumedId, orderItemId: itemId },
    });
    if (!consumed) throw new NotFoundException('Produto consumido não encontrado');

    await this.restockConsumed(order.number, consumed);
    return { id: consumedId, removed: true };
  }

  /**
   * Estorno de um consumido: InventoryMovement(in) + incrementa Product.stock e
   * ProductBatch.quantity, depois deleta a linha. Usado no remove e no cancel.
   */
  private async restockConsumed(
    orderNumber: number,
    consumed: { id: string; productId: string; batchId: string | null; quantity: Prisma.Decimal },
  ) {
    const qty = new Prisma.Decimal(consumed.quantity);
    await this.prisma.client.$transaction(async (tx) => {
      await tx.inventoryMovement.create({
        data: {
          productId: consumed.productId,
          type: 'in',
          quantity: qty,
          reason: `Estorno consumo – Comanda #${orderNumber}`,
          refType: 'order_consumed',
          refId: consumed.id,
        },
      });
      await tx.product.update({
        where: { id: consumed.productId },
        data: { stock: { increment: qty } },
      });
      if (consumed.batchId) {
        await tx.productBatch.update({
          where: { id: consumed.batchId },
          data: { quantity: { increment: qty } },
        });
      }
      await tx.orderItemConsumedProduct.delete({ where: { id: consumed.id } });
    });
  }

  /** Estorna todos os consumidos de um item (usado ao remover o item). */
  private async revertConsumedForItem(order: { number: number }, itemId: string) {
    const rows = await this.prisma.client.orderItemConsumedProduct.findMany({
      where: { orderItemId: itemId },
    });
    for (const row of rows) await this.restockConsumed(order.number, row);
  }

  // ===================== Crédito / Cashback =====================

  async applyCredit(companyId: string, id: string, dto: UseBalanceDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    if (!order.customerId) {
      throw new BadRequestException('Comanda sem cliente — não é possível usar crédito.');
    }
    const customerId = order.customerId;
    const amount = new Prisma.Decimal(dto.amount);

    await this.prisma.client.$transaction(async (tx) => {
      // Reverte aplicação anterior desta comanda (idempotente).
      await tx.customerCredit.deleteMany({ where: { customerId, reason: `order:${id}` } });
      const agg = await tx.customerCredit.aggregate({
        _sum: { amount: true },
        where: { customerId, customer: { companyId } },
      });
      const available = new Prisma.Decimal(agg._sum.amount ?? 0);
      if (amount.greaterThan(available)) {
        throw new BadRequestException('Saldo de crédito insuficiente.');
      }
      await tx.customerCredit.create({
        data: { customerId, amount: amount.negated(), reason: `order:${id}` },
      });
      await tx.order.update({ where: { id }, data: { creditUsed: amount } });
    });

    return this.recalculate(id);
  }

  async removeCredit(companyId: string, id: string) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    if (order.customerId) {
      await this.prisma.client.customerCredit.deleteMany({
        where: { customerId: order.customerId, reason: `order:${id}` },
      });
    }
    await this.prisma.client.order.update({ where: { id }, data: { creditUsed: 0 } });
    return this.recalculate(id);
  }

  async applyCashback(companyId: string, id: string, dto: UseBalanceDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    if (!order.customerId) {
      throw new BadRequestException('Comanda sem cliente — não é possível usar cashback.');
    }
    const customerId = order.customerId;
    const amount = new Prisma.Decimal(dto.amount);
    const now = new Date();

    await this.prisma.client.$transaction(async (tx) => {
      await tx.customerCashback.deleteMany({
        where: { customerId, sourceType: 'order', sourceId: id },
      });
      // Saldo de cashback = soma das linhas não vencidas.
      const rows = await tx.customerCashback.findMany({
        where: {
          customerId,
          customer: { companyId },
          OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        },
        select: { amount: true },
      });
      const available = rows.reduce((acc, r) => acc.add(r.amount), new Prisma.Decimal(0));
      if (amount.greaterThan(available)) {
        throw new BadRequestException('Saldo de cashback insuficiente.');
      }
      await tx.customerCashback.create({
        data: {
          customerId,
          amount: amount.negated(),
          sourceType: 'order',
          sourceId: id,
        },
      });
      await tx.order.update({ where: { id }, data: { cashbackUsed: amount } });
    });

    return this.recalculate(id);
  }

  async removeCashback(companyId: string, id: string) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    if (order.customerId) {
      await this.prisma.client.customerCashback.deleteMany({
        where: { customerId: order.customerId, sourceType: 'order', sourceId: id },
      });
    }
    await this.prisma.client.order.update({ where: { id }, data: { cashbackUsed: 0 } });
    return this.recalculate(id);
  }

  // ===================== Discounts / Payments =====================

  async addDiscount(companyId: string, id: string, dto: AddDiscountDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);
    // Teto do desconto. Sem isso, 500% zerava a comanda (recalculate aplica
    // gross*value/100) e dava para faturar R$ 0 sem pagamento nenhum.
    const value = new Prisma.Decimal(dto.value);
    if (value.lessThan(0)) {
      throw new BadRequestException('Desconto não pode ser negativo.');
    }
    if (dto.type === 'percent') {
      if (value.greaterThan(100)) {
        throw new BadRequestException('Desconto em porcentagem não pode passar de 100%.');
      }
    } else if (value.greaterThan(order.grossTotal)) {
      throw new BadRequestException(
        `Desconto de R$ ${value.toFixed(2)} maior que o valor da comanda (R$ ${new Prisma.Decimal(order.grossTotal).toFixed(2)}).`,
      );
    }
    await this.prisma.client.orderDiscount.create({
      data: { orderId: id, type: dto.type, value: dto.value, reason: dto.reason },
    });
    return this.recalculate(id);
  }

  async addPayment(companyId: string, id: string, dto: AddPaymentDto) {
    const order = await this.loadOrder(companyId, id);
    this.assertEditable(order);

    // Uma comanda não pode receber mais que o saldo líquido ainda em aberto.
    // No pagamento em dinheiro o front envia apenas o valor da venda (o valor
    // entregue pelo cliente serve somente para calcular/exibir o troco).
    const activePayments = await this.prisma.client.orderPayment.findMany({
      where: { orderId: id, status: { not: 'reversed' } },
      select: { amount: true },
    });
    const paidTotal = activePayments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0),
    );
    const remaining = new Prisma.Decimal(order.netTotal).sub(paidTotal);
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.greaterThan(remaining.add(new Prisma.Decimal('0.009')))) {
      throw new BadRequestException(
        `O pagamento ultrapassa o restante da comanda (${remaining.toFixed(2)}).`,
      );
    }

    if (dto.paymentMethodId) {
      const method = await this.prisma.client.paymentMethod.findFirst({
        where: { id: dto.paymentMethodId, companyId, active: true },
        select: { id: true },
      });
      if (!method) throw new BadRequestException('Forma de pagamento inválida.');
    }
    if (dto.accountId) {
      const account = await this.prisma.client.financialAccount.findFirst({
        where: { id: dto.accountId, companyId },
        select: { id: true },
      });
      if (!account) throw new BadRequestException('Conta financeira inválida.');
    }

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

  /**
   * Estorno de pagamento. EXIGE a comanda aberta: numa comanda finalizada os
   * lançamentos do faturamento (receita, caixa e comissão) já existem, e marcar
   * o pagamento como `reversed` sozinho deixaria o dinheiro no caixa e a comissão
   * devida sobre uma venda estornada. O caminho correto reusa a reversão completa
   * que já existe: Reabrir (reopen → reverseFinishReconciliation) → estornar →
   * faturar de novo.
   */
  async reversePayment(companyId: string, id: string, pid: string) {
    const order = await this.loadOrder(companyId, id);
    if (order.status === 'finished') {
      throw new BadRequestException(
        'Comanda finalizada: reabra a comanda antes de estornar o pagamento, senão o valor continua lançado no caixa e na comissão.',
      );
    }
    const payment = await this.prisma.client.orderPayment.findFirst({
      where: { id: pid, orderId: id },
      select: { id: true },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    return this.prisma.client.orderPayment.update({
      where: { id: payment.id },
      data: { status: 'reversed' },
    });
  }

  /**
   * POST /orders/:id/finish — recompute totals + close, reconciliando com
   * Financeiro (Transaction), Caixa (CashMovement), Comissões (CommissionEntry)
   * e Estoque (InventoryMovement) — tudo em UMA transação Prisma, atômica e
   * idempotente.
   *
   * Estoque dos produtos CONSUMIDOS em serviço já é baixado no "Salvar" do drawer
   * (addConsumedProduct); aqui só baixamos o produto VENDIDO direto (item de
   * produto da comanda), sem duplicar.
   *
   * Idempotência: comanda já `finished` retorna sem reprocessar; cada gerador
   * checa a existência dos seus registros (por orderId / refType+refId / legacyId)
   * antes de criar, de modo que um retry parcial não duplica lançamentos.
   */
  async finish(companyId: string, id: string, byUserId?: string) {
    const current = await this.loadOrder(companyId, id);
    if (current.status === 'canceled') {
      throw new BadRequestException('Comanda cancelada — não pode ser finalizada.');
    }
    // Idempotente: já finalizada → apenas retorna (não reprocessa lançamentos).
    if (current.status === 'finished') {
      return this.prisma.client.order.findUniqueOrThrow({
        where: { id },
        include: { items: true, payments: true },
      });
    }

    await this.recalculate(id);

    const finished = await this.prisma.client.$transaction(async (tx) => {
      // Trava a comanda durante toda a reconciliação. Evita que pagamento,
      // fechamento e reabertura concorrentes deixem Financeiro/Caixa divergentes.
      await tx.$queryRaw`
        SELECT "id"
        FROM "Order"
        WHERE "id" = ${id} AND "companyId" = ${companyId}
        FOR UPDATE
      `;

      const order = await tx.order.findFirstOrThrow({
        where: { id, companyId },
        include: {
          // `auxiliaries` entra aqui porque o rateio da comissão é calculado no
          // finish: sem este include o campo chega `undefined` em
          // generateCommissionEntries e o auxiliar volta a não receber nada.
          items: { include: { professional: true, auxiliaries: true } },
          payments: true,
        },
      });
      if (order.status === 'finished') return order;
      if (order.status === 'canceled') {
        throw new BadRequestException('Comanda cancelada — não pode ser finalizada.');
      }

      // Invariante: faturar significa que o valor líquido foi integralmente
      // recebido. Antes esse ponto aceitava zero/parcelas incompletas e a
      // comanda simplesmente desaparecia do caixa.
      const activePayments = order.payments.filter((payment) => payment.status !== 'reversed');
      const paidTotal = activePayments.reduce(
        (sum, payment) => sum.add(payment.amount),
        new Prisma.Decimal(0),
      );
      const netTotal = new Prisma.Decimal(order.netTotal);
      if (!paidTotal.equals(netTotal)) {
        // Pago A MAIS precisa de mensagem própria: netTotal - paidTotal fica
        // negativo, o max(...,0) zerava e a tela dizia "Restante: R$ 0.00" —
        // contraditório, e o operador não descobria que precisa estornar.
        if (paidTotal.greaterThan(netTotal)) {
          throw new BadRequestException(
            `Pagamentos registrados (R$ ${paidTotal.toFixed(2)}) excedem o valor da comanda (R$ ${netTotal.toFixed(2)}). Estorne R$ ${paidTotal.sub(netTotal).toFixed(2)} antes de faturar.`,
          );
        }
        const remaining = netTotal.sub(paidTotal);
        throw new BadRequestException(
          `Registre o pagamento completo antes de faturar. Restante: R$ ${remaining.toFixed(2)}.`,
        );
      }

      // O caixa não é diário: usa o caixa ABERTO do operador mesmo que tenha
      // sido aberto em data anterior. Quando existe só um caixa na empresa,
      // ele é o fallback (compatibilidade com operação centralizada). Com mais
      // de um caixa, nunca joga a venda silenciosamente no caixa de outra
      // pessoa: exige que o operador tenha o próprio caixa.
      //
      // FOR UPDATE usa o mesmo lock do fechamento e serializa os dois fluxos.
      const openCashes = await tx.$queryRaw<
        { id: string; responsibleUserId: string | null }[]
      >`
        SELECT "id", "responsibleUserId"
        FROM "CashRegister"
        WHERE "companyId" = ${companyId} AND "status" = 'open'
        ORDER BY
          CASE WHEN "responsibleUserId" = ${byUserId} THEN 0 ELSE 1 END,
          "openedAt" DESC
        FOR UPDATE
      `;
      const ownCash = openCashes.find(
        (cash) => cash.responsibleUserId === byUserId,
      );
      const openCash =
        ownCash ?? (openCashes.length === 1 ? openCashes[0] : undefined);
      if (netTotal.greaterThan(0) && !openCash) {
        if (openCashes.length > 1) {
          throw new BadRequestException(
            'Há mais de um caixa aberto e nenhum pertence ao seu usuário. Abra o seu caixa ou peça a um gerente para faturar esta comanda.',
          );
        }
        throw new BadRequestException(
          'Nenhum caixa está aberto. Abra o caixa antes de faturar a comanda.',
        );
      }

      const incomeCategory = await tx.financialCategory.findFirst({
        where: { companyId, kind: 'credit', active: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      const paidAt = new Date();
      await tx.orderPayment.updateMany({
        where: { orderId: id, status: { not: 'reversed' } },
        data: { status: 'paid', paidAt },
      });

      await this.generateIncomeTransactions(tx, companyId, order, incomeCategory?.id ?? null);
      if (openCash) {
        await this.generateCashMovements(tx, order, openCash.id);
      }
      // A comissão libera quando o dinheiro entra. Usa o MAIOR prazo entre as
      // formas de pagamento da comanda: se metade foi no crédito de 30 dias, a
      // comissão inteira só está disponível quando aquela parcela cair.
      const formasUsadas = await tx.paymentMethod.findMany({
        where: {
          companyId,
          id: {
            in: [
              ...new Set(
                order.payments
                  .filter((pg) => pg.status !== 'reversed' && pg.paymentMethodId)
                  .map((pg) => pg.paymentMethodId as string),
              ),
            ],
          },
        },
        select: { settlementDays: true },
      });
      const maiorPrazo = formasUsadas.reduce(
        (maior, f) => Math.max(maior, Number(f.settlementDays ?? 0)),
        0,
      );
      const liberaEm =
        maiorPrazo > 0 ? new Date(Date.now() + maiorPrazo * 24 * 60 * 60 * 1000) : undefined;

      const comissoes = await this.generateCommissionEntries(tx, companyId, order, liberaEm);
      await this.generateCashbackEarnings(tx, companyId, order);
      await this.decrementSoldStock(tx, order);

      const atualizada = await tx.order.update({
        where: { id },
        data: {
          status: 'finished',
          statusHistory: {
            create: { fromStatus: current.status, toStatus: 'finished', byUserId },
          },
        },
        include: { items: true, payments: true },
      });
      // Vai junto na resposta para a tela AVISAR. Antes o item sem percentual
      // era pulado em silêncio e o salão faturava esperando comissão.
      return Object.assign(atualizada, { commissionSkipped: comissoes.semPercentual });
    });

    // Event-driven: closing the comanda schedules the post-service follow-up
    // (delayed FOLLOWUP_DELAY_HOURS). Only when there's a customer to message.
    // Idempotent per order via the follow-up job's deterministic jobId + marker.
    if (finished.customerId) {
      void this.queues.enqueueFollowUp(companyId, { orderId: id });
    }
    return finished;
  }

  // ===================== Reconciliação do fechamento =====================

  /**
   * Receita → uma Transaction (income/paid) por OrderPayment não estornado,
   * preservando método/conta/valor de cada pagamento (o DRE agrupa por
   * paymentMethodId/accountId). `legacyId = order:{id}:pay:{paymentId}` garante
   * idempotência via @@unique([companyId, legacyId]).
   */
  private async generateIncomeTransactions(
    tx: Prisma.TransactionClient,
    companyId: string,
    order: {
      id: string;
      customerId: string | null;
      payments: {
        id: string;
        amount: Prisma.Decimal;
        paymentMethodId: string | null;
        accountId: string | null;
        status: string;
      }[];
    },
    categoryId: string | null,
  ) {
    // Resolve conta-default, TAXA e PRAZO das formas de pagamento usadas.
    // `feePercent` e `settlementDays` eram cadastrados e nunca lidos: o salão
    // configurava "Cartão 3,5%, liquida em 30 dias", vendia R$ 100 e o sistema
    // registrava R$ 100 disponíveis HOJE.
    const methodIds = [
      ...new Set(
        order.payments
          .filter((p) => p.paymentMethodId)
          .map((p) => p.paymentMethodId as string),
      ),
    ];
    const methods = methodIds.length
      ? await tx.paymentMethod.findMany({
          where: { id: { in: methodIds }, companyId },
          select: {
            id: true,
            defaultAccountId: true,
            feePercent: true,
            settlementDays: true,
          },
        })
      : [];
    const defaultAccountByMethod = new Map(
      methods.map((m) => [m.id, m.defaultAccountId] as const),
    );
    const methodById = new Map(methods.map((m) => [m.id, m] as const));

    for (const p of order.payments) {
      if (p.status === 'reversed') continue; // pagamento estornado não vira receita
      const legacyId = `order:${order.id}:pay:${p.id}`;
      // Idempotência baseada em ESTADO ATIVO: pula só se já existe uma Transaction
      // ATIVA (não estornada) para este pagamento. Transactions estornadas por um
      // reopen/cancel anterior têm o legacyId zerado (ver reverseFinishReconciliation),
      // liberando o slot único p/ um novo lançamento neste re-finish.
      const active = await tx.transaction.findFirst({
        where: { companyId, legacyId, status: { not: 'reversed' } },
        select: { id: true },
      });
      if (active) continue;

      const accountId =
        p.accountId ??
        (p.paymentMethodId ? defaultAccountByMethod.get(p.paymentMethodId) ?? null : null);
      const now = new Date();

      // TAXA e PRAZO da forma de pagamento. A taxa do cartão é custo da venda:
      // o salão recebe o líquido. E recebe no dia da LIQUIDAÇÃO, não hoje —
      // registrar como disponível na hora inflava o caixa do dia.
      const forma = p.paymentMethodId ? methodById.get(p.paymentMethodId) : undefined;
      const taxa = Number(forma?.feePercent ?? 0);
      const prazo = Number(forma?.settlementDays ?? 0);
      const bruto = new Prisma.Decimal(p.amount);
      const liquido = taxa > 0 ? bruto.sub(bruto.mul(taxa).div(100)) : bruto;
      const liquidacao =
        prazo > 0 ? new Date(now.getTime() + prazo * 24 * 60 * 60 * 1000) : now;
      // Só é "pago" quando o dinheiro entrou de fato. Com prazo, fica a receber.
      const jaCaiu = prazo <= 0;

      await tx.transaction.create({
        data: {
          companyId,
          kind: 'income',
          grossAmount: liquido,
          accountId,
          categoryId,
          paymentMethodId: p.paymentMethodId,
          partyType: order.customerId ? 'customer' : null,
          partyId: order.customerId,
          orderId: order.id,
          description:
            taxa > 0
              ? `Recebimento de comanda (líquido de ${taxa}% de taxa)`
              : 'Recebimento de comanda',
          dueDate: liquidacao,
          competenceDate: now,
          ...(jaCaiu ? { paidAt: now } : {}),
          status: jaCaiu ? 'paid' : 'pending',
          legacyId,
          legacySource: 'order_finish',
        },
      });
    }
  }

  /**
   * Caixa → CashMovement(in) para CADA pagamento ativo da comanda.
   *
   * O caixa do produto é também a conferência de recebimentos por forma
   * (Dinheiro/Pix/Crédito/Outros), como no histórico importado do Belasis; por
   * isso nenhuma forma pode fazer a comanda sumir do caixa aberto. A flag
   * legada `goesToCash` nunca pode ocultar uma venda já recebida da conferência.
   *
   * Idempotência: pula se já há movimento líquido ativo para o paymentId
   * (rastreado em `description`).
   */
  private async generateCashMovements(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      payments: {
        id: string;
        amount: Prisma.Decimal;
        paymentMethodId: string | null;
        status: string;
      }[];
    },
    cashRegisterId: string,
  ) {
    // Idempotência por NET, por pagamento: um `in` (description=paymentId) só
    // conta se ainda não foi compensado por um `out` (description=reversal:paymentId).
    // Assim, um pagamento estornado por reopen anterior volta a entrar no caixa.
    const existing = await tx.cashMovement.findMany({
      where: { cashRegisterId, refType: 'order', refId: order.id },
      select: { type: true, description: true },
    });
    const netInByPay = new Map<string, number>();
    for (const m of existing) {
      const payId = (m.description ?? '').replace(/^reversal:/, '');
      if (!payId) continue;
      netInByPay.set(payId, (netInByPay.get(payId) ?? 0) + (m.type === 'in' ? 1 : -1));
    }

    for (const p of order.payments) {
      if (p.status === 'reversed') continue;
      if ((netInByPay.get(p.id) ?? 0) > 0) continue; // entrada ativa → não duplica

      await tx.cashMovement.create({
        data: {
          cashRegisterId,
          type: 'in',
          paymentMethodId: p.paymentMethodId,
          amount: p.amount,
          refType: 'order',
          refId: order.id,
          // `description` guarda o paymentId para idempotência por pagamento.
          description: p.id,
        },
      });
    }
  }

  /**
   * Comissão → CommissionEntry por OrderItem com profissional que recebe comissão.
   * baseAmount = grossValue − discount do item. Percentual resolvido pela regra
   * aplicável (ProfessionalCommissionRule: item específico → categoria → all),
   * com fallback em Product.defaultCommissionPercent para produtos.
   * Idempotência: se a comanda já tem entries, não recria.
   */
  private async generateCommissionEntries(
    tx: Prisma.TransactionClient,
    companyId: string,
    order: {
      id: string;
      date: Date;
      items: {
        kind: string;
        refId: string;
        professionalId: string | null;
        grossValue: Prisma.Decimal;
        discount: Prisma.Decimal;
        professional: { id: string; name?: string; receivesCommission: boolean } | null;
        auxiliaries?: {
          professionalId: string;
          discountFrom: string;
          valueType: string;
          value: Prisma.Decimal;
        }[];
      }[];
    },
    /**
     * Quando o dinheiro da venda fica disponível (maior prazo de liquidação
     * entre as formas usadas). A comissão libera junto: antes nascia sempre
     * como "agora", e por isso o card "Comissões a liberar" era R$ 0,00 por
     * construção.
     */
    disponivelEm?: Date,
  ): Promise<{ semPercentual: { profissional: string; item: string }[] }> {
    // Idempotência por ESTADO ATIVO: só não recria se já houver lançamentos ativos
    // (open/paid) para esta comanda. Entries `reversed` de um reopen anterior são
    // ignoradas, permitindo gerar novas comissões neste re-finish.
    const activeEntry = await tx.commissionEntry.findFirst({
      where: { companyId, orderId: order.id, status: { not: 'reversed' } },
      select: { id: true },
    });
    if (activeEntry) return { semPercentual: [] };

    const now = new Date();
    const liberaEm = disponivelEm ?? now;
    // Itens que TINHAM profissional comissionado mas ficaram sem percentual.
    // Sem isto o item era pulado em silêncio e o salão faturava esperando
    // comissão que nunca apareceu.
    const semPercentual: { profissional: string; item: string }[] = [];

    for (const item of order.items) {
      const baseAmount = new Prisma.Decimal(item.grossValue).sub(item.discount);
      if (baseAmount.lessThanOrEqualTo(0)) continue;

      // ---------------------- Rateio de auxiliares ----------------------
      // O auxiliar foi cadastrado À MÃO naquele item, com valor à mão — isso já
      // É a decisão de pagar. Por isso não filtro por `receivesCommission` aqui:
      // esse flag é a regra-padrão do profissional DO ITEM, e aplicá-lo ao
      // auxiliar faria a tela aceitar um rateio que o cálculo depois descarta em
      // silêncio (o pior tipo de erro: ninguém vê até o fim do mês).
      let auxFromProfessional = new Prisma.Decimal(0);
      let remaining = baseAmount;

      for (const aux of item.auxiliaries ?? []) {
        if (remaining.lessThanOrEqualTo(0)) break;
        const raw =
          aux.valueType === 'percent'
            ? baseAmount.mul(aux.value).div(100)
            : new Prisma.Decimal(aux.value);
        if (raw.lessThanOrEqualTo(0)) continue;
        // Teto acumulado: dois auxiliares de 80% não podem virar 160% do serviço.
        const auxAmount = Prisma.Decimal.min(raw, remaining);
        remaining = remaining.sub(auxAmount);

        await tx.commissionEntry.create({
          data: {
            companyId,
            professionalId: aux.professionalId,
            orderId: order.id,
            baseAmount,
            commissionAmount: auxAmount,
            status: 'open',
            competenceDate: order.date,
            availableDate: liberaEm,
          },
        });

        // "Desconto do": establishment → o salão paga e o principal não é
        // tocado; professional → sai da comissão do principal, logo abaixo.
        if (aux.discountFrom === 'professional') {
          auxFromProfessional = auxFromProfessional.add(auxAmount);
        }
      }

      // ---------------------- Comissão do principal ----------------------
      const professionalId = item.professionalId;
      if (!professionalId) continue;
      if (!item.professional?.receivesCommission) continue;

      const percent = await this.resolveCommissionPercent(tx, professionalId, item);
      if (percent.lessThanOrEqualTo(0)) {
        const nome =
          item.kind === 'service'
            ? (await tx.service.findUnique({ where: { id: item.refId }, select: { name: true } }))
                ?.name
            : (await tx.product.findUnique({ where: { id: item.refId }, select: { name: true } }))
                ?.name;
        semPercentual.push({
          profissional: item.professional?.name ?? 'profissional',
          item: nome ?? (item.kind === 'service' ? 'serviço' : 'produto'),
        });
        continue;
      }

      const gross = baseAmount.mul(percent).div(100);
      // Nunca negativo: grava-se o que DE FATO foi descontado, não o pretendido.
      // Se o principal não tinha comissão suficiente, o salão acaba bancando a
      // diferença — e a coluna "Desconto de Auxiliares" diz a verdade sobre isso.
      const auxiliaryDiscount = Prisma.Decimal.min(auxFromProfessional, gross);
      const commissionAmount = gross.sub(auxiliaryDiscount);

      await tx.commissionEntry.create({
        data: {
          companyId,
          professionalId,
          orderId: order.id,
          baseAmount,
          commissionAmount,
          auxiliaryDiscount,
          status: 'open',
          // Competência é a data da venda/comanda, não o instante em que alguém
          // clicou em "Finalizar". Isso mantém os filtros e backfills corretos.
          competenceDate: order.date,
          availableDate: liberaEm,
        },
      });
    }

    return { semPercentual };
  }


  /**
   * Resolve o percentual de cashback aplicável a um item.
   *
   * Gêmeo de `resolveCommissionPercent` de propósito: mesma precedência, mesma
   * conversão de valor fixo em percentual. Se as duas divergirem, o salão passa a
   * ter duas mentalidades diferentes para "regra por escopo" na mesma tela.
   *
   * Precedência (mais específico → mais genérico):
   *   1. CashbackRule scope=service|product por scopeId (o item)
   *   2. CashbackRule scope=category (categoria do item)
   *   3. CashbackRule scope=all
   *   4. Catálogo: Service.cashbackPercent | Product.cashback*
   *   5. Padrão da empresa: Company.cashbackValueType + cashbackValue
   *
   * Devolve também a validade em dias da regra que venceu — cada lote de ganho
   * carrega o próprio vencimento, que é como um ledger de fidelidade funciona.
   */
  private async resolveCashbackPercent(
    tx: Prisma.TransactionClient,
    company: {
      cashbackValueType: string | null;
      cashbackValue: Prisma.Decimal | null;
    },
    companyId: string,
    item: { kind: string; refId: string; grossValue: Prisma.Decimal; discount: Prisma.Decimal },
  ): Promise<{ percent: Prisma.Decimal; validityDays: number }> {
    const base = new Prisma.Decimal(item.grossValue).sub(item.discount);
    const zero = { percent: new Prisma.Decimal(0), validityDays: 0 };
    if (base.lessThanOrEqualTo(0)) return zero;

    const scopeType = item.kind === 'service' ? 'service' : 'product';

    const rules = await tx.cashbackRule.findMany({
      where: {
        companyId,
        active: true,
        OR: [
          { scopeType, scopeId: item.refId },
          { scopeType: 'category' },
          { scopeType: 'all' },
        ],
      },
    });

    // Categoria do item, para casar regras scope=category.
    let categoryId: string | null = null;
    if (item.kind === 'service') {
      const svc = await tx.service.findUnique({
        where: { id: item.refId },
        select: { categoryId: true },
      });
      categoryId = svc?.categoryId ?? null;
    } else {
      const prod = await tx.product.findUnique({
        where: { id: item.refId },
        select: { categoryId: true },
      });
      categoryId = prod?.categoryId ?? null;
    }

    const daRegra = (r: { percent: Prisma.Decimal; validityDays: number }) => ({
      percent: new Prisma.Decimal(r.percent),
      validityDays: r.validityDays,
    });

    const especifica = rules.find((r) => r.scopeType === scopeType && r.scopeId === item.refId);
    if (especifica) return daRegra(especifica);
    if (categoryId) {
      const porCategoria = rules.find(
        (r) => r.scopeType === 'category' && r.scopeId === categoryId,
      );
      if (porCategoria) return daRegra(porCategoria);
    }
    const todas = rules.find((r) => r.scopeType === 'all');
    if (todas) return daRegra(todas);

    // 4. Catálogo. Serviço só tem percentual; produto tem percent|value próprio.
    if (item.kind === 'service') {
      const svc = await tx.service.findUnique({
        where: { id: item.refId },
        select: { cashbackPercent: true },
      });
      const p = new Prisma.Decimal(svc?.cashbackPercent ?? 0);
      if (p.greaterThan(0)) return { percent: p, validityDays: 0 };
    } else {
      const prod = await tx.product.findUnique({
        where: { id: item.refId },
        select: { cashbackActive: true, cashbackType: true, cashbackValue: true },
      });
      if (prod?.cashbackActive && prod.cashbackValue) {
        const v = new Prisma.Decimal(prod.cashbackValue);
        const p = prod.cashbackType === 'value' ? v.div(base).mul(100) : v;
        if (p.greaterThan(0)) return { percent: p, validityDays: 0 };
      }
    }

    // 5. Padrão da empresa.
    if (company.cashbackValue) {
      const v = new Prisma.Decimal(company.cashbackValue);
      // 'value' é um valor em reais POR ITEM; vira percentual efetivo sobre a
      // base, como o `toPercent` da comissão faz — assim o ledger guarda sempre
      // dinheiro e o "quanto rendeu" não distorce com desconto.
      const p = company.cashbackValueType === 'value' ? v.div(base).mul(100) : v;
      if (p.greaterThan(0)) return { percent: p, validityDays: 0 };
    }

    return zero;
  }

  /**
   * Credita o cashback ganho na comanda faturada.
   *
   * Roda DENTRO da transação do `finish()`, ao lado de `generateCommissionEntries`:
   * se algo falhar depois, o crédito volta atrás junto. Antes disto o programa de
   * cashback era decorativo — havia configuração, regra, resgate e ajuste manual,
   * mas nada que fizesse o cliente ganhar.
   */
  private async generateCashbackEarnings(
    tx: Prisma.TransactionClient,
    companyId: string,
    order: {
      id: string;
      customerId: string | null;
      netTotal: Prisma.Decimal;
      items: { kind: string; refId: string; grossValue: Prisma.Decimal; discount: Prisma.Decimal }[];
    },
  ): Promise<void> {
    if (!order.customerId) return;

    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: {
        cashbackActive: true,
        cashbackValueType: true,
        cashbackValue: true,
        cashbackMinimum: true,
      },
    });
    if (!company?.cashbackActive) return;

    // Piso do programa: é para isso que `cashbackMinimum` existe.
    const netTotal = new Prisma.Decimal(order.netTotal);
    if (netTotal.lessThan(new Prisma.Decimal(company.cashbackMinimum ?? 0))) return;

    // Idempotência: reabrir e refaturar não pode creditar duas vezes.
    // `sourceType` é 'order-earn', NUNCA 'order' — applyCashback apaga
    // { sourceType: 'order', sourceId } antes de gravar o débito, e o ganho
    // sumiria junto.
    await tx.customerCashback.deleteMany({
      where: { customerId: order.customerId, sourceType: 'order-earn', sourceId: order.id },
    });

    let total = new Prisma.Decimal(0);
    let validityDays = 0;
    for (const item of order.items) {
      const { percent, validityDays: dias } = await this.resolveCashbackPercent(
        tx,
        company,
        companyId,
        item,
      );
      if (percent.lessThanOrEqualTo(0)) continue;
      const base = new Prisma.Decimal(item.grossValue).sub(item.discount);
      total = total.add(base.mul(percent).div(100));
      // Um lote por comanda, com a MAIOR validade entre os itens: gravar uma
      // linha por item encheria o extrato do cliente de centavos soltos.
      if (dias > validityDays) validityDays = dias;
    }

    // Arredonda em 2 casas só no fim, para não perder centavo item a item.
    total = total.toDecimalPlaces(2);
    if (total.lessThanOrEqualTo(0)) return;

    await tx.customerCashback.create({
      data: {
        customerId: order.customerId,
        amount: total,
        sourceType: 'order-earn',
        sourceId: order.id,
        expiresAt:
          validityDays > 0
            ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000)
            : null,
      },
    });
  }

  /**
   * Resolve o percentual de comissão aplicável a um item.
   * Precedência (mais específico → mais genérico):
   *   1. ProfessionalCommissionRule scope=service|product por scopeId (o item)
   *   2. ProfessionalCommissionRule scope=category (categoria do serviço/produto)
   *   3. ProfessionalCommissionRule scope=all
   *   4. Fallback: Service/Product.defaultCommissionPercent.
   * Regras `fixed` são convertidas para percentual efetivo sobre a base do item,
   * pois CommissionEntry armazena base+valor (evita distorcer o "valorVendido").
   */
  private async resolveCommissionPercent(
    tx: Prisma.TransactionClient,
    professionalId: string,
    item: { kind: string; refId: string; grossValue: Prisma.Decimal; discount: Prisma.Decimal },
  ): Promise<Prisma.Decimal> {
    const scopeType = item.kind === 'service' ? 'service' : 'product';
    const base = new Prisma.Decimal(item.grossValue).sub(item.discount);

    const rules = await tx.professionalCommissionRule.findMany({
      where: {
        professionalId,
        OR: [
          { scopeType, scopeId: item.refId },
          { scopeType: 'category' },
          { scopeType: 'all' },
        ],
      },
    });

    // Categoria do item (para casar regras scope=category).
    let categoryId: string | null = null;
    if (item.kind === 'service') {
      const svc = await tx.service.findUnique({
        where: { id: item.refId },
        select: { categoryId: true },
      });
      categoryId = svc?.categoryId ?? null;
    } else {
      const prod = await tx.product.findUnique({
        where: { id: item.refId },
        select: { categoryId: true },
      });
      categoryId = prod?.categoryId ?? null;
    }

    const toPercent = (rule: { type: string; value: Prisma.Decimal }): Prisma.Decimal => {
      const value = new Prisma.Decimal(rule.value);
      if (rule.type === 'percent') return value;
      // fixed → percentual efetivo sobre a base (0 quando base=0).
      if (base.lessThanOrEqualTo(0)) return new Prisma.Decimal(0);
      return value.div(base).mul(100);
    };

    // 1. item específico
    const specific = rules.find((r) => r.scopeType === scopeType && r.scopeId === item.refId);
    if (specific) return toPercent(specific);
    // 2. categoria
    if (categoryId) {
      const byCat = rules.find((r) => r.scopeType === 'category' && r.scopeId === categoryId);
      if (byCat) return toPercent(byCat);
    }
    // 3. all
    const all = rules.find((r) => r.scopeType === 'all');
    if (all) return toPercent(all);

    // 4. fallback: comissão padrão do item no catálogo.
    if (item.kind === 'service') {
      const service = await tx.service.findUnique({
        where: { id: item.refId },
        select: { defaultCommissionPercent: true },
      });
      return new Prisma.Decimal(service?.defaultCommissionPercent ?? 0);
    }
    if (item.kind === 'product') {
      const prod = await tx.product.findUnique({
        where: { id: item.refId },
        select: { defaultCommissionPercent: true },
      });
      return new Prisma.Decimal(prod?.defaultCommissionPercent ?? 0);
    }
    return new Prisma.Decimal(0);
  }

  /**
   * Estoque → baixa dos produtos VENDIDOS direto na comanda (item kind=product).
   * Produtos CONSUMIDOS em serviço já baixaram no addConsumedProduct — aqui é só
   * o gap da venda. Cria InventoryMovement(out, refType='order') + decrementa
   * Product.stock e, se houver batchId, ProductBatch.quantity.
   * Idempotência: pula item cujo movimento (refType='order', refId=order.id,
   * productId, e o próprio orderItem em `reason`) já exista.
   */
  private async decrementSoldStock(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      number: number;
      items: {
        id: string;
        kind: string;
        refId: string;
        quantity: Prisma.Decimal;
        batchId: string | null;
      }[];
    },
  ) {
    const productItems = order.items.filter((it) => it.kind === 'product');
    if (!productItems.length) return;

    // Idempotência por NET: um item só é considerado "já baixado" se ainda houver
    // saída ativa (out) não compensada por um estorno (in) — ambos com o mesmo
    // orderItemId no `reason`. Assim, um item cuja baixa foi revertida por um
    // reopen anterior volta a ser baixado neste re-finish.
    const moves = await tx.inventoryMovement.findMany({
      where: { refType: 'order', refId: order.id },
      select: { type: true, reason: true },
    });
    const netOutByItem = new Map<string, number>();
    for (const m of moves) {
      const itemId = m.reason?.split('item:')[1];
      if (!itemId) continue;
      const delta = m.type === 'out' ? 1 : -1;
      netOutByItem.set(itemId, (netOutByItem.get(itemId) ?? 0) + delta);
    }

    for (const it of productItems) {
      if ((netOutByItem.get(it.id) ?? 0) > 0) continue; // baixa ativa → não duplica
      const qty = new Prisma.Decimal(it.quantity);
      if (qty.lessThanOrEqualTo(0)) continue;

      await tx.inventoryMovement.create({
        data: {
          productId: it.refId,
          type: 'out',
          quantity: qty,
          reason: `Venda – Comanda #${order.number}|item:${it.id}`,
          refType: 'order',
          refId: order.id,
        },
      });
      await tx.product.update({
        where: { id: it.refId },
        data: { stock: { decrement: qty } },
      });
      if (it.batchId) {
        await tx.productBatch.update({
          where: { id: it.batchId },
          data: { quantity: { decrement: qty } },
        });
      }
    }
  }

  /**
   * Estorna TODA a reconciliação gerada pelo finish (usado no reopen e no remove):
   * — Transactions da comanda: marca original como `reversed` + cria contrapartida
   *   `reversed` (mesmo padrão de financial.reverseTransaction — some do DRE);
   * — CommissionEntry `open` da comanda → `reversed` (some dos totais de comissão);
   * — CashMovement(in, refType='order') da comanda → CashMovement(out) contrário;
   * — Estoque vendido: InventoryMovement(in) + devolve Product.stock/ProductBatch.
   * Idempotente: se já estornado, não duplica.
   */
  private async reverseFinishReconciliation(
    tx: Prisma.TransactionClient,
    companyId: string,
    // `customerId` entrou para o estorno do cashback ganho: sem ele, reabrir uma
    // comanda deixaria o cliente com saldo de uma venda que voltou a ficar aberta.
    order: { id: string; number: number; customerId: string | null },
  ) {
    const now = new Date();

    // 1. Transactions (income) — estorna as ativas (não estornadas) da comanda.
    const txns = await tx.transaction.findMany({
      where: { companyId, orderId: order.id, status: { not: 'reversed' }, reversalOfId: null },
    });
    for (const t of txns) {
      await tx.transaction.update({
        where: { id: t.id },
        // Zera o legacyId ao estornar: preserva a linha (histórico/DRE), mas libera
        // o slot @@unique([companyId, legacyId]) para um eventual re-finish.
        data: { status: 'reversed', reversedAt: now, legacyId: null },
      });
      await tx.transaction.create({
        data: {
          companyId,
          kind: t.kind === 'income' ? 'expense' : 'income',
          grossAmount: t.grossAmount,
          accountId: t.accountId,
          categoryId: t.categoryId,
          paymentMethodId: t.paymentMethodId,
          partyType: t.partyType,
          partyId: t.partyId,
          orderId: order.id,
          reversalOfId: t.id,
          description: `Estorno: Recebimento de comanda #${order.number}`,
          dueDate: now,
          paidAt: now,
          status: 'reversed',
        },
      });
    }

    // 1b. Cashback GANHO — apaga o lote desta comanda. Não vira "reversed" como
    //     a comissão porque o ledger de cashback não tem status: a linha some e o
    //     saldo do cliente volta ao que era. Se a comanda for faturada de novo,
    //     `generateCashbackEarnings` recria com o valor recalculado.
    if (order.customerId) {
      await tx.customerCashback.deleteMany({
        where: { customerId: order.customerId, sourceType: 'order-earn', sourceId: order.id },
      });
    }

    // 2. Comissões — entries em aberto viram reversed (some dos totais).
    await tx.commissionEntry.updateMany({
      where: { companyId, orderId: order.id, status: 'open' },
      data: { status: 'reversed' },
    });

    // 3. Caixa — neutraliza por NET, por pagamento: para cada `in` ainda ativo
    //    (não compensado por um `out`), cria o movimento contrário (out). Assim
    //    o saldo do caixa referente à comanda volta a zero e ciclos repetidos de
    //    finish/reopen não geram estornos duplicados.
    const cashMoves = await tx.cashMovement.findMany({
      where: { cashRegister: { companyId }, refType: 'order', refId: order.id },
    });
    const netInByPay = new Map<string, number>();
    for (const m of cashMoves) {
      const payId = (m.description ?? m.id).replace(/^reversal:/, '');
      netInByPay.set(payId, (netInByPay.get(payId) ?? 0) + (m.type === 'in' ? 1 : -1));
    }
    for (const m of cashMoves) {
      if (m.type !== 'in') continue;
      const payId = m.description ?? m.id;
      if ((netInByPay.get(payId) ?? 0) <= 0) continue; // já compensado
      // Consome uma unidade do net para não estornar o mesmo `in` duas vezes.
      netInByPay.set(payId, (netInByPay.get(payId) ?? 0) - 1);
      await tx.cashMovement.create({
        data: {
          cashRegisterId: m.cashRegisterId,
          type: 'out',
          paymentMethodId: m.paymentMethodId,
          amount: m.amount,
          refType: 'order',
          refId: order.id,
          description: `reversal:${payId}`,
        },
      });
    }

    // 4. Estoque vendido — devolve o que o finish baixou, por NET: para cada
    //    orderItem, só estorna se ainda houver saída ativa (sum(out) > sum(in)).
    //    Isso torna o estorno idempotente e correto mesmo após ciclos repetidos
    //    de finish/reopen.
    const invMoves = await tx.inventoryMovement.findMany({
      where: { refType: 'order', refId: order.id },
      select: { type: true, reason: true, productId: true },
    });
    const netOutByItem = new Map<string, number>();
    const productByItem = new Map<string, string>();
    for (const m of invMoves) {
      const itemId = m.reason?.split('item:')[1];
      if (!itemId) continue;
      netOutByItem.set(itemId, (netOutByItem.get(itemId) ?? 0) + (m.type === 'out' ? 1 : -1));
      if (m.type === 'out') productByItem.set(itemId, m.productId);
    }
    // Itens de produto vendidos (quantidade + lote) para dimensionar o estorno.
    const soldItems = await tx.orderItem.findMany({
      where: { orderId: order.id, kind: 'product' },
      select: { id: true, refId: true, batchId: true, quantity: true },
    });
    const soldById = new Map(soldItems.map((it) => [it.id, it] as const));

    for (const [itemId, net] of netOutByItem) {
      if (net <= 0) continue; // sem saída ativa → nada a estornar
      const sold = soldById.get(itemId);
      const productId = sold?.refId ?? productByItem.get(itemId);
      if (!productId) continue;
      const qty = new Prisma.Decimal(sold?.quantity ?? 0);
      if (qty.lessThanOrEqualTo(0)) continue;

      await tx.inventoryMovement.create({
        data: {
          productId,
          type: 'in',
          quantity: qty,
          reason: `Estorno venda – Comanda #${order.number}|item:${itemId}`,
          refType: 'order',
          refId: order.id,
        },
      });
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: qty } },
      });
      if (sold?.batchId) {
        await tx.productBatch.update({
          where: { id: sold.batchId },
          data: { quantity: { increment: qty } },
        });
      }
    }
  }

  /**
   * POST /orders/:id/reopen — finished → open, gravando histórico.
   * ESTORNA a reconciliação do finish (receita, caixa, comissão e estoque
   * VENDIDO) numa única transação, para que a comanda volte a ser editável sem
   * deixar lançamentos financeiros/estoque órfãos. Não mexe no estoque de
   * CONSUMIDOS: a baixa deles ocorre no add e permanece válida enquanto a comanda
   * estiver ativa (open/finished).
   */
  private async assertClosedCashAllowsOrderEdit(
    companyId: string,
    orderId: string,
  ): Promise<void> {
    const setting = await this.prisma.client.setting.findUnique({
      where: { companyId_key: { companyId, key: 'finance.settings' } },
      select: { valueJson: true },
    });
    const value =
      setting?.valueJson &&
      typeof setting.valueJson === 'object' &&
      !Array.isArray(setting.valueJson)
        ? (setting.valueJson as Record<string, unknown>)
        : {};
    // Compatibilidade: empresas sem Setting mantêm o comportamento anterior.
    if (value.allowEditAfterCashClose !== false) return;
    const closedMovement = await this.prisma.client.cashMovement.findFirst({
      where: {
        refType: 'order',
        refId: orderId,
        cashRegister: { companyId, status: 'closed' },
      },
      select: { id: true },
    });
    if (closedMovement) {
      throw new BadRequestException(
        'Esta comanda já foi conferida em um caixa fechado.',
      );
    }
  }

  async reopen(companyId: string, id: string, byUserId?: string) {
    const order = await this.loadOrder(companyId, id);
    if (order.status !== 'finished') {
      throw new BadRequestException('Somente comandas finalizadas podem ser reabertas.');
    }
    await this.assertClosedCashAllowsOrderEdit(companyId, id);
    return this.prisma.client.$transaction(async (tx) => {
      await this.reverseFinishReconciliation(tx, companyId, order);
      return tx.order.update({
        where: { id },
        data: {
          status: 'open',
          statusHistory: { create: { fromStatus: 'finished', toStatus: 'open', byUserId } },
        },
        include: { items: true, payments: true },
      });
    });
  }

  async update(companyId: string, id: string, dto: UpdateOrderDto) {
    const order = await this.loadOrder(companyId, id);
    const data: Prisma.OrderUpdateInput = {};
    if (dto.notes !== undefined) data.notes = dto.notes;
    // Status NÃO muda por aqui. Este endpoint gravava o status direto, pulando a
    // reconciliação inteira: open→finished marcava a comanda como faturada sem
    // receita, caixa nem comissão; open→canceled não estornava crédito/cashback
    // nem repunha estoque; e canceled→open ressuscitava comanda já estornada.
    // Cada transição tem o seu método, que faz os lançamentos certos:
    //   finalizar → finish()  ·  reabrir → reopen()  ·  cancelar → remove()
    if (dto.status && dto.status !== order.status) {
      throw new BadRequestException(
        'Status da comanda não muda por aqui. Use faturar (/finish), reabrir (/reopen) ou cancelar (DELETE) — só esses caminhos lançam receita, caixa, comissão e estorno.',
      );
    }
    return this.prisma.client.order.update({
      where: { id },
      data,
      include: { customer: true },
    });
  }

  /**
   * DELETE /orders/:id — cancela a comanda. Se estava FINALIZADA, estorna a
   * reconciliação do finish (receita, caixa, comissão e estoque VENDIDO) numa
   * transação atômica. Além disso, estorna o estoque de todos os produtos
   * CONSUMIDOS e devolve crédito/cashback ao cliente (remove os ledgers negativos).
   */
  async remove(companyId: string, id: string) {
    const order = await this.loadOrder(companyId, id);
    if (order.status === 'canceled') return order; // idempotente

    // Se estava finalizada, estorna primeiro os lançamentos do finish (atômico).
    if (order.status === 'finished') {
      await this.assertClosedCashAllowsOrderEdit(companyId, id);
      await this.prisma.client.$transaction(async (tx) => {
        await this.reverseFinishReconciliation(tx, companyId, order);
      });
    }

    // Estorna consumidos (todos os itens da comanda).
    const consumed = await this.prisma.client.orderItemConsumedProduct.findMany({
      where: { orderItem: { orderId: id } },
    });
    for (const row of consumed) await this.restockConsumed(order.number, row);

    // Devolve crédito/cashback aplicados nesta comanda.
    if (order.customerId) {
      await this.prisma.client.customerCredit.deleteMany({
        where: { customerId: order.customerId, reason: `order:${id}` },
      });
      await this.prisma.client.customerCashback.deleteMany({
        where: { customerId: order.customerId, sourceType: 'order', sourceId: id },
      });
      // ...e retira o cashback GANHO nela. Cancelar uma comanda faturada sem
      // isto deixaria o cliente com saldo de uma venda que não existe mais.
      await this.prisma.client.customerCashback.deleteMany({
        where: { customerId: order.customerId, sourceType: 'order-earn', sourceId: id },
      });
    }

    return this.prisma.client.order.update({
      where: { id },
      data: { status: 'canceled', creditUsed: 0, cashbackUsed: 0 },
    });
  }

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

    // Valor a pagar ANTES de abater saldo do cliente.
    const base = Prisma.Decimal.max(gross.sub(discountTotal), new Prisma.Decimal(0));
    let creditUsed = new Prisma.Decimal(order.creditUsed);
    let cashbackUsed = new Prisma.Decimal(order.cashbackUsed);
    const applied = creditUsed.add(cashbackUsed);

    // Se a comanda encolheu (item removido, desconto aplicado…) abaixo do que já
    // foi abatido, o excedente PRECISA voltar para o cliente. Antes o netTotal era
    // travado em 0 e creditUsed/cashbackUsed ficavam altos: o saldo já debitado no
    // ledger virava dinheiro queimado, sem aviso.
    const excedente = applied.greaterThan(base);
    if (excedente) {
      if (applied.isZero()) {
        creditUsed = new Prisma.Decimal(0);
        cashbackUsed = new Prisma.Decimal(0);
      } else {
        // Proporcional: não escolhe arbitrariamente de qual bolso o cliente perde.
        creditUsed = base.mul(creditUsed).div(applied);
        cashbackUsed = base.sub(creditUsed);
      }
    }

    const net = Prisma.Decimal.max(
      base.sub(creditUsed).sub(cashbackUsed),
      new Prisma.Decimal(0),
    );

    // Order + ledgers numa transação só: não pode sobrar comanda ajustada com
    // ledger antigo (ou vice-versa).
    return this.prisma.client.$transaction(async (tx) => {
      if (excedente && order.customerId) {
        const customerId = order.customerId;
        // O saldo do cliente é a SOMA das linhas do ledger, então reescrever a
        // linha desta comanda já devolve a diferença.
        await tx.customerCredit.deleteMany({ where: { customerId, reason: `order:${id}` } });
        if (creditUsed.greaterThan(0)) {
          await tx.customerCredit.create({
            data: { customerId, amount: creditUsed.negated(), reason: `order:${id}` },
          });
        }
        await tx.customerCashback.deleteMany({
          where: { customerId, sourceType: 'order', sourceId: id },
        });
        if (cashbackUsed.greaterThan(0)) {
          await tx.customerCashback.create({
            data: {
              customerId,
              amount: cashbackUsed.negated(),
              sourceType: 'order',
              sourceId: id,
            },
          });
        }
      }
      return tx.order.update({
        where: { id },
        data: { grossTotal: gross, discountTotal, netTotal: net, creditUsed, cashbackUsed },
      });
    });
  }
}
