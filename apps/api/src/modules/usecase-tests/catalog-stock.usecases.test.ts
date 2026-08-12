import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@beautypass/db';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { StockMovementType } from '../products/dto';
import { PurchasesService } from '../purchases/purchases.service';

function productsService(client: any) {
  return new ProductsService({ client } as any);
}

function ordersService(client: any) {
  return new OrdersService(
    { client } as any,
    { enqueueFollowUp: async () => undefined } as any,
  );
}

describe('UC-05 — regras de estoque implementadas', () => {
  it('filtra produtos cujo saldo está no mínimo ou abaixo dele', async () => {
    const service = productsService({
      product: {
        findMany: async () => [
          { id: 'low', name: 'Baixo', stock: new Prisma.Decimal(2), minStock: 2 },
          { id: 'ok', name: 'Normal', stock: new Prisma.Decimal(5), minStock: 2 },
        ],
        count: async () => 2,
      },
    });

    const result = await service.list('company-a', { lowStock: true });

    assert.deepEqual(result.data.map((product: any) => product.id), ['low']);
  });

  it('movimento de saída válido cria auditoria e reduz o saldo', async () => {
    let movement: any;
    let stock: any;
    const tx = {
      inventoryMovement: {
        create: async ({ data }: any) => {
          movement = data;
          return data;
        },
      },
      product: {
        update: async ({ data }: any) => {
          stock = data.stock;
          return { id: 'product-1', stock: data.stock };
        },
      },
    };
    const service = productsService({
      product: {
        findFirst: async () => ({
          id: 'product-1',
          companyId: 'company-a',
          stock: new Prisma.Decimal(10),
        }),
      },
      $transaction: async (fn: any) => fn(tx),
    });

    await service.createMovement('company-a', 'product-1', {
      type: StockMovementType.out,
      quantity: 3,
      reason: 'Ajuste contado',
    });

    assert.equal(Number(stock), 7);
    assert.equal(movement.type, StockMovementType.out);
    assert.equal(Number(movement.quantity), 3);
  });
});

describe('GAP: UC-CAT-002/003/024 — catálogo auditável e isolado', () => {
  it('total do filtro lowStock representa somente os resultados filtrados', async () => {
    const service = productsService({
      product: {
        findMany: async () => [
          { id: 'low', stock: new Prisma.Decimal(2), minStock: 2 },
          { id: 'ok', stock: new Prisma.Decimal(5), minStock: 2 },
        ],
        count: async () => 2,
      },
    });

    const result = await service.list('company-a', { lowStock: true });

    assert.equal(result.data.length, 1);
    assert.equal(result.total, 1);
  });

  it('rejeita categoria ou marca pertencente a outro tenant no cadastro', async () => {
    let created = false;
    const service = productsService({
      productCategory: {
        findFirst: async () => null,
      },
      brand: {
        findFirst: async () => null,
      },
      product: {
        create: async () => {
          created = true;
          return { id: 'product-1' };
        },
      },
    });

    await assert.rejects(
      service.create('company-a', {
        name: 'Produto com FK externa',
        salePrice: 50,
        categoryId: 'category-from-company-b',
        brandId: 'brand-from-company-b',
      }),
      /categoria|marca|empresa/i,
    );
    assert.equal(created, false);
  });

  it('gera InventoryMovement quando o saldo é editado diretamente', async () => {
    let movementCreated = false;
    const service = productsService({
      product: {
        findFirst: async () => ({
          id: 'product-1',
          companyId: 'company-a',
          stock: new Prisma.Decimal(10),
        }),
        update: async () => ({ id: 'product-1', stock: new Prisma.Decimal(15) }),
      },
      inventoryMovement: {
        create: async () => {
          movementCreated = true;
        },
      },
    });

    await service.update('company-a', 'product-1', { stock: 15 });

    assert.equal(movementCreated, true, 'alterar saldo sem razão auditável quebra o razão de estoque');
  });
});

