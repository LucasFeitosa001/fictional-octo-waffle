import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useDbAuthState } from '../whatsapp/whatsapp-auth';

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
});
