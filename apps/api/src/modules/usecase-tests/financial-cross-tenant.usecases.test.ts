/**
 * FinancialService — cross-tenant e estorno em corrida. Ver estudo 126.
 *
 * Antes deste arquivo, o service inteiro (878 linhas mexendo em dinheiro) não
 * tinha teste algum. A auditoria de 05/08 apontou como CRÍTICO #2 — o mesmo
 * padrão do "5555555": entrada não validada gravando dado errado.
 *
 * Os fixtures cobrem DUAS empresas de propósito, e o Prisma falso aplica o
 * `where.companyId` de verdade. Um vazamento cross-tenant é literalmente
 * "o findFirst devolveu algo que era da outra empresa" — se a barreira for
 * removida, o teste vê a linha aparecer.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { FinancialService } from '../financial/financial.service';

const AGORA = new Date('2026-08-05T12:00:00Z');

interface Row {
  id: string;
  companyId: string;
  status?: string;
  [k: string]: unknown;
}

function bd(over?: {
  accounts?: Row[];
  categories?: Row[];
  paymentMethods?: Row[];
  transactions?: Row[];
  finSettings?: Row[];
  cashRegisters?: Row[];
}) {
  const state = {
    accounts: over?.accounts ?? [
      { id: 'acc-x', companyId: 'X', name: 'Caixa X' },
      { id: 'acc-y', companyId: 'Y', name: 'Caixa Y' },
    ],
    categories: over?.categories ?? [
      { id: 'cat-x', companyId: 'X', name: 'Vendas' },
      { id: 'cat-y', companyId: 'Y', name: 'Vendas' },
    ],
    paymentMethods: over?.paymentMethods ?? [
      { id: 'pm-x', companyId: 'X', name: 'Dinheiro' },
      { id: 'pm-y', companyId: 'Y', name: 'Dinheiro' },
    ],
    transactions: over?.transactions ?? [],
    finSettings: over?.finSettings ?? [
      { id: 'fs-x', companyId: 'X', allowRetroactive: true, allowTransactionsWithClosedCash: true },
      { id: 'fs-y', companyId: 'Y', allowRetroactive: true, allowTransactionsWithClosedCash: true },
    ],
    cashRegisters: over?.cashRegisters ?? [],
    seq: 1,
  };
  const filtrar = (arr: Row[], where: Record<string, unknown>) =>
    arr.filter((r) =>
      Object.entries(where).every(([k, v]) => {
        if (v && typeof v === 'object' && 'not' in (v as Record<string, unknown>)) {
          return r[k] !== (v as Record<string, unknown>).not;
        }
        if (v && typeof v === 'object' && 'in' in (v as Record<string, unknown>)) {
          return ((v as Record<string, unknown>).in as unknown[]).includes(r[k]);
        }
        return r[k] === v;
      }),
    );
  const client = {
    financialAccount: {
      findFirst: async (a: { where: Record<string, unknown> }) =>
        filtrar(state.accounts, a.where)[0] ?? null,
      findMany: async (a: { where: Record<string, unknown> }) =>
        filtrar(state.accounts, a.where),
    },
    financialCategory: {
      findFirst: async (a: { where: Record<string, unknown> }) =>
        filtrar(state.categories, a.where)[0] ?? null,
    },
    paymentMethod: {
      findFirst: async (a: { where: Record<string, unknown> }) =>
        filtrar(state.paymentMethods, a.where)[0] ?? null,
    },
    // getSettings usa `setting.findUnique({ where: { companyId_key: {...} } })`
    // com valueJson: {}. Devolvemos vazio para cair nos defaults (permitem tudo).
    setting: {
      findUnique: async () => ({ valueJson: {} }),
      upsert: async () => ({}),
    },
    cashRegister: {
      findFirst: async (a: { where: Record<string, unknown> }) =>
        filtrar(state.cashRegisters, a.where)[0] ?? null,
    },
    transaction: {
      create: async (a: { data: Partial<Row> }) => {
        const dados = a.data as Row;
        const row: Row = { ...dados, id: dados.id ?? `t-${state.seq++}` };
        state.transactions.push(row);
        return row;
      },
      findFirst: async (a: { where: Record<string, unknown> }) =>
        filtrar(state.transactions, a.where)[0] ?? null,
      findUnique: async (a: { where: { id: string } }) =>
        state.transactions.find((t) => t.id === a.where.id) ?? null,
      update: async (a: { where: { id: string }; data: Partial<Row> }) => {
        const t = state.transactions.find((x) => x.id === a.where.id);
        if (!t) throw Object.assign(new Error('P2025'), { code: 'P2025' });
        Object.assign(t, a.data);
        return t;
      },
      updateMany: async (a: { where: Record<string, unknown>; data: Partial<Row> }) => {
        const alvo = filtrar(state.transactions, a.where);
        for (const t of alvo) Object.assign(t, a.data);
        return { count: alvo.length };
      },
      delete: async (a: { where: { id: string } }) => {
        const i = state.transactions.findIndex((t) => t.id === a.where.id);
        if (i >= 0) state.transactions.splice(i, 1);
        return {};
      },
    },
    $transaction: async (arg: unknown) => {
      // Suporta as duas formas do Prisma: array de promessas OU callback.
      if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(client);
      return Promise.all(arg as Promise<unknown>[]);
    },
  };
  return { state, client };
}

function svc(client: unknown) {
  return new FinancialService({ client } as never);
}

// ------------------------------------------------------- cross-tenant

describe('FinancialService — cross-tenant nas escritas', () => {
  it('1) createTransaction rejeita accountId de OUTRA empresa', async () => {
    const { client, state } = bd();
    await assert.rejects(
      () =>
        svc(client).createTransaction('X', {
          kind: 'income',
          grossAmount: 100,
          accountId: 'acc-y', // ← da empresa Y
        } as never),
      BadRequestException,
    );
    // E não gravou nada.
    assert.equal(state.transactions.length, 0);
  });

  it('2) createTransaction aceita accountId da própria empresa', async () => {
    const { client, state } = bd();
    await svc(client).createTransaction('X', {
      kind: 'income',
      grossAmount: 100,
      accountId: 'acc-x',
      categoryId: 'cat-x',
    } as never);
    assert.equal(state.transactions.length, 1);
    assert.equal(state.transactions[0].companyId, 'X');
    assert.equal(state.transactions[0].accountId, 'acc-x');
  });

  it('3) createTransaction sem accountId (organizacional) segue funcionando', async () => {
    const { client, state } = bd();
    await svc(client).createTransaction('X', {
      kind: 'expense',
      grossAmount: 50,
      isOrganizational: true,
    } as never);
    assert.equal(state.transactions.length, 1);
  });

  it('4) createTransaction rejeita categoryId de outra empresa', async () => {
    const { client } = bd();
    await assert.rejects(
      () =>
        svc(client).createTransaction('X', {
          kind: 'income',
          grossAmount: 100,
          accountId: 'acc-x',
          categoryId: 'cat-y', // ← da empresa Y
        } as never),
      BadRequestException,
    );
  });

  it('5) createTransaction rejeita paymentMethodId de outra empresa', async () => {
    const { client } = bd();
    await assert.rejects(
      () =>
        svc(client).createTransaction('X', {
          kind: 'income',
          grossAmount: 100,
          accountId: 'acc-x',
          paymentMethodId: 'pm-y', // ← da empresa Y
        } as never),
      BadRequestException,
    );
  });

  it('6) updateTransaction rejeita mudança de accountId para conta de outra empresa', async () => {
    const original: Row = {
      id: 't-1',
      companyId: 'X',
      status: 'paid',
      kind: 'income',
      grossAmount: 100,
      accountId: 'acc-x',
      dueDate: AGORA,
      paidAt: AGORA,
    };
    const { client } = bd({ transactions: [original] });
    await assert.rejects(
      () =>
        svc(client).updateTransaction('X', 't-1', {
          accountId: 'acc-y',
        } as never),
      BadRequestException,
    );
  });
});

// --------------------------------------------------------- estorno em corrida

describe('FinancialService — estorno idempotente', () => {
  it('7) reverseTransaction chamado DUAS vezes em concorrência: só UMA contrapartida', async () => {
    const original: Row = {
      id: 't-orig',
      companyId: 'X',
      status: 'paid',
      kind: 'income',
      grossAmount: 100,
      accountId: 'acc-x',
      categoryId: null,
      paymentMethodId: null,
      partyType: null,
      partyId: null,
      orderId: null,
      description: 'venda 001',
      dueDate: AGORA,
      paidAt: AGORA,
    };
    const { client, state } = bd({ transactions: [original] });
    const service = svc(client);

    // Duas requisições simultâneas — F5 duplo.
    const resultados = await Promise.allSettled([
      service.reverseTransaction('X', 't-orig'),
      service.reverseTransaction('X', 't-orig'),
    ]);

    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const err = resultados.filter((r) => r.status === 'rejected');
    assert.equal(ok.length, 1, 'exatamente uma reversão deve ter sucedido');
    assert.equal(err.length, 1, 'a outra deve ser rejeitada');
    assert.ok(
      (err[0] as PromiseRejectedResult).reason instanceof BadRequestException,
      'a rejeição precisa ser 400, não 500',
    );

    // O caixa recebe UMA contrapartida, não duas.
    const contrapartidas = state.transactions.filter(
      (t) => t.reversalOfId === 't-orig',
    );
    assert.equal(contrapartidas.length, 1);
  });

  it('8) reverseTransaction sequencial: segunda chamada 400 imediato', async () => {
    const original: Row = {
      id: 't-orig',
      companyId: 'X',
      status: 'paid',
      kind: 'income',
      grossAmount: 100,
      accountId: 'acc-x',
      dueDate: AGORA,
      paidAt: AGORA,
    };
    const { client } = bd({ transactions: [original] });
    const service = svc(client);
    await service.reverseTransaction('X', 't-orig');
    await assert.rejects(() => service.reverseTransaction('X', 't-orig'), BadRequestException);
  });
});
