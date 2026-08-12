import { PrismaClient, InventoryMovementType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Staging seed — FORNECEDORES / COMPRAS / ESTOQUE / CATEGORIAS DE PRODUTO.
 *
 * Popula as páginas Fornecedores, Controle→Compras, Produtos/estoque e Categorias
 * com dados de demonstração realistas, ligados aos 6 Products de staging já
 * existentes (legacyId `prod-1`..`prod-6`, legacySource `staging`).
 *
 * IDEMPOTENTE:
 *  - Supplier tem @@unique([companyId, legacyId]) → upsert por `sup-N`.
 *  - ProductCategory NÃO tem legacyId/@@unique → findFirst por (companyId, name).
 *  - Purchase NÃO tem @@unique → chave natural via `invoiceNumber = 'STG-p-N'`
 *    (findFirst); os PurchaseItem são criados junto (nested) só quando a nota
 *    é nova, então re-rodar não duplica itens.
 *  - InventoryMovement NÃO tem legacyId/@@unique → chave natural via
 *    (productId, refType='staging', refId='mov-N') com findFirst.
 *  - ProductBatch NÃO tem @@unique → findFirst por (companyId, productId, code).
 *
 * Re-rodar nunca duplica e mantém o estoque consistente (stock do Product é
 * recalculado a partir do saldo das movimentações de staging).
 */
const SOURCE = 'staging';

async function main() {
  console.log('Seeding STAGING fornecedores/compras/estoque...');

  // 1) Reuse existing company.
  const company =
    (await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error('No company found. Run the base seed first.');
  const companyId = company.id;
  console.log('Using company:', companyId, company.name);

  // 2) Reuse existing staging products (prod-1..prod-6).
  const products = await prisma.product.findMany({
    where: { companyId, legacySource: SOURCE },
    orderBy: { legacyId: 'asc' },
  });
  if (products.length === 0) {
    throw new Error('No staging products found. Run seed-staging.ts first.');
  }
  const productByLegacy = new Map(products.map((p) => [p.legacyId!, p]));
  console.log('Staging products found:', products.length);

  // 3) ProductCategory (~5). findFirst por (companyId, name); vincula produtos.
  const categoryDefs = ['Cabelo', 'Unhas', 'Skincare', 'Barba', 'Acessórios'];
  const categoryByName = new Map<string, { id: string }>();
  for (const name of categoryDefs) {
    let cat = await prisma.productCategory.findFirst({ where: { companyId, name } });
    if (!cat) {
      cat = await prisma.productCategory.create({ data: { companyId, name } });
    }
    categoryByName.set(name, cat);
  }
  console.log('ProductCategories ensured:', categoryByName.size);

  // Vincula os produtos de staging às categorias (Produtos/estoque → categoria).
  const productCategoryMap: Record<string, string> = {
    'prod-1': 'Cabelo', // Shampoo
    'prod-2': 'Cabelo', // Condicionador
    'prod-3': 'Cabelo', // Máscara Capilar
    'prod-4': 'Cabelo', // Óleo de Argan
    'prod-5': 'Unhas', // Esmalte
    'prod-6': 'Unhas', // Removedor de Esmalte
  };
  for (const [legacyId, catName] of Object.entries(productCategoryMap)) {
    const prod = productByLegacy.get(legacyId);
    const cat = categoryByName.get(catName);
    if (prod && cat && prod.categoryId !== cat.id) {
      await prisma.product.update({ where: { id: prod.id }, data: { categoryId: cat.id } });
    }
  }
  console.log('Products linked to categories.');

  // 4) Supplier (~8 distribuidoras). Idempotente via upsert companyId_legacyId.
  const supplierDefs = [
    { name: 'Distribuidora Beleza Total Ltda', cnpj: '12.345.678/0001-90', phone: '+551133214500', email: 'vendas@belezatotal.com.br', stateRegistration: '110.042.490.114' },
    { name: 'Cosméticos Prime Distribuição', cnpj: '23.456.789/0001-01', phone: '+551133224600', email: 'comercial@cosmeticosprime.com.br', stateRegistration: '111.222.333.444' },
    { name: 'Hair Pro Distribuidora', cnpj: '34.567.890/0001-12', phone: '+551133234700', email: 'atendimento@hairpro.com.br', stateRegistration: '222.333.444.555' },
    { name: 'Unhas & Cia Atacado', cnpj: '45.678.901/0001-23', phone: '+551133244800', email: 'pedidos@unhasecia.com.br', stateRegistration: '333.444.555.666' },
    { name: 'SkinCare Brasil Importadora', cnpj: '56.789.012/0001-34', phone: '+551133254900', email: 'vendas@skincarebrasil.com.br', stateRegistration: '444.555.666.777' },
    { name: 'Barbearia Supply Distribuição', cnpj: '67.890.123/0001-45', phone: '+551133265000', email: 'contato@barbeariasupply.com.br', stateRegistration: '555.666.777.888' },
    { name: 'Mega Cosméticos Atacadista', cnpj: '78.901.234/0001-56', phone: '+551133275100', email: 'sac@megacosmeticos.com.br', stateRegistration: '666.777.888.999' },
    { name: 'Salão Fornecedores Express', cnpj: '89.012.345/0001-67', phone: '+551133285200', email: 'express@salaofornecedores.com.br', stateRegistration: '777.888.999.000' },
  ];
  const suppliers = [];
  for (let i = 0; i < supplierDefs.length; i++) {
    const def = supplierDefs[i];
    const legacyId = `sup-${i + 1}`;
    const sup = await prisma.supplier.upsert({
      where: { companyId_legacyId: { companyId, legacyId } },
      update: { name: def.name, cnpj: def.cnpj, phone: def.phone, email: def.email, stateRegistration: def.stateRegistration },
      create: {
        companyId,
        name: def.name,
        cnpj: def.cnpj,
        phone: def.phone,
        email: def.email,
        stateRegistration: def.stateRegistration,
        addressJson: {
          street: 'Rua das Indústrias',
          number: `${100 + i * 25}`,
          city: 'São Paulo',
          state: 'SP',
          zip: '01000-000',
        },
        legacyId,
        legacySource: SOURCE,
      },
    });
    suppliers.push(sup);
  }
  console.log('Suppliers ensured:', suppliers.length);

  // 5) Purchase (~10) + PurchaseItem. jul/2026. Chave natural = invoiceNumber STG-p-N.
  //    Cada compra referencia produtos existentes; itens criados junto (nested).
  //    Guardamos as entradas de estoque geradas por compra para as movimentações.
  type PurchasePlan = {
    n: number;
    supplierIdx: number;
    day: number;
    items: { legacyId: string; quantity: number; unitCost: number }[];
  };
  const purchasePlans: PurchasePlan[] = [
    { n: 1, supplierIdx: 0, day: 2, items: [{ legacyId: 'prod-1', quantity: 24, unitCost: 22 }, { legacyId: 'prod-2', quantity: 24, unitCost: 20 }] },
    { n: 2, supplierIdx: 2, day: 3, items: [{ legacyId: 'prod-3', quantity: 12, unitCost: 35 }, { legacyId: 'prod-4', quantity: 6, unitCost: 40 }] },
    { n: 3, supplierIdx: 3, day: 5, items: [{ legacyId: 'prod-5', quantity: 60, unitCost: 5 }, { legacyId: 'prod-6', quantity: 40, unitCost: 6 }] },
    { n: 4, supplierIdx: 1, day: 6, items: [{ legacyId: 'prod-1', quantity: 12, unitCost: 21.5 }] },
    { n: 5, supplierIdx: 6, day: 8, items: [{ legacyId: 'prod-2', quantity: 18, unitCost: 19.8 }, { legacyId: 'prod-3', quantity: 6, unitCost: 34 }] },
    { n: 6, supplierIdx: 2, day: 10, items: [{ legacyId: 'prod-4', quantity: 10, unitCost: 39.5 }] },
    { n: 7, supplierIdx: 3, day: 12, items: [{ legacyId: 'prod-5', quantity: 100, unitCost: 4.8 }] },
    { n: 8, supplierIdx: 0, day: 14, items: [{ legacyId: 'prod-1', quantity: 24, unitCost: 22 }, { legacyId: 'prod-6', quantity: 50, unitCost: 5.9 }] },
    { n: 9, supplierIdx: 4, day: 16, items: [{ legacyId: 'prod-3', quantity: 10, unitCost: 35.5 }, { legacyId: 'prod-4', quantity: 8, unitCost: 41 }] },
    { n: 10, supplierIdx: 7, day: 18, items: [{ legacyId: 'prod-2', quantity: 24, unitCost: 20.2 }, { legacyId: 'prod-5', quantity: 80, unitCost: 5.1 }] },
  ];

  // Acumula entradas por produto (para movimentações e recálculo de estoque).
  const inflowByProduct = new Map<string, number>();

  let purchasesCreated = 0;
  let purchasesExisting = 0;
  for (const plan of purchasePlans) {
    const invoiceNumber = `STG-p-${plan.n}`;
    const date = new Date(Date.UTC(2026, 6 /* July */, plan.day, 12, 0, 0));
    const freight = 15 + plan.n; // pequeno frete determinístico
    const items = plan.items.map((it) => {
      const prod = productByLegacy.get(it.legacyId);
      if (!prod) throw new Error(`Product ${it.legacyId} not found`);
      const total = Number((it.quantity * it.unitCost).toFixed(2));
      // acumula entrada de estoque
      inflowByProduct.set(prod.id, (inflowByProduct.get(prod.id) ?? 0) + it.quantity);
      return { productId: prod.id, quantity: it.quantity, unitCost: it.unitCost, total };
    });
    const itemsTotal = items.reduce((s, it) => s + it.total, 0);
    const total = Number((itemsTotal + freight).toFixed(2));

    const existing = await prisma.purchase.findFirst({ where: { companyId, invoiceNumber } });
    if (existing) {
      purchasesExisting++;
      continue;
    }
    await prisma.purchase.create({
      data: {
        companyId,
        supplierId: suppliers[plan.supplierIdx].id,
        status: 'lancada',
        number: plan.n,
        invoiceNumber,
        freight,
        total,
        date,
        notes: `Compra de reposição de estoque (staging #${plan.n})`,
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitCost: it.unitCost,
            total: it.total,
          })),
        },
      },
    });
    purchasesCreated++;
  }
  console.log(`Purchases ensured: created=${purchasesCreated} existing=${purchasesExisting}`);

  // 6) InventoryMovement — histórico de estoque dos 6 produtos.
  //    Entradas (in) por compra: uma movimentação agregada por produto (refId mov-in-<prod>).
  //    Saídas (out) por venda: consumo determinístico por produto (refId mov-out-<prod>).
  //    Chave natural: (productId, refType='staging', refId).
  const movements: { productId: string; type: InventoryMovementType; quantity: number; reason: string; refId: string }[] = [];

  // Saídas por venda (determinísticas, menores que as entradas para sobrar estoque).
  const salesByLegacy: Record<string, number> = {
    'prod-1': 20,
    'prod-2': 18,
    'prod-3': 8,
    'prod-4': 6,
    'prod-5': 90,
    'prod-6': 30,
  };

  for (const prod of products) {
    const inflow = inflowByProduct.get(prod.id) ?? 0;
    const outflow = salesByLegacy[prod.legacyId!] ?? 0;
    if (inflow > 0) {
      movements.push({
        productId: prod.id,
        type: InventoryMovementType.in,
        quantity: inflow,
        reason: 'Entrada por compra de fornecedor',
        refId: `mov-in-${prod.legacyId}`,
      });
    }
    if (outflow > 0) {
      movements.push({
        productId: prod.id,
        type: InventoryMovementType.out,
        quantity: outflow,
        reason: 'Saída por venda',
        refId: `mov-out-${prod.legacyId}`,
      });
    }
  }

  let movementsCreated = 0;
  let movementsExisting = 0;
  for (const mv of movements) {
    const existing = await prisma.inventoryMovement.findFirst({
      where: { productId: mv.productId, refType: SOURCE, refId: mv.refId },
    });
    if (existing) {
      movementsExisting++;
      continue;
    }
    await prisma.inventoryMovement.create({
      data: {
        productId: mv.productId,
        type: mv.type,
        quantity: mv.quantity,
        reason: mv.reason,
        refType: SOURCE,
        refId: mv.refId,
      },
    });
    movementsCreated++;
  }
  console.log(`InventoryMovements ensured: created=${movementsCreated} existing=${movementsExisting}`);

  // 6b) Recalcula o stock de cada produto de staging a partir do saldo das
  //     movimentações de staging (in - out), pra o número na página bater com o
  //     histórico. Idempotente: sempre seta pro mesmo valor.
  for (const prod of products) {
    const inflow = inflowByProduct.get(prod.id) ?? 0;
    const outflow = salesByLegacy[prod.legacyId!] ?? 0;
    const stock = inflow - outflow;
    await prisma.product.update({
      where: { id: prod.id },
      data: { stock, trackStock: true },
    });
  }
  console.log('Product stock recomputed from staging movements.');

  // 7) ProductBatch (lotes/validade) — opcional, schema tem o model.
  //    Um lote por produto, validade em 2027. findFirst por (companyId, productId, code).
  let batchesCreated = 0;
  let batchesExisting = 0;
  for (let i = 0; i < products.length; i++) {
    const prod = products[i];
    const code = `L2026-${String(i + 1).padStart(3, '0')}`;
    const existing = await prisma.productBatch.findFirst({
      where: { companyId, productId: prod.id, code },
    });
    if (existing) {
      batchesExisting++;
      continue;
    }
    const inflow = inflowByProduct.get(prod.id) ?? 0;
    const outflow = salesByLegacy[prod.legacyId!] ?? 0;
    await prisma.productBatch.create({
      data: {
        companyId,
        productId: prod.id,
        code,
        manufacturedAt: new Date(Date.UTC(2026, 5, 1)),
        expiresAt: new Date(Date.UTC(2027, 11, 31)),
        quantity: Math.max(inflow - outflow, 0),
      },
    });
    batchesCreated++;
  }
  console.log(`ProductBatches ensured: created=${batchesCreated} existing=${batchesExisting}`);

  console.log('STAGING fornecedores/compras/estoque seed done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
