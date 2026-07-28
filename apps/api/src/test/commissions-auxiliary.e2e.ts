/**
 * Rateio de auxiliares na comissão (banco real, sem mocks).
 *
 * POR QUE EXISTE
 * --------------
 * `OrderItemAuxiliary` guarda o auxiliar de um item de serviço: quem recebe,
 * quanto, e — o campo que muda tudo — de ONDE sai o dinheiro (`discountFrom`):
 *
 *   establishment → o salão paga; a comissão do profissional principal não é tocada.
 *   professional  → sai da comissão do principal e vira a coluna "Desconto de Auxiliares".
 *
 * Errar essa conta não quebra tela nenhuma: paga o profissional errado e ninguém
 * percebe até o fim do mês. Por isso esta suíte prova o contrato contra o Nest
 * REAL + Postgres REAL, finalizando comandas por HTTP e conferindo cada
 * `CommissionEntry` gerada.
 *
 * COMO RODA
 * ---------
 *   pnpm --filter @beautypass/api test:commissions-aux
 *
 * Sobe a API em processo numa porta dedicada, cria um salão descartável,
 * provisiona catálogo/caixa/comandas via Prisma, finaliza por HTTP e apaga a
 * empresa no fim (cascade limpa o resto). Nenhum dado de produção é tocado.
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// --- Carrega env ANTES de importar qualquer coisa que leia no module init. ---
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
      /* arquivo pode não existir */
    }
  }
}
loadEnv();

