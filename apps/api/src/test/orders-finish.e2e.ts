/**
 * Comanda finish/reopen reconciliation suite (real DB, no mocks).
 *
 * WHY THIS EXISTS
 * ----------------
 * `OrdersService.finish()` moves money and stock: closing a comanda must
 * reconcile with Financeiro (Transaction income/paid), Caixa (CashMovement in),
 * Comissões (CommissionEntry) and Estoque (InventoryMovement out on SOLD
 * products) — atomically and idempotently. `reopen()` and cancel must reverse
 * exactly what finish generated. This suite proves that contract against the
 * REAL Nest app + REAL Postgres, exercising the HTTP endpoints for finish/reopen.
 *
 * HOW IT RUNS
 * -----------
 *   pnpm --filter @beautypass/api test:orders-finish
 *
 * It boots the API in-process on a dedicated port, signs up one throwaway salon
 * tenant, provisions a catalog + an open cash register + a comanda with one sold
 * product (with batch) and one service (with a commission rule) directly through
 * Prisma, finishes the comanda over HTTP, asserts every side effect, then reopens
 * it and asserts every side effect is reversed. The throwaway company is deleted
 * at the end (cascades clean up). No production data is touched.
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// --- Load env BEFORE importing anything that reads it at module init. ---
function loadEnv() {
  for (const file of ['.env', join('..', '..', 'packages', 'db', '.env')]) {
    try {
      const raw = readFileSync(join(process.cwd(), file), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        const key = m[1];
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      /* file may not exist; ignore */
    }
  }
}
loadEnv();

const PORT = Number(process.env.ORDERS_FINISH_TEST_PORT ?? 4620);
process.env.BETTER_AUTH_URL = `http://localhost:${PORT}`;
const BASE = `http://localhost:${PORT}/api/v1`;

// --------------------------- assertion harness ---------------------------
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${label}`);
  }
}

// --------------------------- HTTP helper ---------------------------
type ApiResp = { status: number; body: any; token: string | null };

async function api(
  method: string,
  path: string,
  opts: { token?: string | null; body?: unknown } = {},
): Promise<ApiResp> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: `http://localhost:${PORT}`,
  };
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const token = res.headers.get('set-auth-token');
  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body, token };
}

async function signUpStaff(): Promise<{ token: string; userId: string }> {
  const email = `finish-${Date.now()}-${Math.floor(Math.random() * 1e6)}@orders.test`;
  const password = 'orders-finish-pw-123';
  const res = await api('POST', '/auth/sign-up/email', {
    body: { name: 'Studio Reconciliação', email, password },
  });
  let token = res.token;
  let userId = res.body?.user?.id ?? '';
  if (!token) {
    const signin = await api('POST', '/auth/sign-in/email', { body: { email, password } });
    token = signin.token;
    userId = userId || signin.body?.user?.id || '';
  }
  if (!token) throw new Error(`could not obtain token: ${res.status} ${JSON.stringify(res.body)}`);
  return { token, userId };
}

const D = (x: any) => Number(x ?? 0);

