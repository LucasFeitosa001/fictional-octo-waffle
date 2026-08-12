/**
 * CommissionsService — pagamento em corrida. Ver estudo 127.
 *
 * O bug: dois clicks simultâneos em "Pagar" criavam dois `CommissionPayment`
 * sobre as MESMAS entries. Profissional recebia em dobro. Três incidentes
 * registrados na conta do dono. Corrigido com `pg_advisory_xact_lock`.
 *
 * O fixture simula o advisory lock com um `Map<chave, Promise<void>>` — quando
 * a Req A entra, cria uma promise que só resolve no fim da tx dela; a Req B
 * aguarda essa promise antes de ler as entries. É a semântica exata do
 * `pg_advisory_xact_lock`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { CommissionsService } from '../commissions/commissions.service';

interface Entry {
  id: string;
  companyId: string;
  professionalId: string;
  status: 'open' | 'paid';
  commissionAmount: number;
  bonusAmount: number;
}

function fixtureConcorrente() {
  const state = {
    entries: [
      {
        id: 'e1',
        companyId: 'X',
        professionalId: 'p1',
        status: 'open' as const,
        commissionAmount: 100,
        bonusAmount: 0,
      },
      {
        id: 'e2',
        companyId: 'X',
        professionalId: 'p1',
        status: 'open' as const,
        commissionAmount: 50,
        bonusAmount: 0,
      },
    ] as Entry[],
    advances: [] as { id: string; companyId: string; professionalId: string; status: string; amount: number }[],
    payments: [] as { id: string; companyId: string; professionalId: string; amount: number; entriesIds: string[] }[],
    seq: 1,
  };

  // Advisory lock: uma promessa por chave, resolve quando a tx acabar.
  const locks = new Map<string, Promise<void>>();

  const makeTx = (nomeTx: string) => {
    let liberaLock!: () => void;
    const filtrarE = (where: Record<string, unknown>) =>
      state.entries.filter((e) => {
        if (where.companyId && e.companyId !== where.companyId) return false;
        if (where.professionalId && e.professionalId !== where.professionalId) return false;
        if (where.status && e.status !== where.status) return false;
        if (
          where.id &&
          typeof where.id === 'object' &&
          'in' in (where.id as Record<string, unknown>) &&
          !((where.id as { in: string[] }).in.includes(e.id))
        )
          return false;
        return true;
      });
    return {
      commissionEntry: {
        findMany: async (a: { where: Record<string, unknown> }) => filtrarE(a.where),
        updateMany: async (a: { where: Record<string, unknown>; data: Partial<Entry> }) => {
          const alvo = filtrarE(a.where);
          for (const e of alvo) Object.assign(e, a.data);
          return { count: alvo.length };
        },
      },
      commissionAdvance: {
        findMany: async () => [],
        updateMany: async () => ({ count: 0 }),
        update: async () => ({}),
        create: async () => ({}),
        findUnique: async () => null,
      },
      commissionPayment: {
        create: async (a: { data: Record<string, unknown> }) => {
          const row = {
            id: `pay-${state.seq++}`,
            entriesIds: filtrarE({ status: 'paid', companyId: a.data.companyId, professionalId: a.data.professionalId }).map((e) => e.id),
            ...(a.data as unknown as {
              companyId: string;
              professionalId: string;
              amount: number;
            }),
          };
          state.payments.push(row);
          return row;
        },
        update: async () => ({}),
      },
      financialAccount: { findFirst: async () => null },
      transaction: { create: async () => null },
      $executeRaw: async (strings: TemplateStringsArray, ...args: unknown[]) => {
        // Advisory lock: as duas primeiras `${...}` são companyId e
        // professionalId — a chave do lock.
        const raw = strings.join('?');
        if (raw.includes('pg_advisory_xact_lock')) {
          // ASSINATURA (estudo 146). Este fixture provava só que a CHAMADA
          // acontecia; o SQL nunca tocou num Postgres de verdade, então o cast
          // inválido passou despercebido e derrubou TODO pagamento de comissão
          // com 500 em produção. O Postgres tem duas assinaturas:
          //   pg_advisory_xact_lock(bigint)      → UMA chave de 64 bits
          //   pg_advisory_xact_lock(int, int)    → DUAS de 32 bits
          // Usamos duas chaves, então nada de ::bigint — hashtext() já é int4.
          if (/::bigint/.test(raw)) {
            throw new Error(
              'pg_advisory_xact_lock com DUAS chaves não aceita ::bigint — ' +
                'function pg_advisory_xact_lock(bigint, bigint) does not exist. ' +
                'Ver estudo 146.',
            );
          }
          const chave = `${args[0]}:${args[1]}`;
          while (locks.has(chave)) {
            await locks.get(chave); // espera a outra tx acabar
          }
          locks.set(
            chave,
            new Promise<void>((r) => {
              liberaLock = r;
            }),
          );
        }
        return [];
      },
      _liberarLock: () => {
        if (liberaLock) {
          // Remove antes de resolver: quem espera vê o mapa vazio.
          for (const [k, v] of locks.entries()) {
            if (v === (locks.get(k) as unknown)) {
              // não removemos aqui — o loop de espera olha `.has` na próxima volta
            }
          }
          liberaLock();
        }
      },
      _nome: nomeTx,
    };
  };

  const client = {
    $transaction: async <T,>(cb: (tx: ReturnType<typeof makeTx>) => Promise<T>): Promise<T> => {
      const tx = makeTx(`tx-${state.seq}`);
      try {
        return await cb(tx);
      } finally {
        // Libera o lock e apaga a entrada — a próxima checagem `.has` volta falsa.
        for (const [k] of locks) {
          const p = locks.get(k);
          if (p) {
            locks.delete(k);
            // resolve a promessa que a outra tx está aguardando
            (tx as unknown as { _liberarLock: () => void })._liberarLock?.();
          }
        }
      }
    },
  };

  const service = new CommissionsService({ client } as never, {} as never);
  return { service, state };
}

describe('CommissionsService — pagamento em corrida (estudo 127)', () => {
  it('1) dois createPayment simultâneos: SÓ UM cria pagamento, o outro é 400', async () => {
    const { service, state } = fixtureConcorrente();
    const dto = {
      professionalId: 'p1',
      entryIds: ['e1', 'e2'],
      paidAt: '2026-08-05T12:00:00Z',
    } as never;

    const resultados = await Promise.allSettled([
      service.createPayment('X', dto),
      service.createPayment('X', dto),
    ]);

    const ok = resultados.filter((r) => r.status === 'fulfilled');
    const err = resultados.filter((r) => r.status === 'rejected');

    assert.equal(ok.length, 1, 'exatamente um pagamento deve ter sucedido');
    assert.equal(err.length, 1, 'o outro precisa ser rejeitado');
    assert.ok(
      (err[0] as PromiseRejectedResult).reason instanceof BadRequestException,
      'a rejeição precisa ser 400 (não 500 / duplicidade silenciosa)',
    );

    // E o mais importante: só UMA CommissionPayment gravada.
    assert.equal(state.payments.length, 1, 'sem pagamento duplicado');
  });

  it('2) sem entries abertas: qualquer chamada é 400 (regra antiga preservada)', async () => {
    const { service, state } = fixtureConcorrente();
    for (const e of state.entries) e.status = 'paid';
    await assert.rejects(
      () =>
        service.createPayment('X', {
          professionalId: 'p1',
          entryIds: ['e1', 'e2'],
          paidAt: '2026-08-05T12:00:00Z',
        } as never),
      BadRequestException,
    );
  });
});
