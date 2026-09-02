import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useDbAuthState } from '../whatsapp/whatsapp-auth';
import { WhatsappService } from '../whatsapp/whatsapp.service';

describe('Persistência criptográfica do WhatsApp', () => {
  it('a atualização antiga nunca sobrescreve uma credencial mais nova', async () => {
    let calls = 0;
    let stored: any = null;
    const client = {
      whatsappAuthState: {
        findUnique: async () => null,
        upsert: async ({ create, update }: any) => {
          calls += 1;
          const thisCall = calls;
          // Reproduz o incidente: a primeira operação de banco é muito mais
          // lenta. Sem serialização, ela terminaria por último e restauraria
          // o snapshot antigo da sessão Signal.
          await new Promise((resolve) => setTimeout(resolve, thisCall === 1 ? 30 : 0));
          stored = create?.data ?? update.data;
        },
      },
    };
    const { state, saveCreds } = await useDbAuthState(
      { client } as any,
      'company-a',
    );

    state.creds.registered = false;
    const older = saveCreds();
    state.creds.registered = true;
    const newer = saveCreds();
    await Promise.all([older, newer]);

    assert.equal(stored.registered, true);
    assert.equal(calls, 2);
  });

  it('a conexão só grava chaves Signal enquanto ainda possui o lease distribuído', async () => {
    const statements: Array<{ values?: unknown[] }> = [];
    let unguardedUpserts = 0;
    const client = {
      whatsappAuthState: {
        findUnique: async () => null,
        upsert: async () => {
          unguardedUpserts += 1;
        },
      },
      $executeRaw: async (statement: { values?: unknown[] }) => {
        statements.push(statement);
        return 1;
      },
    };
    const { state, saveCreds } = await useDbAuthState(
      { client } as any,
      'company-a',
      'owner-current',
    );

    state.creds.registered = true;
    await saveCreds();

    assert.equal(unguardedUpserts, 0);
    assert.equal(statements.length, 1);
    assert.ok(
      statements[0]?.values?.includes('owner-current'),
      'a escrita precisa provar o ownerId do lease no mesmo SQL',
    );
    assert.ok(statements[0]?.values?.includes('connection-lease'));
  });

  it('a geração mais nova fica embutida no lease para tomar o lugar do blue-green antigo', async () => {
    const statements: Array<{ values?: unknown[] }> = [];
    const service = new WhatsappService({
      client: {
        $queryRaw: async (statement: { values?: unknown[] }) => {
          statements.push(statement);
          return [{ data: {} }];
        },
      },
      // 2º argumento: o cliente da uazapi (estudo 158). Não é usado aqui.
    } as any, { configurado: false } as any);

    const acquired = await (service as any).acquireConnectionLease('company-a');
    const generation = (service as any).instanceStartedAt as number;
    const payload = statements[0]?.values?.find(
      (value): value is string =>
        typeof value === 'string' && value.includes('"generation"'),
    );

    assert.equal(acquired, true);
    assert.equal(JSON.parse(payload ?? '{}').generation, generation);
    assert.ok(
      statements[0]?.values?.includes(generation),
      'o WHERE também precisa comparar a geração para cercar o dono antigo',
    );
  });
});
