import {
  PrismaClient,
  CampaignChannel,
  CampaignStatus,
  CommissionScopeType,
  GoalKind,
  DiscountType,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Staging seed — MARKETING & CADASTROS demo data to fill the Marcas, Cashback,
 * Promoções, Campanhas, Metas, Anamneses pages plus the customer-detail tabs
 * (tags, observações, endereços). Extends the main staging seed
 * (seed-staging.ts): reuses its company, staging customers and staging products.
 *
 * IDEMPOTENT strategy (verified against schema.prisma — none of these models
 * carry a legacyId column, so we use each model's natural key / a staging
 * marker + wipe-and-recreate for child rows):
 *
 *   - Brand:             no unique on (companyId,name) → findFirst by name, create if missing.
 *   - Promotion:         no unique → findFirst by (companyId,name); holds the % / value
 *                        discount + validity that the "Promoções" page shows.
 *   - Coupon:            @@unique([companyId, code]) → upsert on that key, linked to a Promotion.
 *   - CashbackRule:      no unique → findFirst by (companyId, scopeType, percent), create if missing.
 *   - CustomerCashback:  no unique → tagged sourceType='staging'; deleteMany(that source) then create.
 *   - Campaign:          no unique → findFirst by (companyId,name); children (CampaignMessage)
 *                        wiped+recreated per campaign every run.
 *   - Goal:              no unique → findFirst by (companyId, kind, period, employeeId), create if missing.
 *   - AnamnesisTemplate: no unique → findFirst by (companyId,name), create if missing.
 *   - CustomerAnamnesis: no unique → deleteMany by (customerId, templateId) then create.
 *   - CustomerTag:       @@unique([companyId, name]) → upsert tag, then `set` its customers (N:N).
 *   - CustomerNote:      no unique → notes carry a "[staging]" prefix; deleteMany(prefix) then create.
 *   - CustomerAddress:   no unique → deleteMany(customer) then create (staging customers only).
 *
 * ENUM VALUES (verified against schema.prisma):
 *   - CampaignChannel:     whatsapp | sms | email
 *   - CampaignStatus:      draft | scheduled | sending | sent | canceled
 *   - CommissionScopeType: service | product | category | all
 *   - GoalKind:            sales | appointments | customers | commission
 *   - DiscountType:        percent | value
 */
const SOURCE = 'staging';
const NOTE_PREFIX = '[staging]';

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

async function main() {
  console.log('Seeding STAGING marketing/cadastros data...');

  // 1) Reuse the staging company.
  const company =
    (await prisma.company.findFirst({ where: { name: 'Salão Beautypass' } })) ??
    (await prisma.company.findFirst());
  if (!company) throw new Error('No company found. Run the base seed first.');
  const companyId = company.id;
  console.log('Using company:', companyId, company.name);

  // Reuse staging customers (from seed-staging.ts), ordered stably by legacyId.
  const customers = await prisma.customer.findMany({
    where: { companyId, legacySource: SOURCE },
    orderBy: { legacyId: 'asc' },
  });
  if (customers.length === 0) {
    throw new Error('No staging customers found. Run seed-staging.ts first.');
  }
  console.log('Staging customers found:', customers.length);

  // ------------------------------------------------------------------
  // 2) BRANDS (~8 marcas de produtos)
  // ------------------------------------------------------------------
  const brandNames = [
    "L'Oréal Professionnel",
    'Wella Professionals',
    'Truss',
    'Kérastase',
    'Vult',
    'Risqué',
    'Amend',
    'Cadiveu',
  ];
  const brands = [];
  for (const name of brandNames) {
    let brand = await prisma.brand.findFirst({ where: { companyId, name } });
    if (!brand) {
      brand = await prisma.brand.create({ data: { companyId, name, active: true } });
    }
    brands.push(brand);
  }
  console.log('Brands ensured:', brands.length);

  // Link some staging products to brands so the Marcas page shows usage counts.
  const products = await prisma.product.findMany({
    where: { companyId, legacySource: SOURCE },
    orderBy: { legacyId: 'asc' },
  });
  for (let i = 0; i < products.length; i++) {
    const brand = brands[i % brands.length];
    await prisma.product.update({
      where: { id: products[i].id },
      data: { brandId: brand.id },
    });
  }
  console.log('Products linked to brands:', products.length);

  // ------------------------------------------------------------------
  // 3) PROMOTIONS + COUPONS (~6 promoções/cupons com % ou valor + validade)
  // ------------------------------------------------------------------
  const now = new Date('2026-07-22T00:00:00-03:00');
  const daysFromNow = (d: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() + d);
    return x;
  };

  const promoDefs = [
    { code: 'BEMVINDO10', name: 'Boas-vindas (10%)', discountType: DiscountType.percent, discountValue: 10, validFrom: -30, validTo: 90, usageLimit: null as number | null, appliesOnline: true },
    { code: 'ANIVERSARIO', name: 'Aniversariante do mês (20%)', discountType: DiscountType.percent, discountValue: 20, validFrom: -10, validTo: 60, usageLimit: null, appliesOnline: true },
    { code: 'INDICACAO', name: 'Indique uma amiga (R$ 15)', discountType: DiscountType.value, discountValue: 15, validFrom: -60, validTo: 120, usageLimit: 100, appliesOnline: false },
    { code: 'VOLTASEMPRE', name: 'Cliente fiel (15%)', discountType: DiscountType.percent, discountValue: 15, validFrom: -5, validTo: 45, usageLimit: 50, appliesOnline: true },
    { code: 'PRIMAVERA25', name: 'Primavera (25%)', discountType: DiscountType.percent, discountValue: 25, validFrom: 5, validTo: 40, usageLimit: 200, appliesOnline: true },
    { code: 'COMBO50', name: 'Combo escova + hidratação (R$ 50)', discountType: DiscountType.value, discountValue: 50, validFrom: -15, validTo: 30, usageLimit: null, appliesOnline: false },
  ];
  let couponsEnsured = 0;
  for (const def of promoDefs) {
    let promotion = await prisma.promotion.findFirst({ where: { companyId, name: def.name } });
    if (!promotion) {
      promotion = await prisma.promotion.create({
        data: {
          companyId,
          name: def.name,
          scopeType: CommissionScopeType.all,
          discountType: def.discountType,
          discountValue: def.discountValue,
          validFrom: daysFromNow(def.validFrom),
          validTo: daysFromNow(def.validTo),
          usageLimit: def.usageLimit ?? undefined,
          appliesOnline: def.appliesOnline,
        },
      });
    } else {
      promotion = await prisma.promotion.update({
        where: { id: promotion.id },
        data: {
          discountType: def.discountType,
          discountValue: def.discountValue,
          validFrom: daysFromNow(def.validFrom),
          validTo: daysFromNow(def.validTo),
        },
      });
    }
    await prisma.coupon.upsert({
      where: { companyId_code: { companyId, code: def.code } },
      update: { promotionId: promotion.id, usageLimit: def.usageLimit ?? undefined },
      create: {
        companyId,
        code: def.code,
        promotionId: promotion.id,
        usageLimit: def.usageLimit ?? undefined,
        usedCount: randInt(0, def.usageLimit ? Math.min(def.usageLimit, 20) : 20),
      },
    });
    couponsEnsured++;
  }
  console.log('Promotions + Coupons ensured:', couponsEnsured);

  // ------------------------------------------------------------------
  // 4) CASHBACK RULES (1-2) + CUSTOMER CASHBACK balances (~15 clientes)
  // ------------------------------------------------------------------
  const cashbackRuleDefs = [
    { scopeType: CommissionScopeType.all, percent: 5, validityDays: 90 },
    { scopeType: CommissionScopeType.product, percent: 10, validityDays: 60 },
  ];
  let rulesEnsured = 0;
  for (const def of cashbackRuleDefs) {
    const existing = await prisma.cashbackRule.findFirst({
      where: { companyId, scopeType: def.scopeType, percent: def.percent },
    });
    if (!existing) {
      await prisma.cashbackRule.create({
        data: {
          companyId,
          scopeType: def.scopeType,
          percent: def.percent,
          validityDays: def.validityDays,
          active: true,
        },
      });
    }
    rulesEnsured++;
  }
  console.log('CashbackRules ensured:', rulesEnsured);

  // Give ~15 customers a cashback balance. Idempotent: wipe staging-sourced
  // cashback rows for these customers, then recreate.
  const cashbackCustomers = customers.slice(0, 15);
  await prisma.customerCashback.deleteMany({
    where: { sourceType: SOURCE, customerId: { in: cashbackCustomers.map((c) => c.id) } },
  });
  let cashbackRows = 0;
  for (const cust of cashbackCustomers) {
    const amount = randInt(5, 120);
    await prisma.customerCashback.create({
      data: {
        customerId: cust.id,
        amount,
        expiresAt: daysFromNow(randInt(15, 90)),
        sourceType: SOURCE,
        sourceId: `cashback-${cust.legacyId}`,
      },
    });
    cashbackRows++;
  }
  console.log('CustomerCashback balances ensured:', cashbackRows);

  // ------------------------------------------------------------------
  // 5) CAMPAIGNS (~4) + CampaignMessage
  // ------------------------------------------------------------------
  const campaignDefs = [
    { name: 'Reativação — clientes inativos', channel: CampaignChannel.whatsapp, status: CampaignStatus.sent },
    { name: 'Promoção de inverno', channel: CampaignChannel.email, status: CampaignStatus.scheduled },
    { name: 'Aniversariantes de julho', channel: CampaignChannel.whatsapp, status: CampaignStatus.sending },
    { name: 'Lembrete de retorno (30 dias)', channel: CampaignChannel.sms, status: CampaignStatus.draft },
  ];
  let campaignsEnsured = 0;
  let messagesEnsured = 0;
  for (let ci = 0; ci < campaignDefs.length; ci++) {
    const def = campaignDefs[ci];
    let campaign = await prisma.campaign.findFirst({ where: { companyId, name: def.name } });
    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: {
          companyId,
          name: def.name,
          channel: def.channel,
          status: def.status,
          segmentJson: { source: SOURCE, filter: def.name },
        },
      });
    } else {
      campaign = await prisma.campaign.update({
        where: { id: campaign.id },
        data: { channel: def.channel, status: def.status },
      });
    }
    // Wipe + recreate messages for this campaign (idempotent).
    await prisma.campaignMessage.deleteMany({ where: { campaignId: campaign.id } });
    // Target a slice of customers; only "sent"/"sending" campaigns get sentAt.
    const targets = customers.slice(ci * 5, ci * 5 + 8);
    const delivered =
      def.status === CampaignStatus.sent || def.status === CampaignStatus.sending;
    for (const cust of targets) {
      await prisma.campaignMessage.create({
        data: {
          campaignId: campaign.id,
          customerId: cust.id,
          status: delivered ? 'sent' : 'pending',
          sentAt: delivered ? daysFromNow(-randInt(1, 10)) : null,
        },
      });
      messagesEnsured++;
    }
    campaignsEnsured++;
  }
  console.log('Campaigns ensured:', campaignsEnsured, '| messages:', messagesEnsured);

  // ------------------------------------------------------------------
  // 6) GOALS (~5 metas: faturamento, agendamentos, ticket médio via sales, etc.)
  // ------------------------------------------------------------------
  const period = '2026-07';
  const goalDefs = [
    { kind: GoalKind.sales, scopeType: CommissionScopeType.all, target: 45000, employeeIdx: null as number | null },
    { kind: GoalKind.appointments, scopeType: CommissionScopeType.all, target: 220, employeeIdx: null },
    { kind: GoalKind.customers, scopeType: CommissionScopeType.all, target: 30, employeeIdx: null },
    { kind: GoalKind.commission, scopeType: CommissionScopeType.all, target: 6000, employeeIdx: null },
    { kind: GoalKind.sales, scopeType: CommissionScopeType.all, target: 12000, employeeIdx: 0 }, // meta por profissional
  ];
  const professionals = await prisma.professional.findMany({
    where: { companyId },
    orderBy: { createdAt: 'asc' },
  });
  let goalsEnsured = 0;
  for (const def of goalDefs) {
    const employeeId =
      def.employeeIdx != null && professionals[def.employeeIdx]
        ? professionals[def.employeeIdx].id
        : null;
    const existing = await prisma.goal.findFirst({
      where: { companyId, kind: def.kind, period, employeeId },
    });
    if (!existing) {
      await prisma.goal.create({
        data: {
          companyId,
          period,
          scopeType: def.scopeType,
          employeeId: employeeId ?? undefined,
          target: def.target,
          kind: def.kind,
        },
      });
    } else {
      await prisma.goal.update({ where: { id: existing.id }, data: { target: def.target } });
    }
    goalsEnsured++;
  }
  console.log('Goals ensured:', goalsEnsured);

  // ------------------------------------------------------------------
  // 7) ANAMNESIS TEMPLATES (~2) + CustomerAnamnesis em alguns clientes
  // ------------------------------------------------------------------
  const templateDefs = [
    {
      name: 'Anamnese Capilar',
      questionsJson: [
        { id: 'q1', label: 'Já fez alguma química no cabelo?', type: 'boolean' },
        { id: 'q2', label: 'Possui alergia a algum produto?', type: 'text' },
        { id: 'q3', label: 'Usa medicação contínua?', type: 'boolean' },
        { id: 'q4', label: 'Qual o objetivo do procedimento?', type: 'text' },
      ],
    },
    {
      name: 'Anamnese Estética Facial',
      questionsJson: [
        { id: 'q1', label: 'Está gestante ou amamentando?', type: 'boolean' },
        { id: 'q2', label: 'Possui doença de pele?', type: 'text' },
        { id: 'q3', label: 'Faz uso de ácidos?', type: 'boolean' },
        { id: 'q4', label: 'Exposição solar frequente?', type: 'boolean' },
      ],
    },
  ];
  const templates = [];
  for (const def of templateDefs) {
    let tpl = await prisma.anamnesisTemplate.findFirst({ where: { companyId, name: def.name } });
    if (!tpl) {
      tpl = await prisma.anamnesisTemplate.create({
        data: { companyId, name: def.name, questionsJson: def.questionsJson, active: true },
      });
    } else {
      tpl = await prisma.anamnesisTemplate.update({
        where: { id: tpl.id },
        data: { questionsJson: def.questionsJson },
      });
    }
    templates.push(tpl);
  }
  console.log('AnamnesisTemplates ensured:', templates.length);

  // Fill anamnesis for ~10 customers, alternating templates. Idempotent:
  // deleteMany by (customerId, templateId) then create.
  const anamnesisCustomers = customers.slice(0, 10);
  let anamnesisRows = 0;
  for (let i = 0; i < anamnesisCustomers.length; i++) {
    const cust = anamnesisCustomers[i];
    const tpl = templates[i % templates.length];
    await prisma.customerAnamnesis.deleteMany({
      where: { customerId: cust.id, templateId: tpl.id },
    });
    const answers = (tpl.questionsJson as { id: string; type: string }[]).reduce(
      (acc, q) => {
        acc[q.id] = q.type === 'boolean' ? rand() < 0.5 : 'Sem observações.';
        return acc;
      },
      {} as Record<string, unknown>,
    );
    await prisma.customerAnamnesis.create({
      data: {
        customerId: cust.id,
        templateId: tpl.id,
        answersJson: answers,
        signedAt: rand() < 0.7 ? daysFromNow(-randInt(1, 60)) : null,
      },
    });
    anamnesisRows++;
  }
  console.log('CustomerAnamnesis ensured:', anamnesisRows);

  // ------------------------------------------------------------------
  // 8) CUSTOMER DETAILS: Tags (N:N), Notes, Addresses
  // ------------------------------------------------------------------
  // 8a) Tags — upsert by @@unique([companyId, name]); then `set` customers.
  const tagDefs: { name: string; customerIdxs: number[] }[] = [
    { name: 'VIP', customerIdxs: [0, 3, 6, 9, 12] },
    { name: 'Fiel', customerIdxs: [1, 4, 7, 10, 13, 16] },
    { name: 'Novo', customerIdxs: [2, 5, 8, 11] },
    { name: 'Inadimplente', customerIdxs: [14, 17] },
    { name: 'Indicação', customerIdxs: [15, 18, 20] },
  ];
  let tagsEnsured = 0;
  for (const def of tagDefs) {
    const connectIds = def.customerIdxs
      .map((idx) => customers[idx])
      .filter(Boolean)
      .map((c) => ({ id: c.id }));
    await prisma.customerTag.upsert({
      where: { companyId_name: { companyId, name: def.name } },
      update: { customers: { set: connectIds } },
      create: { companyId, name: def.name, customers: { connect: connectIds } },
    });
    tagsEnsured++;
  }
  console.log('CustomerTags ensured:', tagsEnsured);

  // 8b) Notes — staging-prefixed; wipe then recreate for the target customers.
  const noteTexts = [
    'Prefere atendimento no período da tarde.',
    'Alérgica a amônia — usar produtos sem amônia.',
    'Gosta de café sem açúcar durante o atendimento.',
    'Cliente indicada pela Fernanda.',
    'Costuma remarcar; confirmar no dia anterior.',
    'Fez progressiva em maio; retorno recomendado em agosto.',
  ];
  const noteCustomers = customers.slice(0, 12);
  await prisma.customerNote.deleteMany({
    where: {
      customerId: { in: noteCustomers.map((c) => c.id) },
      text: { startsWith: NOTE_PREFIX },
    },
  });
  let notesEnsured = 0;
  for (let i = 0; i < noteCustomers.length; i++) {
    const cust = noteCustomers[i];
    await prisma.customerNote.create({
      data: {
        customerId: cust.id,
        text: `${NOTE_PREFIX} ${noteTexts[i % noteTexts.length]}`,
      },
    });
    notesEnsured++;
  }
  console.log('CustomerNotes ensured:', notesEnsured);

  // 8c) Addresses — wipe then recreate for the target customers.
  const streets = ['Rua das Flores', 'Av. Paulista', 'Rua Augusta', 'Rua Oscar Freire', 'Av. Brasil', 'Rua XV de Novembro'];
  const districts = ['Centro', 'Jardins', 'Vila Mariana', 'Pinheiros', 'Moema', 'Consolação'];
  const cities = ['São Paulo', 'Campinas', 'Santo André', 'Guarulhos'];
  const addressCustomers = customers.slice(0, 20);
  await prisma.customerAddress.deleteMany({
    where: { customerId: { in: addressCustomers.map((c) => c.id) } },
  });
  let addressesEnsured = 0;
  for (let i = 0; i < addressCustomers.length; i++) {
    const cust = addressCustomers[i];
    const zip = `${String(randInt(1000, 9999)).padStart(5, '0')}-${String(randInt(0, 999)).padStart(3, '0')}`;
    await prisma.customerAddress.create({
      data: {
        customerId: cust.id,
        street: streets[i % streets.length],
        number: String(randInt(10, 2000)),
        district: districts[i % districts.length],
        city: cities[i % cities.length],
        state: 'SP',
        zip,
      },
    });
    addressesEnsured++;
  }
  console.log('CustomerAddresses ensured:', addressesEnsured);

  console.log('STAGING marketing/cadastros seed done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
