/**
 * Seeds a brand-new salon owner account for "Samya" with RICH realistic demo
 * data across the whole product, so every screen has real content on first login.
 *
 *   samya@beautypass.dev / samya123
 *
 * Idempotent: re-running is safe. If Samya already has a Better Auth credential
 * AND her company already has demo data, the script just reports and exits.
 *
 * Run (PROD):
 *   DATABASE_URL="$(cat /tmp/bp_prod_dburl.txt)" \
 *   BETTER_AUTH_SECRET="$(cat /tmp/bp_auth_secret.txt)" \
 *   pnpm --filter @beautypass/api exec tsx src/auth/seed-samya.ts
 */
import { prisma } from '@beautypass/db';
import {
  AppointmentStatus,
  CommissionEntryStatus,
  CommissionScopeType,
  AmountType,
  OrderStatus,
  OrderItemKind,
  PaymentStatus,
  TransactionKind,
  InventoryMovementType,
  CashRegisterStatus,
  CashMovementType,
  PackageStatus,
  MembershipStatus,
  DiscountType,
} from '@beautypass/db';
import { auth, ensureOwnerProfessional } from './better-auth';

const SAMYA_EMAIL = 'samya@beautypass.dev';
const SAMYA_PASSWORD = 'samya123';
const SAMYA_NAME = 'Samya';
const COMPANY_NAME = 'Studio Samya';

// ---- date helpers -------------------------------------------------------
const now = new Date();
function daysFromNow(d: number, hour = 10, minute = 0): Date {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + d);
  dt.setHours(hour, minute, 0, 0);
  return dt;
}
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function ensureSamyaUser(): Promise<{ userId: string; companyId: string }> {
  const existingUser = await prisma.user.findUnique({
    where: { email: SAMYA_EMAIL },
    include: { accounts: true },
  });
  const hasCredential = existingUser?.accounts.some((a) => a.providerId === 'credential');

  if (existingUser && hasCredential && existingUser.companyId) {
    // Make sure the company is renamed (idempotent rename).
    await prisma.company.update({
      where: { id: existingUser.companyId },
      data: {
        name: COMPANY_NAME,
        legalName: 'Studio Samya Beleza LTDA',
        timezone: 'America/Sao_Paulo',
        currency: 'BRL',
      },
    });
    return { userId: existingUser.id, companyId: existingUser.companyId };
  }

  // If a placeholder user row exists without a credential, drop it so Better
  // Auth's signUpEmail can recreate it cleanly (mirrors seed-admin).
  if (existingUser && !hasCredential) {
    await prisma.user.delete({ where: { id: existingUser.id } });
  }

  const res = await auth.api.signUpEmail({
    body: { name: SAMYA_NAME, email: SAMYA_EMAIL, password: SAMYA_PASSWORD },
  });

  const created = await prisma.user.findUnique({
    where: { id: res.user.id },
    select: { companyId: true },
  });
  if (!created?.companyId) {
    throw new Error('Sign up did not auto-provision a company for Samya.');
  }

  // Rename the auto-created company into her salon (instead of re-pointing).
  await prisma.company.update({
    where: { id: created.companyId },
    data: {
      name: COMPANY_NAME,
      legalName: 'Studio Samya Beleza LTDA',
      timezone: 'America/Sao_Paulo',
      currency: 'BRL',
    },
  });

  return { userId: res.user.id, companyId: created.companyId };
}

