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

const PORT = Number(process.env.COMMISSIONS_FLOW_TEST_PORT ?? 4624);
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
  const email = `fluxo-${Date.now()}-${Math.floor(Math.random() * 1e6)}@commissions.test`;
  const password = 'commissions-aux-pw-123';
  const res = await api('POST', '/auth/sign-up/email', {
    body: { name: 'Studio Fluxo', email, password },
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
  console.log(`\n▶ Fluxo de Comissões rodando contra ${BASE}\n`);

  let companyId = '';

  try {
    const salon = await signUpStaff();
    for (let i = 0; i < 15 && !companyId; i++) {
      const cur = await api('GET', '/companies/current', { token: salon.token });
      if (cur.status === 200 && cur.body?.id) companyId = cur.body.id;
      else await new Promise((r) => setTimeout(r, 200));
    }
    check('salão provisionado', !!companyId);

    await prisma.featureFlag.create({
      data: { companyId, key: 'commissions', enabled: true },
    });

    // ---------------- catálogo mínimo ----------------
    const conta = await prisma.financialAccount.create({
      data: { companyId, name: 'Caixa', type: 'cash' },
    });
    await prisma.financialCategory.create({
      data: { companyId, name: 'Despesas', kind: 'debit' },
    });
    const formaCaixa = await prisma.paymentMethod.create({
      data: { companyId, name: 'Dinheiro', goesToCash: true, defaultAccountId: conta.id },
    });
    const pro = await prisma.professional.create({
      data: { companyId, name: 'Paula Comissão', receivesCommission: true },
    });
    const caixa = await prisma.cashRegister.create({
      data: {
        companyId,
        number: 1,
        openingBalance: 0,
        status: 'open',
        openedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    });
    const hoje = new Date();
    const entry = await prisma.commissionEntry.create({
      data: {
        companyId,
        professionalId: pro.id,
        baseAmount: 300,
        commissionAmount: 90,
        status: 'open',
        competenceDate: hoje,
        availableDate: hoje,
      },
    });

    // ==========================================================
    // 1) VALE: criar → aparecer na listagem → excluir
    //    O dono relatou "diz que criou e não aparece nada". O vale gravava
    //    certo; o que não existia era onde ver e onde apagar.
    // ==========================================================
    const criaVale = await api('POST', '/commission-advances', {
      token: salon.token,
      body: { professionalId: pro.id, amount: 30, note: 'adiantamento de teste' },
    });
    check('1) criar vale → 2xx', criaVale.status >= 200 && criaVale.status < 300,
      `status ${criaVale.status}`);

    const listaVales = await api('GET', `/commission-advances?professionalId=${pro.id}&status=open`, {
      token: salon.token,
    });
    check('1) o vale APARECE na listagem', (listaVales.body ?? []).length === 1,
      `${(listaVales.body ?? []).length} vale(s)`);
    check('1) com valor e observação preservados',
      Number(listaVales.body?.[0]?.amount) === 30 &&
        listaVales.body?.[0]?.note === 'adiantamento de teste');

    const valeId = listaVales.body?.[0]?.id;
    const excluiVale = await api('DELETE', `/commission-advances/${valeId}`, { token: salon.token });
    check('1) excluir vale → 2xx', excluiVale.status >= 200 && excluiVale.status < 300,
      `status ${excluiVale.status}`);
    const depoisDeExcluir = await api('GET', `/commission-advances?professionalId=${pro.id}&status=open`, {
      token: salon.token,
    });
    check('1) some da listagem depois de excluir', (depoisDeExcluir.body ?? []).length === 0);

    // ==========================================================
    // 1b) Vale de quem NÃO tem comissão no período ainda aparece
    //     Foi assim que o defeito apareceu na produção do dono: salão com zero
    //     comissão gerada, dois vales criados, e a tela Resumidas vazia.
    // ==========================================================
    {
      const semComissao = await prisma.professional.create({
        data: { companyId, name: 'Sem Comissão', receivesCommission: true },
      });
      await api('POST', '/commission-advances', {
        token: salon.token,
        body: { professionalId: semComissao.id, amount: 40 },
      });
      const resumo = await api('GET', '/commissions/summary', { token: salon.token });
      const linhaSem = (resumo.body?.data ?? []).find(
        (r: any) => r.professionalId === semComissao.id,
      );
      check('1b) profissional só com vale APARECE no resumo', !!linhaSem,
        'sem linha, o vale fica invisível na tela principal');
      check('1b) com comissão zerada e o vale visível',
        near(Number(linhaSem?.comissao ?? -1), 0) && near(Number(linhaSem?.vales ?? 0), 40),
        `comissao ${linhaSem?.comissao} vales ${linhaSem?.vales}`);
      check('1b) líquido não fica negativo', Number(linhaSem?.liquido ?? -1) === 0,
        `liquido ${linhaSem?.liquido}`);
      // limpa para não interferir nos casos seguintes
      await prisma.commissionAdvance.deleteMany({ where: { professionalId: semComissao.id } });
    }

    // ==========================================================
    // 2) BONIFICAÇÃO: coluna que era zero por construção
    // ==========================================================
    const poeBonus = await api('PATCH', `/commissions/${entry.id}`, {
      token: salon.token,
      body: { bonusAmount: 20 },
    });
    check('2) gravar bonificação → 2xx', poeBonus.status >= 200 && poeBonus.status < 300,
      `status ${poeBonus.status}`);
    const comBonus = await api('GET', '/commissions/summary', { token: salon.token });
    const linha = (comBonus.body?.data ?? []).find((r: any) => r.professionalId === pro.id);
    check('2) bonificação chega no resumo', near(Number(linha?.bonus ?? 0), 20),
      `bonus ${linha?.bonus}`);
    check('2) e entra no líquido (90 + 20)', near(Number(linha?.liquido ?? 0), 110),
      `liquido ${linha?.liquido}`);

    // ==========================================================
    // 3) PAGAMENTO exige forma + conta e vira DESPESA no Financeiro
    // ==========================================================
    const vale2 = await api('POST', '/commission-advances', {
      token: salon.token,
      body: { professionalId: pro.id, amount: 10 },
    });
    check('3) vale de 10 criado', vale2.status >= 200 && vale2.status < 300);

    const pagar = await api('POST', '/commission-payments/bulk', {
      token: salon.token,
      body: {
        paymentMethodId: formaCaixa.id,
        accountId: conta.id,
        items: [{ professionalId: pro.id }],
      },
    });
    check('3) pagar → 2xx', pagar.status >= 200 && pagar.status < 300, `status ${pagar.status}`);
    // 90 comissão + 20 bônus − 10 vale = 100
    const pago = Number(pagar.body?.payments?.[0]?.amount ?? 0);
    check('3) valor pago = 90 + 20 − 10 = 100', near(pago, 100), `pagou ${pago}`);

    const despesas = await prisma.transaction.findMany({ where: { companyId, kind: 'expense' } });
    check('3) gerou UMA despesa no Financeiro', despesas.length === 1,
      `${despesas.length} despesa(s)`);
    check('3) despesa com o valor do pagamento', near(Number(despesas[0]?.grossAmount ?? 0), 100));
    check('3) despesa já quitada', despesas[0]?.status === 'paid');
    check('3) despesa na conta escolhida', despesas[0]?.accountId === conta.id);

    const saidas = await prisma.cashMovement.findMany({
      where: { cashRegisterId: caixa.id, type: 'out' },
    });
    check('3) gerou saída no caixa (forma vai pro caixa)', saidas.length === 1,
      `${saidas.length} movimento(s)`);

    const pagamentoId = pagar.body?.payments?.[0]?.id;
    const registro = await prisma.commissionPayment.findUnique({ where: { id: pagamentoId } });
    check('3) pagamento guarda forma, conta e trilho',
      registro?.paymentMethodId === formaCaixa.id &&
        registro?.accountId === conta.id &&
        registro?.rail === 'manual');
    check('3) e aponta para a despesa gerada', registro?.transactionId === despesas[0]?.id);

    // ==========================================================
    // 4) ESTORNAR o pagamento desfaz a despesa e o caixa
    //    Sem isto, excluir o pagamento reabria a comissão mas deixava a saída
    //    no Financeiro — o salão pagaria duas vezes no relatório.
    // ==========================================================
    const estorna = await api('DELETE', `/commission-payments/${pagamentoId}`, {
      token: salon.token,
      body: { justification: 'teste de estorno' },
    });
    check('4) estornar → 2xx', estorna.status >= 200 && estorna.status < 300,
      `status ${estorna.status}`);
    check('4) a despesa some do Financeiro',
      (await prisma.transaction.count({ where: { companyId, kind: 'expense' } })) === 0);
    check('4) a saída some do caixa',
      (await prisma.cashMovement.count({ where: { cashRegisterId: caixa.id, type: 'out' } })) === 0);
    check('4) a comissão volta para em aberto',
      (await prisma.commissionEntry.findUnique({ where: { id: entry.id } }))?.status === 'open');
    check('4) o vale volta para em aberto',
      (await prisma.commissionAdvance.count({ where: { companyId, status: 'open' } })) === 1);

    // ==========================================================
    // 5) SALONPAY: cadastro, o que falta, e o limite honesto
    // ==========================================================
    const vazio = await api('GET', '/salonpay/account', { token: salon.token });
    check('5) GET /salonpay/account → 200', vazio.status === 200, `status ${vazio.status}`);
    check('5) começa sem cadastro e incompleto',
      vazio.body?.account === null && vazio.body?.complete === false);
    check('5) e sem poder liquidar', vazio.body?.canSettle === false);

    const parcial = await api('PUT', '/salonpay/account', {
      token: salon.token,
      body: { personType: 'company', legalName: 'Studio Fluxo LTDA' },
    });
    check('5) salvar parcial → 2xx', parcial.status >= 200 && parcial.status < 300);
    check('5) segue incompleto e DIZ o que falta',
      parcial.body?.complete === false && (parcial.body?.missing ?? []).includes('taxId'),
      JSON.stringify(parcial.body?.missing));

    const completo = await api('PUT', '/salonpay/account', {
      token: salon.token,
      body: {
        personType: 'company',
        legalName: 'Studio Fluxo LTDA',
        companyType: 'LTDA',
        taxId: '27.994.180/0001-20',
        revenue: 15000,
        email: 'financeiro@studiofluxo.com.br',
        phone: '+55 (89) 99921-7435',
        zipCode: '64600-430',
        street: 'Rua Eliseu Pereira Bezerra',
        number: '52',
        district: 'Passagem das Pedras',
        acceptPix: true,
        acceptCard: true,
      },
    });
    check('5) cadastro completo', completo.body?.complete === true,
      JSON.stringify(completo.body?.missing));
    check('5) CNPJ guardado só com dígitos',
      completo.body?.account?.taxId === '27994180000120',
      String(completo.body?.account?.taxId));
    check('5) MESMO completo, não promete liquidação sem adquirente',
      completo.body?.canSettle === false,
      'canSettle só vira true com providerAccountId de um PSP real');

    const cnpjCurto = await api('PUT', '/salonpay/account', {
      token: salon.token,
      body: { taxId: '123' },
    });
    check('5) CNPJ com tamanho errado é apontado',
      (cnpjCurto.body?.missing ?? []).includes('taxId'),
      JSON.stringify(cnpjCurto.body?.missing));

    // ==========================================================
    // 6) Pagar com trilho SalonPay fica marcado como tal
    // ==========================================================
    const pagaSalonPay = await api('POST', '/commission-payments/bulk', {
      token: salon.token,
      body: {
        paymentMethodId: formaCaixa.id,
        accountId: conta.id,
        rail: 'salonpay',
        items: [{ professionalId: pro.id }],
      },
    });
    check('6) pagar via SalonPay → 2xx',
      pagaSalonPay.status >= 200 && pagaSalonPay.status < 300, `status ${pagaSalonPay.status}`);
    const regSalonPay = await prisma.commissionPayment.findUnique({
      where: { id: pagaSalonPay.body?.payments?.[0]?.id },
    });
    check('6) o pagamento fica marcado como salonpay', regSalonPay?.rail === 'salonpay',
      String(regSalonPay?.rail));
    check('6) e também lança a despesa',
      (await prisma.transaction.count({ where: { companyId, kind: 'expense' } })) === 1);
  } finally {
    const { prisma } = await import('@beautypass/db');
    if (companyId) {
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
      `Fluxo de Comissões: ${passed}/${total} verificações passaram` +
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
