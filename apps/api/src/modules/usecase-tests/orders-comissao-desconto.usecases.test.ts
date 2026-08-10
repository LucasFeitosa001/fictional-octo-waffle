/**
 * Comanda/Faturar — as travas de dinheiro e estoque do backend. Ver estudo 140
 * (achados 1 a 5 do laudo 139, seções "Faturar" e "Comanda").
 *
 * Todo teste aqui FALHA com o código anterior. São regras que o servidor precisa
 * ser dono: a tela pode mentir, esconder ou nem existir (a comanda também é
 * editada por /comandas/:id, que é outra implementação), então quem garante é
 * o service.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Prisma } from '@beautypass/db';
import { OrdersService } from '../orders/orders.service';

function ordersService(client: unknown) {
  return new OrdersService({ client } as never, {
    enqueueFollowUp: async () => undefined,
  } as never);
}

const D = (v: number | string) => new Prisma.Decimal(v);

/** Item de comanda no formato que o finish() entrega ao gerador de comissão. */
function itemDeServico(over: Record<string, unknown> = {}) {
  return {
    kind: 'service',
    refId: 'svc-1',
    professionalId: 'prof-1',
    grossValue: D(200),
    discount: D(0),
    professional: { id: 'prof-1', name: 'Vitória', receivesCommission: true },
    auxiliaries: [],
    ...over,
  };
}

/**
 * Prisma falso para generateCommissionEntries: regra de comissão "all" com o
 * percentual pedido, e catálogo respondendo nome/categoria.
 */
function txDeComissao(percentual: number) {
  const criadas: Record<string, unknown>[] = [];
  const tx = {
    commissionEntry: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        criadas.push(data);
        return data;
      },
    },
    professionalCommissionRule: {
      findMany: async () => [
        { scopeType: 'all', scopeId: null, type: 'percent', value: D(percentual) },
      ],
    },
    service: {
      findUnique: async () => ({ categoryId: null, name: 'Escova' }),
    },
    product: {
      findUnique: async () => ({ categoryId: null, name: 'Shampoo' }),
    },
  };
  return { tx, criadas };
}

// ============================================================================
// Achado 1 — comissão sobre o valor cheio
// ============================================================================

describe('Comissão x desconto DA COMANDA (estudo 140, achado 1)', () => {
  it('desconta o desconto do PDV da base: 40% de R$ 200 com 50% off = R$ 40, não R$ 80', async () => {
    const service = ordersService({});
    const { tx, criadas } = txDeComissao(40);

    await (service as never as { generateCommissionEntries: Function }).generateCommissionEntries(
      tx,
      'company-a',
      {
        id: 'order-1',
        date: new Date('2026-08-09T12:00:00.000Z'),
        // recalculate escreveu isto no cabeçalho depois do "Adicionar desconto"
        // de 50% sobre R$ 200.
        discountTotal: D(100),
        items: [itemDeServico()],
      },
    );

    assert.equal(criadas.length, 1);
    assert.equal(
      new Prisma.Decimal(criadas[0].baseAmount as Prisma.Decimal).toNumber(),
      100,
      'a base da comissão é o que a cliente pagou, não o valor de tabela',
    );
    assert.equal(
      new Prisma.Decimal(criadas[0].commissionAmount as Prisma.Decimal).toNumber(),
      40,
      'o salão recebeu 100 — não pode dever 80',
    );
  });

  it('rateia o desconto entre os itens e a soma FECHA com o desconto (sem centavo perdido)', async () => {
    const service = ordersService({});
    const { tx, criadas } = txDeComissao(100); // 100% → commissionAmount == base

    // 3 itens de R$ 100 e R$ 100 de desconto na comanda: 100/3 não é exato.
    await (service as never as { generateCommissionEntries: Function }).generateCommissionEntries(
      tx,
      'company-a',
      {
        id: 'order-1',
        date: new Date('2026-08-09T12:00:00.000Z'),
        discountTotal: D(100),
        items: [
          itemDeServico({ grossValue: D(100) }),
          itemDeServico({ grossValue: D(100) }),
          itemDeServico({ grossValue: D(100) }),
        ],
      },
    );

    assert.equal(criadas.length, 3);
    const somaDasBases = criadas.reduce(
      (acc, e) => acc.add(e.baseAmount as Prisma.Decimal),
      D(0),
    );
    assert.equal(
      somaDasBases.toFixed(2),
      '200.00',
      'as bases somadas têm de bater com 300 − 100; sobra de centavo não some nem duplica',
    );
  });

  it('rateio proporcional: item mais caro absorve mais desconto', () => {
    const service = ordersService({});
    const cotas = (
      service as never as { ratearDescontoDaComanda: Function }
    ).ratearDescontoDaComanda([D(300), D(100)], D(40)) as Prisma.Decimal[];

    assert.equal(cotas[0].toFixed(2), '30.00');
    assert.equal(cotas[1].toFixed(2), '10.00');
  });

  it('desconto maior que a comanda inteira zera a base, nunca deixa negativa', () => {
    const service = ordersService({});
    const cotas = (
      service as never as { ratearDescontoDaComanda: Function }
    ).ratearDescontoDaComanda([D(100), D(50)], D(500)) as Prisma.Decimal[];

    assert.equal(cotas[0].toFixed(2), '100.00');
    assert.equal(cotas[1].toFixed(2), '50.00');
  });
});

