import {
  PrismaClient,
  OrderStatus,
  OrderItemKind,
  PaymentStatus,
  DiscountType,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Staging seed — COMANDAS (Orders) demo data to fill the "Comandas" page.
 * Extends the main staging seed (seed-staging.ts) with Order + OrderItem +
 * OrderPayment (+ OrderStatusHistory + OrderDiscount) rows for July 2026.
 *
 * Links to EXISTING staging Customers / Professionals / Services / Products
 * (legacySource = 'staging'), reusing whatever the company already has.
 *
 * IDEMPOTENT:
 *   - Order has @@unique([companyId, legacyId]) and @@unique([companyId, number]).
 *     We upsert on (companyId, legacyId) using stable staging legacyIds `ord-N`
 *     and a stable staging `number` range (5001..5040). Re-running never
 *     duplicates orders.
 *   - Child rows (OrderItem / OrderPayment / OrderStatusHistory / OrderDiscount)
 *     have no unique/legacy key, so before (re)seeding we delete all children of
 *     the staging orders and recreate them. Deterministic PRNG keeps values
 *     stable across re-runs.
 *
 * ENUM VALUES (verified against schema.prisma):
 *   - OrderStatus:   open | finished | canceled
 *   - OrderItemKind: service | product
 *   - PaymentStatus: pending | paid | reversed
 *   - DiscountType:  percent | value
 *
 * NOTES:
 *   - PaymentMethod table is empty in staging, so OrderPayment.paymentMethodId
 *     stays null (it is optional). We describe the method via `description`.
 *   - OrderStatusHistory.byUserId references the User model; we use the existing
 *     admin User when available (nullable otherwise).
 *   - Totals: grossTotal = sum(item grossValue); discountTotal from OrderDiscount
 *     (when any); netTotal = grossTotal - discountTotal. creditUsed/cashbackUsed
 *     left at 0. Closed (finished) orders get payment(s) summing to netTotal.
 */
const SOURCE = 'staging';
const STAGING_NUMBER_BASE = 5000; // staging orders get numbers 5001..5040
const TOTAL_ORDERS = 40;

// Deterministic PRNG so re-runs produce the same data.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rand = makeRng(20260722);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const round2 = (n: number) => Math.round(n * 100) / 100;

// July 2026, Brazil time (-03:00).
const dateAt = (day: number, hour: number, minute = 0) =>
  new Date(
    `2026-07-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(
      minute,
    ).padStart(2, '0')}:00-03:00`,
  );

const PAYMENT_METHODS = ['Dinheiro', 'Pix', 'Cartão de crédito', 'Cartão de débito'];

async function main() {
  console.log('Seeding STAGING COMANDAS data...');

  // 1) Reuse existing company.
  const company =
    (await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error('No company found. Run the base seed first.');
  const companyId = company.id;
  console.log('Using company:', companyId, company.name);

  // 2) Existing domain rows. Prefer staging-tagged; fall back to whatever the
  //    company has so the seed still works if tags differ.
  const stagingCustomers = await prisma.customer.findMany({
    where: { companyId, legacySource: SOURCE, active: true },
  });
  const customers =
    stagingCustomers.length > 0
      ? stagingCustomers
      : await prisma.customer.findMany({ where: { companyId, active: true } });

  const professionals = await prisma.professional.findMany({ where: { companyId } });

  const services = await prisma.service.findMany({ where: { companyId } });

  const products = await prisma.product.findMany({ where: { companyId } });

  if (customers.length === 0) throw new Error('No customers found. Run seed-staging.ts first.');
  if (professionals.length === 0) throw new Error('No professionals found. Run seed-staging.ts first.');
  if (services.length === 0) throw new Error('No services found. Run seed-staging.ts first.');
  console.log(
    `Pools -> customers: ${customers.length}, professionals: ${professionals.length}, services: ${services.length}, products: ${products.length}`,
  );

  // 3) Optional admin user for OrderStatusHistory.byUserId (nullable).
  const adminUser = await prisma.user.findFirst({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
  });

  let ordersCreated = 0;
  let itemsCreated = 0;
  let paymentsCreated = 0;
  let discountsCreated = 0;
  let historyCreated = 0;

  for (let i = 1; i <= TOTAL_ORDERS; i++) {
    const legacyId = `ord-${i}`;
    const number = STAGING_NUMBER_BASE + i; // 5001..5040
    const customer = pick(customers);
    const orderProfessional = pick(professionals);

    // Spread across July 2026. Bias: earlier days finished/paid, last few open.
    const day = randInt(1, 21);
    const hour = randInt(9, 19);
    const minute = pick([0, 15, 30, 45]);
    const date = dateAt(day, hour, minute);

    // Status: ~70% finished (paid), ~20% open, ~10% canceled — but keep the last
    // several orders open so the page shows live comandas.
    let status: OrderStatus;
    if (i > TOTAL_ORDERS - 6) {
      status = OrderStatus.open;
    } else {
      const roll = rand();
      status = roll < 0.7 ? OrderStatus.finished : roll < 0.9 ? OrderStatus.open : OrderStatus.canceled;
    }

    // 3a) Build 1-4 items (services and/or products).
    const itemCount = randInt(1, 4);
    type ItemDef = {
      kind: OrderItemKind;
      refId: string;
      professionalId: string | null;
      quantity: number;
      unitPrice: number;
      grossValue: number;
    };
    const itemDefs: ItemDef[] = [];
    for (let k = 0; k < itemCount; k++) {
      // ~65% services, ~35% products (when products exist).
      const wantsProduct = products.length > 0 && rand() < 0.35;
      if (wantsProduct) {
        const p = pick(products);
        const quantity = randInt(1, 3);
        const unitPrice = round2(Number(p.salePrice));
        itemDefs.push({
          kind: OrderItemKind.product,
          refId: p.id,
          professionalId: null,
          quantity,
          unitPrice,
          grossValue: round2(unitPrice * quantity),
        });
      } else {
        const svc = pick(services);
        const quantity = 1;
        const unitPrice = round2(Number(svc.price));
        // Service item performed by the order's professional (or another).
        const svcPro = rand() < 0.8 ? orderProfessional : pick(professionals);
        itemDefs.push({
          kind: OrderItemKind.service,
          refId: svc.id,
          professionalId: svcPro.id,
          quantity,
          unitPrice,
          grossValue: round2(unitPrice * quantity),
        });
      }
    }

    const grossTotal = round2(itemDefs.reduce((a, it) => a + it.grossValue, 0));

    // 3b) Optional order-level discount (~25% of non-canceled orders).
    let discountTotal = 0;
    let discountDef: { type: DiscountType; value: number; reason: string } | null = null;
    if (status !== OrderStatus.canceled && rand() < 0.25 && grossTotal > 0) {
      if (rand() < 0.5) {
        // percent discount 5..15%
        const pct = randInt(5, 15);
        discountTotal = round2((grossTotal * pct) / 100);
        discountDef = { type: DiscountType.percent, value: pct, reason: 'Desconto fidelidade' };
      } else {
        // fixed value discount (up to ~20% of gross, min 5)
        const val = round2(Math.min(grossTotal * 0.2, Math.max(5, randInt(5, 30))));
        discountTotal = val;
        discountDef = { type: DiscountType.value, value: val, reason: 'Desconto promocional' };
      }
    }

    const netTotal = round2(Math.max(0, grossTotal - discountTotal));

    // 3c) Upsert the order on the unique (companyId, legacyId).
    const order = await prisma.order.upsert({
      where: { companyId_legacyId: { companyId, legacyId } },
      update: {
        number,
        customerId: customer.id,
        professionalId: orderProfessional.id,
        status,
        grossTotal,
        discountTotal,
        creditUsed: 0,
        cashbackUsed: 0,
        netTotal,
        date,
      },
      create: {
        companyId,
        number,
        customerId: customer.id,
        professionalId: orderProfessional.id,
        status,
        grossTotal,
        discountTotal,
        creditUsed: 0,
        cashbackUsed: 0,
        netTotal,
        date,
        legacyId,
        legacySource: SOURCE,
      },
    });
    ordersCreated++;

    // 3d) Idempotent children: wipe this order's children, then recreate.
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.orderPayment.deleteMany({ where: { orderId: order.id } });
    await prisma.orderDiscount.deleteMany({ where: { orderId: order.id } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } });

    // Items
    for (const it of itemDefs) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          kind: it.kind,
          refId: it.refId,
          professionalId: it.professionalId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          grossValue: it.grossValue,
          discount: 0,
        },
      });
      itemsCreated++;
    }

    // Discount
    if (discountDef) {
      await prisma.orderDiscount.create({
        data: {
          orderId: order.id,
          type: discountDef.type,
          value: discountDef.value,
          reason: discountDef.reason,
        },
      });
      discountsCreated++;
    }

    // Payments — only for finished (closed/paid) orders. Sum == netTotal.
    if (status === OrderStatus.finished && netTotal > 0) {
      const paidAt = dateAt(day, hour, Math.min(59, minute + randInt(10, 40)));
      // ~30% split into two payment methods.
      if (rand() < 0.3 && netTotal >= 20) {
        const firstAmount = round2(netTotal / 2);
        const secondAmount = round2(netTotal - firstAmount);
        const [m1, m2] = (() => {
          const a = pick(PAYMENT_METHODS);
          let b = pick(PAYMENT_METHODS);
          if (b === a) b = PAYMENT_METHODS[(PAYMENT_METHODS.indexOf(a) + 1) % PAYMENT_METHODS.length];
          return [a, b];
        })();
        await prisma.orderPayment.create({
          data: {
            orderId: order.id,
            paymentMethodId: null,
            amount: firstAmount,
            paidAt,
            status: PaymentStatus.paid,
            description: m1,
          },
        });
        await prisma.orderPayment.create({
          data: {
            orderId: order.id,
            paymentMethodId: null,
            amount: secondAmount,
            paidAt,
            status: PaymentStatus.paid,
            description: m2,
          },
        });
        paymentsCreated += 2;
      } else {
        await prisma.orderPayment.create({
          data: {
            orderId: order.id,
            paymentMethodId: null,
            amount: netTotal,
            paidAt,
            status: PaymentStatus.paid,
            description: pick(PAYMENT_METHODS),
          },
        });
        paymentsCreated++;
      }
    }

    // Status history: open -> (finished|canceled) for closed orders.
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: null,
        toStatus: OrderStatus.open,
        at: date,
        byUserId: adminUser?.id ?? null,
      },
    });
    historyCreated++;
    if (status !== OrderStatus.open) {
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.open,
          toStatus: status,
          at: new Date(date.getTime() + randInt(15, 90) * 60_000),
          byUserId: adminUser?.id ?? null,
        },
      });
      historyCreated++;
    }
  }

  console.log('Orders (comandas) ensured:', ordersCreated);
  console.log('OrderItems ensured:', itemsCreated);
  console.log('OrderPayments ensured:', paymentsCreated);
  console.log('OrderDiscounts ensured:', discountsCreated);
  console.log('OrderStatusHistory ensured:', historyCreated);
  console.log('STAGING COMANDAS seed done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
