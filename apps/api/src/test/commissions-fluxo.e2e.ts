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

    // ==========================================================
    // 0) O SALÃO JÁ NASCE PODENDO PAGAR
    //    O drawer exige forma de pagamento + conta. Antes o provisionamento não
    //    criava nenhuma das duas, então todo salão recém-cadastrado abria os
    //    dois selects vazios e não conseguia concluir pagamento nenhum.
    // ==========================================================
    {
      const formas = await api('GET', '/payment-methods', { token: salon.token });
      const nomes = (formas.body ?? []).map((f: any) => f.name);
      check('0) salão novo já vem com formas de pagamento', nomes.length >= 4, nomes.join(', '));
      for (const esperada of ['Dinheiro', 'Pix', 'Cartão de Crédito', 'Cartão de Débito']) {
        check(`0) tem "${esperada}"`, nomes.includes(esperada), nomes.join(', '));
      }
      const contas = await api('GET', '/financial-accounts', { token: salon.token });
      check('0) e já vem com conta', (contas.body ?? []).length >= 1,
        (contas.body ?? []).map((c: any) => c.name).join(', '));
      const soCaixa = (formas.body ?? []).filter((f: any) => f.goesToCash);
      check('0) só Dinheiro entra no caixa da recepção',
        soCaixa.length === 1 && soCaixa[0].name === 'Dinheiro',
        soCaixa.map((f: any) => f.name).join(', '));
    }

    // ---------------- catálogo mínimo ----------------
    // Usa a config que o próprio provisionamento criou — se o teste fabricasse
    // a sua, deixaria de exercitar o caminho real.
    const conta = await prisma.financialAccount.findFirstOrThrow({
      where: { companyId, name: 'Caixa' },
    });
    const formaCaixa = await prisma.paymentMethod.findFirstOrThrow({
      where: { companyId, name: 'Dinheiro' },
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
      // A tela precisa saber que NÃO há lançamento — é o que a faz escrever
      // "Sem comissão" em vez de "Em aberto" numa linha que não tem nada aberto.
      check('1b) a linha declara zero lançamentos', Number(linhaSem?.entryCount ?? -1) === 0,
        `entryCount ${linhaSem?.entryCount}`);
      check('1b) e não entra como pagável (total = 0)', Number(linhaSem?.total ?? -1) === 0);
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

    // As duas datas da referência: "Data" (registro) e "Pagamento" (saída).
    // Antes as duas colunas liam o MESMO campo e mostravam o mesmo valor.
    {
      const lista = await api('GET', '/commission-payments', { token: salon.token });
      const linha = (lista.body ?? [])[0];
      check('3c) o histórico devolve createdAt (registro)',
        typeof linha?.createdAt === 'string' && !Number.isNaN(Date.parse(linha.createdAt)),
        String(linha?.createdAt));
      check('3c) e paidAt (saída do dinheiro)',
        typeof linha?.paidAt === 'string' && !Number.isNaN(Date.parse(linha.paidAt)),
        String(linha?.paidAt));

      // Retroativo: pagar com data anterior mantém as duas datas DIFERENTES —
      // é o caso que a captura do Belasis mostra (18/07 registrado, 17/07 pago).
      const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const outra = await prisma.commissionEntry.create({
        data: {
          companyId,
          professionalId: pro.id,
          baseAmount: 100,
          commissionAmount: 30,
          status: 'open',
          competenceDate: new Date(),
          availableDate: new Date(),
        },
      });
      const retro = await api('POST', '/commission-payments/bulk', {
        token: salon.token,
        body: {
          paymentMethodId: formaCaixa.id,
          accountId: conta.id,
          paidAt: ontem,
          items: [{ professionalId: pro.id, entryIds: [outra.id] }],
        },
      });
      check('3c) pagamento retroativo → 2xx', retro.status >= 200 && retro.status < 300,
        `status ${retro.status}`);
      const reg = await prisma.commissionPayment.findUnique({
        where: { id: retro.body?.payments?.[0]?.id },
      });
      check('3c) paidAt guarda a data escolhida (ontem)',
        reg != null && reg.paidAt.toISOString().slice(0, 10) === ontem.slice(0, 10),
        String(reg?.paidAt?.toISOString()));
      check('3c) createdAt guarda HOJE — as duas datas divergem',
        reg != null &&
          reg.createdAt.toISOString().slice(0, 10) ===
            new Date().toISOString().slice(0, 10) &&
          reg.createdAt.toISOString().slice(0, 10) !== reg.paidAt.toISOString().slice(0, 10),
        `createdAt ${reg?.createdAt?.toISOString()} paidAt ${reg?.paidAt?.toISOString()}`);

      // Deixa o cenário como estava para os casos seguintes.
      await api('DELETE', `/commission-payments/${retro.body?.payments?.[0]?.id}`, {
        token: salon.token,
        body: { justification: 'limpeza do caso 3c' },
      });
      await prisma.commissionEntry.delete({ where: { id: outra.id } }).catch(() => undefined);
    }

    const pagamentoId = pagar.body?.payments?.[0]?.id;
    const registro = await prisma.commissionPayment.findUnique({ where: { id: pagamentoId } });
    check('3) pagamento guarda forma, conta e trilho',
      registro?.paymentMethodId === formaCaixa.id &&
        registro?.accountId === conta.id &&
        registro?.rail === 'manual');
    check('3) e aponta para a despesa gerada', registro?.transactionId === despesas[0]?.id);

    // ==========================================================
    // 3b) PAGAR DE NOVO quem já está quitado tem que ser RECUSADO
    //     Aconteceu na conta do dono: ele clicou "Pagar" mais de uma vez e a
    //     API criou TRÊS pagamentos de R$ 0,00, com a tela comemorando
    //     "Pagamento concluído · total de R$ 0,00".
    // ==========================================================
    {
      const denovo = await api('POST', '/commission-payments/bulk', {
        token: salon.token,
        body: {
          paymentMethodId: formaCaixa.id,
          accountId: conta.id,
          items: [{ professionalId: pro.id }],
        },
      });
      check('3b) pagar quem não tem comissão em aberto → 400',
        denovo.status === 400, `status ${denovo.status}`);
      check('3b) e a mensagem explica o motivo',
        /em aberto/i.test(JSON.stringify(denovo.body?.message ?? '')),
        JSON.stringify(denovo.body?.message));
      check('3b) nenhum pagamento fantasma foi criado',
        (await prisma.commissionPayment.count({ where: { companyId } })) === 1,
        `${await prisma.commissionPayment.count({ where: { companyId } })} pagamento(s)`);
      check('3b) nem despesa a mais',
        (await prisma.transaction.count({ where: { companyId, kind: 'expense' } })) === 1);
    }

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
    // 4b) OS QUATRO DEFEITOS DE DINHEIRO DA VARREDURA
    // ==========================================================
    {
      const pro2 = await prisma.professional.create({
        data: { companyId, name: 'Rita Auditoria', receivesCommission: true },
      });
      const hojeIso = new Date().toISOString().slice(0, 10);
      const antigo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      // (8.1) uma comissão ANTIGA (fora do período) e uma de hoje.
      await prisma.commissionEntry.create({
        data: {
          companyId, professionalId: pro2.id, baseAmount: 1000, commissionAmount: 500,
          status: 'open', competenceDate: antigo, availableDate: antigo,
        },
      });
      await prisma.commissionEntry.create({
        data: {
          companyId, professionalId: pro2.id, baseAmount: 600, commissionAmount: 300,
          status: 'open', competenceDate: new Date(), availableDate: new Date(),
        },
      });

      const soHoje = await api('POST', '/commission-payments/bulk', {
        token: salon.token,
        body: {
          paymentMethodId: formaCaixa.id, accountId: conta.id,
          from: hojeIso, to: hojeIso,
          items: [{ professionalId: pro2.id, advanceIds: [] }],
        },
      });
      check('8.1) pagar com período → 2xx', soHoje.status >= 200 && soHoje.status < 300,
        `status ${soHoje.status}`);
      check('8.1) paga SÓ o do período (300), não os 800',
        near(Number(soHoje.body?.payments?.[0]?.amount ?? 0), 300),
        `pagou ${soHoje.body?.payments?.[0]?.amount}`);
      check('8.1) a comissão antiga continua em aberto',
        (await prisma.commissionEntry.count({
          where: { companyId, professionalId: pro2.id, status: 'open' },
        })) === 1);

      // (8.2) vale desmarcado NÃO pode ser descontado.
      const pro3 = await prisma.professional.create({
        data: { companyId, name: 'Sonia Auditoria', receivesCommission: true },
      });
      await prisma.commissionEntry.create({
        data: {
          companyId, professionalId: pro3.id, baseAmount: 600, commissionAmount: 300,
          status: 'open', competenceDate: new Date(), availableDate: new Date(),
        },
      });
      await prisma.commissionAdvance.create({
        data: { companyId, professionalId: pro3.id, amount: 200, status: 'open' },
      });
      const semVale = await api('POST', '/commission-payments/bulk', {
        token: salon.token,
        body: {
          paymentMethodId: formaCaixa.id, accountId: conta.id,
          from: hojeIso, to: hojeIso,
          items: [{ professionalId: pro3.id, advanceIds: [] }],
        },
      });
      check('8.2) desmarcar todos os vales paga o valor CHEIO (300)',
        near(Number(semVale.body?.payments?.[0]?.amount ?? 0), 300),
        `pagou ${semVale.body?.payments?.[0]?.amount}`);
      check('8.2) e o vale continua em aberto',
        (await prisma.commissionAdvance.count({
          where: { companyId, professionalId: pro3.id, status: 'open' },
        })) === 1);

      // (8.3) vale MAIOR que a comissão: consome só o que cabe.
      const pro4 = await prisma.professional.create({
        data: { companyId, name: 'Tania Auditoria', receivesCommission: true },
      });
      await prisma.commissionEntry.create({
        data: {
          companyId, professionalId: pro4.id, baseAmount: 200, commissionAmount: 100,
          status: 'open', competenceDate: new Date(), availableDate: new Date(),
        },
      });
      await prisma.commissionAdvance.create({
        data: { companyId, professionalId: pro4.id, amount: 500, status: 'open', note: 'adiantamento grande' },
      });
      const grande = await api('POST', '/commission-payments/bulk', {
        token: salon.token,
        body: {
          paymentMethodId: formaCaixa.id, accountId: conta.id,
          from: hojeIso, to: hojeIso,
          items: [{ professionalId: pro4.id }],
        },
      });
      check('8.3) pagamento sai zerado (vale cobre tudo)',
        near(Number(grande.body?.payments?.[0]?.amount ?? -1), 0),
        `pagou ${grande.body?.payments?.[0]?.amount}`);
      check('8.3) registra só o que FOI recuperado (100), não os 500',
        near(Number(grande.body?.payments?.[0]?.advancesTotal ?? 0), 100),
        `advancesTotal ${grande.body?.payments?.[0]?.advancesTotal}`);
      const saldo = await prisma.commissionAdvance.findMany({
        where: { companyId, professionalId: pro4.id, status: 'open' },
      });
      check('8.3) sobra um vale ABERTO com o residual de 400',
        saldo.length === 1 && near(Number(saldo[0].amount), 400),
        saldo.map((v) => `${v.amount}/${v.status}`).join(', '));
      const soma = (
        await prisma.commissionAdvance.findMany({
          where: { companyId, professionalId: pro4.id },
        })
      ).reduce((t, v) => t + Number(v.amount), 0);
      check('8.3) as partes somadas continuam valendo o original (500)', near(soma, 500),
        `soma ${soma}`);

      // Estornar devolve o vale inteiro.
      await api('DELETE', `/commission-payments/${grande.body?.payments?.[0]?.id}`, {
        token: salon.token,
        body: { justification: 'teste 8.3' },
      });
      const depoisEstorno = (
        await prisma.commissionAdvance.findMany({
          where: { companyId, professionalId: pro4.id, status: 'open' },
        })
      ).reduce((t, v) => t + Number(v.amount), 0);
      check('8.3) estorno devolve os 500 em aberto', near(depoisEstorno, 500),
        `em aberto ${depoisEstorno}`);

      // (8.4) resumo não soma estornado quando não há status explícito.
      const pro5 = await prisma.professional.create({
        data: { companyId, name: 'Vera Auditoria', receivesCommission: true },
      });
      await prisma.commissionEntry.createMany({
        data: [
          { companyId, professionalId: pro5.id, baseAmount: 200, commissionAmount: 100,
            status: 'open', competenceDate: new Date(), availableDate: new Date() },
          { companyId, professionalId: pro5.id, baseAmount: 100, commissionAmount: 50,
            status: 'reversed', competenceDate: new Date(), availableDate: new Date() },
        ],
      });
      const resumo = await api('GET', '/commissions/summary', { token: salon.token });
      const vera = (resumo.body?.data ?? []).find((r: any) => r.professionalName === 'Vera Auditoria');
      check('8.4) estornado NÃO entra na soma do resumo', near(Number(vera?.comissao ?? 0), 100),
        `comissao ${vera?.comissao}`);

      const soAberto = await api('GET', '/commissions/summary?status=open', { token: salon.token });
      const vera2 = (soAberto.body?.data ?? []).find((r: any) => r.professionalName === 'Vera Auditoria');
      check('8.4) com status=open a conta bate também', near(Number(vera2?.comissao ?? 0), 100));
    }

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
    // Escopado ao PRÓPRIO pagamento: contar despesas da empresa inteira quebra
    // sempre que um caso novo é inserido antes deste.
    check('6) e também lança a despesa',
      regSalonPay?.transactionId != null &&
        (await prisma.transaction.count({
          where: { companyId, kind: 'expense', id: regSalonPay.transactionId },
        })) === 1,
      `transactionId ${regSalonPay?.transactionId}`);

    // ==========================================================
    // 7) SALONPAY é CONTA DIGITAL: pagar por ele emite TRANSFERÊNCIA
    //    Desenho tirado das rotas mineradas do Belasis
    //    (/belasis-pay/transfers) e das colunas da tela Transferências.
    // ==========================================================
    {
      const transfers = await api('GET', '/salonpay/transfers', { token: salon.token });
      check('7) GET /salonpay/transfers → 200', transfers.status === 200, `status ${transfers.status}`);
      const t = (transfers.body ?? [])[0];
      check('7) o pagamento SalonPay gerou UMA transferência',
        (transfers.body ?? []).length === 1, `${(transfers.body ?? []).length}`);
      check('7) operação = comissão', t?.operation === 'commission', String(t?.operation));
      check('7) nasce "pending" — registrada, não enviada a provedor nenhum',
        t?.status === 'pending', String(t?.status));
      check('7) guarda o nome de quem recebe (snapshot)',
        t?.recipientName === 'Paula Comissão', String(t?.recipientName));
      check('7) e o valor do pagamento', near(Number(t?.amount ?? 0), 100), String(t?.amount));
      check('7) sem chave PIX, avisa o motivo em vez de sumir',
        t?.pixKey === null && /chave PIX/i.test(t?.statusReason ?? ''),
        String(t?.statusReason));

      // Pagamento MANUAL não pode gerar transferência — o dinheiro saiu por fora.
      const soDoSalonPay = (transfers.body ?? []).every((x: any) => x.operation === 'commission');
      check('7) pagamento manual não gera transferência', soDoSalonPay);
    }

    // ==========================================================
    // 8) Destinatários: a tela precisa saber quem NÃO tem chave antes de pagar
    // ==========================================================
    {
      const antes = await api('GET', '/salonpay/recipients', { token: salon.token });
      check('8) GET /salonpay/recipients → 200', antes.status === 200);
      const paula = (antes.body ?? []).find((r: any) => r.name === 'Paula Comissão');
      check('8) sem chave nem documento → sem destino', paula?.temDestino === false,
        JSON.stringify(paula));

      // CPF serve de chave PIX.
      await prisma.professional.update({
        where: { id: pro.id },
        data: { document: '12345678901' },
      });
      const comCpf = await api('GET', '/salonpay/recipients', { token: salon.token });
      const comDoc = (comCpf.body ?? []).find((r: any) => r.name === 'Paula Comissão');
      check('8) CPF vale como chave PIX',
        comDoc?.temDestino === true && comDoc?.pixKey === '12345678901',
        JSON.stringify(comDoc));

      // pixKey explícita ganha do documento.
      await prisma.professional.update({
        where: { id: pro.id },
        data: { pixKey: 'paula@salao.com.br' },
      });
      const comChave = await api('GET', '/salonpay/recipients', { token: salon.token });
      const comPix = (comChave.body ?? []).find((r: any) => r.name === 'Paula Comissão');
      check('8) chave explícita ganha do documento',
        comPix?.pixKey === 'paula@salao.com.br', JSON.stringify(comPix?.pixKey));
    }

    // ==========================================================
    // 9) Estornar o pagamento cancela a transferência ainda não enviada
    // ==========================================================
    {
      const pagamentoSP = pagaSalonPay.body?.payments?.[0]?.id;
      const estorna = await api('DELETE', `/commission-payments/${pagamentoSP}`, {
        token: salon.token,
        body: { justification: 'teste de estorno do salonpay' },
      });
      check('9) estornar pagamento SalonPay → 2xx',
        estorna.status >= 200 && estorna.status < 300, `status ${estorna.status}`);
      const restou = await prisma.salonPayTransfer.count({ where: { companyId } });
      check('9) a transferência pendente é cancelada junto', restou === 0, `${restou} restante(s)`);
    }
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
