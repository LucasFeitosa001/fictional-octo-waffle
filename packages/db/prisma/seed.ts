import { PrismaClient } from '@prisma/client';
import { PLANS, DEV_DEFAULT_PLAN, LEGACY_PLAN_MAP } from './plan-catalog';
import { seedPermissions, seedCompanyRoles } from '../src/rbac';

const prisma = new PrismaClient();

/**
 * FASE 2 — paid modules. Idempotently:
 *   1. Upserts the starter/pro/max plans (with their featuresJson). `Plan.name`
 *      is unique, so re-runs update prices/features in place.
 *   2. Re-points every Subscription that still references an OLD plan
 *      (free/basic/pro/premium) to its new equivalent (premium→max, pro→pro,
 *      basic→pro, free→starter) so no subscription is left orphaned on a plan
 *      that is no longer part of the catalog.
 *   3. Guarantees EVERY company has a Subscription. Companies without one are put
 *      on a generous max/trialing plan (DEV default) so the dev app keeps all
 *      features unlocked. Existing subscriptions keep their (re-mapped) plan.
 *
 * Old Plan rows (free/basic/premium) are intentionally NOT deleted — we only stop
 * referencing them, which keeps the migration reversible and avoids touching FK
 * history. No other entity data is modified.
 *
 * Safe to re-run.
 */
async function seedPlansAndSubscriptions() {
  // 1. Upsert the new canonical plans.
  const plansByName = new Map<string, { id: string }>();
  for (const plan of PLANS) {
    const row = await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        priceMonthly: plan.priceMonthly,
        featuresJson: plan.features,
      },
      create: {
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        featuresJson: plan.features,
      },
    });
    plansByName.set(plan.name, row);
  }

  const defaultPlan = plansByName.get(DEV_DEFAULT_PLAN);
  if (!defaultPlan) throw new Error(`Default plan "${DEV_DEFAULT_PLAN}" missing`);

  // 2. Re-point subscriptions that reference an old plan whose name is not one of
  //    the new canonical names. `pro` maps to itself (same row), so those are
  //    already correct and skipped. Only free/basic/premium need moving.
  const newNames = new Set(PLANS.map((p) => p.name as string));
  const legacyPlans = await prisma.plan.findMany({
    where: { name: { notIn: [...newNames] } },
    select: { id: true, name: true },
  });
  let repointed = 0;
  for (const legacy of legacyPlans) {
    const targetName = LEGACY_PLAN_MAP[legacy.name] ?? DEV_DEFAULT_PLAN;
    const target = plansByName.get(targetName);
    if (!target || target.id === legacy.id) continue;
    const res = await prisma.subscription.updateMany({
      where: { planId: legacy.id },
      data: { planId: target.id },
    });
    repointed += res.count;
  }

  // 3. Every company must have a subscription; missing ones get the dev default.
  const companies = await prisma.company.findMany({ select: { id: true } });
  let created = 0;
  for (const company of companies) {
    const existing = await prisma.subscription.findFirst({
      where: { companyId: company.id },
    });
    if (existing) continue;
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        planId: defaultPlan.id,
        status: 'trialing',
      },
    });
    created += 1;
  }

  console.log(
    `Plans ensured (${PLANS.length}); ${repointed} subscription(s) re-pointed from legacy plans; ` +
      `subscriptions created for ${created}/${companies.length} companies (default: ${DEV_DEFAULT_PLAN}).`,
  );
}

/**
 * RBAC — semeia o catálogo de permissões (global) e os 5 papéis padrão
 * (isSystem) para TODAS as empresas existentes. Idempotente.
 *
 * Antes de criar os papéis, reconcilia qualquer Role legada 'Administrador'
 * (do fluxo antigo) para o papel canônico 'owner': reaproveita a linha
 * renomeando-a (code='owner', isSystem=true) em vez de criar uma segunda,
 * para não perder as UserCompany já ligadas a ela. O upsert de seedCompanyRoles
 * então só a atualiza.
 */
async function seedRbac() {
  const permByKey = await seedPermissions(prisma);

  const companies = await prisma.company.findMany({ select: { id: true } });
  for (const company of companies) {
    // Reaproveita a Role 'Administrador' legada como 'owner' (se ainda não houver
    // uma role com code='owner' na empresa), preservando suas UserCompany.
    const owner = await prisma.role.findFirst({
      where: { companyId: company.id, code: 'owner' },
      select: { id: true },
    });
    if (!owner) {
      const legacyAdmin = await prisma.role.findFirst({
        where: { companyId: company.id, name: 'Administrador' },
        select: { id: true },
      });
      if (legacyAdmin) {
        await prisma.role.update({
          where: { id: legacyAdmin.id },
          data: { code: 'owner', name: 'Proprietario(a)', isSystem: true },
        });
      }
    }

    await seedCompanyRoles(prisma, company.id, permByKey);
  }

  console.log(
    `RBAC ensured: ${Object.keys(permByKey ? Object.fromEntries(permByKey) : {}).length} permissions, ` +
      `default roles for ${companies.length} company(ies).`,
  );
}

/**
 * Idempotent seed. Domain data is created via upserts so re-running is safe.
 *
 * NOTE on the admin login: credentials are owned by Better Auth (stored hashed
 * in the `Account` table), NOT in `User.passwordHash`. This seed creates the
 * company + admin USER row and links it. The working Better Auth credential
 * (admin@beautypass.dev / beautypass123) is created by the API script:
 *   pnpm --filter @beautypass/api seed:admin
 * which calls Better Auth's signUpEmail and then links the user to this company.
 */