async function main() {
  const { userId, companyId } = await ensureSamyaUser();

  // A dona Samya também é uma Professional (aparece na agenda). Idempotente e
  // fora do guard de demo, pra valer mesmo quando a demo já foi semeada antes.
  await ensureOwnerProfessional(companyId, userId, SAMYA_NAME);

  // Idempotency guard for the heavy demo data.
  const existingServices = await prisma.service.count({ where: { companyId } });
  if (existingServices > 0) {
    console.log(
      `Samya ready: ${SAMYA_EMAIL} / ${SAMYA_PASSWORD} (company ${companyId}, ${COMPANY_NAME}) — demo data already present, skipping.`,
    );
    return;
  }

  // ===== PRODUCT CATEGORIES & SERVICES ==================================
  const catCabelo = await prisma.productCategory.create({
    data: { companyId, name: 'Cabelo' },
  });
  const catUnhas = await prisma.productCategory.create({
    data: { companyId, name: 'Unhas' },
  });
  const catEstetica = await prisma.productCategory.create({
    data: { companyId, name: 'Estética' },
  });
  const catSobrancelha = await prisma.productCategory.create({
    data: { companyId, name: 'Sobrancelha & Cílios' },
  });

  const serviceDefs = [
    { name: 'Corte Feminino', price: 90, durationMin: 60, categoryId: catCabelo.id },
    { name: 'Corte Masculino', price: 55, durationMin: 40, categoryId: catCabelo.id },
    { name: 'Escova', price: 60, durationMin: 45, categoryId: catCabelo.id },
    { name: 'Coloração', price: 220, durationMin: 120, categoryId: catCabelo.id },
    { name: 'Hidratação', price: 90, durationMin: 50, categoryId: catCabelo.id },
    { name: 'Progressiva', price: 350, durationMin: 180, categoryId: catCabelo.id },
    { name: 'Manicure', price: 45, durationMin: 45, categoryId: catUnhas.id },
    { name: 'Pedicure', price: 50, durationMin: 50, categoryId: catUnhas.id },
    { name: 'Esmaltação em Gel', price: 80, durationMin: 60, categoryId: catUnhas.id },
    { name: 'Limpeza de Pele', price: 150, durationMin: 75, categoryId: catEstetica.id },
    { name: 'Design de Sobrancelha', price: 40, durationMin: 30, categoryId: catSobrancelha.id },
    { name: 'Extensão de Cílios', price: 180, durationMin: 90, categoryId: catSobrancelha.id },
  ];
  const services = await Promise.all(
    serviceDefs.map((s, i) =>
      prisma.service.create({
        data: {
          companyId,
          categoryId: s.categoryId,
          name: s.name,
          price: s.price,
          durationMin: s.durationMin,
          cashbackPercent: i % 4 === 0 ? 5 : 0,
          favorite: i < 3,
          displayOrder: i,
        },
      }),
    ),
  );

  // ===== PROFESSIONALS ==================================================
  const proDefs = [
    { name: 'Marina Silva', profession: 'Cabeleireira', svc: [0, 1, 2, 3, 4, 5] },
    { name: 'Júlia Costa', profession: 'Colorista', svc: [3, 4, 5, 2] },
    { name: 'Patrícia Lima', profession: 'Manicure', svc: [6, 7, 8] },
    { name: 'Renata Souza', profession: 'Esteticista', svc: [9, 10, 11] },
  ];
  const professionals = await Promise.all(
    proDefs.map((p) =>
      prisma.professional.create({
        data: {
          companyId,
          name: p.name,
          profession: p.profession,
          phone: '+551198' + Math.floor(1000000 + Math.random() * 8999999),
          schedules: {
            create: [1, 2, 3, 4, 5, 6].map((weekday) => ({
              weekday,
              startTime: weekday === 6 ? '09:00' : '09:00',
              endTime: weekday === 6 ? '14:00' : '19:00',
            })),
          },
          services: { create: p.svc.map((idx) => ({ serviceId: services[idx].id })) },
        },
      }),
    ),
  );

  // ===== CUSTOMERS =====================================================
  const thisMonth = now.getMonth();
  const firstNames = [
    'Ana', 'Beatriz', 'Carla', 'Daniela', 'Fernanda', 'Gabriela', 'Helena',
    'Isabela', 'Juliana', 'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Roberta', 'Vanessa',
  ];
  const lastNames = [
    'Oliveira', 'Santos', 'Pereira', 'Almeida', 'Rodrigues', 'Ferreira', 'Carvalho',
    'Gomes', 'Martins', 'Araújo', 'Ribeiro', 'Barbosa', 'Cardoso', 'Teixeira', 'Moreira',
  ];
  const customers = await Promise.all(
    firstNames.map((fn, i) => {
      // a couple have birthdays this month
      const bday =
        i < 2
          ? new Date(1990 + i, thisMonth, 5 + i * 7)
          : new Date(1985 + (i % 15), (thisMonth + i) % 12, 1 + (i % 27));
      return prisma.customer.create({
        data: {
          companyId,
          name: `${fn} ${pick(lastNames, i)}`,
          phone: '+551197' + Math.floor(1000000 + Math.random() * 8999999),
          email: `${fn.toLowerCase()}.${pick(lastNames, i).toLowerCase()}@example.com`,
          birthday: bday,
        },
      });
    }),
  );

  // ===== PRODUCTS / BRANDS / SUPPLIERS / STOCK =========================
  const brandWella = await prisma.brand.create({ data: { companyId, name: 'Wella' } });
  const brandLoreal = await prisma.brand.create({ data: { companyId, name: "L'Oréal" } });
  const brandOPI = await prisma.brand.create({ data: { companyId, name: 'OPI' } });

  const pcCabelo = catCabelo;
  const pcUnhas = catUnhas;
  const pcRevenda = await prisma.productCategory.create({ data: { companyId, name: 'Revenda' } });

  const supplier1 = await prisma.supplier.create({
    data: { companyId, name: 'Distribuidora Beleza Total', phone: '+551133334444', cnpj: '12345678000190' },
  });
  const supplier2 = await prisma.supplier.create({
    data: { companyId, name: 'Cosméticos São Paulo', phone: '+551144445555', cnpj: '98765432000110' },
  });

  const productDefs = [
    { name: 'Shampoo Hidratante 1L', salePrice: 85, costPrice: 45, stock: 20, minStock: 5, cat: pcCabelo.id, brand: brandWella.id },
    { name: 'Condicionador 1L', salePrice: 90, costPrice: 48, stock: 18, minStock: 5, cat: pcCabelo.id, brand: brandWella.id },
    { name: 'Máscara Reconstrutora 500g', salePrice: 120, costPrice: 65, stock: 12, minStock: 4, cat: pcCabelo.id, brand: brandLoreal.id },
    { name: 'Óleo de Argan 60ml', salePrice: 70, costPrice: 30, stock: 3, minStock: 5, cat: pcCabelo.id, brand: brandLoreal.id }, // low
    { name: 'Tinta Loiro Platinado', salePrice: 55, costPrice: 28, stock: 25, minStock: 8, cat: pcCabelo.id, brand: brandWella.id },
    { name: 'Esmalte Vermelho', salePrice: 25, costPrice: 10, stock: 40, minStock: 10, cat: pcUnhas.id, brand: brandOPI.id },
    { name: 'Esmalte Nude', salePrice: 25, costPrice: 10, stock: 0, minStock: 10, cat: pcUnhas.id, brand: brandOPI.id }, // zero
    { name: 'Base Fortalecedora', salePrice: 30, costPrice: 14, stock: 15, minStock: 5, cat: pcUnhas.id, brand: brandOPI.id },
    { name: 'Acetona 500ml', salePrice: 18, costPrice: 7, stock: 22, minStock: 5, cat: pcUnhas.id, brand: brandOPI.id },
    { name: 'Leave-in Revenda 200ml', salePrice: 65, costPrice: 32, stock: 10, minStock: 3, cat: pcRevenda.id, brand: brandLoreal.id },
    { name: 'Sérum Capilar Revenda', salePrice: 95, costPrice: 50, stock: 2, minStock: 4, cat: pcRevenda.id, brand: brandLoreal.id }, // low
    { name: 'Kit Manutenção Loiros', salePrice: 150, costPrice: 80, stock: 8, minStock: 2, cat: pcRevenda.id, brand: brandWella.id },
  ];
  const products = await Promise.all(
    productDefs.map((p, i) =>
      prisma.product.create({
        data: {
          companyId,
          categoryId: p.cat,
          brandId: p.brand,
          name: p.name,
          salePrice: p.salePrice,
          costPrice: p.costPrice,
          stock: p.stock,
          minStock: p.minStock,
          favorite: i < 2,
        },
      }),
    ),
  );
  // Inventory movements (initial stock entries + a couple of outs)
  await Promise.all(
    products.map((p, i) =>
      prisma.inventoryMovement.create({
        data: {
          productId: p.id,
          type: InventoryMovementType.in,
          quantity: productDefs[i].stock + 5,
          reason: 'Estoque inicial',
        },
      }),
    ),
  );
  await prisma.inventoryMovement.createMany({
    data: [
      { productId: products[0].id, type: InventoryMovementType.out, quantity: 5, reason: 'Venda' },
      { productId: products[3].id, type: InventoryMovementType.out, quantity: 7, reason: 'Uso interno' },
      { productId: products[6].id, type: InventoryMovementType.out, quantity: 10, reason: 'Venda' },
    ],
  });

  // ===== FINANCIAL ACCOUNTS / PAYMENT METHODS / CATEGORIES =============
  const accCaixa = await prisma.financialAccount.create({
    data: { companyId, name: 'Caixa', type: 'cash', initialBalance: 200 },
  });
  const accBanco = await prisma.financialAccount.create({
    data: { companyId, name: 'Banco Inter', type: 'bank', initialBalance: 5000 },
  });

  const pmDinheiro = await prisma.paymentMethod.create({
    data: { companyId, name: 'Dinheiro', goesToCash: true, defaultAccountId: accCaixa.id },
  });
  const pmPix = await prisma.paymentMethod.create({
    data: { companyId, name: 'Pix', defaultAccountId: accBanco.id },
  });
  const pmCredito = await prisma.paymentMethod.create({
    data: { companyId, name: 'Cartão de Crédito', feePercent: 3.5, settlementDays: 30, defaultAccountId: accBanco.id },
  });
  const pmDebito = await prisma.paymentMethod.create({
    data: { companyId, name: 'Cartão de Débito', feePercent: 1.5, settlementDays: 1, defaultAccountId: accBanco.id },
  });
  const paymentMethods = [pmDinheiro, pmPix, pmCredito, pmDebito];

  const fcServicos = await prisma.financialCategory.create({
    data: { companyId, name: 'Serviços', kind: 'credit', countsAsCommission: true },
  });
  const fcProdutos = await prisma.financialCategory.create({
    data: { companyId, name: 'Venda de Produtos', kind: 'credit' },
  });
  const fcAluguel = await prisma.financialCategory.create({
    data: { companyId, name: 'Aluguel', kind: 'debit', isExpense: true },
  });
  const fcFornecedores = await prisma.financialCategory.create({
    data: { companyId, name: 'Fornecedores', kind: 'debit', isExpense: true },
  });

  // ===== APPOINTMENTS (last & next 2 weeks, varied statuses) ===========
  const apptStatuses: AppointmentStatus[] = [
    AppointmentStatus.scheduled,
    AppointmentStatus.confirmed,
    AppointmentStatus.done,
    AppointmentStatus.finished,
    AppointmentStatus.canceled,
    AppointmentStatus.in_progress,
    AppointmentStatus.waiting,
  ];
  let apptCount = 0;
  for (let i = 0; i < 30; i++) {
    const dayOffset = -10 + i; // -10 .. +19
    const hour = 9 + (i % 8);
    const svc = pick(services, i);
    const pro = pick(professionals, i);
    const cust = pick(customers, i);
    // Past appts get terminal statuses; future ones scheduled/confirmed
    const status =
      dayOffset < 0
        ? pick([AppointmentStatus.finished, AppointmentStatus.done, AppointmentStatus.canceled], i)
        : pick([AppointmentStatus.scheduled, AppointmentStatus.confirmed, AppointmentStatus.waiting, AppointmentStatus.in_progress], i);
    const start = daysFromNow(dayOffset, hour, 0);
    const end = new Date(start.getTime() + svc.durationMin * 60000);
    await prisma.appointment.create({
      data: {
        companyId,
        customerId: cust.id,
        professionalId: pro.id,
        status,
        start,
        end,
        source: i % 3 === 0 ? 'online' : 'admin',
        items: {
          create: [
            { serviceId: svc.id, professionalId: pro.id, durationMin: svc.durationMin, price: svc.price },
          ],
        },
      },
    });
    apptCount++;
  }

  // ===== ORDERS (comandas) + payments + transactions ===================
  let orderNumber = 1;
  let orderOpenCount = 0;
  let orderFinishedCount = 0;
  const commissionEntriesData: {
    professionalId: string;
    orderId: string;
    base: number;
    commission: number;
    status: CommissionEntryStatus;
    competenceDate: Date;
  }[] = [];

  for (let i = 0; i < 25; i++) {
    const dayOffset = -12 + i; // mostly past, some recent
    const isFinished = dayOffset < 2; // past & near orders finished, future open
    const cust = pick(customers, i);
    const pro = pick(professionals, i);
    const svc = pick(services, i);
    const prod = pick(products, i);
    const includeProduct = i % 3 === 0;

    const serviceGross = Number(svc.price);
    const productGross = includeProduct ? Number(prod.salePrice) : 0;
    const grossTotal = serviceGross + productGross;
    const discountTotal = i % 5 === 0 ? 10 : 0;
    const netTotal = grossTotal - discountTotal;
    const orderDate = daysFromNow(dayOffset, 11 + (i % 6), 0);

    const order = await prisma.order.create({
      data: {
        companyId,
        number: orderNumber++,
        customerId: cust.id,
        professionalId: pro.id,
        status: isFinished ? OrderStatus.finished : OrderStatus.open,
        grossTotal,
        discountTotal,
        netTotal,
        date: orderDate,
        items: {
          create: [
            {
              kind: OrderItemKind.service,
              refId: svc.id,
              professionalId: pro.id,
              quantity: 1,
              unitPrice: serviceGross,
              grossValue: serviceGross,
              discount: discountTotal,
            },
            ...(includeProduct
              ? [
                  {
                    kind: OrderItemKind.product,
                    refId: prod.id,
                    professionalId: pro.id,
                    quantity: 1,
                    unitPrice: productGross,
                    grossValue: productGross,
                  },
                ]
              : []),
          ],
        },
        statusHistory: {
          create: isFinished
            ? [
                { toStatus: OrderStatus.open, at: orderDate, byUserId: userId },
                { fromStatus: OrderStatus.open, toStatus: OrderStatus.finished, at: orderDate, byUserId: userId },
              ]
            : [{ toStatus: OrderStatus.open, at: orderDate, byUserId: userId }],
        },
      },
    });

    if (isFinished) {
      orderFinishedCount++;
      const pm = pick(paymentMethods, i);
      const acc = pm.goesToCash ? accCaixa : accBanco;
      await prisma.orderPayment.create({
        data: {
          orderId: order.id,
          paymentMethodId: pm.id,
          accountId: acc.id,
          amount: netTotal,
          paidAt: orderDate,
          status: PaymentStatus.paid,
        },
      });
      // Income transaction matching the finalized order
      await prisma.transaction.create({
        data: {
          companyId,
          kind: TransactionKind.income,
          accountId: acc.id,
          categoryId: includeProduct ? fcProdutos.id : fcServicos.id,
          paymentMethodId: pm.id,
          description: `Comanda #${order.number}`,
          grossAmount: netTotal,
          paidAt: orderDate,
          dueDate: orderDate,
          status: PaymentStatus.paid,
          orderId: order.id,
        },
      });
      // Commission entry (40% of service value)
      commissionEntriesData.push({
        professionalId: pro.id,
        orderId: order.id,
        base: serviceGross,
        commission: Math.round(serviceGross * 0.4 * 100) / 100,
        status: i % 3 === 0 ? CommissionEntryStatus.paid : CommissionEntryStatus.open,
        competenceDate: orderDate,
      });
    } else {
      orderOpenCount++;
    }
  }

  // A couple of expense transactions
  await prisma.transaction.createMany({
    data: [
      {
        companyId,
        kind: TransactionKind.expense,
        accountId: accBanco.id,
        categoryId: fcAluguel.id,
        description: 'Aluguel do salão',
        grossAmount: 2800,
        dueDate: daysFromNow(-5, 9, 0),
        paidAt: daysFromNow(-5, 9, 0),
        status: PaymentStatus.paid,
      },
      {
        companyId,
        kind: TransactionKind.expense,
        accountId: accBanco.id,
        categoryId: fcFornecedores.id,
        description: 'Compra de produtos - Distribuidora Beleza Total',
        grossAmount: 1200,
        dueDate: daysFromNow(-3, 9, 0),
        paidAt: daysFromNow(-3, 9, 0),
        status: PaymentStatus.paid,
      },
      {
        companyId,
        kind: TransactionKind.expense,
        accountId: accBanco.id,
        categoryId: fcFornecedores.id,
        description: 'Energia elétrica',
        grossAmount: 540,
        dueDate: daysFromNow(4, 9, 0),
        status: PaymentStatus.pending,
      },
    ],
  });

  // ===== CASH REGISTERS + MOVEMENTS ====================================
  const closedRegister = await prisma.cashRegister.create({
    data: {
      companyId,
      number: 1,
      responsibleUserId: userId,
      openingBalance: 200,
      countedBalance: 980,
      openedAt: daysFromNow(-2, 8, 0),
      closedAt: daysFromNow(-2, 19, 0),
      status: CashRegisterStatus.closed,
      movements: {
        create: [
          { type: CashMovementType.in, paymentMethodId: pmDinheiro.id, amount: 90, at: daysFromNow(-2, 10, 0) },
          { type: CashMovementType.in, paymentMethodId: pmDinheiro.id, amount: 220, at: daysFromNow(-2, 13, 0) },
          { type: CashMovementType.in, paymentMethodId: pmDinheiro.id, amount: 520, at: daysFromNow(-2, 16, 0) },
          { type: CashMovementType.out, paymentMethodId: pmDinheiro.id, amount: 50, refType: 'sangria', at: daysFromNow(-2, 17, 0) },
        ],
      },
    },
  });
  const openRegister = await prisma.cashRegister.create({
    data: {
      companyId,
      number: 2,
      responsibleUserId: userId,
      openingBalance: 200,
      openedAt: daysFromNow(0, 8, 0),
      status: CashRegisterStatus.open,
      movements: {
        create: [
          { type: CashMovementType.in, paymentMethodId: pmDinheiro.id, amount: 90, at: daysFromNow(0, 9, 30) },
          { type: CashMovementType.in, paymentMethodId: pmDinheiro.id, amount: 45, at: daysFromNow(0, 11, 0) },
        ],
      },
    },
  });

  // ===== COMMISSION RULE + ENTRIES =====================================
  const commissionRule = await prisma.commissionRule.create({
    data: {
      companyId,
      scopeType: CommissionScopeType.all,
      type: AmountType.percent,
      value: 40,
    },
  });
  for (const ce of commissionEntriesData) {
    await prisma.commissionEntry.create({
      data: {
        companyId,
        professionalId: ce.professionalId,
        orderId: ce.orderId,
        baseAmount: ce.base,
        commissionAmount: ce.commission,
        status: ce.status,
        competenceDate: ce.competenceDate,
        availableDate: ce.competenceDate,
      },
    });
  }

  // ===== PACKAGES ======================================================
  const pkgTemplate1 = await prisma.packageTemplate.create({
    data: {
      companyId,
      name: 'Pacote 4 Escovas',
      price: 200,
      validityDays: 60,
      discount: 40,
      items: { create: [{ serviceId: services[2].id, sessions: 4 }] },
    },
  });
  const pkgTemplate2 = await prisma.packageTemplate.create({
    data: {
      companyId,
      name: 'Combo Unhas (Mão + Pé) x4',
      price: 320,
      validityDays: 90,
      discount: 60,
      items: {
        create: [
          { serviceId: services[6].id, sessions: 4 },
          { serviceId: services[7].id, sessions: 4 },
        ],
      },
    },
  });
  let pkgNumber = 1;
  await prisma.customerPackage.create({
    data: {
      companyId,
      customerId: customers[0].id,
      templateId: pkgTemplate1.id,
      number: pkgNumber++,
      price: 200,
      status: PackageStatus.active,
      expiresAt: daysFromNow(50, 12, 0),
      items: { create: [{ serviceId: services[2].id, sessionsTotal: 4, sessionsUsed: 1 }] },
    },
  });
  await prisma.customerPackage.create({
    data: {
      companyId,
      customerId: customers[3].id,
      templateId: pkgTemplate2.id,
      number: pkgNumber++,
      price: 320,
      status: PackageStatus.active,
      expiresAt: daysFromNow(80, 12, 0),
      items: {
        create: [
          { serviceId: services[6].id, sessionsTotal: 4, sessionsUsed: 2 },
          { serviceId: services[7].id, sessionsTotal: 4, sessionsUsed: 1 },
        ],
      },
    },
  });

  // ===== MEMBERSHIP ====================================================
  const membershipPlan = await prisma.membershipPlan.create({
    data: {
      companyId,
      name: 'Clube Studio Samya',
      recurringPrice: 199,
      intervalMonths: 1,
      services: {
        create: [
          { serviceId: services[2].id, quantityPerCycle: 2 },
          { serviceId: services[10].id, quantityPerCycle: 1 },
        ],
      },
    },
  });
  await prisma.customerMembership.create({
    data: {
      companyId,
      customerId: customers[1].id,
      membershipPlanId: membershipPlan.id,
      status: MembershipStatus.active,
      nextDueDate: daysFromNow(15, 12, 0),
      payments: {
        create: [
          { amount: 199, dueDate: daysFromNow(-15, 12, 0), paidAt: daysFromNow(-15, 12, 0), status: PaymentStatus.paid },
          { amount: 199, dueDate: daysFromNow(15, 12, 0), status: PaymentStatus.pending },
        ],
      },
    },
  });
  await prisma.customerMembership.create({
    data: {
      companyId,
      customerId: customers[4].id,
      membershipPlanId: membershipPlan.id,
      status: MembershipStatus.active,
      nextDueDate: daysFromNow(8, 12, 0),
      payments: {
        create: [{ amount: 199, dueDate: daysFromNow(-22, 12, 0), paidAt: daysFromNow(-22, 12, 0), status: PaymentStatus.paid }],
      },
    },
  });

  // ===== BOOKING LINK ==================================================
  await prisma.bookingLink.create({
    data: { companyId, slug: 'studio-samya', active: true },
  });

  // ===== PROMOTIONS ====================================================
  await prisma.promotion.createMany({
    data: [
      {
        companyId,
        name: 'Terça da Beleza - 20% OFF',
        scopeType: CommissionScopeType.all,
        discountType: DiscountType.percent,
        discountValue: 20,
        validFrom: daysFromNow(-30, 0, 0),
        validTo: daysFromNow(30, 0, 0),
        appliesOnline: true,
      },
      {
        companyId,
        name: 'Indique uma amiga - R$15',
        scopeType: CommissionScopeType.service,
        discountType: DiscountType.value,
        discountValue: 15,
        validFrom: daysFromNow(-10, 0, 0),
        validTo: daysFromNow(60, 0, 0),
        appliesOnline: false,
      },
    ],
  });

  // ===== REVIEWS =======================================================
  const reviewComments = [
    'Amei o resultado, super recomendo!',
    'Atendimento impecável e ambiente acolhedor.',
    'Profissionais muito atenciosas, voltarei sempre.',
    'Adorei minha escova, ficou perfeita!',
    'Pontuais e caprichosas. Nota 10!',
  ];
  await Promise.all(
    reviewComments.map((comment, i) =>
      prisma.review.create({
        data: {
          companyId,
          customerId: pick(customers, i).id,
          professionalId: pick(professionals, i).id,
          serviceId: pick(services, i).id,
          rating: i % 5 === 0 ? 4 : 5,
          comment,
        },
      }),
    ),
  );

  // ===== CASHBACK RULE =================================================
  await prisma.cashbackRule.create({
    data: {
      companyId,
      scopeType: CommissionScopeType.all,
      percent: 5,
      validityDays: 90,
      active: true,
    },
  });

  // ===== GOALS =========================================================
  const periodNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  await prisma.goal.createMany({
    data: [
      { companyId, period: periodNow, scopeType: CommissionScopeType.all, target: 25000, kind: 'sales' },
      { companyId, period: periodNow, scopeType: CommissionScopeType.all, target: 120, kind: 'appointments' },
      { companyId, period: periodNow, scopeType: CommissionScopeType.all, target: 15, kind: 'customers' },
    ],
  });

  // ===== NOTIFICATIONS =================================================
  await prisma.notification.createMany({
    data: [
      { companyId, userId, type: 'stock', title: 'Estoque baixo', body: 'Ólede Argan e Sérum Capilar estão abaixo do mínimo.' },
      { companyId, userId, type: 'birthday', title: 'Aniversariantes do mês', body: 'Você tem clientes fazendo aniversário este mês.' },
      { companyId, userId, type: 'appointment', title: 'Novos agendamentos online', body: 'Há novos agendamentos pelo link de reservas.' },
      { companyId, userId, type: 'finance', title: 'Conta a pagar', body: 'Conta de energia elétrica vence em breve.' },
    ],
  });

  // ===== SUMMARY =======================================================
  const counts = {
    services: services.length,
    professionals: professionals.length,
    customers: customers.length,
    products: products.length,
    appointments: apptCount,
    ordersFinished: orderFinishedCount,
    ordersOpen: orderOpenCount,
    commissionEntries: commissionEntriesData.length,
  };
  console.log(
    `Samya ready: ${SAMYA_EMAIL} / ${SAMYA_PASSWORD} (company ${companyId}, ${COMPANY_NAME})`,
  );
  console.log('Counts:', JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
