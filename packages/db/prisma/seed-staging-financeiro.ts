import {
  PrismaClient,
  FinancialAccountType,
  FinancialCategoryKind,
  CommissionScopeType,
  AmountType,
  CommissionEntryStatus,
  CommissionClosingStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Staging seed — FINANCEIRO + COMISSÕES.
 *
 * Popula as páginas Financeiro → Cadastros (Contas, Formas de pagamento,
 * Categorias) e o módulo de Comissões, em cima do staging já existente
 * (company "Salão Beautypass", 6 profissionais, 40 comandas — 23 finished).
 *
 * IDEMPOTENTE: os models financeiros/comissões NÃO têm coluna legacyId, então
 * a chave lógica é natural:
 *   - FinancialAccount / PaymentMethod / FinancialCategory: (companyId, name)
 *   - CommissionRule: (companyId, scopeType, scopeId)
 *   - CommissionEntry: (companyId, professionalId, orderId)
 *   - CommissionClosing: (companyId, periodStart, periodEnd)
 *   - CommissionPayment: (companyId, professionalId, closingId)
 * Re-rodar faz upsert manual (findFirst -> update|create) e nunca duplica.
 */

const COMMISSION_PERCENT = 40; // % padrão sobre serviços

async function findCompany() {
  const company =
    (await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error('No company found. Run the base + staging seed first.');
  return company;
}

async function main() {
  console.log('Seeding STAGING financeiro + comissões...');
  const company = await findCompany();
  const companyId = company.id;
  console.log('Using company:', companyId, company.name);

  // ------------------------------------------------------------------
  // 1) FinancialAccount (~4). type é enum cash|bank apenas; o "tipo" real
  //    (poupança / carteira PIX) fica implícito no nome + adminOnly.
  // ------------------------------------------------------------------
  const accountDefs: Array<{
    name: string;
    type: FinancialAccountType;
    initialBalance: number;
    adminOnly?: boolean;
  }> = [
    { name: 'Caixa', type: FinancialAccountType.cash, initialBalance: 500 },
    { name: 'Conta Corrente Banco', type: FinancialAccountType.bank, initialBalance: 12500, adminOnly: true },
    { name: 'Poupança', type: FinancialAccountType.bank, initialBalance: 30000, adminOnly: true },
    { name: 'Carteira PIX', type: FinancialAccountType.cash, initialBalance: 1800 },
  ];

  const accounts: Record<string, { id: string }> = {};
  for (const def of accountDefs) {
    const existing = await prisma.financialAccount.findFirst({
      where: { companyId, name: def.name },
    });
    const data = {
      companyId,
      name: def.name,
      type: def.type,
      initialBalance: def.initialBalance,
      adminOnly: def.adminOnly ?? false,
      active: true,
    };
    const acc = existing
      ? await prisma.financialAccount.update({ where: { id: existing.id }, data })
      : await prisma.financialAccount.create({ data });
    accounts[def.name] = acc;
  }
  console.log('FinancialAccount ensured:', Object.keys(accounts).length);

  // ------------------------------------------------------------------
  // 2) PaymentMethod (~6). feePercent/feeFixed/kind/settlementDays/goesToCash.
  //    defaultAccountId liga ao FinancialAccount correspondente.
  // ------------------------------------------------------------------
  const methodDefs: Array<{
    name: string;
    kind: string;
    feePercent: number;
    feeFixed: number;
    settlementDays: number;
    goesToCash: boolean;
    favorite: boolean;
    defaultAccount: string;
  }> = [
    { name: 'Dinheiro', kind: 'dinheiro', feePercent: 0, feeFixed: 0, settlementDays: 0, goesToCash: true, favorite: true, defaultAccount: 'Caixa' },
    { name: 'PIX', kind: 'pix', feePercent: 0, feeFixed: 0, settlementDays: 0, goesToCash: false, favorite: true, defaultAccount: 'Carteira PIX' },
    { name: 'Cartão de Crédito', kind: 'cartao', feePercent: 3.5, feeFixed: 0, settlementDays: 30, goesToCash: false, favorite: false, defaultAccount: 'Conta Corrente Banco' },
    { name: 'Cartão de Débito', kind: 'cartao', feePercent: 1.5, feeFixed: 0, settlementDays: 1, goesToCash: false, favorite: false, defaultAccount: 'Conta Corrente Banco' },
    { name: 'Transferência', kind: 'transferencia', feePercent: 0, feeFixed: 0, settlementDays: 0, goesToCash: false, favorite: false, defaultAccount: 'Conta Corrente Banco' },
    { name: 'Boleto', kind: 'boleto', feePercent: 0, feeFixed: 2.5, settlementDays: 2, goesToCash: false, favorite: false, defaultAccount: 'Conta Corrente Banco' },
  ];

  const methods: Record<string, { id: string }> = {};
  for (const def of methodDefs) {
    const existing = await prisma.paymentMethod.findFirst({
      where: { companyId, name: def.name },
    });
    const data = {
      companyId,
      name: def.name,
      kind: def.kind,
      feePercent: def.feePercent,
      feeFixed: def.feeFixed,
      settlementDays: def.settlementDays,
      goesToCash: def.goesToCash,
      favorite: def.favorite,
      active: true,
      defaultAccountId: accounts[def.defaultAccount]?.id ?? null,
    };
    const pm = existing
      ? await prisma.paymentMethod.update({ where: { id: existing.id }, data })
      : await prisma.paymentMethod.create({ data });
    methods[def.name] = pm;
  }
  console.log('PaymentMethod ensured:', Object.keys(methods).length);

  // ------------------------------------------------------------------
  // 3) FinancialCategory (~10). kind = credit (receita) | debit (despesa).
  //    isExpense marca despesas; countsAsCommission marca "Comissões".
  // ------------------------------------------------------------------
  const categoryDefs: Array<{
    name: string;
    kind: FinancialCategoryKind;
    isExpense: boolean;
    countsAsCommission?: boolean;
  }> = [
    { name: 'Serviços', kind: FinancialCategoryKind.credit, isExpense: false },
    { name: 'Produtos', kind: FinancialCategoryKind.credit, isExpense: false },
    { name: 'Pacotes e Assinaturas', kind: FinancialCategoryKind.credit, isExpense: false },
    { name: 'Aluguel', kind: FinancialCategoryKind.debit, isExpense: true },
    { name: 'Salários', kind: FinancialCategoryKind.debit, isExpense: true },
    { name: 'Comissões', kind: FinancialCategoryKind.debit, isExpense: true, countsAsCommission: true },
    { name: 'Insumos', kind: FinancialCategoryKind.debit, isExpense: true },
    { name: 'Marketing', kind: FinancialCategoryKind.debit, isExpense: true },
    { name: 'Impostos', kind: FinancialCategoryKind.debit, isExpense: true },
    { name: 'Contas de Consumo', kind: FinancialCategoryKind.debit, isExpense: true },
  ];

  const categories: Record<string, { id: string }> = {};
  for (const def of categoryDefs) {
    const existing = await prisma.financialCategory.findFirst({
      where: { companyId, name: def.name },
    });
    const data = {
      companyId,
      name: def.name,
      kind: def.kind,
      isExpense: def.isExpense,
      countsAsCommission: def.countsAsCommission ?? false,
      active: true,
    };
    const cat = existing
      ? await prisma.financialCategory.update({ where: { id: existing.id }, data })
      : await prisma.financialCategory.create({ data });
    categories[def.name] = cat;
  }
  console.log('FinancialCategory ensured:', Object.keys(categories).length);

  // ------------------------------------------------------------------
  // 4) CommissionRule — 1 regra geral por profissional: percent sobre serviços.
  //    scopeType=service, scopeId=professionalId (regra específica do profissional).
  // ------------------------------------------------------------------
  const professionals = await prisma.professional.findMany({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
  });
  if (professionals.length === 0) throw new Error('No professionals found. Run staging seed first.');

  // Regra geral (fallback) — scopeType=all, sem scopeId.
  const generalRuleExisting = await prisma.commissionRule.findFirst({
    where: { companyId, scopeType: CommissionScopeType.all, scopeId: null },
  });
  const generalRuleData = {
    companyId,
    scopeType: CommissionScopeType.all,
    scopeId: null,
    type: AmountType.percent,
    value: COMMISSION_PERCENT,
    settingsJson: { basis: 'services', payer: 'establishment', appliesTo: 'finalized' },
  };
  if (generalRuleExisting) {
    await prisma.commissionRule.update({ where: { id: generalRuleExisting.id }, data: generalRuleData });
  } else {
    await prisma.commissionRule.create({ data: generalRuleData });
  }

  // Regra por profissional (scopeType=service, scopeId=professionalId).
  let rulesCount = 1;
  for (const pro of professionals) {
    const existing = await prisma.commissionRule.findFirst({
      where: { companyId, scopeType: CommissionScopeType.service, scopeId: pro.id },
    });
    const data = {
      companyId,
      scopeType: CommissionScopeType.service,
      scopeId: pro.id,
      type: AmountType.percent,
      value: COMMISSION_PERCENT,
      settingsJson: { basis: 'services', payer: 'establishment', appliesTo: 'finalized', professionalName: pro.name },
    };
    if (existing) {
      await prisma.commissionRule.update({ where: { id: existing.id }, data });
    } else {
      await prisma.commissionRule.create({ data });
    }
    rulesCount++;
  }
  console.log('CommissionRule ensured:', rulesCount, '(1 geral +', professionals.length, 'por profissional)');

  // ------------------------------------------------------------------
  // 5) CommissionEntry — 1 lançamento por (profissional × comanda finished),
  //    baseAmount = soma dos grossValue dos itens de serviço daquele profissional
  //    na comanda; commissionAmount = base * 40%. Ligado ao orderId real.
  //    ~metade paga / metade em aberto (determinístico pelo número da comanda).
  // ------------------------------------------------------------------
  const finishedOrders = await prisma.order.findMany({
    where: { companyId, status: 'finished' },
    select: {
      id: true,
      number: true,
      date: true,
      items: {
        where: { kind: 'service' },
        select: { professionalId: true, grossValue: true },
      },
    },
    orderBy: { number: 'asc' },
  });

  const round2 = (n: number) => Math.round(n * 100) / 100;

  let entriesCreated = 0;
  let entriesUpdated = 0;
  let paidCount = 0;
  // Acumula comissão paga por profissional para gerar CommissionPayment.
  const paidByPro: Record<string, number> = {};

  for (const order of finishedOrders) {
    // Agrupa por profissional dentro da comanda.
    const byPro = new Map<string, number>();
    for (const item of order.items) {
      if (!item.professionalId) continue;
      const prev = byPro.get(item.professionalId) ?? 0;
      byPro.set(item.professionalId, prev + Number(item.grossValue));
    }

    for (const [professionalId, base] of byPro) {
      const baseAmount = round2(base);
      const commissionAmount = round2(baseAmount * (COMMISSION_PERCENT / 100));
      // Determinístico: comandas de número par => pago, ímpar => aberto.
      const isPaid = order.number % 2 === 0;
      const status = isPaid ? CommissionEntryStatus.paid : CommissionEntryStatus.open;

      const existing = await prisma.commissionEntry.findFirst({
        where: { companyId, professionalId, orderId: order.id },
      });
      const data = {
        companyId,
        professionalId,
        orderId: order.id,
        baseAmount,
        commissionAmount,
        bonusAmount: 0,
        status,
        competenceDate: order.date,
        availableDate: order.date,
        signed: isPaid,
      };
      if (existing) {
        await prisma.commissionEntry.update({ where: { id: existing.id }, data });
        entriesUpdated++;
      } else {
        await prisma.commissionEntry.create({ data });
        entriesCreated++;
      }
      if (isPaid) {
        paidCount++;
        paidByPro[professionalId] = round2((paidByPro[professionalId] ?? 0) + commissionAmount);
      }
    }
  }
  console.log(
    'CommissionEntry ensured — created:',
    entriesCreated,
    '| updated:',
    entriesUpdated,
    '| pagas:',
    paidCount,
  );

  // ------------------------------------------------------------------
  // 6) CommissionClosing — 1 fechamento do período (mês de julho/2026),
  //    status closed, + CommissionPayment por profissional com comissão paga.
  // ------------------------------------------------------------------
  const periodStart = new Date('2026-07-01T00:00:00.000Z');
  const periodEnd = new Date('2026-07-31T23:59:59.999Z');

  let closing = await prisma.commissionClosing.findFirst({
    where: { companyId, periodStart, periodEnd },
  });
  if (closing) {
    closing = await prisma.commissionClosing.update({
      where: { id: closing.id },
      data: { status: CommissionClosingStatus.closed },
    });
  } else {
    closing = await prisma.commissionClosing.create({
      data: {
        companyId,
        periodStart,
        periodEnd,
        status: CommissionClosingStatus.closed,
      },
    });
  }

  let paymentsCount = 0;
  for (const [professionalId, amount] of Object.entries(paidByPro)) {
    if (amount <= 0) continue;
    const existing = await prisma.commissionPayment.findFirst({
      where: { companyId, professionalId, closingId: closing.id },
    });
    const data = {
      companyId,
      professionalId,
      amount,
      paidAt: periodEnd,
      closingId: closing.id,
    };
    if (existing) {
      await prisma.commissionPayment.update({ where: { id: existing.id }, data });
    } else {
      await prisma.commissionPayment.create({ data });
    }
    paymentsCount++;
  }
  console.log('CommissionClosing ensured: 1 | CommissionPayment ensured:', paymentsCount);

  console.log('STAGING financeiro + comissões seed done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