// ============================================================================
// Achado 5 — item sem profissional entra no aviso do faturamento
// ============================================================================

describe('Aviso de item sem profissional (estudo 140, achado 5)', () => {
  it('lista o item órfão em vez de pular em silêncio', async () => {
    const service = ordersService({});
    const { tx, criadas } = txDeComissao(40);

    const resultado = await (
      service as never as { generateCommissionEntries: Function }
    ).generateCommissionEntries(tx, 'company-a', {
      id: 'order-1',
      date: new Date('2026-08-09T12:00:00.000Z'),
      discountTotal: D(0),
      items: [itemDeServico({ professionalId: null, professional: null })],
    });

    assert.equal(criadas.length, 0, 'sem profissional não há a quem pagar');
    assert.deepEqual(
      resultado.semProfissional,
      [{ item: 'Escova' }],
      'quem fatura precisa saber que o item saiu sem comissão',
    );
    assert.deepEqual(resultado.semPercentual, [], 'a causa não é falta de percentual');
  });
});

// ============================================================================
// Achado 2 — desconto do item sem teto
// ============================================================================

describe('Teto do desconto do ITEM (estudo 140, achado 2)', () => {
  it('addItem recusa desconto maior que o valor do item', async () => {
    let criado = false;
    const service = ordersService({
      order: { findFirst: async () => ({ id: 'order-1', status: 'open' }) },
      service: { findFirst: async () => ({ price: D(100) }) },
      orderItem: {
        create: async () => {
          criado = true;
          return {};
        },
      },
    });

    await assert.rejects(
      service.addItem('company-a', 'order-1', {
        kind: 'service',
        refId: 'svc-1',
        // Queria 20 e digitou 200 — o caso do laudo.
        discount: 200,
      }),
      /maior que o valor do item/,
    );
    assert.equal(criado, false);
  });

  it('updateItem recusa desconto maior que o valor do item', async () => {
    let atualizado = false;
    const service = ordersService({
      order: { findFirst: async () => ({ id: 'order-1', status: 'open' }) },
      orderItem: {
        findFirst: async () => ({
          id: 'item-1',
          orderId: 'order-1',
          kind: 'service',
          refId: 'svc-1',
          professionalId: null,
          unitPrice: D(100),
          quantity: D(1),
          discount: D(0),
        }),
        update: async () => {
          atualizado = true;
          return {};
        },
      },
    });

    await assert.rejects(
      service.updateItem('company-a', 'order-1', 'item-1', { discount: 200 }),
      /maior que o valor do item/,
    );
    assert.equal(atualizado, false);
  });

  it('NÃO recusa a cortesia de 100% em item com quantidade fracionada (estudo 141)', async () => {
    // Produto a R$ 3,25 · quantidade 1,5: o bruto exato é 4,875 e o banco grava
    // 4,88 (OrderItem.grossValue é Decimal(12,2)). O painel manda o desconto de
    // 100% já arredondado, 4,88 — comparar com o bruto EXATO respondia
    // "Desconto de R$ 4,88 maior que o valor do item (R$ 4,88)" e a cortesia
    // ficava impossível, com uma mensagem que se contradiz.
    let gravado: Record<string, unknown> | null = null;
    const service = ordersService({
      order: {
        findFirst: async () => ({ id: 'order-1', status: 'open' }),
        findUniqueOrThrow: async () => ({
          id: 'order-1',
          customerId: null,
          creditUsed: D(0),
          cashbackUsed: D(0),
          discounts: [],
          items: [],
        }),
      },
      orderItem: {
        findFirst: async () => ({
          id: 'item-1',
          orderId: 'order-1',
          kind: 'product',
          refId: 'prod-1',
          professionalId: null,
          unitPrice: D('3.25'),
          quantity: D('1.5'),
          discount: D(0),
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          gravado = data;
          return {};
        },
      },
      $transaction: async (fn: (t: unknown) => unknown) =>
        fn({ order: { update: async () => ({}) } }),
    });

    await service.updateItem('company-a', 'order-1', 'item-1', {
      unitPrice: 3.25,
      quantity: 1.5,
      discount: 4.88,
    });

    assert.notEqual(gravado, null, 'a cortesia de 100% tem de passar');
  });

  it('recalculate isola item já gravado com desconto exagerado (não canibaliza os outros)', async () => {
    let gravado: Record<string, unknown> = {};
    const tx = {
      order: {
        update: async ({ data }: { data: Record<string, unknown> }) => {
          gravado = data;
          return data;
        },
      },
    };
    const service = ordersService({
      order: {
        findUniqueOrThrow: async () => ({
          id: 'order-1',
          customerId: null,
          creditUsed: D(0),
          cashbackUsed: D(0),
          discounts: [],
          items: [
            // Escova R$ 100 com "200" de desconto (dado legado, gravado antes do teto)
            { grossValue: D(100), discount: D(200) },
            // Shampoo R$ 50, intacto
            { grossValue: D(50), discount: D(0) },
          ],
        }),
      },
      $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
    });

    await (service as never as { recalculate: Function }).recalculate('order-1');

    assert.equal(
      new Prisma.Decimal(gravado.grossTotal as Prisma.Decimal).toFixed(2),
      '50.00',
      'o Shampoo de R$ 50 não pode sumir do total por causa do item estragado',
    );
    assert.equal(
      new Prisma.Decimal(gravado.netTotal as Prisma.Decimal).toFixed(2),
      '50.00',
      'com o líquido em 0 o Faturar passava sem pagamento e sem caixa aberto',
    );
  });
});

// ============================================================================
// Achado 3 — venda derrubando estoque para negativo
// ============================================================================

describe('Estoque na venda de produto (estudo 140, achado 3)', () => {
  function clienteComProduto(produto: Record<string, unknown>, itensNaComanda: unknown[] = []) {
    const estado = { criado: false, recalculou: false };
    const tx = { order: { update: async () => ({}) } };
    const client = {
      order: {
        findFirst: async () => ({ id: 'order-1', status: 'open' }),
        findUniqueOrThrow: async () => {
          estado.recalculou = true;
          return {
            id: 'order-1',
            customerId: null,
            creditUsed: D(0),
            cashbackUsed: D(0),
            discounts: [],
            items: [],
          };
        },
      },
      product: { findFirst: async () => produto },
      orderItem: {
        findMany: async () => itensNaComanda,
        create: async () => {
          estado.criado = true;
          return {};
        },
      },
      $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
    };
    return { client, estado };
  }

  it('recusa vender 3 com 1 em estoque quando o produto controla estoque', async () => {
    const { client, estado } = clienteComProduto({
      name: 'Shampoo Hidratante',
      unit: 'un',
      stock: D(1),
      trackStock: true,
      salePrice: D(50),
    });
    const service = ordersService(client);

    await assert.rejects(
      service.addItem('company-a', 'order-1', {
        kind: 'product',
        refId: 'prod-1',
        quantity: 3,
      }),
      /Estoque insuficiente de Shampoo Hidratante/,
    );
    assert.equal(estado.criado, false, 'o item não pode entrar na comanda');
  });

  it('soma o que a PRÓPRIA comanda já reservou (dois itens de 1 un com saldo 1)', async () => {
    const { client } = clienteComProduto(
      { name: 'Shampoo', unit: 'un', stock: D(1), trackStock: true, salePrice: D(50) },
      [{ quantity: D(1) }],
    );
    const service = ordersService(client);

    await assert.rejects(
      service.addItem('company-a', 'order-1', {
        kind: 'product',
        refId: 'prod-1',
        quantity: 1,
      }),
      /Estoque insuficiente/,
    );
  });

  it('deixa vender quando o salão NÃO controla o estoque daquele produto', async () => {
    // trackStock=false é o default do schema e a situação do catálogo importado
    // do Belasis (saldo 0 em quase tudo): barrar aqui impediria vender qualquer
    // coisa. Onde o saldo é palpite, ele não trava a operação.
    const { client, estado } = clienteComProduto({
      name: 'Shampoo',
      unit: 'un',
      stock: D(0),
      trackStock: false,
      salePrice: D(50),
    });
    const service = ordersService(client);

    await service.addItem('company-a', 'order-1', {
      kind: 'product',
      refId: 'prod-1',
      quantity: 3,
    });
    assert.equal(estado.criado, true);
    assert.equal(estado.recalculou, true);
  });
});

// ============================================================================
// Achado 4 — comissão já paga sobrevive ao cancelamento
// ============================================================================

describe('Comissão já paga no estorno da comanda (estudo 140, achado 4)', () => {
  function clienteDeEstorno() {
    const tx = {
      transaction: { findMany: async () => [] },
      commissionEntry: {
        findMany: async () => [
          { commissionAmount: D(80), professional: { name: 'Vitória' } },
        ],
        updateMany: async () => ({ count: 0 }),
      },
      cashMovement: { findMany: async () => [] },
      inventoryMovement: { findMany: async () => [] },
      orderItem: { findMany: async () => [] },
      order: {
        update: async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'order-1',
          ...data,
        }),
      },
    };
    return {
      order: {
        findFirst: async () => ({
          id: 'order-1',
          number: 312,
          status: 'finished',
          customerId: null,
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'order-1',
          ...data,
        }),
      },
      setting: { findUnique: async () => null },
      orderItemConsumedProduct: { findMany: async () => [] },
      $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
    };
  }

  it('reabrir avisa que já saiu comissão paga sobre esta venda', async () => {
    const service = ordersService(clienteDeEstorno());
    const reaberta = (await service.reopen('company-a', 'order-1', 'user-1')) as unknown as {
      commissionAlreadyPaid: { profissional: string; valor: Prisma.Decimal }[];
    };

    assert.equal(reaberta.commissionAlreadyPaid.length, 1);
    assert.equal(reaberta.commissionAlreadyPaid[0].profissional, 'Vitória');
    assert.equal(new Prisma.Decimal(reaberta.commissionAlreadyPaid[0].valor).toNumber(), 80);
  });

  it('cancelar avisa o mesmo — o dinheiro já saiu e a venda deixou de existir', async () => {
    const service = ordersService(clienteDeEstorno());
    const cancelada = (await service.remove('company-a', 'order-1')) as unknown as {
      commissionAlreadyPaid: { profissional: string; valor: Prisma.Decimal }[];
    };

    assert.equal(cancelada.commissionAlreadyPaid.length, 1);
    assert.equal(cancelada.commissionAlreadyPaid[0].profissional, 'Vitória');
  });
});
