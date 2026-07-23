import { PrismaClient, CashRegisterStatus, CashMovementType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Staging seed — CAIXA (cash register) demo data to fill the "Histórico de caixa"
 * page. Extends the main staging seed (seed-staging.ts) with CashRegister +
 * CashMovement rows for July 2026.
 *
 * IDEMPOTENT:
 *   - CashRegister has @@unique([companyId, number]); we upsert on that key using
 *     a stable staging `number` range (101..112). Re-running never duplicates.
 *   - CashMovement has no unique/legacy key, so before (re)seeding movements we
 *     delete all movements belonging to the staging registers (numbers 101..112)
 *     and recreate them. Deterministic PRNG keeps values stable across re-runs.
 *
 * ENUM VALUES (verified against schema.prisma):
 *   - CashRegisterStatus: open | closed
 *   - CashMovementType:   in  | out   (só 2 valores — sangria=out, suprimento=in,
 *                          diferenciados pela `description`)
 *
 * NOTE: responsibleUserId / closedByUserId reference the User model (not
 * Professional). We use the existing admin User as responsible/closer.
 * PaymentMethod table is empty in staging, so movements leave paymentMethodId null.
 */
const STAGING_NUMBER_BASE = 100; // staging registers get numbers 101..112

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
const money = (min: number, max: number) => Math.round((rand() * (max - min) + min) * 100) / 100;

// July 2026, Brazil time (-03:00). Register N opens on day = base + offset.
const dateAt = (day: number, hour: number, minute = 0) =>
  new Date(`2026-07-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`);

type MovementDef = {
  type: CashMovementType;
  amount: number;
  description: string;
  minutesAfterOpen: number;
};

async function main() {
  console.log('Seeding STAGING CAIXA data...');

  // 1) Reuse existing company.
  const company =
    (await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error('No company found. Run the base seed first.');
  const companyId = company.id;
  console.log('Using company:', companyId, company.name);

  // 2) Responsible/closer users. CashRegister.responsibleUserId & closedByUserId
  //    reference the User model. Use whatever Users the company has (at least the
  //    admin). We never invent Users here.
  const users = await prisma.user.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
  if (users.length === 0) throw new Error('No users found for company. Run the base seed first.');
  console.log('Users available for caixa responsible:', users.length);

  // 3) Register definitions across July 2026. `day` = opening day.
  //    Most are closed (with closing date + counted balance); the last 2 stay open.
  const registerDefs: Array<{
    day: number;
    openHour: number;
    openingBalance: number;
    closeHour: number | null; // null => still open
  }> = [
    { day: 1, openHour: 8, openingBalance: 200, closeHour: 20 },
    { day: 2, openHour: 8, openingBalance: 200, closeHour: 20 },
    { day: 3, openHour: 8, openingBalance: 250, closeHour: 20 },
    { day: 6, openHour: 8, openingBalance: 200, closeHour: 19 },
    { day: 7, openHour: 8, openingBalance: 200, closeHour: 20 },
    { day: 8, openHour: 8, openingBalance: 300, closeHour: 20 },
    { day: 9, openHour: 8, openingBalance: 200, closeHour: 20 },
    { day: 10, openHour: 8, openingBalance: 250, closeHour: 20 },
    { day: 13, openHour: 8, openingBalance: 200, closeHour: 20 },
    { day: 14, openHour: 8, openingBalance: 200, closeHour: 20 },
    // Still-open registers (today-ish, no closing):
    { day: 20, openHour: 8, openingBalance: 250, closeHour: null },
    { day: 21, openHour: 8, openingBalance: 200, closeHour: null },
  ];

  let registersCreated = 0;
  let movementsCreated = 0;

  for (let i = 0; i < registerDefs.length; i++) {
    const def = registerDefs[i];
    const number = STAGING_NUMBER_BASE + i + 1; // 101..112
    const responsibleUser = users[i % users.length];
    const openedAt = dateAt(def.day, def.openHour, 0);
    const isClosed = def.closeHour !== null;

    // 3a) Build the day's movements first so we can compute an expected balance.
    const movements: MovementDef[] = [];

    // Suprimento inicial (troco reforçado) em alguns caixas — entrada.
    if (rand() < 0.4) {
      movements.push({
        type: CashMovementType.in,
        amount: money(50, 150),
        description: 'Suprimento de troco',
        minutesAfterOpen: 15,
      });
    }

    // Vendas do dia (entradas) — 5 a 10.
    const salesCount = randInt(5, 10);
    const saleDescriptions = [
      'Venda — serviço de cabelo',
      'Venda — manicure',
      'Venda — coloração',
      'Venda — pacote combo',
      'Venda — produtos (shampoo/condicionador)',
      'Venda — barba',
      'Venda — escova + hidratação',
      'Venda — progressiva',
    ];
    for (let s = 0; s < salesCount; s++) {
      movements.push({
        type: CashMovementType.in,
        amount: money(40, 260),
        description: pick(saleDescriptions),
        minutesAfterOpen: randInt(30, 600),
      });
    }

    // Saídas (despesas do dia) — 1 a 3.
    const expenseCount = randInt(1, 3);
    const expenseDescriptions = [
      'Compra de material — descartáveis',
      'Pagamento entregador (delivery de insumos)',
      'Lanche da equipe',
      'Compra de água/café',
      'Reposição de esmaltes',
    ];
    for (let e = 0; e < expenseCount; e++) {
      movements.push({
        type: CashMovementType.out,
        amount: money(15, 90),
        description: pick(expenseDescriptions),
        minutesAfterOpen: randInt(60, 600),
      });
    }

    // Sangria (retirada de excesso para o cofre/banco) — na maioria dos caixas fechados.
    if (isClosed && rand() < 0.7) {
      movements.push({
        type: CashMovementType.out,
        amount: money(200, 500),
        description: 'Sangria — depósito bancário',
        minutesAfterOpen: randInt(300, 620),
      });
    }

    // 3b) Compute expected balance = opening + sum(in) - sum(out).
    const sumIn = movements.filter((m) => m.type === CashMovementType.in).reduce((a, m) => a + m.amount, 0);
    const sumOut = movements.filter((m) => m.type === CashMovementType.out).reduce((a, m) => a + m.amount, 0);
    const expected = Math.round((def.openingBalance + sumIn - sumOut) * 100) / 100;

    // Closed register fields: counted balance is expected ± small divergence.
    let closedAt: Date | null = null;
    let countedBalance: number | null = null;
    let expectedBalance: number | null = null;
    let divergence: number | null = null;
    let closedByUserId: string | null = null;
    let status: CashRegisterStatus = CashRegisterStatus.open;

    if (isClosed) {
      closedAt = dateAt(def.day, def.closeHour as number, 30);
      expectedBalance = expected;
      // ~70% conferem exato, ~30% têm pequena divergência (troco/erro de caixa).
      const div = rand() < 0.7 ? 0 : Math.round((rand() * 20 - 10) * 100) / 100; // -10..+10
      countedBalance = Math.round((expected + div) * 100) / 100;
      divergence = Math.round((countedBalance - expected) * 100) / 100;
      closedByUserId = responsibleUser.id;
      status = CashRegisterStatus.closed;
    }

    // 3c) Upsert the register on the unique (companyId, number).
    const register = await prisma.cashRegister.upsert({
      where: { companyId_number: { companyId, number } },
      update: {
        responsibleUserId: responsibleUser.id,
        openingBalance: def.openingBalance,
        countedBalance,
        expectedBalance,
        divergence,
        closedByUserId,
        openedAt,
        closedAt,
        status,
      },
      create: {
        companyId,
        number,
        responsibleUserId: responsibleUser.id,
        openingBalance: def.openingBalance,
        countedBalance,
        expectedBalance,
        divergence,
        closedByUserId,
        openedAt,
        closedAt,
        status,
      },
    });
    registersCreated++;

    // 3d) Idempotent movements: wipe this register's movements, then recreate.
    await prisma.cashMovement.deleteMany({ where: { cashRegisterId: register.id } });
    for (const m of movements) {
      await prisma.cashMovement.create({
        data: {
          cashRegisterId: register.id,
          type: m.type,
          amount: m.amount,
          description: m.description,
          at: new Date(openedAt.getTime() + m.minutesAfterOpen * 60_000),
        },
      });
      movementsCreated++;
    }
  }

  console.log('CashRegisters ensured:', registersCreated);
  console.log('CashMovements ensured:', movementsCreated);
  console.log('STAGING CAIXA seed done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