// --------------------------- main ---------------------------
async function run() {
  const { NestFactory } = await import('@nestjs/core');
  const { ValidationPipe } = await import('@nestjs/common');
  const expressMod = await import('express');
  const express = (expressMod as any).default ?? expressMod;
  const { toNodeHandler } = await import('better-auth/node');
  const { AppModule } = await import('../app.module.js');
  const { auth } = await import('../auth/better-auth.js');
  const { prisma } = await import('@beautypass/db');

  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error', 'warn'] });
  app.setGlobalPrefix('api/v1');
  const instance = app.getHttpAdapter().getInstance();
  instance.all(/^\/api\/v1\/auth\/.*/, toNodeHandler(auth));
  instance.use(express.json());
  instance.use(express.urlencoded({ extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  await app.listen(PORT);
  // eslint-disable-next-line no-console
  console.log(`\n▶ Orders finish/reopen suite running against ${BASE}\n`);

  let companyId = '';

  try {
    const salon = await signUpStaff();
    for (let i = 0; i < 15 && !companyId; i++) {
      const cur = await api('GET', '/companies/current', { token: salon.token });
      if (cur.status === 200 && cur.body?.id) companyId = cur.body.id;
      else await new Promise((r) => setTimeout(r, 200));
    }
    check('salon company provisioned', !!companyId);

    // --------------------------------------------------------------
    // Provision catalog directly through Prisma (full control).
    // --------------------------------------------------------------
    const accCaixa = await prisma.financialAccount.create({
      data: { companyId, name: 'Caixa', type: 'cash' },
    });
    // Income category (kind=credit) — finish must attach it to the Transaction.
    // O salão já NASCE com categorias padrão (provisionamento no cadastro), e
    // `finish()` usa a PRIMEIRA categoria de receita ativa da empresa. Resolver
    // aqui em vez de criar outra: fabricar uma segunda faria o teste afirmar
    // algo que o código não promete.
    const incomeCat = await prisma.financialCategory.findFirstOrThrow({
      where: { companyId, kind: 'credit', active: true },
      orderBy: { createdAt: 'asc' },
    });
    // Payment methods with different financial-auto flags. Both must still
    // appear in the open cash register's payment reconciliation.
    const pmCash = await prisma.paymentMethod.create({
      data: { companyId, name: 'Dinheiro', goesToCash: true, defaultAccountId: accCaixa.id },
    });
    const pmCard = await prisma.paymentMethod.create({
      data: { companyId, name: 'Crédito', goesToCash: false },
    });

    // Professional who receives commission. The service carries the catalog
    // default (the Belasis model); a per-professional rule may override it.
    const pro = await prisma.professional.create({
      data: { companyId, name: 'Paula Cabeleireira', receivesCommission: true },
    });
    const service = await prisma.service.create({
      data: { companyId, name: 'Corte', price: 100, defaultCommissionPercent: 30 },
    });

    // Product to SELL directly (10% default commission), with a batch.
    const product = await prisma.product.create({
      data: {
        companyId,
        name: 'Shampoo',
        salePrice: 50,
        stock: 10,
        trackStock: true,
        defaultCommissionPercent: 10,
      },
    });
    const batch = await prisma.productBatch.create({
      data: { companyId, productId: product.id, code: 'L1', quantity: 10 },
    });

    // Open cash register yesterday: cash registers remain open across days
    // until somebody explicitly closes them.
    const openedYesterday = new Date(Date.now() - 36 * 60 * 60 * 1000);
    const cash = await prisma.cashRegister.create({
      data: {
        companyId,
        number: 1,
        openingBalance: 0,
        status: 'open',
        openedAt: openedYesterday,
      },
    });

    // Guardrail: a partial payment cannot finish a command or silently omit it
    // from the cash register.
    const underpaidOrder = await prisma.order.create({
      data: {
        companyId,
        number: 2,
        status: 'open',
        items: {
          create: {
            kind: 'service',
            refId: service.id,
            professionalId: pro.id,
            quantity: 1,
            unitPrice: 100,
            grossValue: 100,
          },
        },
      },
    });
    await prisma.orderPayment.create({
      data: {
        orderId: underpaidOrder.id,
        paymentMethodId: pmCash.id,
        amount: 50,
        status: 'pending',
      },
    });
    const underpaidFinish = await api('POST', `/orders/${underpaidOrder.id}/finish`, {
      token: salon.token,
    });
    check('underpaid finish → 400', underpaidFinish.status === 400);
    const underpaidAfter = await prisma.order.findUnique({
      where: { id: underpaidOrder.id },
      select: { status: true },
    });
    check('underpaid finish: order remains open', underpaidAfter?.status === 'open');
    check(
      'underpaid finish: no cash movement',
      (await prisma.cashMovement.count({
        where: { cashRegisterId: cash.id, refId: underpaidOrder.id },
      })) === 0,
    );

    // Comanda with: 1 service (R$100, pro), 1 sold product (2 x R$50 = R$100, batch).
    const order = await prisma.order.create({
      data: {
        companyId,
        number: 1,
        professionalId: pro.id,
        status: 'open',
        items: {
          create: [
            {
              kind: 'service',
              refId: service.id,
              professionalId: pro.id,
              quantity: 1,
              unitPrice: 100,
              grossValue: 100,
            },
            {
              kind: 'product',
              refId: product.id,
              professionalId: pro.id,
              quantity: 2,
              unitPrice: 50,
              grossValue: 100,
              batchId: batch.id,
            },
          ],
        },
      },
    });
    // Payments: R$150 cash (goesToCash) + R$50 card (not). Total 200 = order net.
    await prisma.orderPayment.createMany({
      data: [
        { orderId: order.id, paymentMethodId: pmCash.id, amount: 150, status: 'pending' },
        { orderId: order.id, paymentMethodId: pmCard.id, amount: 50, status: 'pending' },
      ],
    });

    // ==============================================================
    // FINISH — reconcile everything
    // ==============================================================
    const fin = await api('POST', `/orders/${order.id}/finish`, { token: salon.token });
    check('finish → 2xx', fin.status >= 200 && fin.status < 300);
    check('finish → status finished', fin.body?.status === 'finished');

    // --- Financeiro: one Transaction (income/paid) per payment ---
    const txns = await prisma.transaction.findMany({ where: { companyId, orderId: order.id } });
    check('finish: 2 income transactions (one per payment)', txns.length === 2);
    check('finish: all transactions kind=income', txns.every((t) => t.kind === 'income'));
    check('finish: all transactions status=paid', txns.every((t) => t.status === 'paid'));
    check('finish: all transactions have paidAt', txns.every((t) => !!t.paidAt));
    check(
      'finish: transactions sum equals payments (200)',
      Math.abs(txns.reduce((a, t) => a + D(t.grossAmount), 0) - 200) < 0.001,
    );
    check(
      'finish: cash transaction carries the default account',
      txns.some((t) => t.paymentMethodId === pmCash.id && t.accountId === accCaixa.id),
    );
    check(
      'finish: transactions carry the income category',
      txns.every((t) => t.categoryId === incomeCat.id),
    );

    // --- Caixa: every payment is reconciled, regardless of financial-auto flag ---
    const moves = await prisma.cashMovement.findMany({
      where: { cashRegisterId: cash.id, refType: 'order', refId: order.id },
    });
    check('finish: exactly 2 cash movements (all payments)', moves.length === 2);
    check('finish: cash movements are type in', moves.every((m) => m.type === 'in'));
    check(
      'finish: cash movements sum to the full order (200)',
      Math.abs(moves.reduce((sum, movement) => sum + D(movement.amount), 0) - 200) < 0.001,
    );
    check(
      'finish: cash register includes card even with goesToCash=false',
      moves.some((movement) => movement.paymentMethodId === pmCard.id),
    );
    check(
      'finish: yesterday cash remains the selected register',
      moves.every((movement) => movement.cashRegisterId === cash.id),
    );

    // --- Comissão: CommissionEntry per commissionable item ---
    const entries = await prisma.commissionEntry.findMany({
      where: { companyId, orderId: order.id },
    });
    check('finish: 2 commission entries (service + product)', entries.length === 2);
    check('finish: all entries status=open', entries.every((e) => e.status === 'open'));
    // service base 100 * 30% = 30 ; product base 100 * 10% = 10
    const svcEntry = entries.find((e) => D(e.baseAmount) === 100 && Math.abs(D(e.commissionAmount) - 30) < 0.001);
    const prodEntry = entries.find((e) => D(e.baseAmount) === 100 && Math.abs(D(e.commissionAmount) - 10) < 0.001);
    check('finish: service commission = 30% of 100 = 30', !!svcEntry);
    check('finish: product commission = 10% default of 100 = 10', !!prodEntry);

    // --- Estoque: SOLD product decremented (2 units); batch decremented ---
    const prodAfter = await prisma.product.findUnique({ where: { id: product.id }, select: { stock: true } });
    check('finish: product stock 10 → 8 (sold 2)', D(prodAfter?.stock) === 8);
    const batchAfter = await prisma.productBatch.findUnique({ where: { id: batch.id }, select: { quantity: true } });
    check('finish: batch quantity 10 → 8', D(batchAfter?.quantity) === 8);
    const invOut = await prisma.inventoryMovement.findMany({
      where: { productId: product.id, refType: 'order', refId: order.id, type: 'out' },
    });
    check('finish: 1 inventory out movement for the sold product', invOut.length === 1);
    check('finish: inventory out quantity = 2', D(invOut[0]?.quantity) === 2);

    // --- Idempotency: finishing again does not duplicate ---
    const fin2 = await api('POST', `/orders/${order.id}/finish`, { token: salon.token });
    check('re-finish → 2xx (idempotent no-op)', fin2.status >= 200 && fin2.status < 300);
    const txns2 = await prisma.transaction.count({ where: { companyId, orderId: order.id } });
    const moves2 = await prisma.cashMovement.count({ where: { cashRegisterId: cash.id, refType: 'order', refId: order.id } });
    const entries2 = await prisma.commissionEntry.count({ where: { companyId, orderId: order.id } });
    const prodIdem = await prisma.product.findUnique({ where: { id: product.id }, select: { stock: true } });
    check('idempotent: transactions still 2', txns2 === 2);
    check('idempotent: cash movements still 2', moves2 === 2);
    check('idempotent: commission entries still 2', entries2 === 2);
    check('idempotent: product stock still 8', D(prodIdem?.stock) === 8);

    // ==============================================================
    // REOPEN — everything reversed
    // ==============================================================
    const reo = await api('POST', `/orders/${order.id}/reopen`, { token: salon.token });
    check('reopen → 2xx', reo.status >= 200 && reo.status < 300);
    check('reopen → status open', reo.body?.status === 'open');

    // Transactions: originals reversed + counter-entries reversed → net 0 in DRE.
    const txnsR = await prisma.transaction.findMany({ where: { companyId, orderId: order.id } });
    check('reopen: no paid transaction remains', txnsR.every((t) => t.status !== 'paid'));
    check('reopen: originals marked reversed', txnsR.filter((t) => !t.reversalOfId).every((t) => t.status === 'reversed'));
    check('reopen: a counter-entry exists per original', txnsR.filter((t) => t.reversalOfId).length === 2);

    // Commission entries reversed.
    const entriesR = await prisma.commissionEntry.findMany({ where: { companyId, orderId: order.id } });
    check('reopen: commission entries all reversed', entriesR.length === 2 && entriesR.every((e) => e.status === 'reversed'));

    // Cash: a counter (out) movement neutralizes the in → net 0 for the order.
    const movesR = await prisma.cashMovement.findMany({
      where: { cashRegisterId: cash.id, refType: 'order', refId: order.id },
    });
    const netCash = movesR.reduce((a, m) => a + (m.type === 'in' ? D(m.amount) : -D(m.amount)), 0);
    check('reopen: cash net for the order back to 0', Math.abs(netCash) < 0.001);

    // Stock restored.
    const prodR = await prisma.product.findUnique({ where: { id: product.id }, select: { stock: true } });
    check('reopen: product stock restored to 10', D(prodR?.stock) === 10);
    const batchR = await prisma.productBatch.findUnique({ where: { id: batch.id }, select: { quantity: true } });
    check('reopen: batch quantity restored to 10', D(batchR?.quantity) === 10);

    // Idempotency of reverse: reopening path already reset; re-finish then cancel.
    const fin3 = await api('POST', `/orders/${order.id}/finish`, { token: salon.token });
    check('re-finish after reopen → 2xx', fin3.status >= 200 && fin3.status < 300);
    const prodRefin = await prisma.product.findUnique({ where: { id: product.id }, select: { stock: true } });
    check('re-finish after reopen: stock 10 → 8 again', D(prodRefin?.stock) === 8);
    const txnsRefin = await prisma.transaction.count({
      where: { companyId, orderId: order.id, status: 'paid' },
    });
    check('re-finish after reopen: exactly 2 fresh paid transactions', txnsRefin === 2);

    // Cancel (remove) a finished order also reverses everything.
    const cancel = await api('DELETE', `/orders/${order.id}`, { token: salon.token });
    check('cancel finished order → 2xx', cancel.status >= 200 && cancel.status < 300);
    const prodCancel = await prisma.product.findUnique({ where: { id: product.id }, select: { stock: true } });
    check('cancel: product stock restored to 10', D(prodCancel?.stock) === 10);
    const paidAfterCancel = await prisma.transaction.count({
      where: { companyId, orderId: order.id, status: 'paid' },
    });
    check('cancel: no paid transaction remains', paidAfterCancel === 0);
    const openEntriesAfterCancel = await prisma.commissionEntry.count({
      where: { companyId, orderId: order.id, status: 'open' },
    });
    check('cancel: no open commission entry remains', openEntriesAfterCancel === 0);

    // Guardrail: a paid comanda also cannot finish when there is no manually
    // open cash register. No register is opened automatically by date.
    await prisma.cashRegister.update({
      where: { id: cash.id },
      data: { status: 'closed', closedAt: new Date() },
    });
    const noCashOrder = await prisma.order.create({
      data: {
        companyId,
        number: 3,
        status: 'open',
        items: {
          create: {
            kind: 'service',
            refId: service.id,
            professionalId: pro.id,
            quantity: 1,
            unitPrice: 100,
            grossValue: 100,
          },
        },
        payments: {
          create: {
            paymentMethodId: pmCash.id,
            amount: 100,
            status: 'pending',
          },
        },
      },
    });
    const noCashFinish = await api('POST', `/orders/${noCashOrder.id}/finish`, {
      token: salon.token,
    });
    check('finish without open cash → 400', noCashFinish.status === 400);
    const noCashAfter = await prisma.order.findUnique({
      where: { id: noCashOrder.id },
      select: { status: true },
    });
    check('finish without open cash: order remains open', noCashAfter?.status === 'open');
  } finally {
    const { prisma } = await import('@beautypass/db');
    if (companyId) {
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  }

  const total = passed + failed;
  // eslint-disable-next-line no-console
  console.log(
    `\n──────────────────────────────────────────────\n` +
      `Orders finish/reopen: ${passed}/${total} assertions passed` +
      (failed ? `, ${failed} FAILED` : '') +
      `\n──────────────────────────────────────────────`,
  );
  if (failed) {
    // eslint-disable-next-line no-console
    console.error(`\nFailed assertions:\n - ${failures.join('\n - ')}`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Suite crashed:', e);
  process.exit(1);
});
