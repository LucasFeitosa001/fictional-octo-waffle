import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  readVoltrConfig,
  resolveIngestToken,
  resolveTenantSchema,
  resolveTenantSlug,
  type VoltrConfig,
} from './voltr.config';

export type VoltrScope = 'chat' | 'crm' | 'boards' | 'ia';

export interface VoltrEmbedTokenResponse {
  embedUrl: string;
  expiresIn: number;
  accessToken: string;
}

/** Clientes por requisição no sync. O `/api/ingest/clientes` da Voltr aceita até
 *  5.000 por chamada, mas o upsert lá é linha a linha — lote menor mantém cada
 *  requisição curta e cabe no rate-limit de 30/min do endpoint. */
const SYNC_CLIENTES_LOTE = 400;

/** Teto de clientes lidos num sync (salão real não passa disso; evita varredura
 *  infinita se a paginação por cursor der errado). */
const SYNC_CLIENTES_MAX = 20_000;

/** Timeout de cada lote. Maior que o do inbound: são centenas de upserts. */
const SYNC_CLIENTES_TIMEOUT_MS = 30_000;

/** Espera antes da única retentativa quando a Voltr devolve 429. */
const SYNC_CLIENTES_PAUSA_429_MS = 5_000;

/** Telefone curto demais não casa com JID de WhatsApp — DDD + 8 dígitos. */
const TELEFONE_MIN_DIGITOS = 10;

/** Timeout do aviso de recibo. Curto: é um UPDATE de uma linha do outro lado, e
 *  um ACK que demora mais que isso já foi substituído por outro mais novo. */
const STATUS_TIMEOUT_MS = 10_000;

/** Formato exato que o `/api/ingest/clientes` da Voltr aceita (IngestClienteExterno). */
interface ClienteParaVoltr {
  nome: string;
  telefone: string;
  email?: string;
  documento?: string;
}

/** Resposta do `/api/ingest/clientes` da Voltr. */
interface RespostaSyncVoltr {
  criados?: number;
  atualizados?: number;
  ignorados?: number;
  descartadosPorLimite?: number;
}

/** Os quatro estados que o `/api/ingest/status` da Voltr aceita. */
export type VoltrStatusEntrega = 'enviada' | 'entregue' | 'lida' | 'falha';

export interface VoltrStatusResultado {
  ok: boolean;
  /** Por que o status não foi gravado lá, quando `ok` é falso. */
  motivo?:
    | 'integracao_desligada'
    /** A Voltr ainda não conhece esse externalId — vale tentar de novo. */
    | 'mensagem_nao_encontrada'
    /** A Voltr respondeu, mas recusou (token, schema, payload). */
    | 'recusado'
    /** Não houve resposta: rede, timeout, Voltr fora do ar. */
    | 'sem_resposta';
}

export interface VoltrSyncClientesResultado {
  ok: boolean;
  /** Por que nada foi enviado, quando `ok` é falso. */
  motivo?: 'integracao_desligada' | 'sincronizacao_em_andamento';
  /** Clientes lidos do cadastro do salão. */
  lidos: number;
  /** Clientes que de fato saíram daqui (com telefone utilizável, sem repetição). */
  enviados: number;
  /** Descartados aqui: sem telefone ou telefone curto demais. */
  semTelefone: number;
  /** Descartados aqui: mesmo telefone de outro cliente já enviado. */
  repetidos: number;
  /** Contagens devolvidas pela Voltr (só dos lotes que ela aceitou). */
  criados: number;
  atualizados: number;
  ignorados: number;
  lotes: number;
  lotesComFalha: number;
}

/**
 * Cliente da Voltr (estudo 68).
 *
 * O SEGREDO DE PARCEIRO NUNCA SAI DAQUI: quem chama `POST /api/embed/token` é
 * este servidor, e o painel só recebe o JWT curto já emitido. Erro da Voltr vira
 * 502 — quem falhou foi o parceiro, não o usuário.
 */
@Injectable()
export class VoltrService {
  private readonly logger = new Logger(VoltrService.name);
  private readonly config: VoltrConfig = readVoltrConfig();
  /** Empresas com sync de clientes rodando agora (trava contra clique duplo). */
  private readonly syncEmAndamento = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  get configurado(): boolean {
    return Boolean(
      this.config.embedUrl && this.config.clientId && this.config.clientSecret,
    );
  }

