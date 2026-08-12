import { Injectable, Logger } from '@nestjs/common';

/**
 * Cliente HTTP da uazapi — o provedor alternativo ao Baileys (estudo 158).
 *
 * Contrato verificado contra o servidor real em 12/08/2026, não pela
 * documentação (que é uma SPA e não expõe o spec): a autenticação é o header
 * `token` com o token DA INSTÂNCIA — não é Bearer, e `admintoken` só serve para
 * rotas administrativas, que devolvem 401 com o token de instância.
 *
 * Só o que a integração precisa mora aqui. O resto do sistema continua falando
 * com o WhatsappService; este cliente é detalhe de transporte.
 */

/** Resultado normalizado de um envio, no formato que o outbox já grava. */
export interface UazapiEnvio {
  /** id da mensagem no WhatsApp — vai para `WhatsappOutbox.whatsappMessageId`. */
  messageId: string | null;
  /** Corpo cru da resposta; guardado para casar o ACK depois. */
  raw: unknown;
}

export interface UazapiStatus {
  status: string;
  connected: boolean;
  phone: string | null;
  profileName: string | null;
  qrcode: string | null;
  paircode: string | null;
}

@Injectable()
export class UazapiClient {
  private readonly logger = new Logger(UazapiClient.name);

  private get baseUrl(): string | null {
    const raw = (process.env.UAZAPI_BASE_URL ?? '').trim().replace(/\/+$/, '');
    if (!raw) return null;
    // Só HTTPS: a URL recebe o token no header e não pode trafegar em claro. E
    // vem do AMBIENTE, nunca do banco ou do frontend — senão vira SSRF.
    if (!raw.startsWith('https://')) {
      this.logger.error('UAZAPI_BASE_URL precisa começar com https:// — ignorando.');
      return null;
    }
    return raw;
  }

  private get token(): string | null {
    return (process.env.UAZAPI_INSTANCE_TOKEN ?? '').trim() || null;
  }

  /** A integração só existe quando as duas variáveis estão configuradas. */
  get configurado(): boolean {
    return Boolean(this.baseUrl && this.token);
  }

  private async chamar<T>(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown; timeoutMs?: number },
  ): Promise<T> {
    const base = this.baseUrl;
    const token = this.token;
    if (!base || !token) {
      throw new Error('uazapi não configurada (UAZAPI_BASE_URL / UAZAPI_INSTANCE_TOKEN).');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
    try {
      const res = await fetch(`${base}${path}`, {
        method: init.method,
        headers: {
          token,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
        signal: controller.signal,
      });
      const texto = await res.text();
      if (!res.ok) {
        // A frase do provedor é a única que diz o que houve. Cortada para não
        // estourar o `lastError` (500 chars) nem despejar payload no log.
        throw new Error(`uazapi ${path} devolveu ${res.status}: ${texto.slice(0, 200)}`);
      }
      return (texto ? (JSON.parse(texto) as T) : (null as T));
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Envia texto. `number` vai só com dígitos (DDI+DDD+número) — é o formato que
   * o outbox já guarda em `toPhone`.
   */
  async enviarTexto(numero: string, texto: string): Promise<UazapiEnvio> {
    const digitos = (numero || '').replace(/\D/g, '');
    if (!digitos) throw new Error('Número vazio para envio via uazapi.');
    const resposta = await this.chamar<Record<string, unknown>>('/send/text', {
      method: 'POST',
      body: { number: digitos, text: texto },
    });
    return { messageId: this.extrairMessageId(resposta), raw: resposta };
  }

  /**
   * O id da mensagem pode vir em chaves diferentes conforme a versão. Procura
   * nas conhecidas e devolve null em vez de chutar: sem id o ACK não casa, mas
   * um id errado casaria com a mensagem ERRADA.
   */
  private extrairMessageId(resposta: unknown, profundidade = 0): string | null {
    if (!resposta || typeof resposta !== 'object' || profundidade > 3) return null;
    const o = resposta as Record<string, unknown>;
    for (const c of [o.messageid, o.messageId, o.id, o.key]) {
      if (typeof c === 'string' && c.trim()) return c.trim();
      if (c && typeof c === 'object') {
        const id = (c as Record<string, unknown>).id;
        if (typeof id === 'string' && id.trim()) return id.trim();
      }
    }
    return this.extrairMessageId(o.message, profundidade + 1);
  }

  /** Estado da instância — alimenta a tela de conexão e a decisão de enviar. */
  async status(): Promise<UazapiStatus | null> {
    try {
      const r = await this.chamar<{ instance?: Record<string, unknown> } | null>(
        '/instance/status',
        { method: 'GET', timeoutMs: 12_000 },
      );
      const i = r?.instance;
      if (!i) return null;
      const status = String(i.status ?? '');
      return {
        status,
        connected: status.toLowerCase() === 'connected',
        phone: typeof i.owner === 'string' ? i.owner : null,
        profileName: typeof i.profileName === 'string' ? i.profileName : null,
        qrcode: typeof i.qrcode === 'string' && i.qrcode ? i.qrcode : null,
        paircode: typeof i.paircode === 'string' && i.paircode ? i.paircode : null,
      };
    } catch (err) {
      this.logger.warn(`Falha ao ler status da uazapi: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Registra o webhook. O segredo viaja NA URL porque o provedor não documenta
   * header de assinatura — a validação é defesa nossa, não capacidade dele.
   *
   * `excludeMessages: ['wasSentByApi']` evita o eco das nossas próprias
   * mensagens no evento `messages`; `messages_update` NÃO é filtrado, senão o
   * filtro esconderia junto os ACKs de entrega e leitura.
   */
  async registrarWebhook(url: string): Promise<unknown> {
    return this.chamar('/webhook', {
      method: 'POST',
      body: {
        enabled: true,
        url,
        events: ['messages', 'messages_update', 'connection'],
        excludeMessages: ['wasSentByApi'],
        addUrlEvents: false,
        addUrlTypesMessages: false,
      },
    });
  }

  async lerWebhook(): Promise<unknown> {
    return this.chamar('/webhook', { method: 'GET', timeoutMs: 12_000 });
  }
}
