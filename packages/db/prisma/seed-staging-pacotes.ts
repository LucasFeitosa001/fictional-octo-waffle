import {
  PrismaClient,
  PackageStatus,
  MembershipStatus,
  PaymentStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Staging seed — PACOTES (packages/combos) e ASSINATURAS (memberships) demo data
 * to fill the "Pacotes" and "Vendas por Assinatura" pages. Extends the main
 * staging seed (seed-staging.ts): reuses its company, services and customers.
 *
 * IDEMPOTENT strategy (verified against schema.prisma):
 *   - PackageTemplate / PackageTemplateItem: NO legacyId column. Idempotent by
 *     unique (companyId, name): findFirst by name, create if missing, then
 *     replace child items (deleteMany + create) so re-runs never duplicate items.
 *   - CustomerPackage: has @@unique([companyId, legacyId]); we upsert on that key
 *     with stable staging `legacyId` = "pkg-N". Its children (CustomerPackageItem,
 *     PackageUsage) are wiped+recreated per package on every run.
 *   - MembershipPlan / MembershipService: NO legacyId column. Idempotent by
 *     (companyId, name): findFirst by name; MembershipService has PK
 *     [membershipPlanId, serviceId] so we deleteMany + create the grid.
 *   - CustomerMembership: NO legacyId column and no natural unique key beyond
 *     indexes. Idempotent by (companyId, customerId, membershipPlanId): findFirst;
 *     children (MembershipPayment) wiped+recreated per membership on every run.
 *
 * ENUM VALUES (verified against schema.prisma):
 *   - PackageStatus:    active | expired | finished
 *   - MembershipStatus: active | canceled | overdue
 *   - PaymentStatus:    pending | paid | reversed
 */
const SOURCE = 'staging';

// Deterministic PRNG so re-runs produce stable data.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rand = makeRng(20260722);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const TODAY = new Date('2026-07-22T12:00:00-03:00');
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

async function main() {
  console.log('Seeding STAGING data — PACOTES & ASSINATURAS...');

  // 1) Reuse existing company (same lookup as seed-staging.ts).
  const company =
    (await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error('No company found. Run the base + staging seed first.');
  const companyId = company.id;
  console.log('Using company:', companyId, company.name);

  // 2) Reuse existing services (by name) from the main staging seed.
  const svcByName = new Map<string, { id: string; price: any }>();
  const allServices = await prisma.service.findMany({ where: { companyId } });
  for (const s of allServices) svcByName.set(s.name, { id: s.id, price: s.price });
  const svc = (name: string) => {
    const s = svcByName.get(name);
    if (!s) throw new Error(`Service not found (run seed-staging.ts first): ${name}`);
    return s;
  };
  console.log('Services available:', allServices.length);

  // 3) Reuse existing customers (staging) — need enough for ~10 packages + ~12 memberships.
  const customers = await prisma.customer.findMany({
    where: { companyId, legacySource: SOURCE, active: true },
    orderBy: { legacyId: 'asc' },
  });
  if (customers.length < 12) {
    throw new Error(
      `Not enough staging customers (${customers.length}). Run seed-staging.ts first.`,
    );
  }
  console.log('Staging customers available:', customers.length);

  // =====================================================================
  // A) PACKAGE TEMPLATES (~6 combos)
  // =====================================================================
  const templateDefs: {
    name: string;
    price: number;
    validityDays: number;
    discount: number;
    items: { service: string; sessions: number }[];
  }[] = [
    {
      name: 'Dia da Noiva',
      price: 890,
      validityDays: 90,
      discount: 120,
      items: [
        { service: 'Escova', sessions: 1 },
        { service: 'Manicure', sessions: 1 },
        { service: 'Pedicure', sessions: 1 },
        { service: 'Hidratação', sessions: 1 },
      ],
    },
    {
      name: 'Combo Corte + Escova',
      price: 110,
      validityDays: 60,
      discount: 20,
      items: [
        { service: 'Corte Feminino', sessions: 1 },
        { service: 'Escova', sessions: 1 },
      ],
    },
    {
      name: 'Pacote 5 Manicures',
      price: 180,
      validityDays: 120,
      discount: 45,
      items: [{ service: 'Manicure', sessions: 5 }],
    },
    {
      name: 'Pacote 4 Hidratações',
      price: 300,
      validityDays: 120,
      discount: 60,
      items: [{ service: 'Hidratação', sessions: 4 }],
    },
    {
      name: 'Combo Barba + Corte Masculino',
      price: 80,
      validityDays: 45,
      discount: 10,
      items: [
        { service: 'Corte Masculino', sessions: 1 },
        { service: 'Barba', sessions: 1 },
      ],
    },
    {
      name: 'Pacote Coloração + Corte',
      price: 240,
      validityDays: 90,
      discount: 20,
      items: [
        { service: 'Coloração', sessions: 1 },
        { service: 'Corte Feminino', sessions: 1 },
      ],
    },
  ];

  const templates: { id: string; def: (typeof templateDefs)[number] }[] = [];
  for (const def of templateDefs) {
    let tpl = await prisma.packageTemplate.findFirst({ where: { companyId, name: def.name } });
    if (!tpl) {
      tpl = await prisma.packageTemplate.create({
        data: {
          companyId,
          name: def.name,
          price: def.price,
          validityDays: def.validityDays,
          discount: def.discount,
          active: true,
        },
      });
    } else {
      tpl = await prisma.packageTemplate.update({
        where: { id: tpl.id },
        data: {
          price: def.price,
          validityDays: def.validityDays,
          discount: def.discount,
          active: true,
        },
      });
    }
    // Replace items (no legacy key on items).
    await prisma.packageTemplateItem.deleteMany({ where: { templateId: tpl.id } });
    await prisma.packageTemplateItem.createMany({
      data: def.items.map((it) => ({
        templateId: tpl!.id,
        serviceId: svc(it.service).id,
        sessions: it.sessions,
      })),
    });
    templates.push({ id: tpl.id, def });
  }
  console.log('Package templates ensured:', templates.length);

  // =====================================================================
  // B) CUSTOMER PACKAGES (~10 bought, some with usages consumed)
  // =====================================================================
  // Assign templates round-robin to the first 10 staging customers.
  const PKG_COUNT = 10;
  let packagesCreated = 0;
  for (let i = 1; i <= PKG_COUNT; i++) {
    const legacyId = `pkg-${i}`;
    const customer = customers[i - 1];
    const { id: templateId, def } = templates[(i - 1) % templates.length];

    // Bought between 60 days ago and 5 days ago.
    const boughtOffset = -randInt(5, 60);
    const boughtAt = addDays(TODAY, boughtOffset);
    const expiresAt = addDays(boughtAt, def.validityDays);
    const expired = expiresAt < TODAY;

    // Total sessions across all items.
    const totalSessions = def.items.reduce((acc, it) => acc + it.sessions, 0);

    // Decide how many sessions already used: ~half the packages have usage.
    const useSome = i % 2 === 0;
    let usedGlobal = useSome ? randInt(1, Math.max(1, totalSessions - 1)) : 0;
    const allUsed = usedGlobal >= totalSessions;

    const status: PackageStatus = expired
      ? PackageStatus.expired
      : allUsed
        ? PackageStatus.finished
        : PackageStatus.active;

    // Upsert the package on stable legacy key.
    const pkg = await prisma.customerPackage.upsert({
      where: { companyId_legacyId: { companyId, legacyId } },
      update: {
        customerId: customer.id,
        templateId,
        price: def.price,
        status,
        expiresAt,
      },
      create: {
        companyId,
        customerId: customer.id,
        templateId,
        number: 500 + i, // stable staging number range
        price: def.price,
        status,
        expiresAt,
        legacyId,
        legacySource: SOURCE,
      },
    });

    // Rebuild items + usages deterministically.
    const existingItems = await prisma.customerPackageItem.findMany({
      where: { customerPackageId: pkg.id },
      select: { id: true },
    });
    if (existingItems.length) {
      await prisma.packageUsage.deleteMany({
        where: { customerPackageItemId: { in: existingItems.map((e) => e.id) } },
      });
      await prisma.customerPackageItem.deleteMany({ where: { customerPackageId: pkg.id } });
    }

    // Distribute usedGlobal sessions across items in order.
    for (const it of def.items) {
      const usedHere = Math.min(usedGlobal, it.sessions);
      usedGlobal -= usedHere;
      const item = await prisma.customerPackageItem.create({
        data: {
          customerPackageId: pkg.id,
          serviceId: svc(it.service).id,
          sessionsTotal: it.sessions,
          sessionsUsed: usedHere,
        },
      });
      // Register PackageUsage rows for the consumed sessions.
      for (let u = 0; u < usedHere; u++) {
        await prisma.packageUsage.create({
          data: {
            customerPackageItemId: item.id,
            usedAt: addDays(boughtAt, randInt(1, Math.max(1, -boughtOffset - 1))),
          },
        });
      }
    }
    packagesCreated++;
  }
  console.log('Customer packages ensured:', packagesCreated);

  // =====================================================================
  // C) MEMBERSHIP PLANS (~4 recurring subscription plans)
  // =====================================================================
  const planDefs: {
    name: string;
    recurringPrice: number;
    intervalMonths: number;
    services: { service: string; quantityPerCycle: number }[];
  }[] = [
    {
      name: 'Clube Beleza',
      recurringPrice: 149.9,
      intervalMonths: 1,
      services: [
        { service: 'Escova', quantityPerCycle: 4 },
        { service: 'Hidratação', quantityPerCycle: 1 },
      ],
    },
    {
      name: 'Clube Unhas',
      recurringPrice: 99.9,
      intervalMonths: 1,
      services: [
        { service: 'Manicure', quantityPerCycle: 2 },
        { service: 'Pedicure', quantityPerCycle: 2 },
      ],
    },
    {
      name: 'Clube Barba & Cabelo',
      recurringPrice: 119.9,
      intervalMonths: 1,
      services: [
        { service: 'Corte Masculino', quantityPerCycle: 2 },
        { service: 'Barba', quantityPerCycle: 2 },
      ],
    },
    {
      name: 'Clube Premium Trimestral',
      recurringPrice: 399.9,
      intervalMonths: 3,
      services: [
        { service: 'Corte Feminino', quantityPerCycle: 3 },
        { service: 'Escova', quantityPerCycle: 6 },
        { service: 'Coloração', quantityPerCycle: 1 },
      ],
    },
  ];

  const plans: { id: string; def: (typeof planDefs)[number] }[] = [];
  for (const def of planDefs) {
    let plan = await prisma.membershipPlan.findFirst({ where: { companyId, name: def.name } });
    if (!plan) {
      plan = await prisma.membershipPlan.create({
        data: {
          companyId,
          name: def.name,
          recurringPrice: def.recurringPrice,
          intervalMonths: def.intervalMonths,
          active: true,
        },
      });
    } else {
      plan = await prisma.membershipPlan.update({
        where: { id: plan.id },
        data: {
          recurringPrice: def.recurringPrice,
          intervalMonths: def.intervalMonths,
          active: true,
        },
      });
    }
    // Rebuild the service grid (PK [membershipPlanId, serviceId]).
    await prisma.membershipService.deleteMany({ where: { membershipPlanId: plan.id } });
    for (const s of def.services) {
      const service = svc(s.service);
      await prisma.membershipService.create({
        data: {
          membershipPlanId: plan.id,
          serviceId: service.id,
          quantityPerCycle: s.quantityPerCycle,
          unitPrice: service.price,
          discount: 0,
          quantity: s.quantityPerCycle,
        },
      });
    }
    plans.push({ id: plan.id, def });
  }
  console.log('Membership plans ensured:', plans.length);

  // =====================================================================
  // D) CUSTOMER MEMBERSHIPS (~12 active subscribers, some with payments)
  // =====================================================================
  // Use customers offset so subscribers differ from package buyers where possible.
  const MEMB_COUNT = 12;
  let membershipsCreated = 0;
  for (let i = 1; i <= MEMB_COUNT; i++) {
    // Offset by 10 to lean on different customers than package buyers, wrap around.
    const customer = customers[(i + 9) % customers.length];
    const { id: membershipPlanId, def } = plans[(i - 1) % plans.length];

    // Status distribution: mostly active, a couple overdue, one canceled.
    let status: MembershipStatus = MembershipStatus.active;
    if (i % 6 === 0) status = MembershipStatus.canceled;
    else if (i % 5 === 0) status = MembershipStatus.overdue;

    // Subscribed some months ago.
    const monthsAgo = randInt(1, 6);
    const startedAt = addDays(TODAY, -monthsAgo * 30);
    // Next due date: for active/overdue in near future/past, none for canceled.
    let nextDueDate: Date | null;
    if (status === MembershipStatus.canceled) {
      nextDueDate = null;
    } else if (status === MembershipStatus.overdue) {
      nextDueDate = addDays(TODAY, -randInt(3, 20)); // past due
    } else {
      nextDueDate = addDays(TODAY, randInt(3, 25)); // upcoming
    }

    // Idempotent by (companyId, customerId, membershipPlanId).
    let membership = await prisma.customerMembership.findFirst({
      where: { companyId, customerId: customer.id, membershipPlanId },
    });
    if (!membership) {
      membership = await prisma.customerMembership.create({
        data: {
          companyId,
          customerId: customer.id,
          membershipPlanId,
          status,
          nextDueDate,
          createdAt: startedAt,
        },
      });
    } else {
      membership = await prisma.customerMembership.update({
        where: { id: membership.id },
        data: { status, nextDueDate },
      });
    }

    // Rebuild payment history: one payment per elapsed cycle.
    await prisma.membershipPayment.deleteMany({
      where: { customerMembershipId: membership.id },
    });
    const cycleDays = def.intervalMonths * 30;
    const cyclesElapsed = Math.max(1, Math.floor((monthsAgo * 30) / cycleDays));
    for (let c = 0; c < cyclesElapsed; c++) {
      const dueDate = addDays(startedAt, c * cycleDays);
      const isLast = c === cyclesElapsed - 1;
      // Past cycles paid; the last one may be pending/overdue.
      let payStatus: PaymentStatus;
      let paidAt: Date | null;
      if (!isLast) {
        payStatus = PaymentStatus.paid;
        paidAt = addDays(dueDate, randInt(0, 3));
      } else if (status === MembershipStatus.overdue) {
        payStatus = PaymentStatus.pending;
        paidAt = null;
      } else if (status === MembershipStatus.canceled) {
        payStatus = PaymentStatus.paid;
        paidAt = addDays(dueDate, randInt(0, 3));
      } else {
        payStatus = PaymentStatus.paid;
        paidAt = addDays(dueDate, randInt(0, 3));
      }
      await prisma.membershipPayment.create({
        data: {
          customerMembershipId: membership.id,
          amount: def.recurringPrice,
          dueDate,
          paidAt,
          status: payStatus,
        },
      });
    }
    membershipsCreated++;
  }
  console.log('Customer memberships ensured:', membershipsCreated);

  console.log('STAGING seed (PACOTES & ASSINATURAS) done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