describe('GAP: UC-CAT-005/006/020/022/026 — concorrência e lotes', () => {
  it('movimento manual aplica incremento/decremento relativo dentro da transação', async () => {
    let updateData: any;
    const tx = {
      inventoryMovement: {
        create: async () => ({ id: 'movement-1' }),
      },
      product: {
        update: async ({ data }: any) => {
          updateData = data;
          return { id: 'product-1', stock: new Prisma.Decimal(8) };
        },
      },
    };
    const service = productsService({
      product: {
        findFirst: async () => ({
          id: 'product-1',
          companyId: 'company-a',
          stock: new Prisma.Decimal(10),
        }),
      },
      $transaction: async (fn: any) => fn(tx),
    });

    await service.createMovement('company-a', 'product-1', {
      type: StockMovementType.out,
      quantity: 2,
    });

    assert.equal(
      Number(updateData.stock?.decrement),
      2,
      'gravar saldo absoluto permite lost update entre duas requisições',
    );
  });

  it('lista somente lotes ativos, com saldo e não vencidos', async () => {
    let where: any;
    const service = productsService({
      productBatch: {
        findMany: async (args: any) => {
          where = args.where;
          return [];
        },
      },
    });

    await service.listBatches('company-a', 'product-1');

    assert.equal(where.active, true);
    assert.equal(where.quantity?.gt, 0);
    assert.ok(where.OR || where.expiresAt, 'a validade precisa entrar no filtro');
  });

  it('rejeita baixa de venda maior que o estoque global', async () => {
    const tx = {
      inventoryMovement: {
        findMany: async () => [],
        create: async () => ({ id: 'movement-1' }),
      },
      product: {
        findUnique: async () => ({
          id: 'product-1',
          stock: new Prisma.Decimal(1),
          trackStock: true,
        }),
        update: async () => ({ id: 'product-1' }),
      },
      productBatch: {
        update: async () => ({ id: 'batch-1' }),
      },
    };

    await assert.rejects(
      (ordersService({}) as any).decrementSoldStock(tx, {
        id: 'order-1',
        number: 1,
        items: [
          {
            id: 'item-1',
            kind: 'product',
            refId: 'product-1',
            quantity: new Prisma.Decimal(2),
            batchId: null,
          },
        ],
      }),
      /estoque insuficiente/i,
    );
  });

  it('rejeita consumo de lote vencido, inativo ou sem saldo', async () => {
    let consumedCreated = false;
    const tx = {
      orderItemConsumedProduct: {
        create: async () => {
          consumedCreated = true;
          return { id: 'consumed-1' };
        },
      },
      inventoryMovement: { create: async () => ({ id: 'movement-1' }) },
      product: { update: async () => ({ id: 'product-1' }) },
      productBatch: { update: async () => ({ id: 'batch-expired' }) },
    };
    const service = ordersService({
      order: {
        findFirst: async () => ({ id: 'order-1', status: 'open', number: 1 }),
      },
      orderItem: {
        findFirst: async () => ({
          id: 'item-1',
          orderId: 'order-1',
          kind: 'service',
          refId: 'service-1',
        }),
      },
      product: {
        findFirst: async () => ({
          id: 'product-1',
          companyId: 'company-a',
          stock: new Prisma.Decimal(10),
          unit: 'un',
        }),
      },
      productBatch: {
        findFirst: async () => ({
          id: 'batch-expired',
          companyId: 'company-a',
          productId: 'product-1',
          quantity: new Prisma.Decimal(0),
          active: false,
          expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        }),
      },
      service: {
        findUnique: async () => ({ name: 'Procedimento' }),
      },
      $transaction: async (fn: any) => fn(tx),
    });

    await assert.rejects(
      service.addConsumedProduct('company-a', 'order-1', 'item-1', {
        productId: 'product-1',
        batchId: 'batch-expired',
        quantity: 1,
      }),
      /lote.*(vencido|inativo|saldo)|saldo.*lote/i,
    );
    assert.equal(consumedCreated, false);
  });
});

describe('GAP: UC-CAT-025 — custo médio ponderado', () => {
  it('atualiza costPrice junto com a entrada de compra', async () => {
    let productData: any;
    const tx = {
      product: {
        update: async ({ data }: any) => {
          productData = data;
          return { id: 'product-1' };
        },
      },
      inventoryMovement: {
        create: async () => ({ id: 'movement-1' }),
      },
    };
    const service = new PurchasesService({ client: {} } as any);

    await (service as any).applyStockEntry(
      tx,
      'purchase-1',
      [{ productId: 'product-1', quantity: 10, unitCost: 20 }],
      new Map([
        [
          'product-1',
          {
            stock: new Prisma.Decimal(10),
            costPrice: new Prisma.Decimal(10),
          },
        ],
      ]),
    );

    assert.equal(Number(productData.costPrice), 15, 'média: (10×10 + 10×20) / 20');
  });
});
