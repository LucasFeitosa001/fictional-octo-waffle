import { PrismaClient, AppointmentStatus, AppointmentSource } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Staging seed — realistic demo data to fill ~3 pages of listings (65 clients,
 * ~55 appointments), plus supporting services/professionals/products.
 *
 * IDEMPOTENT: every domain row is tagged with `legacySource = 'staging'` and a
 * stable `legacyId`. The schema has @@unique([companyId, legacyId]) on Customer,
 * Professional, Service, Product and Appointment, so we upsert on that key and
 * re-running never duplicates.
 */
const SOURCE = 'staging';

// Deterministic PRNG so re-runs produce the same data.
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const rand = makeRng(20260721);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const FIRST_NAMES = [
  'Ana', 'Beatriz', 'Camila', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena',
  'Isabela', 'Juliana', 'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Renata', 'Sabrina',
  'Tatiana', 'Vanessa', 'Amanda', 'Bianca', 'Carla', 'Débora', 'Elaine', 'Flávia',
  'Bruno', 'Carlos', 'Diego', 'Felipe', 'Gustavo', 'Henrique', 'João', 'Lucas',
  'Marcelo', 'Rafael', 'Rodrigo', 'Thiago', 'André', 'Pedro', 'Vinícius', 'Wesley',
];
const LAST_NAMES = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
  'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes',
  'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade',
  'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos',
];

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '');