const ADMIN_EMAIL = 'admin@beautypass.dev';

/**
 * Garante ~4 profissionais na empresa informada. Idempotente: procura por
 * (companyId, name) e só cria os que faltam. Não recria/atualiza os existentes
 * (preserva edições feitas na UI). Nomes pt-BR, com phone e profession.
 */
async function ensureProfessionals(companyId: string) {
  const seedPros: { name: string; profession: string; phone: string }[] = [
    { name: 'Marina Silva', profession: 'Cabeleireira', phone: '+5511990000001' },
    { name: 'Júlia Costa', profession: 'Colorista', phone: '+5511990000002' },
    { name: 'Beatriz Almeida', profession: 'Manicure', phone: '+5511990000003' },
    { name: 'Camila Rodrigues', profession: 'Esteticista', phone: '+5511990000004' },
  ];

  let created = 0;
  for (const p of seedPros) {
    const existing = await prisma.professional.findFirst({
      where: { companyId, name: p.name, deletedAt: null },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.professional.create({
      data: {
        companyId,
        name: p.name,
        profession: p.profession,
        phone: p.phone,
      },
    });
    created += 1;
  }

  const total = await prisma.professional.count({ where: { companyId, deletedAt: null } });
  console.log(`Professionals ensured: +${created} created, ${total} total in company ${companyId}.`);
}

async function main() {
  console.log('Seeding Beautypass...');

  let company = await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'Salão Beautypass',
        legalName: 'Beautypass Beleza LTDA',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
      },
    });
  }

  // RBAC: catálogo de permissões + 5 papéis padrão (isSystem) para todas as
  // empresas (inclui a recém-criada acima). Reaproveita a Role 'Administrador'
  // legada como 'owner'. Roda antes de ligar o admin para a role owner existir.
  await seedRbac();

  const ownerRole = await prisma.role.findFirstOrThrow({
    where: { companyId: company.id, code: 'owner' },
    select: { id: true },
  });

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { companyId: company.id },
    create: {
      companyId: company.id,
      name: 'Bela Admin',
      email: ADMIN_EMAIL,
      provider: 'local',
      userCompanies: {
        create: { companyId: company.id, roleId: ownerRole.id },
      },
    },
  });

  // Garante que a UserCompany do admin (mesmo pré-existente) aponte para 'owner',
  // preservando acesso total ao login admin@beautypass.dev.
  await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: admin.id, companyId: company.id } },
    update: { roleId: ownerRole.id },
    create: { userId: admin.id, companyId: company.id, roleId: ownerRole.id },
  });

  // FASE 2: plans + a subscription for every company (runs before the demo-data
  // guard below so it also applies to already-seeded / production databases).
  await seedPlansAndSubscriptions();

  // Profissionais base da empresa principal (para a página de Permissões por
  // funcionário ter conteúdo). Idempotente por nome — roda SEMPRE, inclusive em
  // bancos já semeados (fora do guard de demo-data abaixo). ~4 profissionais.
  await ensureProfessionals(company.id);

  // Domain demo data: only create once (idempotent re-seed guard).
  const existingServices = await prisma.service.count({ where: { companyId: company.id } });
  if (existingServices > 0) {
    console.log('Seed done (admin ensured; demo data already present):', {
      company: company.id,
      admin: admin.email,
    });
    return;
  }

  const category = await prisma.serviceCategory.create({
    data: { companyId: company.id, name: 'Cabelo', displayOrder: 0 },
  });

  const services = await Promise.all(
    [
      { name: 'Corte Feminino', price: 80, durationMin: 60 },
      { name: 'Escova', price: 50, durationMin: 45 },
      { name: 'Coloração', price: 180, durationMin: 120 },
    ].map((s) =>
      prisma.service.create({
        data: {
          companyId: company.id,
          categoryId: category.id,
          name: s.name,
          price: s.price,
          durationMin: s.durationMin,
        },
      }),
    ),
  );

  // Profissionais já foram criados por ensureProfessionals (idempotente, roda
  // acima). Aqui apenas anexamos horários e serviços aos que existem — só na
  // primeira vez (guard existingServices > 0 acima já garante isso).
  const professionals = await prisma.professional.findMany({
    where: { companyId: company.id, deletedAt: null },
    select: { id: true },
  });
  for (const pro of professionals) {
    await prisma.professionalSchedule.createMany({
      data: [1, 2, 3, 4, 5].map((weekday) => ({
        professionalId: pro.id,
        weekday,
        startTime: '09:00',
        endTime: '18:00',
      })),
    });
    await prisma.professionalService.createMany({
      data: services.map((svc) => ({ professionalId: pro.id, serviceId: svc.id })),
      skipDuplicates: true,
    });
  }

  await prisma.customer.create({
    data: {
      companyId: company.id,
      name: 'Cliente Exemplo',
      phone: '+5511999999999',
      email: 'cliente@example.com',
    },
  });

  await prisma.bookingLink.create({
    data: { companyId: company.id, slug: 'salao-dona-bela', active: true },
  });

  await prisma.financialAccount.create({
    data: { companyId: company.id, name: 'Caixa', type: 'cash' },
  });

  await prisma.paymentMethod.createMany({
    data: [
      { companyId: company.id, name: 'Dinheiro', goesToCash: true },
      { companyId: company.id, name: 'Pix' },
      { companyId: company.id, name: 'Cartão de Crédito', feePercent: 3.5, settlementDays: 30 },
    ],
  });

  console.log('Seed done:', {
    company: company.id,
    admin: admin.email,
    services: services.length,
    professionals: professionals.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
