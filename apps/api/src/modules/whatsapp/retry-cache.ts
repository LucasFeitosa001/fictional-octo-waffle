/**
 * Contador de tentativas de reenvio do WhatsApp (estudo 69).
 *
 * Quando o aparelho do destinatário não consegue decifrar uma mensagem, ele
 * devolve um "retry receipt" pedindo o reenvio. O Baileys usa este cache para
 * contar quantas vezes já tentou aquele mesmo id — e a documentação pede que
 * ele viva FORA do socket: criado junto, a contagem zera a cada reconexão e o
 * mesmo pedido pode virar laço infinito.
 *
 * Implementação mínima com TTL para não arrastar dependência nova; a interface
 * é a `CacheStore` que o Baileys espera (`get`/`set`/`del`/`flushAll`).
 */
export class RetryCache {
  private readonly dados = new Map<string, { valor: unknown; expira: number }>();

  constructor(
    private readonly ttlMs = 60 * 60 * 1000,
    private readonly teto = 5000,
    private readonly agora: () => number = () => Date.now(),
  ) {}

  get<T>(chave: string): T | undefined {
    const linha = this.dados.get(chave);
    if (!linha) return undefined;
    if (linha.expira <= this.agora()) {
      this.dados.delete(chave);
      return undefined;
    }
    return linha.valor as T;
  }

  set<T>(chave: string, valor: T): void {
    // Reescrever mantém a posição original no Map; apagar antes faz a chave
    // voltar para o fim da fila, que é o que a ordem de despejo espera.
    this.dados.delete(chave);
    if (this.dados.size >= this.teto) {
      const maisAntigo = this.dados.keys().next().value;
      if (maisAntigo !== undefined) this.dados.delete(maisAntigo);
    }
    this.dados.set(chave, { valor, expira: this.agora() + this.ttlMs });
  }

  del(chave: string): void {
    this.dados.delete(chave);
  }

  flushAll(): void {
    this.dados.clear();
  }

  /** Só para teste/diagnóstico: quantas chaves estão guardadas. */
  get tamanho(): number {
    return this.dados.size;
  }
}

/**
 * Instância única do processo. É de propósito que ela seja module-level: o
 * socket é recriado a cada reconexão e precisa reencontrar a MESMA contagem.
 */
export const RETRY_COUNTER_CACHE = new RetryCache();
