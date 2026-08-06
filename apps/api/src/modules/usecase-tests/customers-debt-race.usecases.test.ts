/**
 * CustomersService.addDebtPayment — corrida contra overpayment. Ver estudo 132.
 *
 * Bug antigo: dois POSTs simultâneos de R$100 num débito de R$100 criavam dois
 * payments (R$200 pagos > R$100 devidos). Corrigido com advisory lock por
 * `debtId` dentro de `$transaction`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';

interface Debt {
  id: string;
  companyId: string;
  customerId: string;
  amount: number;
  status: string;
}

interface Payment {
  id: string;
  debtId: string;
  amount: number;
}

function fixture() {
  const state = {
    customers: [{ id: 'cus-1', companyId: 'X' }],
    debts: [
      { id: 'debt-1', companyId: 'X', customerId: 'cus-1', amount: 100, status: 'open' },
    ] as Debt[],
    payments: [] as Payment[],
    seq: 1,
  };

  const locks = new Map<string, Promise<void>>();

  const makeTx = () => {
    let liberar: (() => void) | null = null;
    const filtrarDebt = (where: Record<string, unknown>): Debt[] =>
      state.debts.filter((d) => {
        for (const [k, v] of Object.entries(where)) {
          if ((d as unknown as Record<string, unknown>)[k] !== v) return false;
        }
        return true;
      });
    return {
      customerDebt: {
        findFirst: async (a: { where: Record<string, unknown> }) => filtrarDebt(a.where)[0] ?? null,
        update: async (a: { where: { id: string }; data: Partial<Debt> }) => {
          const d = state.debts.find((x) => x.id === a.where.id);
          if (d) Object.assign(d, a.data);
          return d;
        },
      },
      customerDebtPayment: {
        aggregate: async (a: { where: { debtId: string } }) => ({
          _sum: {
            amount: state.payments
              .filter((p) => p.debtId === a.where.debtId)
              .reduce((s, p) => s + p.amount, 0),
          },
        }),
        create: async (a: { data: Omit<Payment, 'id'> }) => {
          const row = { id: `pay-${state.seq++}`, ...a.data } as Payment;
          state.payments.push(row);
          return row;
        },
      },
      $queryRaw: async (strings: TemplateStringsArray, ...args: unknown[]) => {
        const raw = strings.join('?');
        if (raw.includes('pg_advisory_xact_lock')) {
          const chave = String(args[0]);
          while (locks.has(chave)) {
            await locks.get(chave);
          }
          locks.set(
            chave,
            new Promise<void>((r) => {
              liberar = r;
            }),
          );
        }
        return [];
      },
      _releaseLock: () => liberar?.(),
    };
  };

  const client = {
    customer: { findFirst: async () => state.customers[0] },
    $transaction: async <T,>(cb: (tx: ReturnType<typeof makeTx>) => Promise<T>): Promise<T> => {
      const tx = makeTx();
      try {
        return await cb(tx);
      } finally {
        // Libera o lock e remove a entrada.
        for (const [k] of locks) {
          locks.delete(k);
          tx._releaseLock();
        }
      }
    },
  };

  return { state, service: new CustomersService({ client } as never) };
}

describe('CustomersService.addDebtPayment — corrida (estudo 132)', () => {
  it('1) dois pagamentos SIMULTÂNEOS de R$100 num débito de R$100: SÓ UM cria', async () => {
    const { state, service } = fixture();
    const dto = { amount: 100 } as never;

    const resultados = await Promise.allSettled([
      service.addDebtPayment('X', 'cus-1', 'debt-1', dto),
      service.addDebtPayment('X', 'cus-1', 'debt-1', dto),
    ]);

    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const err = resultados.filter((r) => r.status === 'rejected');
    assert.equal(ok.length, 1, 'só um pagamento pode passar');
    assert.equal(err.length, 1, 'o outro é rejeitado');
    assert.ok(
      (err[0] as PromiseRejectedResult).reason instanceof BadRequestException,
      'o rejeitado precisa ser 400 (overpayment)',
    );
    assert.equal(state.payments.length, 1, 'só uma linha de payment no banco');
    assert.equal(state.debts[0].status, 'paid');
  });

  it('2) dois pagamentos PARCIAIS que juntos NÃO passam do saldo: os dois entram', async () => {
    const { state, service } = fixture();
    // R$60 + R$30 sobre R$100 = R$90, ok.
    const rs = await Promise.allSettled([
      service.addDebtPayment('X', 'cus-1', 'debt-1', { amount: 60 } as never),
      service.addDebtPayment('X', 'cus-1', 'debt-1', { amount: 30 } as never),
    ]);
    const ok = rs.filter((r) => r.status === 'fulfilled');
    assert.equal(ok.length, 2);
    assert.equal(state.payments.length, 2);
    assert.equal(state.debts[0].status, 'open'); // ainda não quitou
  });

  it('3) pagamento EXCEDENTE isolado é 400 (regra antiga preservada)', async () => {
    const { service } = fixture();
    await assert.rejects(
      () => service.addDebtPayment('X', 'cus-1', 'debt-1', { amount: 150 } as never),
      BadRequestException,
    );
  });
});