const PORT = Number(process.env.COMMISSIONS_AUX_TEST_PORT ?? 4622);
process.env.BETTER_AUTH_URL = `http://localhost:${PORT}`;
const BASE = `http://localhost:${PORT}/api/v1`;

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(label + (detail ? ` (${detail})` : ''));
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

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
  const email = `aux-${Date.now()}-${Math.floor(Math.random() * 1e6)}@commissions.test`;
  const password = 'commissions-aux-pw-123';
  const res = await api('POST', '/auth/sign-up/email', {
    body: { name: 'Studio Rateio', email, password },
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
const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

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
  console.log(`\n▶ Rateio de auxiliares rodando contra ${BASE}\n`);

  let companyId = '';

  try {
    const salon = await signUpStaff();
    for (let i = 0; i < 15 && !companyId; i++) {
      const cur = await api('GET', '/companies/current', { token: salon.token });
      if (cur.status === 200 && cur.body?.id) companyId = cur.body.id;
      else await new Promise((r) => setTimeout(r, 200));
    }
    check('salão provisionado', !!companyId);

    // O módulo de Comissões é gated por plano (`@RequireFeature('commissions')`,
    // commissions.controller.ts:33) e o salão recém-criado cai num plano que não
    // o inclui — sem isto o caso 7 volta 402 e não testa nada.
    await prisma.featureFlag.create({
      data: { companyId, key: 'commissions', enabled: true },
    });

    // ---------------- catálogo ----------------
    const accCaixa = await prisma.financialAccount.create({
      data: { companyId, name: 'Caixa', type: 'cash' },
    });
    await prisma.financialCategory.create({
      data: { companyId, name: 'Serviços', kind: 'credit' },
    });
    const pmCash = await prisma.paymentMethod.create({
      data: { companyId, name: 'Dinheiro', goesToCash: true, defaultAccountId: accCaixa.id },
    });

    // Principal com 30% no catálogo; dois auxiliares distintos.
    const principal = await prisma.professional.create({
      data: { companyId, name: 'Paula Principal', receivesCommission: true },
    });
    const auxA = await prisma.professional.create({
      data: { companyId, name: 'Ana Auxiliar', receivesCommission: true },
    });
    // Deliberadamente com receivesCommission = false: o rateio foi digitado à
    // mão naquele item, então tem que valer mesmo assim. Se este check quebrar,
    // a tela aceita um auxiliar que o cálculo descarta em silêncio.
    const auxB = await prisma.professional.create({
      data: { companyId, name: 'Bia Auxiliar', receivesCommission: false },
    });
    const service = await prisma.service.create({
      data: { companyId, name: 'Coloração', price: 200, defaultCommissionPercent: 30 },
    });

    const cash = await prisma.cashRegister.create({
      data: {
        companyId,
        number: 1,
        openingBalance: 0,
        status: 'open',
        openedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    });
    check('caixa aberto', cash.status === 'open');

    // Helper: cria comanda de 1 serviço de R$200 com os auxiliares informados,
    // paga integralmente e finaliza por HTTP.
    let seq = 0;
    async function finishOrderWith(
      auxiliaries: {
        professionalId: string;
        discountFrom: 'establishment' | 'professional';
        valueType: 'percent' | 'value';
        value: number;
      }[],
    ) {
      seq += 1;
      const order = await prisma.order.create({
        data: {
          companyId,
          number: seq,
          professionalId: principal.id,
          status: 'open',
          items: {
            create: [
              {
                kind: 'service',
                refId: service.id,
                professionalId: principal.id,
                quantity: 1,
                unitPrice: 200,
                grossValue: 200,
              },
            ],
          },
        },
        include: { items: true },
      });
      for (const aux of auxiliaries) {
        await prisma.orderItemAuxiliary.create({
          data: { orderItemId: order.items[0].id, ...aux },
        });
      }
      await prisma.orderPayment.create({
        data: { orderId: order.id, paymentMethodId: pmCash.id, amount: 200, status: 'pending' },
      });
      const res = await api('POST', `/orders/${order.id}/finish`, { token: salon.token });
      const entries = await prisma.commissionEntry.findMany({
        where: { companyId, orderId: order.id, status: { not: 'reversed' } },
      });
      return { order, res, entries };
    }

    // ==========================================================
    // CASO 1 — sem auxiliar: nada muda (regressão do que já valia)
    // ==========================================================
    {
      const { res, entries } = await finishOrderWith([]);
      check('caso 1: finish → 2xx', res.status >= 200 && res.status < 300, `status ${res.status}`);
      check('caso 1: uma entry só', entries.length === 1, `${entries.length} entries`);
      const own = entries.find((e) => e.professionalId === principal.id);
      check('caso 1: principal recebe 30% de 200 = 60', near(D(own?.commissionAmount), 60));
      check('caso 1: desconto de auxiliares zerado', near(D(own?.auxiliaryDiscount), 0));
    }

    // ==========================================================
    // CASO 2 — auxiliar 25% com desconto DO ESTABELECIMENTO
    //   auxiliar: 25% de 200 = 50 · principal: 60 intacto
    // ==========================================================
    {
      const { res, entries } = await finishOrderWith([
        {
          professionalId: auxA.id,
          discountFrom: 'establishment',
          valueType: 'percent',
          value: 25,
        },
      ]);
      check('caso 2: finish → 2xx', res.status >= 200 && res.status < 300, `status ${res.status}`);
      check('caso 2: duas entries (principal + auxiliar)', entries.length === 2);
      const own = entries.find((e) => e.professionalId === principal.id);
      const her = entries.find((e) => e.professionalId === auxA.id);
      check('caso 2: auxiliar recebe 50', near(D(her?.commissionAmount), 50));
      check('caso 2: principal continua com 60', near(D(own?.commissionAmount), 60));
      check(
        'caso 2: nada descontado do principal (salão paga)',
        near(D(own?.auxiliaryDiscount), 0),
      );
    }

    // ==========================================================
    // CASO 3 — auxiliar 25% com desconto DO PROFISSIONAL
    //   auxiliar: 50 · principal: 60 − 50 = 10 · auxiliaryDiscount = 50
    // ==========================================================
    {
      const { res, entries } = await finishOrderWith([
        {
          professionalId: auxA.id,
          discountFrom: 'professional',
          valueType: 'percent',
          value: 25,
        },
      ]);
      check('caso 3: finish → 2xx', res.status >= 200 && res.status < 300, `status ${res.status}`);
      check('caso 3: duas entries', entries.length === 2);
      const own = entries.find((e) => e.professionalId === principal.id);
      const her = entries.find((e) => e.professionalId === auxA.id);
      check('caso 3: auxiliar recebe 50', near(D(her?.commissionAmount), 50));
      check('caso 3: principal cai para 10', near(D(own?.commissionAmount), 10));
      check('caso 3: auxiliaryDiscount grava 50', near(D(own?.auxiliaryDiscount), 50));
    }

    // ==========================================================
    // CASO 4 — valor FIXO maior que a comissão do principal
    //   auxiliar: R$ 90 fixos · principal tinha 60 → desconto capado em 60,
    //   comissão 0, e o salão banca a diferença. NUNCA negativo.
    // ==========================================================
    {
      const { res, entries } = await finishOrderWith([
        {
          professionalId: auxA.id,
          discountFrom: 'professional',
          valueType: 'value',
          value: 90,
        },
      ]);
      check('caso 4: finish → 2xx', res.status >= 200 && res.status < 300, `status ${res.status}`);
      const own = entries.find((e) => e.professionalId === principal.id);
      const her = entries.find((e) => e.professionalId === auxA.id);
      check('caso 4: auxiliar recebe os 90 cheios', near(D(her?.commissionAmount), 90));
      check('caso 4: comissão do principal zera (não fica negativa)', near(D(own?.commissionAmount), 0));
      check('caso 4: desconto gravado é o REAL (60), não o pretendido (90)',
        near(D(own?.auxiliaryDiscount), 60));
    }

    // ==========================================================
    // CASO 5 — dois auxiliares, um deles sem receivesCommission,
    //          e teto acumulado: 80% + 80% não vira 160% do serviço.
    //   base 200 → A leva 160, B leva os 40 que sobraram.
    // ==========================================================
    {
      const { res, entries } = await finishOrderWith([
        { professionalId: auxA.id, discountFrom: 'establishment', valueType: 'percent', value: 80 },
        { professionalId: auxB.id, discountFrom: 'establishment', valueType: 'percent', value: 80 },
      ]);
      check('caso 5: finish → 2xx', res.status >= 200 && res.status < 300, `status ${res.status}`);
      const a = entries.find((e) => e.professionalId === auxA.id);
      const b = entries.find((e) => e.professionalId === auxB.id);
      check('caso 5: auxiliar A leva 160', near(D(a?.commissionAmount), 160));
      check(
        'caso 5: auxiliar B entra mesmo com receivesCommission=false',
        !!b,
        'rateio digitado à mão é decisão explícita de pagar',
      );
      check('caso 5: auxiliar B fica com o que sobrou (40), não 160', near(D(b?.commissionAmount), 40));
      const somaAux = D(a?.commissionAmount) + D(b?.commissionAmount);
      check('caso 5: soma dos auxiliares não passa da base do item (200)', somaAux <= 200.005,
        `soma ${somaAux}`);
    }

    // ==========================================================
    // CASO 6 — reabrir estorna TUDO, inclusive a entry do auxiliar
    // ==========================================================
    {
      const { order, entries } = await finishOrderWith([
        { professionalId: auxA.id, discountFrom: 'professional', valueType: 'percent', value: 25 },
      ]);
      check('caso 6: gerou 2 entries antes do reopen', entries.length === 2);
      const reopen = await api('POST', `/orders/${order.id}/reopen`, { token: salon.token });
      check('caso 6: reopen → 2xx', reopen.status >= 200 && reopen.status < 300,
        `status ${reopen.status}`);
      const after = await prisma.commissionEntry.findMany({
        where: { companyId, orderId: order.id },
      });
      check(
        'caso 6: TODAS as entries viraram reversed (auxiliar junto)',
        after.length === 2 && after.every((e) => e.status === 'reversed'),
        after.map((e) => e.status).join(','),
      );
    }

    // ==========================================================
    // CASO 7 — o detalhamento devolve o campo para a coluna da tela
    // ==========================================================
    {
      const detail = await api(
        'GET',
        `/commissions/detail?professionalId=${principal.id}`,
        { token: salon.token },
      );
      check('caso 7: /commissions/detail → 200', detail.status === 200, `status ${detail.status}`);
      const items: any[] = detail.body?.items ?? [];
      check(
        'caso 7: item traz auxiliaryDiscount',
        items.length > 0 && items.every((i) => typeof i.auxiliaryDiscount === 'number'),
      );
      check(
        'caso 7: existe ao menos um item com desconto > 0',
        items.some((i) => i.auxiliaryDiscount > 0),
      );
      check(
        'caso 7: totals.auxiliares soma os descontos',
        typeof detail.body?.totals?.auxiliares === 'number' &&
          near(
            detail.body.totals.auxiliares,
            items.reduce((s, i) => s + i.auxiliaryDiscount, 0),
          ),
      );
    }
  } finally {
    const { prisma } = await import('@beautypass/db');
    if (companyId) {
      // `OrderItemAuxiliary.professional` NÃO tem onDelete cascade (schema.prisma,
      // model OrderItemAuxiliary): apagar a empresa direto esbarra na FK e deixa
      // o salão de teste para trás. Apagar as comandas primeiro derruba
      // OrderItem → OrderItemAuxiliary em cascata e libera os profissionais.
      await prisma.order.deleteMany({ where: { companyId } }).catch(() => undefined);
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  }

  const total = passed + failed;
  // eslint-disable-next-line no-console
  console.log(
    `\n──────────────────────────────────────────────\n` +
      `Rateio de auxiliares: ${passed}/${total} verificações passaram` +
      (failed ? `, ${failed} FALHARAM` : '') +
      `\n──────────────────────────────────────────────`,
  );
  if (failed) {
    // eslint-disable-next-line no-console
    console.error(`\nFalhas:\n - ${failures.join('\n - ')}`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Suite crashed:', e);
  process.exit(1);
});