async function main() {
  console.log('Seeding STAGING data...');

  // 1) Reuse existing company.
  const company =
    (await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error('No company found. Run the base seed first.');
  console.log('Using company:', company.id, company.name);
  const companyId = company.id;

  // 2) Services (variados). Reuse existing by name; create missing. Tagged staging
  //    only for the ones we create so we do not clobber base-seed services.
  const category =
    (await prisma.productCategory.findFirst({ where: { companyId, name: 'Cabelo' } })) ??
    (await prisma.productCategory.create({
      data: { companyId, name: 'Cabelo' },
    }));

  const serviceDefs = [
    { name: 'Corte Feminino', price: 80, durationMin: 60 },
    { name: 'Corte Masculino', price: 50, durationMin: 40 },
    { name: 'Escova', price: 50, durationMin: 45 },
    { name: 'Coloração', price: 180, durationMin: 120 },
    { name: 'Luzes', price: 250, durationMin: 150 },
    { name: 'Hidratação', price: 90, durationMin: 60 },
    { name: 'Progressiva', price: 220, durationMin: 150 },
    { name: 'Barba', price: 40, durationMin: 30 },
    { name: 'Manicure', price: 45, durationMin: 45 },
    { name: 'Pedicure', price: 55, durationMin: 50 },
  ];

  const services = [];
  for (const def of serviceDefs) {
    let svc = await prisma.service.findFirst({ where: { companyId, name: def.name } });
    if (!svc) {
      svc = await prisma.service.create({
        data: {
          companyId,
          categoryId: category.id,
          name: def.name,
          price: def.price,
          durationMin: def.durationMin,
          legacyId: `svc-${slugify(def.name)}`,
          legacySource: SOURCE,
        },
      });
    }
    services.push(svc);
  }
  console.log('Services ensured:', services.length);

  // 3) Professionals (~6 novos). Idempotent via legacyId.
  const proDefs = [
    { name: 'Camila Ferreira', profession: 'Cabeleireira' },
    { name: 'Rafael Nunes', profession: 'Barbeiro' },
    { name: 'Aline Ribeiro', profession: 'Manicure' },
    { name: 'Patrícia Gomes', profession: 'Colorista' },
    { name: 'Bruno Almeida', profession: 'Cabeleireiro' },
    { name: 'Fernanda Rocha', profession: 'Esteticista' },
  ];
  const professionals = [];
  for (let i = 0; i < proDefs.length; i++) {
    const def = proDefs[i];
    const legacyId = `pro-${i + 1}`;
    const pro = await prisma.professional.upsert({
      where: { companyId_legacyId: { companyId, legacyId } },
      update: { profession: def.profession },
      create: {
        companyId,
        name: def.name,
        profession: def.profession,
        legacyId,
        legacySource: SOURCE,
        schedules: {
          create: [1, 2, 3, 4, 5, 6].map((weekday) => ({
            weekday,
            startTime: '09:00',
            endTime: '19:00',
          })),
        },
        services: { create: services.map((svc) => ({ serviceId: svc.id })) },
      },
    });
    professionals.push(pro);
  }
  // Include any pre-existing professionals so appointments can reference them too.
  const allProfessionals = await prisma.professional.findMany({ where: { companyId } });
  console.log('Professionals ensured (staging):', professionals.length, '| total:', allProfessionals.length);

  // 4) Customers (~65). Idempotent via legacyId `cust-N`.
  const TOTAL_CUSTOMERS = 65;
  const customers = [];
  for (let i = 1; i <= TOTAL_CUSTOMERS; i++) {
    const first = FIRST_NAMES[(i * 7) % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 13) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const legacyId = `cust-${i}`;
    // Unique phone: (11) 9XXXX-XXXX, derived from index to stay unique + stable.
    const block = 90000 + (i * 137) % 10000; // 90000..99999
    const suffix = 1000 + (i * 613) % 9000; // 1000..9999
    const phone = `+5511${block}${suffix}`;
    const email = `${slugify(name)}${i}@staging.local`;
    // ~15% inactive.
    const active = i % 7 !== 0;
    // ~40% have a birthday.
    const hasBirthday = i % 5 < 2;
    const birthday = hasBirthday
      ? new Date(Date.UTC(1970 + randInt(0, 35), randInt(0, 11), randInt(1, 28)))
      : null;

    const cust = await prisma.customer.upsert({
      where: { companyId_legacyId: { companyId, legacyId } },
      update: { active },
      create: {
        companyId,
        name,
        phone,
        email,
        birthday,
        active,
        legacyId,
        legacySource: SOURCE,
      },
    });
    customers.push(cust);
  }
  const activeCustomers = customers.filter((c) => c.active);
  console.log('Customers ensured:', customers.length, '| active:', activeCustomers.length);

  // 5) Appointments (~55). Spread across past / today / next days of July 2026.
  const statuses: AppointmentStatus[] = [
    AppointmentStatus.scheduled,
    AppointmentStatus.confirmed,
    AppointmentStatus.unconfirmed,
    AppointmentStatus.waiting,
    AppointmentStatus.in_progress,
    AppointmentStatus.done,
    AppointmentStatus.finished,
    AppointmentStatus.canceled,
  ];
  const TOTAL_APPTS = 55;
  const TODAY = new Date('2026-07-22T00:00:00-03:00');
  const hoursStart = [9, 10, 11, 13, 14, 15, 16, 17, 18];

  let appointmentsCreated = 0;
  for (let i = 1; i <= TOTAL_APPTS; i++) {
    const legacyId = `appt-${i}`;
    const customer = pick(activeCustomers);
    const service = pick(services);
    const professional = pick(allProfessionals);

    // Day offset: ~-20 .. +12 days around today, biased so past ones are done/finished.
    const dayOffset = randInt(-20, 12);
    const hour = pick(hoursStart);
    const minute = pick([0, 15, 30, 45]);
    const start = new Date(TODAY);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(hour, minute, 0, 0);
    const end = new Date(start.getTime() + service.durationMin * 60_000);

    let status: AppointmentStatus;
    if (dayOffset < -1) {
      // Past: mostly completed, some canceled.
      status = pick([
        AppointmentStatus.finished,
        AppointmentStatus.finished,
        AppointmentStatus.done,
        AppointmentStatus.canceled,
      ]);
    } else if (dayOffset <= 0) {
      // Today / yesterday: in-progress / waiting / confirmed.
      status = pick([
        AppointmentStatus.in_progress,
        AppointmentStatus.waiting,
        AppointmentStatus.confirmed,
        AppointmentStatus.done,
      ]);
    } else {
      // Future: scheduled / confirmed / unconfirmed.
      status = pick([
        AppointmentStatus.scheduled,
        AppointmentStatus.confirmed,
        AppointmentStatus.unconfirmed,
      ]);
    }

    const source = rand() < 0.3 ? AppointmentSource.online : AppointmentSource.admin;

    await prisma.appointment.upsert({
      where: { companyId_legacyId: { companyId, legacyId } },
      update: { status, start, end, customerId: customer.id, professionalId: professional.id },
      create: {
        companyId,
        customerId: customer.id,
        professionalId: professional.id,
        status,
        source,
        start,
        end,
        legacyId,
        legacySource: SOURCE,
        items: {
          create: {
            serviceId: service.id,
            professionalId: professional.id,
            durationMin: service.durationMin,
            price: service.price,
          },
        },
      },
    });
    appointmentsCreated++;
  }
  console.log('Appointments ensured:', appointmentsCreated);

  // 6) Products (rápido). Idempotent via legacyId.
  const productDefs = [
    { name: 'Shampoo Hidratante 300ml', salePrice: 45, costPrice: 22, stock: 30 },
    { name: 'Condicionador 300ml', salePrice: 42, costPrice: 20, stock: 25 },
    { name: 'Máscara Capilar 250g', salePrice: 68, costPrice: 35, stock: 18 },
    { name: 'Óleo de Argan 60ml', salePrice: 85, costPrice: 40, stock: 12 },
    { name: 'Esmalte Vermelho', salePrice: 12, costPrice: 5, stock: 50 },
    { name: 'Removedor de Esmalte 100ml', salePrice: 15, costPrice: 6, stock: 40 },
  ];
  let productsCreated = 0;
  for (let i = 0; i < productDefs.length; i++) {
    const def = productDefs[i];
    const legacyId = `prod-${i + 1}`;
    await prisma.product.upsert({
      where: { companyId_legacyId: { companyId, legacyId } },
      update: { salePrice: def.salePrice },
      create: {
        companyId,
        name: def.name,
        salePrice: def.salePrice,
        costPrice: def.costPrice,
        stock: def.stock,
        trackStock: true,
        legacyId,
        legacySource: SOURCE,
      },
    });
    productsCreated++;
  }
  console.log('Products ensured:', productsCreated);

  console.log('STAGING seed done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
