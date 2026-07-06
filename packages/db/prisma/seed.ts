import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  let role = await prisma.role.findFirst({
    where: { companyId: company.id, name: 'Administrador' },
  });
  if (!role) {
    role = await prisma.role.create({
      data: { companyId: company.id, name: 'Administrador' },
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { companyId: company.id },
    create: {
      companyId: company.id,
      name: 'Bela Admin',
      email: ADMIN_EMAIL,
      provider: 'local',
      userCompanies: {
        create: { companyId: company.id, roleId: role.id },
      },
    },
  });

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

  const professionals = await Promise.all(
    [
      { name: 'Marina Silva', profession: 'Cabeleireira' },
      { name: 'Júlia Costa', profession: 'Colorista' },
    ].map((p) =>
      prisma.professional.create({
        data: {
          companyId: company.id,
          name: p.name,
          profession: p.profession,
          schedules: {
            create: [1, 2, 3, 4, 5].map((weekday) => ({
              weekday,
              startTime: '09:00',
              endTime: '18:00',
            })),
          },
          services: {
            create: services.map((svc) => ({ serviceId: svc.id })),
          },
        },
      }),
    ),
  );

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