  /** Nome de exibição do usuário, para a Voltr não criar "usuário sem nome". */
  async resolveDisplayName(userId: string, email: string): Promise<string> {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      return user?.name?.trim() || email.split('@')[0] || 'Usuário';
    } catch {
      return email.split('@')[0] || 'Usuário';
    }
  }

  async getEmbedToken(
    user: {
      companyId: string;
      externalUserId: string;
      email: string;
      nome: string;
    },
    scopes: VoltrScope[],
  ): Promise<VoltrEmbedTokenResponse> {
    if (!this.configurado) {
      throw new ServiceUnavailableException(
        'Integração com a Voltr não configurada nesta instalação.',
      );
    }
    const tenantSlug = resolveTenantSlug(user.companyId, this.config);
    if (!tenantSlug) {
      throw new ServiceUnavailableException(
        'Este salão ainda não está vinculado a um espaço na Voltr.',
      );
    }

    // Anti-replay exigido pela Voltr: timestamp em SEGUNDOS (janela ±300s) e um
    // nonce único por requisição. Sem eles a troca devolve 400.
    const ts = Math.floor(Date.now() / 1000);
    const nonce = randomUUID();

    let res: Response;
    try {
      res = await fetch(`${this.config.embedUrl}/api/embed/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-embed-client': this.config.clientId,
          'x-embed-secret': this.config.clientSecret,
          'x-embed-ts': String(ts),
          'x-embed-nonce': nonce,
        },
        body: JSON.stringify({
          tenantSlug,
          externalUserId: user.externalUserId,
          email: user.email,
          nome: user.nome,
          scopes,
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`Voltr indisponível: ${(err as Error).message}`);
      throw new BadGatewayException('A Voltr não respondeu. Tente de novo.');
    }

    const corpo = (await res.json().catch(() => null)) as {
      accessToken?: string;
      expiresIn?: number;
      embedUrl?: string;
      message?: string;
    } | null;

    if (!res.ok || !corpo?.accessToken || !corpo.embedUrl) {
      const motivo = corpo?.message ?? `HTTP ${res.status}`;
      this.logger.warn(
        `Troca de token da Voltr recusada (tenant=${tenantSlug}): ${motivo}`,
      );
      throw new BadGatewayException(`A Voltr recusou o acesso: ${motivo}`);
    }

    return {
      accessToken: corpo.accessToken,
      expiresIn: corpo.expiresIn ?? 900,
      embedUrl: corpo.embedUrl,
    };
  }

  /** Encaminha para o inbox da Voltr uma mensagem da conversa — nos dois sentidos. */
  async encaminharInbound(msg: {
    companyId: string;
    /** JID do CONTATO (o outro lado da conversa), não de quem escreveu. */
    contatoJid: string;
    text: string;
    externalId?: string;
    nomeCliente?: string;
    /** true quando foi o salão que escreveu (msg.fromMe). Ver estudo 78. */
    doSalao?: boolean;
  }): Promise<void> {
    const token = resolveIngestToken(msg.companyId, this.config);
    const schema = resolveTenantSchema(msg.companyId, this.config);
    if (!this.config.apiUrl || !token || !schema) return; // integração desligada

    await fetch(`${this.config.apiUrl}/api/ingest/mensagem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-ingest-token': token,
        'x-tenant-schema': schema,
      },
      body: JSON.stringify({
        canal: 'whatsapp',
        externalUserId: msg.contatoJid,
        texto: msg.text,
        // Os DOIS sentidos. Descartar o que o salão manda deixava o inbox da
        // Voltr com meia conversa — só a fala do cliente. Copiar para lá uma
        // mensagem que JÁ foi enviada pelo WhatsApp não dispara nada; a via de
        // saída (a Voltr mandando pela nossa fila) segue desligada. Estudo 78.
        direcao: msg.doSalao ? 'saida' : 'entrada',
        autor: msg.doSalao ? 'humano' : 'cliente',
        ...(msg.externalId ? { externalId: msg.externalId } : {}),
        ...(msg.nomeCliente ? { nomeCliente: msg.nomeCliente } : {}),
        ts: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  }

  /**
   * Empurra o cadastro de clientes do salão para a agenda do CRM da Voltr.
   *
   * A Voltr casa por TELEFONE (com e sem DDI 55) e marca a tag `salonpass`, então
   * rodar de novo atualiza em vez de duplicar — pode ser disparado quantas vezes
   * o dono quiser. Sai em lotes de {@link SYNC_CLIENTES_LOTE} porque o upsert do
   * outro lado é linha a linha e o endpoint tem rate-limit.
   *
   * Mesma regra dos outros caminhos daqui: sem `apiUrl`/token/schema a integração
   * está DESLIGADA e nada acontece — sem exceção, sem chamada. Falha de um lote
   * vira log e segue para o próximo; o resultado conta quantos foram de verdade.
   */
  async sincronizarClientes(companyId: string): Promise<VoltrSyncClientesResultado> {
    const vazio = {
      lidos: 0,
      enviados: 0,
      semTelefone: 0,
      repetidos: 0,
      criados: 0,
      atualizados: 0,
      ignorados: 0,
      lotes: 0,
      lotesComFalha: 0,
    };

    const token = resolveIngestToken(companyId, this.config);
    const schema = resolveTenantSchema(companyId, this.config);
    if (!this.config.apiUrl || !token || !schema) {
      return { ok: false, motivo: 'integracao_desligada', ...vazio };
    }

    // Dois cliques no botão não podem virar duas varreduras concorrentes do
    // cadastro inteiro batendo no mesmo tenant.
    if (this.syncEmAndamento.has(companyId)) {
      return { ok: false, motivo: 'sincronizacao_em_andamento', ...vazio };
    }
    this.syncEmAndamento.add(companyId);

    const total = { ...vazio };
    const telefonesEnviados = new Set<string>();
    try {
      let cursor: string | undefined;
      for (;;) {
        const pagina = await this.prisma.client.customer.findMany({
          where: { companyId, deletedAt: null },
          select: {
            id: true,
            name: true,
            phone: true,
            secondaryPhone: true,
            email: true,
            cpf: true,
            cnpj: true,
          },
          orderBy: { id: 'asc' },
          take: SYNC_CLIENTES_LOTE,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!pagina.length) break;
        cursor = pagina[pagina.length - 1].id;
        total.lidos += pagina.length;

        const lote: ClienteParaVoltr[] = [];
        for (const c of pagina) {
          const telefone = this.telefoneUtilizavel(c.phone) ?? this.telefoneUtilizavel(c.secondaryPhone);
          if (!telefone) {
            total.semTelefone++;
            continue;
          }
          if (telefonesEnviados.has(telefone)) {
            total.repetidos++;
            continue;
          }
          telefonesEnviados.add(telefone);
          const email = c.email?.trim();
          const documento = (c.cpf ?? c.cnpj ?? '').replace(/\D/g, '');
          lote.push({
            nome: c.name?.trim() || telefone,
            telefone,
            ...(email ? { email } : {}),
            ...(documento ? { documento } : {}),
          });
        }

        if (lote.length) {
          total.lotes++;
          const resposta = await this.enviarLoteClientes(lote, token, schema);
          if (resposta) {
            total.enviados += lote.length;
            total.criados += resposta.criados ?? 0;
            total.atualizados += resposta.atualizados ?? 0;
            total.ignorados += resposta.ignorados ?? 0;
          } else {
            total.lotesComFalha++;
          }
        }

        if (pagina.length < SYNC_CLIENTES_LOTE) break;
        if (total.lidos >= SYNC_CLIENTES_MAX) {
          this.logger.warn(
            `Sync de clientes para a Voltr parou no teto de ${SYNC_CLIENTES_MAX} (tenant=${schema}).`,
          );
          break;
        }
      }
    } catch (err) {
      // Ler o cadastro falhou no meio. Devolve o que já foi em vez de estourar.
      this.logger.error(
        `Sync de clientes para a Voltr interrompido (tenant=${schema}): ${(err as Error).message}`,
      );
      return { ok: false, ...total };
    } finally {
      // Solta a trava mesmo se a leitura estourar — senão o botão trava para sempre.
      this.syncEmAndamento.delete(companyId);
    }

    this.logger.log(
      `Sync de clientes para a Voltr (tenant=${schema}): ${total.enviados} enviados de ${total.lidos} lidos ` +
        `(${total.criados} criados, ${total.atualizados} atualizados, ${total.semTelefone} sem telefone, ` +
        `${total.repetidos} repetidos), ${total.lotesComFalha} de ${total.lotes} lote(s) com falha.`,
    );

    return { ok: total.lotesComFalha === 0, ...total };
  }

  /**
   * POSTa UM lote em `/api/ingest/clientes`. Devolve a contagem da Voltr, ou
   * `null` quando o lote não passou — o chamador conta a falha e segue.
   * 429 (rate-limit do endpoint) ganha uma única retentativa depois de uma pausa.
   */
  private async enviarLoteClientes(
    clientes: ClienteParaVoltr[],
    token: string,
    schema: string,
  ): Promise<RespostaSyncVoltr | null> {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const res = await fetch(`${this.config.apiUrl}/api/ingest/clientes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-ingest-token': token,
            'x-tenant-schema': schema,
          },
          body: JSON.stringify({ clientes }),
          signal: AbortSignal.timeout(SYNC_CLIENTES_TIMEOUT_MS),
        });

        // Rate-limit do endpoint (30/min): espera e repete UMA vez. Na segunda
        // volta um 429 cai no `!res.ok` abaixo e o lote é contado como falha.
        if (res.status === 429 && tentativa === 0) {
          this.logger.warn(
            `Rate-limit da Voltr no sync de clientes (tenant=${schema}); repetindo o lote em ${SYNC_CLIENTES_PAUSA_429_MS / 1000}s.`,
          );
          await this.esperar(SYNC_CLIENTES_PAUSA_429_MS);
          continue;
        }
        if (!res.ok) {
          this.logger.warn(
            `Lote de ${clientes.length} cliente(s) recusado pela Voltr (tenant=${schema}): HTTP ${res.status}`,
          );
          return null;
        }
        return ((await res.json().catch(() => null)) as RespostaSyncVoltr | null) ?? {};
      } catch (err) {
        this.logger.warn(
          `Lote de ${clientes.length} cliente(s) não chegou na Voltr (tenant=${schema}): ${(err as Error).message}`,
        );
        return null;
      }
    }
    return null; // inalcançável: a segunda volta sempre retorna.
  }

  /** Telefone em dígitos, ou null quando não dá para casar com um contato. */
  private telefoneUtilizavel(bruto: string | null | undefined): string | null {
    const digitos = (bruto ?? '').replace(/\D/g, '');
    return digitos.length >= TELEFONE_MIN_DIGITOS ? digitos : null;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** A ponte com a Voltr está ligada para esta empresa? (mesma regra dos outros
   *  caminhos: sem apiUrl/token/schema a integração está DESLIGADA). */
  integracaoLigada(companyId: string): boolean {
    return Boolean(
      this.config.apiUrl &&
        resolveIngestToken(companyId, this.config) &&
        resolveTenantSchema(companyId, this.config),
    );
  }

  /**
   * Avisa a Voltr do ACK do WhatsApp (entregue/lida), casado por `externalId` —
   * o mesmo id da mensagem que o encaminhamento mandou em `/api/ingest/mensagem`.
   * É o que acende ✓✓ e ✓✓ azul no chat de lá.
   *
   * NUNCA estoura: devolve o motivo para quem chamou decidir se repete. Um
   * `mensagem_nao_encontrada` é normal quando o ACK corre na frente da cópia da
   * mensagem — aí vale tentar de novo daqui a pouco.
   *
   * Isto NÃO envia nada por WhatsApp: só relata para a Voltr um ACK que o
   * WhatsApp já nos deu.
   */
  async enviarStatus(
    companyId: string,
    externalId: string,
    status: VoltrStatusEntrega,
  ): Promise<VoltrStatusResultado> {
    const token = resolveIngestToken(companyId, this.config);
    const schema = resolveTenantSchema(companyId, this.config);
    if (!this.config.apiUrl || !token || !schema) {
      return { ok: false, motivo: 'integracao_desligada' };
    }

    let res: Response;
    try {
      res = await fetch(`${this.config.apiUrl}/api/ingest/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-ingest-token': token,
          'x-tenant-schema': schema,
        },
        body: JSON.stringify({ externalId, status }),
        signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.debug(
        `Recibo ${status} não chegou na Voltr (tenant=${schema}): ${(err as Error).message}`,
      );
      return { ok: false, motivo: 'sem_resposta' };
    }

    if (!res.ok) {
      // 429 (rate-limit do endpoint) e 5xx entram aqui como 'sem_resposta' para o
      // chamador poder repetir; 4xx de payload/token é 'recusado' e não adianta.
      const repetivel = res.status === 429 || res.status >= 500;
      this.logger.warn(
        `A Voltr recusou o recibo ${status} (tenant=${schema}): HTTP ${res.status}`,
      );
      return { ok: false, motivo: repetivel ? 'sem_resposta' : 'recusado' };
    }

    const corpo = (await res.json().catch(() => null)) as {
      ok?: boolean;
      motivo?: string;
    } | null;
    if (corpo && corpo.ok === false) {
      return {
        ok: false,
        motivo:
          corpo.motivo === 'mensagem_nao_encontrada'
            ? 'mensagem_nao_encontrada'
            : 'recusado',
      };
    }
    return { ok: true };
  }
}
