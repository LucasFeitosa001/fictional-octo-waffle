import {
  PrismaClient,
  TransactionKind,
  PaymentStatus,
  DiscountType,
  CommissionScopeType,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Staging seed — TRANSAÇÕES financeiras, AVALIAÇÕES, PROMOÇÕES, DOCUMENTOS e
 * GALERIA. Preenche as páginas Financeiro→Transações, Marketing→Avaliações,
 * Marketing→Promoções e Controle→Gerador de Documento, além da galeria pública.
 *
 * IDEMPOTENTE por model:
 *  - Transaction: `@@unique([companyId, legacyId])` -> upsert em `txn-N`.
 *  - Review: `appointmentId` é @unique -> pulo os agendamentos que já têm review.
 *  - Promotion: sem unique natural -> chave (companyId, name) com nomes próprios
 *    tagged, para não colidir com promoções pré-existentes.
 *  - DocumentTemplate / Document: chave (companyId, name).
 *  - GalleryPhoto: chave (companyId, url).
 *
 * Liga Transaction a FinancialAccount / FinancialCategory / PaymentMethod
 * EXISTENTES (criados por outro seed). Se não houver, cai para null nos campos
 * opcionais.
 */
const SOURCE = 'staging';

// PRNG determinístico para re-runs idênticos.
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

// Julho/2026: gera uma data em jul/2026 no dia informado (1..31), hora comercial.
function julyDate(day: number, hour = 12, minute = 0): Date {
  return new Date(Date.UTC(2026, 6, day, hour + 3, minute, 0)); // -03:00 => +3 UTC
}

async function main() {
  console.log('Seeding STAGING transações/avaliações/promoções/documentos/galeria...');

  const company =
    (await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error('No company found. Run the base seed first.');
  const companyId = company.id;
  console.log('Using company:', companyId, company.name);

  // ---------------------------------------------------------------------------
  // Referências financeiras EXISTENTES (criadas por outro seed). Opcionais.
  // ---------------------------------------------------------------------------
  const accounts = await prisma.financialAccount.findMany({ where: { companyId } });
  const categories = await prisma.financialCategory.findMany({ where: { companyId } });
  const paymentMethods = await prisma.paymentMethod.findMany({ where: { companyId } });

  const catByName = (name: string) => categories.find((c) => c.name === name) ?? null;
  const acctByName = (name: string) => accounts.find((a) => a.name === name) ?? null;
  const pmByName = (name: string) => paymentMethods.find((p) => p.name === name) ?? null;

  // Contas / formas de pagamento de fallback (primeira existente, se houver).
  const cashAcct = acctByName('Caixa') ?? accounts[0] ?? null;
  const bankAcct = acctByName('Conta Corrente Banco') ?? accounts[0] ?? null;
  const pixPm = pmByName('PIX') ?? paymentMethods[0] ?? null;
  const cashPm = pmByName('Dinheiro') ?? paymentMethods[0] ?? null;
  const creditPm = pmByName('Cartão de Crédito') ?? paymentMethods[0] ?? null;
  const debitPm = pmByName('Cartão de Débito') ?? paymentMethods[0] ?? null;

  console.log(
    `Financeiro existente -> contas:${accounts.length} categorias:${categories.length} formas:${paymentMethods.length}`,
  );

  // ---------------------------------------------------------------------------
  // 1) TRANSAÇÕES (~50): receitas de serviços/produtos + despesas fixas/variáveis.
  // ---------------------------------------------------------------------------
  type TxnDef = {
    kind: TransactionKind;
    categoryName: string | null;
    account: { id: string } | null;
    paymentMethod: { id: string } | null;
    description: string;
    grossAmount: number;
    day: number;
    status: PaymentStatus;
  };

  const revenuePms = [pixPm, cashPm, creditPm, debitPm].filter(Boolean) as { id: string }[];

  const txns: TxnDef[] = [];

  // -- Receitas de serviços (comandas): ~24 lançamentos ao longo de julho. --
  for (let d = 1; d <= 24; d++) {
    const amount = randInt(50, 320) + (rand() < 0.5 ? 0.5 : 0);
    txns.push({
      kind: TransactionKind.income,
      categoryName: 'Serviços',
      account: cashAcct,
      paymentMethod: revenuePms.length ? pick(revenuePms) : null,
      description: `Receita de serviços — comanda #${1000 + d}`,
      grossAmount: amount,
      day: d,
      status: PaymentStatus.paid,
    });
  }

  // -- Receitas de venda de produtos: ~6 lançamentos. --
  const produtoDescs = [
    'Venda Shampoo Hidratante',
    'Venda Óleo de Argan',
    'Venda Máscara Capilar',
    'Venda Kit Manicure',
    'Venda Condicionador',
    'Venda Esmaltes',
  ];
  produtoDescs.forEach((desc, i) => {
    txns.push({
      kind: TransactionKind.income,
      categoryName: 'Produtos',
      account: cashAcct,
      paymentMethod: revenuePms.length ? pick(revenuePms) : null,
      description: desc,
      grossAmount: randInt(30, 180),
      day: 2 + i * 4,
      status: PaymentStatus.paid,
    });
  });

  // -- Despesas fixas / variáveis: ~20 lançamentos. --
  const despesas: Array<Omit<TxnDef, 'kind'>> = [
    { categoryName: 'Aluguel', account: bankAcct, paymentMethod: null, description: 'Aluguel do salão — julho/2026', grossAmount: 4500, day: 5, status: PaymentStatus.paid },
    { categoryName: 'Salários', account: bankAcct, paymentMethod: null, description: 'Salário — Camila Ferreira', grossAmount: 2400, day: 5, status: PaymentStatus.paid },
    { categoryName: 'Salários', account: bankAcct, paymentMethod: null, description: 'Salário — Rafael Nunes', grossAmount: 2200, day: 5, status: PaymentStatus.paid },
    { categoryName: 'Salários', account: bankAcct, paymentMethod: null, description: 'Salário — Aline Ribeiro', grossAmount: 1800, day: 5, status: PaymentStatus.paid },
    { categoryName: 'Salários', account: bankAcct, paymentMethod: null, description: 'Salário — Patrícia Gomes', grossAmount: 2600, day: 5, status: PaymentStatus.paid },
    { categoryName: 'Salários', account: bankAcct, paymentMethod: null, description: 'Salário — Bruno Almeida', grossAmount: 2300, day: 5, status: PaymentStatus.paid },
    { categoryName: 'Salários', account: bankAcct, paymentMethod: null, description: 'Salário — Fernanda Rocha', grossAmount: 2100, day: 5, status: PaymentStatus.paid },
    { categoryName: 'Insumos', account: cashAcct, paymentMethod: debitPm, description: 'Compra de tintura e coloração', grossAmount: 680, day: 8, status: PaymentStatus.paid },
    { categoryName: 'Insumos', account: cashAcct, paymentMethod: debitPm, description: 'Compra de shampoo e condicionador (revenda)', grossAmount: 540, day: 12, status: PaymentStatus.paid },
    { categoryName: 'Insumos', account: cashAcct, paymentMethod: pixPm, description: 'Esmaltes e acetona', grossAmount: 180, day: 15, status: PaymentStatus.paid },
    { categoryName: 'Insumos', account: cashAcct, paymentMethod: pixPm, description: 'Toalhas e descartáveis', grossAmount: 260, day: 19, status: PaymentStatus.paid },
    { categoryName: 'Marketing', account: bankAcct, paymentMethod: creditPm, description: 'Anúncios Instagram/Meta Ads', grossAmount: 400, day: 3, status: PaymentStatus.paid },
    { categoryName: 'Marketing', account: bankAcct, paymentMethod: creditPm, description: 'Impressão de flyers e cartões', grossAmount: 220, day: 10, status: PaymentStatus.paid },
    { categoryName: 'Contas de Consumo', account: bankAcct, paymentMethod: null, description: 'Conta de energia elétrica', grossAmount: 830, day: 14, status: PaymentStatus.paid },
    { categoryName: 'Contas de Consumo', account: bankAcct, paymentMethod: null, description: 'Conta de água', grossAmount: 210, day: 14, status: PaymentStatus.paid },
    { categoryName: 'Contas de Consumo', account: bankAcct, paymentMethod: null, description: 'Internet e telefone', grossAmount: 150, day: 14, status: PaymentStatus.paid },
    { categoryName: 'Impostos', account: bankAcct, paymentMethod: null, description: 'Simples Nacional (DAS) — competência jun/2026', grossAmount: 720, day: 20, status: PaymentStatus.paid },
    { categoryName: 'Comissões', account: cashAcct, paymentMethod: pixPm, description: 'Comissões da equipe — 1ª quinzena', grossAmount: 1650, day: 16, status: PaymentStatus.paid },
    // Pendentes (a pagar), com vencimento futuro em julho.
    { categoryName: 'Aluguel', account: bankAcct, paymentMethod: null, description: 'Aluguel do salão — agosto/2026 (a pagar)', grossAmount: 4500, day: 30, status: PaymentStatus.pending },
    { categoryName: 'Insumos', account: cashAcct, paymentMethod: null, description: 'Pedido de insumos (aguardando pagamento)', grossAmount: 590, day: 28, status: PaymentStatus.pending },
    { categoryName: 'Comissões', account: cashAcct, paymentMethod: null, description: 'Comissões da equipe — 2ª quinzena (a pagar)', grossAmount: 1720, day: 31, status: PaymentStatus.pending },
  ];
  despesas.forEach((d) => txns.push({ kind: TransactionKind.expense, ...d }));

  let txnCount = 0;
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i];
    const legacyId = `txn-${i + 1}`;
    const category = t.categoryName ? catByName(t.categoryName) : null;
    const isPaid = t.status === PaymentStatus.paid;
    const dueDate = julyDate(t.day, 12, 0);
    const paidAt = isPaid ? julyDate(t.day, randInt(9, 18), pick([0, 15, 30, 45])) : null;

    await prisma.transaction.upsert({
      where: { companyId_legacyId: { companyId, legacyId } },
      update: {
        kind: t.kind,
        grossAmount: t.grossAmount,
        status: t.status,
        description: t.description,
        accountId: t.account?.id ?? null,
        categoryId: category?.id ?? null,
        paymentMethodId: t.paymentMethod?.id ?? null,
        dueDate,
        paidAt,
      },
      create: {
        companyId,
        kind: t.kind,
        grossAmount: t.grossAmount,
        status: t.status,
        description: t.description,
        accountId: t.account?.id ?? null,
        categoryId: category?.id ?? null,
        paymentMethodId: t.paymentMethod?.id ?? null,
        dueDate,
        paidAt,
        legacyId,
        legacySource: SOURCE,
      },
    });
    txnCount++;
  }
  console.log('Transações garantidas:', txnCount);

  // ---------------------------------------------------------------------------
  // 2) AVALIAÇÕES (~20): ligadas a agendamentos finished/done do staging.
  //    Idempotente: appointmentId é @unique, então pulamos os já avaliados.
  // ---------------------------------------------------------------------------
  const reviewableAppts = await prisma.appointment.findMany({
    where: { companyId, status: { in: ['finished', 'done'] } },
    include: { items: true },
    orderBy: { start: 'asc' },
  });

  const positivos = [
    'Amei o resultado, super recomendo!',
    'Atendimento impecável, saí renovada.',
    'Profissional atenciosa e caprichosa.',
    'Melhor salão da região, voltarei sempre.',
    'Muito satisfeita com o serviço.',
    'Ambiente agradável e equipe simpática.',
    'Ficou exatamente como eu queria.',
    'Pontualidade e qualidade, nota 10.',
  ];
  const neutros = [
    'Bom atendimento, mas demorou um pouco.',
    'Gostei do resultado, poderia melhorar a espera.',
    'Serviço ok, preço justo.',
  ];
  const negativos = [
    'Esperava um pouco mais pelo valor cobrado.',
    'Atendimento demorado dessa vez.',
  ];

  const TARGET_REVIEWS = 20;
  let reviewCount = 0;
  let reviewCreated = 0;
  for (const appt of reviewableAppts) {
    if (reviewCount >= TARGET_REVIEWS) break;
    reviewCount++;

    const existing = await prisma.review.findUnique({ where: { appointmentId: appt.id } });
    if (existing) continue;

    // Distribuição de notas: majoritariamente 4-5, com alguns 3 e raros 1-2.
    const r = rand();
    let rating: number;
    let comment: string;
    if (r < 0.7) {
      rating = pick([5, 5, 4]);
      comment = pick(positivos);
    } else if (r < 0.9) {
      rating = 3;
      comment = pick(neutros);
    } else {
      rating = pick([1, 2]);
      comment = pick(negativos);
    }

    const serviceId = appt.items[0]?.serviceId ?? null;

    await prisma.review.create({
      data: {
        companyId,
        customerId: appt.customerId,
        professionalId: appt.professionalId,
        serviceId,
        appointmentId: appt.id,
        rating,
        comment,
        createdAt: appt.end ?? appt.start,
      },
    });
    reviewCreated++;
  }
  const totalReviews = await prisma.review.count({ where: { companyId } });
  console.log(`Avaliações -> criadas agora:${reviewCreated} | total:${totalReviews}`);

  // ---------------------------------------------------------------------------
  // 3) PROMOÇÕES (~5): idempotente por (companyId, name). Nomes próprios para
  //    não colidir com promoções pré-existentes.
  // ---------------------------------------------------------------------------
  const services = await prisma.service.findMany({ where: { companyId } });
  const svcByName = (name: string) => services.find((s) => s.name === name) ?? null;

  const promoDefs: Array<{
    name: string;
    scopeType: CommissionScopeType;
    scopeServiceName?: string;
    discountType: DiscountType;
    discountValue: number;
    validFrom: Date;
    validTo: Date | null;
    usageLimit: number | null;
    appliesOnline: boolean;
  }> = [
    {
      name: 'Julho Premiado — 20% OFF',
      scopeType: CommissionScopeType.all,
      discountType: DiscountType.percent,
      discountValue: 20,
      validFrom: julyDate(1, 0, 0),
      validTo: julyDate(31, 23, 59),
      usageLimit: 100,
      appliesOnline: true,
    },
    {
      name: 'Coloração com 15% OFF',
      scopeType: CommissionScopeType.service,
      scopeServiceName: 'Coloração',
      discountType: DiscountType.percent,
      discountValue: 15,
      validFrom: julyDate(1, 0, 0),
      validTo: julyDate(31, 23, 59),
      usageLimit: 50,
      appliesOnline: true,
    },
    {
      name: 'Escova em Dobro — R$ 30',
      scopeType: CommissionScopeType.service,
      scopeServiceName: 'Escova',
      discountType: DiscountType.value,
      discountValue: 30,
      validFrom: julyDate(10, 0, 0),
      validTo: julyDate(31, 23, 59),
      usageLimit: 40,
      appliesOnline: false,
    },
    {
      name: 'Progressiva com R$ 50 OFF',
      scopeType: CommissionScopeType.service,
      scopeServiceName: 'Progressiva',
      discountType: DiscountType.value,
      discountValue: 50,
      validFrom: julyDate(5, 0, 0),
      validTo: julyDate(25, 23, 59),
      usageLimit: 30,
      appliesOnline: true,
    },
    {
      // Inativa: período de validade já expirado (jun/2026).
      name: 'Junho Especial — 25% OFF (encerrada)',
      scopeType: CommissionScopeType.all,
      discountType: DiscountType.percent,
      discountValue: 25,
      validFrom: new Date(Date.UTC(2026, 5, 1, 3, 0, 0)),
      validTo: new Date(Date.UTC(2026, 5, 30, 3, 0, 0)),
      usageLimit: null,
      appliesOnline: false,
    },
  ];

  let promoCreated = 0;
  let promoUpdated = 0;
  for (const p of promoDefs) {
    const scopeId = p.scopeServiceName ? svcByName(p.scopeServiceName)?.id ?? null : null;
    const existing = await prisma.promotion.findFirst({ where: { companyId, name: p.name } });
    const data = {
      scopeType: p.scopeType,
      scopeId,
      discountType: p.discountType,
      discountValue: p.discountValue,
      validFrom: p.validFrom,
      validTo: p.validTo,
      usageLimit: p.usageLimit,
      appliesOnline: p.appliesOnline,
    };
    if (existing) {
      await prisma.promotion.update({ where: { id: existing.id }, data });
      promoUpdated++;
    } else {
      await prisma.promotion.create({ data: { companyId, name: p.name, ...data } });
      promoCreated++;
    }
  }
  const totalPromos = await prisma.promotion.count({ where: { companyId } });
  console.log(`Promoções -> criadas:${promoCreated} atualizadas:${promoUpdated} | total:${totalPromos}`);

  // ---------------------------------------------------------------------------
  // 4) DOCUMENTOS: ~2 modelos (contrato, termo) + ~5 documentos gerados.
  //    Idempotente por (companyId, name).
  // ---------------------------------------------------------------------------
  const templateDefs = [
    {
      name: 'Contrato de Prestação de Serviços',
      bodyHtml:
        '<h1>Contrato de Prestação de Serviços</h1>' +
        '<p>Pelo presente instrumento, <strong>{{cliente_nome}}</strong>, doravante CONTRATANTE, ' +
        'e o <strong>Salão Beautypass</strong>, doravante CONTRATADO, ajustam os serviços de ' +
        '<strong>{{servico}}</strong> pelo valor de <strong>R$ {{valor}}</strong>.</p>' +
        '<p>Data: {{data}}.</p><p>Assinatura do cliente: ____________________________</p>',
      fieldsJson: {
        fields: [
          { key: 'cliente_nome', label: 'Nome do cliente', type: 'text' },
          { key: 'servico', label: 'Serviço', type: 'text' },
          { key: 'valor', label: 'Valor (R$)', type: 'number' },
          { key: 'data', label: 'Data', type: 'date' },
        ],
      },
    },
    {
      name: 'Termo de Consentimento de Procedimento',
      bodyHtml:
        '<h1>Termo de Consentimento</h1>' +
        '<p>Eu, <strong>{{cliente_nome}}</strong>, autorizo a realização do procedimento ' +
        '<strong>{{procedimento}}</strong>, estando ciente dos cuidados e possíveis reações.</p>' +
        '<p>Data: {{data}}.</p><p>Assinatura: ____________________________</p>',
      fieldsJson: {
        fields: [
          { key: 'cliente_nome', label: 'Nome do cliente', type: 'text' },
          { key: 'procedimento', label: 'Procedimento', type: 'text' },
          { key: 'data', label: 'Data', type: 'date' },
        ],
      },
    },
  ];

  const templatesByName: Record<string, string> = {};
  let tmplCreated = 0;
  for (const t of templateDefs) {
    const existing = await prisma.documentTemplate.findFirst({
      where: { companyId, name: t.name },
    });
    if (existing) {
      await prisma.documentTemplate.update({
        where: { id: existing.id },
        data: { bodyHtml: t.bodyHtml, fieldsJson: t.fieldsJson },
      });
      templatesByName[t.name] = existing.id;
    } else {
      const created = await prisma.documentTemplate.create({
        data: { companyId, name: t.name, bodyHtml: t.bodyHtml, fieldsJson: t.fieldsJson },
      });
      templatesByName[t.name] = created.id;
      tmplCreated++;
    }
  }
  console.log(`Modelos de documento garantidos:${templateDefs.length} (novos:${tmplCreated})`);

  // Documentos gerados para clientes existentes.
  const someCustomers = await prisma.customer.findMany({
    where: { companyId, legacySource: SOURCE },
    take: 5,
    orderBy: { name: 'asc' },
  });

  const docDefs = [
    { templateName: 'Contrato de Prestação de Serviços', servico: 'Progressiva', valor: 220 },
    { templateName: 'Contrato de Prestação de Serviços', servico: 'Coloração', valor: 180 },
    { templateName: 'Termo de Consentimento de Procedimento', procedimento: 'Alisamento capilar' },
    { templateName: 'Termo de Consentimento de Procedimento', procedimento: 'Coloração química' },
    { templateName: 'Contrato de Prestação de Serviços', servico: 'Luzes', valor: 250 },
  ];

  let docCreated = 0;
  for (let i = 0; i < docDefs.length; i++) {
    const d = docDefs[i];
    const customer = someCustomers[i % Math.max(someCustomers.length, 1)] ?? null;
    const clienteNome = customer?.name ?? `Cliente ${i + 1}`;
    const docName = `${d.templateName} — ${clienteNome}`;
    const dataJson: Record<string, unknown> = {
      cliente_nome: clienteNome,
      data: '2026-07-' + String(randInt(1, 28)).padStart(2, '0'),
      ...('servico' in d ? { servico: d.servico, valor: d.valor } : {}),
      ...('procedimento' in d ? { procedimento: d.procedimento } : {}),
    };
    const existing = await prisma.document.findFirst({ where: { companyId, name: docName } });
    if (existing) {
      await prisma.document.update({
        where: { id: existing.id },
        data: { templateId: templatesByName[d.templateName] ?? null, dataJson },
      });
    } else {
      await prisma.document.create({
        data: {
          companyId,
          templateId: templatesByName[d.templateName] ?? null,
          name: docName,
          dataJson,
          pdfUrl: null,
        },
      });
      docCreated++;
    }
  }
  const totalDocs = await prisma.document.count({ where: { companyId } });
  console.log(`Documentos gerados -> novos:${docCreated} | total:${totalDocs}`);

  // ---------------------------------------------------------------------------
  // 5) GALERIA (~8 fotos antes/depois). Idempotente por (companyId, url).
  // ---------------------------------------------------------------------------
  const galleryDefs = [
    { caption: 'Coloração — antes' },
    { caption: 'Coloração — depois' },
    { caption: 'Corte feminino — antes' },
    { caption: 'Corte feminino — depois' },
    { caption: 'Progressiva — antes' },
    { caption: 'Progressiva — depois' },
    { caption: 'Luzes — resultado final' },
    { caption: 'Manicure — arte nas unhas' },
  ];

  let photoCreated = 0;
  for (let i = 0; i < galleryDefs.length; i++) {
    const g = galleryDefs[i];
    const url = `https://picsum.photos/seed/beautypass-galeria-${i + 1}/800/600`;
    const existing = await prisma.galleryPhoto.findFirst({ where: { companyId, url } });
    if (existing) {
      await prisma.galleryPhoto.update({
        where: { id: existing.id },
        data: { caption: g.caption, displayOrder: i },
      });
    } else {
      await prisma.galleryPhoto.create({
        data: { companyId, url, caption: g.caption, displayOrder: i },
      });
      photoCreated++;
    }
  }
  const totalPhotos = await prisma.galleryPhoto.count({ where: { companyId } });
  console.log(`Galeria -> novas:${photoCreated} | total:${totalPhotos}`);

  console.log('STAGING transações/avaliações/promoções/documentos/galeria: OK.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
