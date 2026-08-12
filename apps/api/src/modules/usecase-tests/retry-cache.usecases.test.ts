/**
 * Certificação do contador de reenvio do WhatsApp (estudo 69).
 *
 * O que estes testes travam:
 *  - a instância é ÚNICA no processo: o socket é recriado a cada reconexão e
 *    precisa reencontrar a mesma contagem, senão o mesmo pedido de reenvio
 *    reinicia do zero e pode virar laço;
 *  - a contagem expira: um pedido de ontem não pode contar contra o de hoje;
 *  - o cache não cresce sem fim (despeja o mais antigo);
 *  - `get`/`set`/`del`/`flushAll` são o que o Baileys chama — se a assinatura
 *    mudar, a biblioteca quebra em silêncio.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RetryCache, RETRY_COUNTER_CACHE } from '../whatsapp/retry-cache';

/** Relógio de mentira para não depender de espera real. */
function relogio(inicio = 1_000_000) {
  let agora = inicio;
  return { ler: () => agora, avancar: (ms: number) => (agora += ms) };
}

describe('Contador de reenvio do WhatsApp (estudo 69)', () => {
  it('1) guarda e devolve a contagem', () => {
    const cache = new RetryCache();
    assert.equal(cache.get('msg-1'), undefined, 'id nunca visto não tem contagem');
    cache.set('msg-1', 1);
    assert.equal(cache.get<number>('msg-1'), 1);
    cache.set('msg-1', 2);
    assert.equal(cache.get<number>('msg-1'), 2, 'reescrever atualiza, não duplica');
    assert.equal(cache.tamanho, 1);
  });

  it('2) a contagem expira depois do TTL', () => {
    const t = relogio();
    const cache = new RetryCache(60_000, 5000, t.ler);
    cache.set('msg-1', 3);

    t.avancar(59_000);
    assert.equal(cache.get<number>('msg-1'), 3, 'dentro da janela ainda vale');

    t.avancar(2_000);
    assert.equal(cache.get('msg-1'), undefined, 'passou o TTL: contagem some');
    assert.equal(cache.tamanho, 0, 'e a linha vencida é varrida, não fica ocupando');
  });

  it('3) não cresce sem fim: despeja o mais antigo ao estourar o teto', () => {
    const cache = new RetryCache(60_000, 3);
    cache.set('a', 1);
    cache.set('b', 1);
    cache.set('c', 1);
    cache.set('d', 1);

    assert.equal(cache.tamanho, 3, 'o teto é respeitado');
    assert.equal(cache.get('a'), undefined, 'o mais antigo saiu');
    assert.equal(cache.get<number>('d'), 1, 'o mais novo entrou');
  });

  it('4) reescrever manda a chave para o fim da fila de despejo', () => {
    const cache = new RetryCache(60_000, 3);
    cache.set('a', 1);
    cache.set('b', 1);
    cache.set('a', 2); // 'a' voltou a ser usada — não pode ser a próxima a sair
    cache.set('c', 1);
    cache.set('d', 1);

    assert.equal(cache.get('b'), undefined, "'b' era a mais antiga em uso");
    assert.equal(cache.get<number>('a'), 2, "'a' sobreviveu porque foi reescrita");
  });

  it('5) del e flushAll fazem o que o Baileys espera', () => {
    const cache = new RetryCache();
    cache.set('msg-1', 1);
    cache.del('msg-1');
    assert.equal(cache.get('msg-1'), undefined);

    cache.set('msg-2', 1);
    cache.set('msg-3', 1);
    cache.flushAll();
    assert.equal(cache.tamanho, 0);
    assert.doesNotThrow(() => cache.del('nao-existe'), 'apagar o que não existe não explode');
  });

  it('6) a instância compartilhada sobrevive à reconexão do socket', () => {
    // Cada reconexão chama makeWASocket de novo passando ESTE objeto. Se ele
    // fosse criado dentro, a contagem zeraria — é o erro que a doc alerta.
    const primeiroSocket = RETRY_COUNTER_CACHE;
    primeiroSocket.set('msg-da-eduarda', 2);

    const depoisDeReconectar = RETRY_COUNTER_CACHE;
    assert.equal(
      depoisDeReconectar.get<number>('msg-da-eduarda'),
      2,
      'a contagem continua de onde parou',
    );

    RETRY_COUNTER_CACHE.del('msg-da-eduarda');
  });
});
