import { PrismaClient, AppointmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Staging seed — DETALHES de cliente + FILIAIS.
 *
 * Enriquece o perfil do cliente (débitos, créditos, dependentes, redes sociais,
 * arquivos) e a página de filiais/config (Branch). Complementa seed-staging.ts.
 *
 * IDEMPOTENTE: as tabelas-alvo (CustomerDebt, CustomerCredit, CustomerDependent,
 * CustomerSocialProfile, CustomerFile, AppointmentStatusHistory, Branch) NÃO têm
 * `legacyId`/`legacySource` no schema. Então o padrão idempotente aqui é
 * "delete-then-recreate" restrito ao escopo staging:
 *   - dados de cliente: deleteMany filtrado pelos customerIds staging desta company;
 *   - histórico de status: deleteMany filtrado pelos appointmentIds staging;
 *   - filiais: deleteMany por (companyId, name) das filiais que este seed cria.
 * Re-rodar sempre produz o mesmo estado, sem duplicar.
 *
 * Requer que seed-staging.ts já tenha rodado (clientes/agendamentos staging).
 */
const SOURCE = 'staging';

// PRNG determinístico — re-runs produzem os mesmos dados.
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
const money = (min: number, max: number) => Math.round((min + rand() * (max - min)) * 100) / 100;

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '');

const DEPENDENT_FIRST = [
  'Miguel', 'Arthur', 'Heitor', 'Bernardo', 'Théo', 'Davi', 'Gael', 'Ravi',
  'Alice', 'Sophia', 'Helena', 'Valentina', 'Laura', 'Cecília', 'Maria', 'Isabella',
];

async function main() {
  console.log('Seeding STAGING DETALHES (cliente + filiais)...');

  // 1) Company (mesma lógica do seed base).
  const company =
    (await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error('Nenhuma company encontrada. Rode o seed base primeiro.');
  const companyId = company.id;
  console.log('Using company:', companyId, company.name);

  // 2) Clientes staging existentes (legacySource='staging'), ordenados de forma estável.
  const customers = await prisma.customer.findMany({
    where: { companyId, legacySource: SOURCE },
    orderBy: { legacyId: 'asc' },
  });
  if (customers.length === 0) {
    throw new Error('Nenhum cliente staging encontrado. Rode seed-staging.ts primeiro.');
  }
  const customerIds = customers.map((c) => c.id);
  console.log('Clientes staging encontrados:', customers.length);

  // Ordenar por índice numérico do legacyId (cust-1, cust-2, ...) para escolhas estáveis.
  const byIndex = [...customers].sort((a, b) => {
    const na = parseInt((a.legacyId ?? '0').replace(/\D/g, ''), 10) || 0;
    const nb = parseInt((b.legacyId ?? '0').replace(/\D/g, ''), 10) || 0;
    return na - nb;
  });

  // 3) Agendamentos staging existentes.
  const appointments = await prisma.appointment.findMany({
    where: { companyId, legacySource: SOURCE },
    orderBy: { legacyId: 'asc' },
    select: { id: true, status: true, start: true, legacyId: true },
  });
  const appointmentIds = appointments.map((a) => a.id);
  console.log('Agendamentos staging encontrados:', appointments.length);

  // Um usuário staff (opcional) para atribuir autoria no histórico de status.
  const staffUser = await prisma.user.findFirst({
    where: { companyId, accountType: 'staff' },
    orderBy: { createdAt: 'asc' },
  });

  // =====================================================================
  // LIMPEZA IDEMPOTENTE (escopo staging)
  // =====================================================================
  // Pagamentos de débito são apagados via cascade ao apagar CustomerDebt.
  await prisma.$transaction([
    prisma.customerDebt.deleteMany({ where: { companyId, customerId: { in: customerIds } } }),
    prisma.customerCredit.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.customerDependent.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.customerSocialProfile.deleteMany({ where: { customerId: { in: customerIds } } }),
    prisma.customerFile.deleteMany({ where: { companyId, customerId: { in: customerIds } } }),
    prisma.appointmentStatusHistory.deleteMany({ where: { appointmentId: { in: appointmentIds } } }),
    prisma.branch.deleteMany({
      where: { companyId, name: { in: ['Matriz', 'Unidade 2 — Centro'] } },
    }),
  ]);
  console.log('Escopo staging limpo (delete-then-recreate).');

  // =====================================================================
  // CustomerDebt (+ CustomerDebtPayment) — ~12 clientes com débitos em aberto
  // =====================================================================
  const DEBT_COUNT = 12;
  let debtsCreated = 0;
  let debtPaymentsCreated = 0;
  const debtOrigins = [
    'Serviço não pago',
    'Produto fiado',
    'Comanda em aberto',
    'Pacote parcelado',
    'Saldo de coloração',
  ];
  const debtMethods = ['pix', 'dinheiro', 'cartao_credito', 'cartao_debito'];

  for (let i = 0; i < DEBT_COUNT; i++) {
    const customer = byIndex[i % byIndex.length];
    const amount = money(50, 600);
    // Vencimentos entre 25 dias atrás e 20 dias à frente.
    const dueDate = new Date('2026-07-22T00:00:00-03:00');
    dueDate.setDate(dueDate.getDate() + randInt(-25, 20));
    // ~40% dos débitos têm um pagamento parcial (continuam em aberto).
    const hasPartial = i % 5 < 2;

    const debt = await prisma.customerDebt.create({
      data: {
        companyId,
        customerId: customer.id,
        amount,
        origin: pick(debtOrigins),
        dueDate,
        status: 'open',
      },
    });
    debtsCreated++;

    if (hasPartial) {
      const paidAt = new Date(dueDate);
      paidAt.setDate(paidAt.getDate() - randInt(1, 10));
      await prisma.customerDebtPayment.create({
        data: {
          debtId: debt.id,
          amount: Math.round(amount * (0.3 + rand() * 0.4) * 100) / 100, // 30–70% parcial
          paidAt,
          method: pick(debtMethods),
        },
      });
      debtPaymentsCreated++;
    }
  }
  console.log(`CustomerDebt: ${debtsCreated} | CustomerDebtPayment: ${debtPaymentsCreated}`);

  // =====================================================================
  // CustomerCredit — ~10 clientes com crédito/saldo positivo
  // =====================================================================
  const CREDIT_COUNT = 10;
  let creditsCreated = 0;
  const creditReasons = [
    'Devolução de produto',
    'Cortesia',
    'Cashback de pacote',
    'Ajuste de comanda',
    'Crédito promocional',
    'Pagamento antecipado',
  ];
  for (let i = 0; i < CREDIT_COUNT; i++) {
    // Usa clientes diferentes dos primeiros débitos quando possível.
    const customer = byIndex[(i + DEBT_COUNT) % byIndex.length];
    await prisma.customerCredit.create({
      data: {
        customerId: customer.id,
        amount: money(20, 400),
        reason: pick(creditReasons),
      },
    });
    creditsCreated++;
  }
  console.log(`CustomerCredit: ${creditsCreated}`);

  // =====================================================================
  // CustomerDependent — dependentes (filhos) em ~8 clientes
  // =====================================================================
  const DEP_CLIENT_COUNT = 8;
  let dependentsCreated = 0;
  for (let i = 0; i < DEP_CLIENT_COUNT; i++) {
    const customer = byIndex[(i * 3 + 2) % byIndex.length];
    const kids = randInt(1, 2);
    for (let k = 0; k < kids; k++) {
      const first = pick(DEPENDENT_FIRST);
      const last = customer.name.split(' ').slice(-1)[0] ?? 'Silva';
      await prisma.customerDependent.create({
        data: {
          customerId: customer.id,
          name: `${first} ${last}`,
          relationship: 'Filho(a)',
        },
      });
      dependentsCreated++;
    }
  }
  console.log(`CustomerDependent: ${dependentsCreated}`);

  // =====================================================================
  // CustomerSocialProfile — instagram/facebook em ~20 clientes
  // =====================================================================
  const SOCIAL_CLIENT_COUNT = 20;
  let socialsCreated = 0;
  for (let i = 0; i < SOCIAL_CLIENT_COUNT; i++) {
    const customer = byIndex[i % byIndex.length];
    const handle = slugify(customer.name).replace(/\./g, '_');
    // Todos ganham instagram; ~metade também facebook.
    await prisma.customerSocialProfile.create({
      data: {
        customerId: customer.id,
        platform: 'instagram',
        url: `https://instagram.com/${handle}`,
      },
    });
    socialsCreated++;
    if (i % 2 === 0) {
      await prisma.customerSocialProfile.create({
        data: {
          customerId: customer.id,
          platform: 'facebook',
          url: `https://facebook.com/${handle}`,
        },
      });
      socialsCreated++;
    }
  }
  console.log(`CustomerSocialProfile: ${socialsCreated}`);

  // =====================================================================
  // CustomerFile — alguns arquivos (URLs placeholder) em ~6 clientes
  // =====================================================================
  const FILE_CLIENT_COUNT = 6;
  let filesCreated = 0;
  const fileDefs = [
    { name: 'Ficha de anamnese.pdf', mimeType: 'application/pdf', size: 184320 },
    { name: 'Foto antes.jpg', mimeType: 'image/jpeg', size: 512000 },
    { name: 'Foto depois.jpg', mimeType: 'image/jpeg', size: 498176 },
    { name: 'Termo de consentimento.pdf', mimeType: 'application/pdf', size: 92160 },
  ];
  for (let i = 0; i < FILE_CLIENT_COUNT; i++) {
    const customer = byIndex[(i * 5 + 1) % byIndex.length];
    const nFiles = randInt(1, 2);
    for (let f = 0; f < nFiles; f++) {
      const def = fileDefs[(i + f) % fileDefs.length];
      await prisma.customerFile.create({
        data: {
          companyId,
          customerId: customer.id,
          url: `https://placehold.co/uploads/staging/${customer.id}/${slugify(def.name)}`,
          name: def.name,
          mimeType: def.mimeType,
          size: def.size,
        },
      });
      filesCreated++;
    }
  }
  console.log(`CustomerFile: ${filesCreated}`);

  // =====================================================================
  // AppointmentStatusHistory — histórico de mudança de status
  // =====================================================================
  // Reconstrói uma trilha plausível levando ao status atual de cada agendamento.
  // Cadeias por status final:
  const chainFor = (final: AppointmentStatus): AppointmentStatus[] => {
    switch (final) {
      case AppointmentStatus.finished:
        return [
          AppointmentStatus.scheduled,
          AppointmentStatus.confirmed,
          AppointmentStatus.in_progress,
          AppointmentStatus.done,
          AppointmentStatus.finished,
        ];
      case AppointmentStatus.done:
        return [
          AppointmentStatus.scheduled,
          AppointmentStatus.confirmed,
          AppointmentStatus.in_progress,
          AppointmentStatus.done,
        ];
      case AppointmentStatus.in_progress:
        return [
          AppointmentStatus.scheduled,
          AppointmentStatus.confirmed,
          AppointmentStatus.waiting,
          AppointmentStatus.in_progress,
        ];
      case AppointmentStatus.waiting:
        return [AppointmentStatus.scheduled, AppointmentStatus.confirmed, AppointmentStatus.waiting];
      case AppointmentStatus.confirmed:
        return [AppointmentStatus.scheduled, AppointmentStatus.confirmed];
      case AppointmentStatus.canceled:
        return [AppointmentStatus.scheduled, AppointmentStatus.confirmed, AppointmentStatus.canceled];
      case AppointmentStatus.unconfirmed:
        return [AppointmentStatus.scheduled, AppointmentStatus.unconfirmed];
      case AppointmentStatus.scheduled:
      default:
        return [AppointmentStatus.scheduled];
    }
  };

  let historyCreated = 0;
  for (const appt of appointments) {
    const chain = chainFor(appt.status);
    // A trilha começa ~2 dias antes do horário do agendamento e avança.
    const base = new Date(appt.start);
    base.setDate(base.getDate() - 2);
    for (let s = 0; s < chain.length; s++) {
      const at = new Date(base.getTime() + s * 6 * 60 * 60 * 1000); // +6h por passo
      await prisma.appointmentStatusHistory.create({
        data: {
          appointmentId: appt.id,
          fromStatus: s === 0 ? null : chain[s - 1],
          toStatus: chain[s],
          at,
          byUserId: staffUser?.id ?? null,
        },
      });
      historyCreated++;
    }
  }
  console.log(`AppointmentStatusHistory: ${historyCreated} (para ${appointments.length} agendamentos)`);

  // =====================================================================
  // Branch — ~2 filiais (Matriz + Unidade 2) com endereço
  // =====================================================================
  const branchDefs = [
    {
      name: 'Matriz',
      addressJson: {
        street: 'Av. Paulista',
        number: '1578',
        complement: 'Loja 3',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP',
        zip: '01310-200',
        phone: '+551133334444',
      },
    },
    {
      name: 'Unidade 2 — Centro',
      addressJson: {
        street: 'Rua XV de Novembro',
        number: '420',
        complement: 'Sala 12',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zip: '01013-000',
        phone: '+551144445555',
      },
    },
  ];
  let branchesCreated = 0;
  for (const def of branchDefs) {
    await prisma.branch.create({
      data: {
        companyId,
        name: def.name,
        addressJson: def.addressJson,
        active: true,
      },
    });
    branchesCreated++;
  }
  console.log(`Branch: ${branchesCreated}`);

  console.log('STAGING DETALHES seed done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
