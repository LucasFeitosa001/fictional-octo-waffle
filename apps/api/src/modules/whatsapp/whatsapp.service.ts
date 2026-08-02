import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  Browsers,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  normalizeMessageContent,
  proto,
} from 'baileys';
import type { WAMessage, WASocket, WAVersion } from 'baileys';
import * as QRCode from 'qrcode';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { useDbAuthState } from './whatsapp-auth';
import { RETRY_COUNTER_CACHE } from './retry-cache';
import { escolherJidConhecido } from './jid-escolha';
import { UploadsService } from '../uploads/uploads.service';
import {
  autorizacaoAindaVale,
  expirouNaFila,
  expirouEsperandoConexao,
  isAutomationKind,
  podeEnfileirar,
  type AutomacaoDaConta,
} from './outbox-policy';


type WaStatus = 'disabled' | 'connecting' | 'qr' | 'open' | 'closed';

function jidUserDigitsValue(jid: string): string {
  return (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

export function whatsappParticipantIdentity(
  remoteJid: string,
  fromMe: boolean,
  senderPn?: string | null,
  participantPn?: string | null,
): {
  individual: boolean;
  isLid: boolean;
  phoneDigits: string;
} {
  const isPhoneJid = remoteJid.endsWith('@s.whatsapp.net');
  const isLid = remoteJid.endsWith('@lid');
  const phoneJid = isPhoneJid
    ? remoteJid
    : isLid && !fromMe
      ? (senderPn ?? participantPn ?? '')
      : '';
  return {
    individual: isPhoneJid || isLid,
    isLid,
    phoneDigits: phoneJid.endsWith('@s.whatsapp.net')
      ? jidUserDigitsValue(phoneJid)
      : '',
  };
}

// Config rows (manager number) live under a SEPARATE sessionId so a WhatsApp
// re-link (which wipes every credential row of a company's sessionId) never
// erases the salon's manager-number settings. itemId = companyId.
const CONFIG_SESSION_ID = 'config';
const CONFIG_CATEGORY = 'owner';
const RUNTIME_CATEGORY = 'runtime';
const CONNECTION_LEASE_ITEM_ID = 'connection-lease';
const CONNECTION_LEASE_TTL_MS = 45_000;
const CONNECTION_LEASE_HEARTBEAT_MS = 15_000;

// O antigo socket global usava este sessionId. Multi-tenant NÃO o usa mais (cada
// empresa vira seu próprio sessionId = companyId). Mantido só para o boot ignorar
// essa linha ao varrer credenciais e para documentar a migração (re-link único).
const LEGACY_GLOBAL_SESSION_ID = 'default';

// A plain-text reply that arrived at the salon's WhatsApp from the manager.
export interface WhatsappInbound {
  fromDigits: string; // sender number, digits only (e.g. "5511988887777")
  text: string;
  quotedText?: string; // text of the message being replied to (swipe-reply)
  messageId?: string;
  remoteJid: string;
  pushName?: string;
  kind?: string;
  metadata?: Record<string, string | number | boolean | null>;
  media?: {
    type: 'image' | 'audio';
    buffer: Buffer;
    mimetype: string;
    fileName: string;
    ptt: boolean;
  };
  fromMe: boolean;
  timestamp: Date;
  // Empresa dona do socket em que a mensagem chegou. Como cada company tem seu
  // PRÓPRIO número/socket, sabemos de imediato de qual salão veio a resposta.
  companyId: string;
}
export type WhatsappInboundHandler = (
  msg: WhatsappInbound,
) => void | Promise<void>;

/** Mensagem que acabou de entrar na outbox durável. */
export interface WhatsappOutboundQueued {
  outboxId: string;
  companyId: string;
  customerId: string | null;
  toPhone: string;
  toJid: string | null;
  text: string;
  kind: string | null;
  status: string;
  createdAt: Date;
  sentAt: Date | null;
}
export type WhatsappOutboundHandler = (
  msg: WhatsappOutboundQueued,
) => void | Promise<void>;

export interface WhatsappEnqueueResult {
  id: string;
  status: string;
  deduplicated: boolean;
}

export interface WhatsappDeliveryUpdate {
  companyId: string;
  whatsappMessageId: string;
  status: 'sent' | 'delivered' | 'read';
  at: Date;
}
export type WhatsappDeliveryHandler = (
  update: WhatsappDeliveryUpdate,
) => void | Promise<void>;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

// Outbox worker tuning. Baileys NÃO impõe rate limit; portanto a aplicação
// precisa suavizar rajadas. Os defaults deliberadamente conservadores podem ser
// ajustados por ambiente sem novo deploy.
const OUTBOX_TICK_MS = envInt('WHATSAPP_OUTBOX_TICK_MS', 5000, 1000, 60000);
const OUTBOX_MAX_ATTEMPTS = 5; // give up after this many tries → status 'failed'
const TRANSACTIONAL_DELAY_MIN_MS = envInt(
  'WHATSAPP_DELAY_MIN_MS',
  6000,
  1000,
  120000,
);
const TRANSACTIONAL_DELAY_MAX_MS = envInt(
  'WHATSAPP_DELAY_MAX_MS',
  12000,
  TRANSACTIONAL_DELAY_MIN_MS,
  180000,
);
const BULK_DELAY_MIN_MS = envInt(
  'WHATSAPP_BULK_DELAY_MIN_MS',
  18000,
  TRANSACTIONAL_DELAY_MIN_MS,
  300000,
);
const BULK_DELAY_MAX_MS = envInt(
  'WHATSAPP_BULK_DELAY_MAX_MS',
  35000,
  BULK_DELAY_MIN_MS,
  600000,
);
// 5 minutos, não 60 segundos: com 60s o mesmo cliente recebeu três mensagens em
// três minutos quando a fila drenou de uma vez (estudo 60). Cooldown só ADIA,
// nunca descarta — atrasar um aviso é melhor que parecer spam.
const RECIPIENT_COOLDOWN_MS = envInt(
  'WHATSAPP_RECIPIENT_COOLDOWN_MS',
  300000,
  0,
  3600000,
);
const OUTBOX_DEDUP_WINDOW_MS = envInt(
  'WHATSAPP_DEDUP_WINDOW_MS',
  10 * 60 * 1000,
  0,
  60 * 60 * 1000,
);
const BULK_HOURLY_LIMIT = envInt('WHATSAPP_BULK_HOURLY_LIMIT', 60, 1, 1000);
const BULK_KINDS = ['campaign', 'followup'] as const;
const CLIENT_AUTOMATION_KINDS = [
  'confirmation',
  'cancellation',
  'reminder',
  'followup',
  'campaign',
] as const;
// Quantas mensagens enviadas guardar por sessão para responder aos retry-receipts
// (ver getMessage). Cobre com folga a janela em que um aparelho pede reenvio.
const SENT_CACHE_MAX = 1000;
const MAX_INBOUND_MEDIA_BYTES = 16 * 1024 * 1024;
// Por quanto tempo guardar a cópia da mensagem enviada para responder a um
// pedido de reenvio. 14 dias cobre com folga a janela real do WhatsApp; depois
// disso é peso morto na tabela. Ver estudo 69.
const RETENCAO_COPIA_MS = 14 * 24 * 60 * 60 * 1000;
const LIMPEZA_COPIAS_TICK_MS = 6 * 60 * 60 * 1000;

// Minimal pino-compatible logger so Baileys stays quiet (it logs verbosely).
function silentLogger(): any {
  const noop = () => undefined;
  const logger: any = {
    level: 'silent',
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    child: () => logger,
  };
  return logger;
}

/**
 * Estado de UMA sessão de WhatsApp (uma empresa). O gerenciador mantém um destes
 * por companyId. Cada sessão tem seu próprio socket Baileys, status, QR pendente
 * e credenciais persistidas em Postgres sob sessionId = companyId.
 */
interface SessionState {
  companyId: string;
  sock: WASocket | null;
  status: WaStatus;
  currentQr: string | null;
  connecting: boolean;
  reconnectAttempts: number;
  connectTimeout: ReturnType<typeof setTimeout> | null;
  // Últimos 8 dígitos do próprio número conectado (capturado no 'open'). Usado
  // para reconhecer o chat "conversar consigo mesmo": salões que usam UM número
  // para bot + gerente respondem 1/2/3 no self-chat como fromMe.
  selfDigitsTail: string | null;
  // Cache id→conteúdo das últimas mensagens que ESTE socket enviou. Alimenta o
  // hook `getMessage` do Baileys: quando um aparelho do próprio dono (o celular
  // primário) recebe a cópia da mensagem enviada mas NÃO consegue decifrar, ele
  // pede reenvio (retry receipt) e o Baileys chama getMessage(key) pra reobter o
  // conteúdo e RE-ENVIAR criptografado. Sem isso a mensagem fica presa em
  // "Aguardando esta mensagem…" no WhatsApp do dono. Limitado a SENT_CACHE_MAX.
  sentCache: Map<string, proto.IMessage>;
  // Próximo instante em que ESTA sessão pode enviar. Cada empresa tem sua
  // própria cadência, então uma campanha de um salão não paralisa os demais.
  nextSendAt: number;
  // Lease distribuído no PostgreSQL. App Runner faz blue-green e pode manter
  // duas instâncias vivas por alguns minutos mesmo com MaxSize=1; só a dona do
  // lease pode abrir o socket Baileys desta empresa.
  hasLease: boolean;
  leaseHeartbeat: ReturnType<typeof setInterval> | null;
}

/**
 * Gerencia UMA conexão Baileys (WhatsApp Web) POR EMPRESA (multi-tenant). Cada
 * salão conecta e envia do SEU PRÓPRIO número. As credenciais de cada empresa são
 * persistidas em Postgres (useDbAuthState com sessionId = companyId), então um
 * restart do container reconecta silenciosamente, sem novo QR.
 *
 * IMPORTANTE: só um processo pode segurar cada sessão por vez, ou o WhatsApp
 * briga entre os dois aparelhos e desloga. Por isso o App Runner precisa
 * continuar em uma única instância (autoscaling MaxSize = 1).
 *
 * Desabilitado salvo WHATSAPP_ENABLED=true, para a conexão nunca subir em dev ou
 * antes das contas serem ligadas.
 */
@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  // Uma sessão por empresa. A chave é o companyId (= sessionId das credenciais).
  private readonly sessions = new Map<string, SessionState>();
  private readonly inboundHandlers = new Set<WhatsappInboundHandler>();
  private readonly outboundHandlers = new Set<WhatsappOutboundHandler>();
  private readonly deliveryHandlers = new Set<WhatsappDeliveryHandler>();
  private outboxTimer: ReturnType<typeof setInterval> | null = null;
  private limpezaTimer: ReturnType<typeof setInterval> | null = null;
  private draining = false;
  private readonly enabled = process.env.WHATSAPP_ENABLED === 'true';
  private readonly instanceId = randomUUID();
  // Fence monotônico do lease. No blue-green, o App Runner pode conservar o
  // container antigo indefinidamente por causa do WebSocket aberto. O processo
  // que iniciou depois precisa poder assumir e fazer o antigo perder o próximo
  // heartbeat; depender só do TTL nunca funciona enquanto ele ainda renova.
  private readonly instanceStartedAt = Date.now();
  // A versão embutida no pacote Baileys fica obsoleta antes de um novo release
  // npm e o WhatsApp rejeita o handshake com 405. Busca uma vez por processo e
  // reutiliza em todos os sockets/empresas; se a consulta falhar, o Baileys
  // ainda consegue tentar com o fallback interno.
  private waVersionPromise: Promise<WAVersion | undefined> | null = null;
  // Evita que duas chamadas concorrentes passem juntas pela consulta de
  // deduplicação antes de uma delas persistir a linha no banco.
  private readonly enqueueInFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads?: UploadsService,
  ) {}

  private getCurrentWaVersion(): Promise<WAVersion | undefined> {
    if (!this.waVersionPromise) {
      this.waVersionPromise = fetchLatestBaileysVersion()
        .then(({ version, isLatest }) => {
          this.logger.log(
            `WhatsApp Web protocol ${version.join('.')} (latest=${isLatest}).`,
          );
          return version;
        })
        .catch((err) => {
          this.logger.warn(
            `Não foi possível consultar a versão atual do WhatsApp Web; usando fallback do Baileys: ${(err as Error).message}`,
          );
          return undefined;
        });
    }
    return this.waVersionPromise;
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('WhatsApp desabilitado (defina WHATSAPP_ENABLED=true para ativar).');
      return;
    }
    // Fire-and-forget: nunca bloqueia o boot da API nos sockets do WhatsApp.
    // Reconecta cada empresa que já tem credenciais salvas.
    void this.reconnectSavedSessions();
    // Drena o outbox num timer; no-op enquanto nenhum socket estiver aberto.
    this.outboxTimer = setInterval(() => void this.drainOutbox(), OUTBOX_TICK_MS);
    // A cópia para reenvio só serve na janela em que o aparelho ainda pode
    // pedir. Passado isso é peso morto na tabela — some com ela sem apagar a
    // linha, que é o histórico. Ver estudo 69.
    this.limpezaTimer = setInterval(
      () => void this.limparCopiasVelhas(),
      LIMPEZA_COPIAS_TICK_MS,
    );
    void this.limparCopiasVelhas();
  }

  /** Zera `sentMessageJson` de mensagens antigas demais para receberem retry. */
  private async limparCopiasVelhas(): Promise<void> {
    const limite = new Date(Date.now() - RETENCAO_COPIA_MS);
    try {
      const { count } = await this.prisma.client.whatsappOutbox.updateMany({
        where: { sentAt: { lt: limite }, sentMessageJson: { not: Prisma.DbNull } },
        data: { sentMessageJson: Prisma.DbNull },
      });
      if (count > 0) {
        this.logger.log(`Outbox: ${count} cópia(s) de reenvio expiradas foram descartadas.`);
      }
    } catch (err) {
      this.logger.warn(
        `Não deu para limpar as cópias de reenvio: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    if (this.outboxTimer) clearInterval(this.outboxTimer);
    if (this.limpezaTimer) clearInterval(this.limpezaTimer);
    for (const session of this.sessions.values()) {
      if (session.connectTimeout) clearTimeout(session.connectTimeout);
      if (session.leaseHeartbeat) clearInterval(session.leaseHeartbeat);
      this.teardownSocket(session);
      session.status = 'closed';
      session.connecting = false;
      await this.releaseConnectionLease(session.companyId);
    }
  }

  /**
   * Registers the single consumer of inbound manager replies (the booking flow
   * wires this so a "1/2/3" answer from the salon drives the confirmation). Only
   * one handler is supported — last registration wins.
   */
  setInboundHandler(fn: WhatsappInboundHandler): void {
    this.inboundHandlers.add(fn);
  }

  /** Registra um consumidor adicional do stream de mensagens da empresa. */
  addInboundHandler(fn: WhatsappInboundHandler): () => void {
    this.inboundHandlers.add(fn);
    return () => this.inboundHandlers.delete(fn);
  }

  /**
   * Observa mensagens assim que entram na outbox. O inbox usa este evento para
   * criar o balão antes do envio e refletir depois pending/sent/failed.
   */
  addOutboundHandler(fn: WhatsappOutboundHandler): () => void {
    this.outboundHandlers.add(fn);
    return () => this.outboundHandlers.delete(fn);
  }

  /** Observa os ACKs do WhatsApp (servidor, entregue e lido) dos nossos envios. */
  addDeliveryHandler(fn: WhatsappDeliveryHandler): () => void {
    this.deliveryHandlers.add(fn);
    return () => this.deliveryHandlers.delete(fn);
  }

  private async emitOutboundQueued(message: WhatsappOutboundQueued) {
    for (const handler of this.outboundHandlers) {
      try {
        await handler(message);
      } catch (err) {
        this.logger.error(
          `Erro no handler de mensagem enviada: ${(err as Error).message}`,
        );
      }
    }
  }

  private async emitDeliveryUpdate(update: WhatsappDeliveryUpdate) {
    for (const handler of this.deliveryHandlers) {
      try {
        await handler(update);
      } catch (err) {
        this.logger.error(
          `Erro no handler de recibo do WhatsApp: ${(err as Error).message}`,
        );
      }
    }
  }

  private async dispatchInbound(
    inbound: WhatsappInbound,
    rawMessage: WAMessage,
    sock: WASocket,
    session: SessionState,
  ): Promise<void> {
    const sentByThisWorker =
      inbound.fromMe &&
      Boolean(inbound.messageId && session.sentCache.has(inbound.messageId));
    if (
      (inbound.kind === 'image' || inbound.kind === 'audio') &&
      !sentByThisWorker
    ) {
      try {
        const downloaded = await downloadMediaMessage(
          rawMessage,
          'buffer',
          {},
          {
            logger: silentLogger(),
            reuploadRequest: sock.updateMediaMessage,
          },
        );
        const buffer = Buffer.from(downloaded);
        if (buffer.length > MAX_INBOUND_MEDIA_BYTES) {
          inbound.metadata = {
            ...(inbound.metadata ?? {}),
            mediaError: 'Arquivo maior que 16 MB',
          };
        } else {
          const mimetype = String(
            inbound.metadata?.mimetype ||
              (inbound.kind === 'image' ? 'image/jpeg' : 'audio/ogg'),
          ).split(';')[0];
          const extension =
            inbound.kind === 'image'
              ? mimetype === 'image/png'
                ? 'png'
                : mimetype === 'image/webp'
                  ? 'webp'
                  : mimetype === 'image/gif'
                    ? 'gif'
                    : 'jpg'
              : mimetype === 'audio/mpeg'
                ? 'mp3'
                : mimetype === 'audio/mp4'
                  ? 'm4a'
                  : mimetype === 'audio/webm'
                    ? 'webm'
                    : 'ogg';
          inbound.media = {
            type: inbound.kind,
            buffer,
            mimetype,
            fileName: `whatsapp-${inbound.messageId ?? Date.now()}.${extension}`,
            ptt: Boolean(inbound.metadata?.ptt),
          };
        }
      } catch (err) {
        inbound.metadata = {
          ...(inbound.metadata ?? {}),
          mediaError: (err as Error).message.slice(0, 300),
        };
        this.logger.warn(
          `Não foi possível baixar mídia recebida (company=${inbound.companyId}, message=${inbound.messageId ?? '?'}): ${(err as Error).message}`,
        );
      }
    }

    for (const handler of this.inboundHandlers) {
      try {
        await handler(inbound);
      } catch (err) {
        this.logger.error(
          `Erro no handler de mensagem recebida: ${(err as Error).message}`,
        );
      }
    }
  }

  // ------------------------------------------------------- sessão por empresa

  /** Recupera (ou cria "vazia") a sessão de uma empresa. */
  private getSession(companyId: string): SessionState {
    let session = this.sessions.get(companyId);
    if (!session) {
      session = {
        companyId,
        sock: null,
        status: 'closed',
        currentQr: null,
        connecting: false,
        reconnectAttempts: 0,
        connectTimeout: null,
        selfDigitsTail: null,
        sentCache: new Map(),
        nextSendAt: 0,
        hasLease: false,
        leaseHeartbeat: null,
      };
      this.sessions.set(companyId, session);
    }
    return session;
  }

  /**
   * No boot, varre as credenciais salvas (WhatsappAuthState) e reconecta cada
   * empresa que já tem uma sessão linkada. Ignora as linhas de config (manager)
   * e a antiga sessão global 'default'. Empresas sem credenciais só conectam sob
   * demanda (quando o painel pede QR/status).
   */
  private async reconnectSavedSessions(): Promise<void> {
    try {
      const rows = await this.prisma.client.whatsappAuthState.findMany({
        where: {
          category: 'creds',
          itemId: 'creds',
          sessionId: { notIn: [CONFIG_SESSION_ID, LEGACY_GLOBAL_SESSION_ID] },
        },
        select: { sessionId: true },
      });
      const companyIds = [...new Set(rows.map((r) => r.sessionId))];
      if (companyIds.length === 0) {
        this.logger.log('WhatsApp: nenhuma empresa com sessão salva — conexões sob demanda.');
        return;
      }
      this.logger.log(`WhatsApp: reconectando ${companyIds.length} empresa(s) com sessão salva.`);
      for (const companyId of companyIds) {
        void this.connect(companyId);
      }
    } catch (err) {
      this.logger.error(`Falha ao varrer sessões salvas do WhatsApp: ${(err as Error).message}`);
    }
  }

  /**
   * Resolve a empresa-alvo do fluxo de OPS (endpoints com WHATSAPP_ADMIN_TOKEN,
   * que não carregam sessão de usuário). Prioridade:
   *   1. companyId explícito na query (o operador diz qual salão linkar);
   *   2. se houver EXATAMENTE uma empresa com credenciais/config salvas, ela;
   *   3. caso contrário null (ambíguo) — o operador precisa informar ?companyId.
   * Mantém o fluxo de ops utilizável sem quebrar o multi-tenant.
   */
  async resolveOpsCompanyId(companyId?: string): Promise<string | null> {
    if (companyId && companyId.trim()) return companyId.trim();
    try {
      const rows = await this.prisma.client.whatsappAuthState.findMany({
        where: { sessionId: { notIn: [CONFIG_SESSION_ID, LEGACY_GLOBAL_SESSION_ID] } },
        select: { sessionId: true },
        distinct: ['sessionId'],
      });
      const ids = [...new Set(rows.map((r) => r.sessionId))];
      if (ids.length === 1) return ids[0];
      // Nenhuma credencial ainda: cai no config (manager) se houver só uma empresa.
      if (ids.length === 0) {
        const cfg = await this.prisma.client.whatsappAuthState.findMany({
          where: { sessionId: CONFIG_SESSION_ID, category: CONFIG_CATEGORY },
          select: { itemId: true },
          distinct: ['itemId'],
        });
        const cfgIds = [...new Set(cfg.map((r) => r.itemId))];
        if (cfgIds.length === 1) return cfgIds[0];
      }
    } catch {
      // ignore — devolve null (ambíguo)
    }
    return null;
  }

  // --------------------------------------------------------- número do gerente

  /**
   * Stores the salon's manager/reception number — the phone that RECEIVES the
   * "confirm this booking?" prompt and whose replies drive the flow. Kept in a
   * dedicated config session so a WhatsApp re-link never wipes it. Normalized to
   * Brazilian digits; pass an empty/short value to clear it.
   */
  async setManagerPhone(companyId: string, phone: string): Promise<void> {
    const digits = this.normalizeBrDigits(phone);
    const db = this.prisma.client;
    const where = {
      sessionId_category_itemId: {
        sessionId: CONFIG_SESSION_ID,
        category: CONFIG_CATEGORY,
        itemId: companyId,
      },
    };
    if (!digits) {
      await db.whatsappAuthState.delete({ where }).catch(() => undefined);
      return;
    }
    const data = { managerPhone: digits };
    await db.whatsappAuthState.upsert({
      where,
      create: {
        sessionId: CONFIG_SESSION_ID,
        category: CONFIG_CATEGORY,
        itemId: companyId,
        data,
      },
      update: { data },
    });
  }

  /** Current manager number for a company (digits), or null when unset. */
  async getManagerPhone(companyId: string): Promise<string | null> {
    const row = await this.prisma.client.whatsappAuthState.findUnique({
      where: {
        sessionId_category_itemId: {
          sessionId: CONFIG_SESSION_ID,
          category: CONFIG_CATEGORY,
          itemId: companyId,
        },
      },
      select: { data: true },
    });
    const data = row?.data as { managerPhone?: unknown } | null;
    return typeof data?.managerPhone === 'string' ? data.managerPhone : null;
  }

  /**
   * Reverse lookup: which company owns the number a reply came from. Matches on
   * the last 8 digits so a stored "5511988887777" still matches an inbound JID
   * that drops/adds the country code or the 9th digit. Null when no salon claims
   * the number.
   */
  async findCompanyByManagerDigits(fromDigits: string): Promise<string | null> {
    const tail = this.digitsTail(fromDigits);
    if (!tail) return null;
    const rows = await this.prisma.client.whatsappAuthState.findMany({
      where: { sessionId: CONFIG_SESSION_ID, category: CONFIG_CATEGORY },
      select: { itemId: true, data: true },
    });
    for (const row of rows) {
      const data = row.data as { managerPhone?: unknown } | null;
      const phone = typeof data?.managerPhone === 'string' ? data.managerPhone : '';
      if (phone && this.digitsTail(phone) === tail) return row.itemId;
    }
    return null;
  }

  async isManagerPhone(companyId: string, phone: string): Promise<boolean> {
    const manager = await this.getManagerPhone(companyId);
    const managerTail = this.digitsTail(manager ?? '');
    const phoneTail = this.digitsTail(phone);
    return Boolean(managerTail && phoneTail && managerTail === phoneTail);
  }

  // Last 8 digits of a phone number — the stable tail shared across 55-prefix and
  // 9th-digit variants. Empty string when too short.
  private digitsTail(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    return digits.length >= 8 ? digits.slice(-8) : '';
  }

  // Digits of the "user" part of a JID, dropping the device (":7") and server
  // ("@s.whatsapp.net") suffixes — e.g. "558994588003:7@s.whatsapp.net" →
  // "558994588003". Naively stripping non-digits would fold the ":7" device id
  // into the number and corrupt the tail comparison.
  private jidUserDigits(jid: string): string {
    return jidUserDigitsValue(jid);
  }

  // Normalize to Brazilian digits (prefix 55 when absent). Empty when invalid.
  private normalizeBrDigits(phone: string): string {
    let digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) return '';
    if (!digits.startsWith('55')) digits = `55${digits}`;
    if (digits.length < 12 || digits.length > 13) return '';
    return digits;
  }

  // -------------------------------------------------------------- API pública

  /** Status da conexão de UMA empresa. */
  getStatus(
    companyId: string,
  ): { status: WaStatus; hasQr: boolean; phone: string | null } {
    if (!this.enabled) {
      return { status: 'disabled', hasQr: false, phone: null };
    }
    const session = this.sessions.get(companyId);
    if (!session) {
      return { status: 'closed', hasQr: false, phone: null };
    }
    const phone = this.jidUserDigits(session.sock?.user?.id ?? '') || null;
    return {
      status: session.status,
      hasQr: Boolean(session.currentQr),
      phone,
    };
  }

  /**
   * QR de pareamento atual de uma empresa como data URL PNG, ou null quando não
   * há pareamento pendente. Conecta sob demanda: se a empresa ainda não tem
   * sessão viva, dispara a conexão para o QR aparecer.
   */
  async getQrDataUrl(companyId: string): Promise<string | null> {
    if (!this.enabled) return null;
    const session = this.sessions.get(companyId);
    if (!session || (session.status !== 'open' && !session.connecting && !session.currentQr)) {
      // Sem sessão viva → sobe uma para gerar o QR.
      void this.connect(companyId);
      return null;
    }
    if (!session.currentQr) return null;
    return QRCode.toDataURL(session.currentQr, { margin: 1, width: 320 });
  }

  /**
   * Garante que a sessão de uma empresa esteja conectando/conectada. Chamado pelo
   * controller quando o painel abre a tela de conexão (pede status/QR).
   */
  ensureConnecting(companyId: string): void {
    if (!this.enabled) return;
    const session = this.sessions.get(companyId);
    if (!session || (session.status !== 'open' && !session.connecting)) {
      void this.connect(companyId);
    }
  }

  /**
   * Mints an 8-char pairing code for "link with phone number" — the alternative
   * to scanning the QR. The salon types this code into WhatsApp → Linked devices
   * → Link with phone number instead. Only valid while a pairing is pending
   * (status 'qr' / not yet registered). Returns null otherwise.
   */
  async requestPairingCode(companyId: string, phone: string): Promise<string | null> {
    if (!this.enabled) return null;
    // Garante uma sessão viva para essa empresa antes de pedir o código.
    this.ensureConnecting(companyId);
    const session = this.sessions.get(companyId);
    if (!session || !session.sock) return null;
    if (session.status === 'open') return null;
    let digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (!digits.startsWith('55')) digits = `55${digits}`;
    if (digits.length < 12 || digits.length > 13) return null;
    try {
      const code = await session.sock.requestPairingCode(digits);
      this.logger.log(`Código de pareamento do WhatsApp gerado (company=${companyId}).`);
      return code;
    } catch (err) {
      this.logger.error(
        `Falha ao gerar código de pareamento (company=${companyId}): ${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Encerra e limpa a sessão de uma empresa (re-link). */
  async logout(companyId: string): Promise<void> {
    const session = this.sessions.get(companyId);
    try {
      await session?.sock?.logout();
    } catch {
      // ignore — limpamos o estado de qualquer forma
    }
    const { clear } = await useDbAuthState(this.prisma, companyId);
    await clear();
    if (session) {
      this.teardownSocket(session);
      session.currentQr = null;
      session.status = 'closed';
      session.connecting = false;
      session.reconnectAttempts = 0;
      session.selfDigitsTail = null;
      if (session.connectTimeout) {
        clearTimeout(session.connectTimeout);
        session.connectTimeout = null;
      }
      if (session.leaseHeartbeat) {
        clearInterval(session.leaseHeartbeat);
        session.leaseHeartbeat = null;
      }
      await this.releaseConnectionLease(companyId);
      // Não remove a entrada do Map: o painel pode pedir um novo QR em seguida e
      // uma reconexão sob demanda cria a sessão fresca.
    }
  }

  // ----------------------------------------------------------------- outbox

  /**
   * Enqueues a plain-text WhatsApp message instead of sending it inline. This is
   * the path the booking flow uses: fire-and-forget Baileys sends were silently
   * lost (the socket can accept a send right after connect and drop it, and the
   * Brazilian 9th-digit JID is ambiguous). Persisting to an outbox guarantees the
   * message survives a restart and is retried until the salon actually receives
   * it. Fails soft — bad numbers are dropped with a warning, never thrown.
   *
   * `ctx.companyId` é ESSENCIAL no multi-tenant: o drain usa esse companyId para
   * escolher o SOCKET certo (o número do salão dono da mensagem). Mensagens sem
   * companyId não têm por onde sair e são deixadas pendentes (nenhum socket as
   * reivindica) — todas as chamadas relevantes já passam companyId.
   */
  /**
   * Grava a mensagem que a trava 1 recusou, já em estado terminal, para que a
   * recusa apareça no histórico em vez de sumir. Ver estudo 82.
   *
   * Nunca entra na fila: `status: 'failed'` não é buscado pelo remetente. Sem
   * `companyId` não há onde pendurar a linha (nem tela que a mostre), então aí
   * só resta o warn — é o caso de envio avulso sem empresa.
   */
  private async registrarRecusa(
    toPhone: string,
    text: string,
    recipientJid: string | null | undefined,
    motivo: string | undefined,
    ctx?: { companyId?: string; customerId?: string; appointmentId?: string; kind?: string },
  ): Promise<void> {
    const companyId = ctx?.companyId;
    if (!companyId) return;
    try {
      // Automação repetida (o poller tenta de novo a cada tick) viraria uma
      // lista de lixo idêntica. Uma recusa por mensagem dentro da mesma janela
      // já usada para duplicatas.
      const jaRegistrada = await this.prisma.client.whatsappOutbox.findFirst({
        where: {
          companyId,
          toPhone,
          text,
          status: 'failed',
          kind: ctx?.kind ?? null,
          appointmentId: ctx?.appointmentId ?? null,
          createdAt: { gte: new Date(Date.now() - OUTBOX_DEDUP_WINDOW_MS) },
        },
        select: { id: true },
      });
      if (jaRegistrada) return;
      await this.prisma.client.whatsappOutbox.create({
        data: {
          companyId,
          customerId: ctx?.customerId,
          appointmentId: ctx?.appointmentId,
          kind: ctx?.kind,
          toPhone,
          toJid: recipientJid,
          text,
          status: 'failed',
          attempts: 0,
          lastError: motivo ?? 'Recusada antes da fila',
        },
      });
    } catch (err) {
      // Registrar a recusa não pode derrubar quem chamou: o envio já não ia
      // acontecer de qualquer jeito.
      this.logger.error(`Outbox: falha ao registrar a recusa — ${(err as Error).message}`);
    }
  }

  async enqueueText(
    phone: string,
    text: string,
    ctx?: {
      companyId?: string;
      customerId?: string;
      appointmentId?: string;
      kind?: string;
      /** UUID estável da ação HTTP; retry devolve a linha já criada. */
      requestKey?: string;
      /**
       * Uma PESSOA autorizou este envio específico (botão "Enviar confirmação",
       * sugestão de horário). Isenta a linha da revalidação de automação na
       * entrega e permite enfileirar com o canal fechado — quem clicou está
       * olhando a tela e vê "na fila". Ver estudo 60.
       */
      authorized?: boolean;
      inboxMessageId?: string;
      /** JID já observado no inbox (`@s.whatsapp.net` ou `@lid`). */
      recipientJid?: string;
      media?: {
        type: 'image' | 'audio';
        url: string;
        mimeType: string;
        fileName?: string;
        ptt?: boolean;
      };
    },
  ): Promise<WhatsappEnqueueResult | null> {
    const recipientJid = this.normalizeRecipientJid(ctx?.recipientJid);
    const normalized = this.normalizeOutgoingPhone(phone);
    if (!normalized && !recipientJid) {
      this.logger.warn(`Outbox: número inválido ignorado (${phone}).`);
      return null;
    }
    const toPhone =
      normalized?.value ?? this.jidUserDigits(recipientJid ?? '');
    if (!toPhone) {
      this.logger.warn('Outbox: destinatário sem número ou JID válido.');
      return null;
    }
    const companyId = ctx?.companyId ?? null;

    // TRAVA 1 (estudo 60): automação com o canal FECHADO não entra na fila. Era
    // isso que armava a bomba — a fila enchia parada e drenava tudo de uma vez
    // no reconnect, com texto velho e horário já passado.
    const canalAberto = companyId ? this.isSessionOpen(companyId) : false;
    const entrada = podeEnfileirar(ctx?.kind, canalAberto, {
      autorizadaPorPessoa: ctx?.authorized === true,
      doInbox: Boolean(ctx?.inboxMessageId),
    });
    if (!entrada.ok) {
      // Hoje só cai aqui o que a política recusa por mérito próprio — o canal
      // fechado deixou de recusar e passou a ADIAR (estudo 85). O rastro do
      // estudo 82 continua valendo para o que ainda for recusado.
      this.logger.warn(
        `Outbox: ${ctx?.kind} para ${toPhone} NÃO enfileirada (company=${companyId ?? 'sem-company'}) — ${entrada.motivo}.`,
      );
      await this.registrarRecusa(toPhone, text, recipientJid, entrada.motivo, ctx);
      return null;
    }

    if (companyId && ctx?.requestKey) {
      const sameRequest =
        await this.prisma.client.whatsappOutbox.findUnique({
          where: {
            companyId_requestKey: {
              companyId,
              requestKey: ctx.requestKey,
            },
          },
          select: { id: true, status: true },
        });
      if (sameRequest) {
        void this.drainOutbox();
        return {
          id: sameRequest.id,
          status: sameRequest.status,
          deduplicated: true,
        };
      }
    }
    const dedupRecipient = recipientJid ?? toPhone;
    const dedupKey = `${companyId ?? '-'}\u0000${dedupRecipient}\u0000${text}\u0000${ctx?.media?.url ?? ''}`;
    // Mensagens nascidas no inbox têm identidade própria e precisam sempre
    // ganhar sua linha na outbox; deduplicá-las aqui deixaria o balão novo
    // eternamente em "pending". A deduplicação continua valendo para as
    // automações transacionais/campanhas que não possuem inboxMessageId.
    const shouldDeduplicate =
      ctx?.kind !== 'manual' && !ctx?.inboxMessageId;
    if (
      shouldDeduplicate &&
      OUTBOX_DEDUP_WINDOW_MS > 0 &&
      this.enqueueInFlight.has(dedupKey)
    ) {
      this.logger.warn(
        `Outbox: duplicata concorrente ignorada (company=${companyId ?? 'sem-company'}).`,
      );
      return null;
    }
    this.enqueueInFlight.add(dedupKey);
    try {
      if (shouldDeduplicate && OUTBOX_DEDUP_WINDOW_MS > 0) {
        const duplicate = await this.prisma.client.whatsappOutbox.findFirst({
          where: {
            companyId,
            appointmentId: ctx?.appointmentId,
            toPhone,
            toJid: recipientJid,
            text,
            mediaUrl: ctx?.media?.url,
            mediaType: ctx?.media?.type,
            mediaMimeType: ctx?.media?.mimeType,
            mediaFileName: ctx?.media?.fileName,
            mediaPtt: ctx?.media?.ptt ?? false,
            OR: [
              // Uma duplicata nunca deve ultrapassar a original ainda pendente,
              // mesmo que o socket tenha ficado offline por bastante tempo.
              { status: 'pending' },
              {
                status: 'sent',
                createdAt: {
                  gte: new Date(Date.now() - OUTBOX_DEDUP_WINDOW_MS),
                },
              },
            ],
          },
          select: { id: true, status: true },
        });
        if (duplicate) {
          this.logger.warn(
            `Outbox: mensagem duplicada ignorada (company=${companyId ?? 'sem-company'}, original=${duplicate.id}).`,
          );
          return {
            id: duplicate.id,
            status: duplicate.status,
            deduplicated: true,
          };
        }
      }
      let queued;
      try {
        queued = await this.prisma.client.whatsappOutbox.create({
          data: {
            // Preserve an explicit E.164 country code. The leading + is the signal
            // that this is not a Brazilian local number, and is needed later when
            // resolving the WhatsApp JID.
            toPhone,
            toJid: recipientJid,
            text,
            // Só grava o que veio — undefined vira NULL na coluna (retrocompatível).
            companyId,
            customerId: ctx?.customerId ?? null,
            appointmentId: ctx?.appointmentId ?? null,
            kind: ctx?.kind ?? null,
            requestKey: ctx?.requestKey ?? null,
            inboxMessageId: ctx?.inboxMessageId ?? null,
            authorizedAt: ctx?.authorized === true ? new Date() : null,
          },
          select: {
            id: true,
            companyId: true,
            customerId: true,
            toPhone: true,
            toJid: true,
            text: true,
            kind: true,
            status: true,
            createdAt: true,
            sentAt: true,
            inboxMessageId: true,
          },
        });
      } catch (error) {
        if (
          companyId &&
          ctx?.requestKey &&
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'P2002'
        ) {
          const sameRequest =
            await this.prisma.client.whatsappOutbox.findUnique({
              where: {
                companyId_requestKey: {
                  companyId,
                  requestKey: ctx.requestKey,
                },
              },
              select: { id: true, status: true },
            });
          if (sameRequest) {
            return {
              id: sameRequest.id,
              status: sameRequest.status,
              deduplicated: true,
            };
          }
        }
        throw error;
      }
      // Mensagens já criadas dentro do inbox (IA/atendente) só precisam que a
      // outbox atualize o status. As demais — confirmação, cancelamento,
      // lembrete, follow-up e campanha — ganham o balão por este evento.
      if (queued.companyId && !queued.inboxMessageId) {
        await this.emitOutboundQueued({
          outboxId: queued.id,
          companyId: queued.companyId,
          customerId: queued.customerId,
          toPhone: queued.toPhone,
          toJid: queued.toJid,
          text: queued.text,
          kind: queued.kind,
          status: queued.status,
          createdAt: queued.createdAt,
          sentAt: queued.sentAt,
        });
      }
      void this.drainOutbox();
      return {
        id: queued.id,
        status: queued.status,
        deduplicated: false,
      };
    } finally {
      this.enqueueInFlight.delete(dedupKey);
    }
  }

  /**
   * Sanitizes an outgoing phone without losing an explicit E.164 marker.
   *
   * A value beginning with `+` already declares its country code, so it is
   * persisted as canonical E.164 (`+19182384714`, for example). Digit-only
   * values remain digit-only for backwards compatibility: they are Brazilian
   * local numbers unless they are a legacy 55-prefixed E.164 value.
   */
  private normalizeOutgoingPhone(
    phone: string,
  ): { digits: string; value: string; hasExplicitCountryCode: boolean } | null {
    const raw = (phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    const hasExplicitCountryCode = raw.startsWith('+');
    // Brazilian local numbers have 10–11 digits. E.164 allows up to 15; use a
    // lower bound only for explicit international values to avoid dropping
    // countries with shorter national numbers.
    const minLength = hasExplicitCountryCode ? 7 : 10;
    if (digits.length < minLength || digits.length > 15) return null;
    return {
      digits,
      value: hasExplicitCountryCode ? `+${digits}` : digits,
      hasExplicitCountryCode,
    };
  }

  /** Aceita somente JIDs individuais; grupo/status/newsletter nunca entram. */
  private normalizeRecipientJid(value?: string): string | null {
    const jid = value?.trim() ?? '';
    if (
      !jid ||
      (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@lid'))
    ) {
      return null;
    }
    return this.jidUserDigits(jid) ? jid : null;
  }

  private absoluteMediaUrl(value: string): string {
    if (/^https?:\/\//i.test(value)) return value;
    const apiBase = (
      process.env.BETTER_AUTH_URL ||
      process.env.API_URL ||
      `http://localhost:${process.env.PORT ?? 3334}`
    ).replace(/\/$/, '');
    return `${apiBase}${value.startsWith('/') ? '' : '/'}${value}`;
  }

  /**
   * Baileys não carrega o cookie da sessão do navegador. Para uploads locais
   * privados, lê o arquivo já validado pelo tenant e entrega o Buffer direto;
   * mídias S3/CDN continuam por URL.
   */
  private async outboundMediaSource(
    value: string,
    companyId: string,
  ): Promise<Buffer | { url: string }> {
    const match = value.match(/^\/api\/v1\/uploads\/file\/([A-Za-z0-9._-]+)$/);
    if (!match) return { url: this.absoluteMediaUrl(value) };
    const full = await this.uploads?.resolveLocalFile(match[1], companyId);
    if (!full) throw new Error('Upload local não pertence à empresa ou não existe.');
    return readFile(full);
  }

  /**
   * Marca no WhatsApp as mensagens que o atendente realmente abriu. Além de
   * zerar o contador local, isso envia o receipt que transforma os vistos do
   * cliente em azuis (se a confirmação de leitura estiver habilitada na conta).
   */
  async markMessagesRead(
    companyId: string,
    remoteJid: string,
    messageIds: string[],
  ): Promise<void> {
    const session = this.sessions.get(companyId);
    const jid = this.normalizeRecipientJid(remoteJid);
    const ids = [...new Set(messageIds.filter(Boolean))];
    if (
      !session ||
      session.status !== 'open' ||
      !session.sock ||
      !jid ||
      ids.length === 0
    ) {
      return;
    }
    try {
      await session.sock.readMessages(
        ids.map((id) => ({ remoteJid: jid, id, fromMe: false })),
      );
    } catch (err) {
      // A leitura local continua válida mesmo se o socket cair nesse instante.
      this.logger.warn(
        `Falha ao enviar recibo de leitura (company=${companyId}): ${(err as Error).message}`,
      );
    }
  }

  private isBrazilianE164Digits(digits: string): boolean {
    return digits.startsWith('55') && (digits.length === 12 || digits.length === 13);
  }

  private randomBetween(min: number, max: number): number {
    if (max <= min) return min;
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  private isBulkKind(kind: string | null | undefined): boolean {
    return BULK_KINDS.includes(kind as (typeof BULK_KINDS)[number]);
  }

  private isClientAutomationKind(kind: string | null | undefined): boolean {
    return CLIENT_AUTOMATION_KINDS.includes(
      kind as (typeof CLIENT_AUTOMATION_KINDS)[number],
    );
  }

  /** Intervalo aleatório, maior para campanha/follow-up do que para transacional. */
  private nextPacingDelay(kind: string | null | undefined): number {
    return this.isBulkKind(kind)
      ? this.randomBetween(BULK_DELAY_MIN_MS, BULK_DELAY_MAX_MS)
      : this.randomBetween(TRANSACTIONAL_DELAY_MIN_MS, TRANSACTIONAL_DELAY_MAX_MS);
  }

  /** Empresas com socket aberto agora — usado para filtrar o outbox no drain. */
  /** A company tem socket aberto AGORA? (usado pela trava de enfileiramento) */
  private isSessionOpen(companyId: string): boolean {
    const session = this.sessions.get(companyId);
    return Boolean(session && session.status === 'open' && session.sock);
  }

  private openCompanyIds(readyAt = Number.POSITIVE_INFINITY): string[] {
    const ids: string[] = [];
    for (const session of this.sessions.values()) {
      if (
        session.status === 'open' &&
        session.sock &&
        session.nextSendAt <= readyAt
      ) {
        ids.push(session.companyId);
      }
    }
    return ids;
  }

  /**
   * Drena o outbox uma mensagem por vez, mais antigas primeiro, com pacing para
   * não bater no anti-spam do WhatsApp. Só considera mensagens de empresas cujo
   * socket está ABERTO agora (as demais ficam pendentes até a company reconectar
   * — nunca travam a fila). Re-entrância protegida (`draining`).
   */
  private async drainOutbox(): Promise<void> {
    if (this.draining || !this.enabled) return;
    const open = this.openCompanyIds();
    if (open.length === 0) return; // nenhuma empresa conectada — nada a enviar
    this.draining = true;
    try {
      for (;;) {
        // Recalcula a cada volta (uma company pode cair no meio do drain).
        const openNow = this.openCompanyIds(Date.now());
        if (openNow.length === 0) break;
        const where = {
          status: 'pending',
          nextAttemptAt: { lte: new Date() },
          companyId: { in: openNow },
        } as const;
        // Transacionais (marcado/cancelado/lembrete/gestor) passam na frente de
        // campanhas antigas para uma rajada de marketing não atrasar a operação.
        const msg =
          (await this.prisma.client.whatsappOutbox.findFirst({
            where: { ...where, kind: { notIn: [...BULK_KINDS] } },
            orderBy: { createdAt: 'asc' },
          })) ??
          (await this.prisma.client.whatsappOutbox.findFirst({
            where,
            orderBy: { createdAt: 'asc' },
          }));
        if (!msg) break;
        await this.deliverOutbox(msg);
      }
    } catch (err) {
      this.logger.error(`Erro ao drenar outbox: ${(err as Error).message}`);
    } finally {
      this.draining = false;
    }
  }

  /**
   * Entrega UMA linha do outbox pelo socket da company dona da mensagem. Sucesso
   * marca 'sent'; falha incrementa a tentativa com backoff exponencial e desiste
   * ('failed') após OUTBOX_MAX_ATTEMPTS, para um número permanentemente ruim não
   * travar a fila. Uma company que perdeu o socket no meio → deixa pendente.
   */
  private async deliverOutbox(msg: {
    id: string;
    toPhone: string;
    toJid: string | null;
    text: string;
    mediaUrl: string | null;
    mediaType: string | null;
    mediaMimeType: string | null;
    mediaFileName: string | null;
    mediaPtt: boolean;
    attempts: number;
    companyId: string | null;
    customerId: string | null;
    appointmentId: string | null;
    kind: string | null;
    inboxMessageId: string | null;
    createdAt: Date;
    authorizedAt: Date | null;
  }): Promise<void> {
    const db = this.prisma.client;
    const session = msg.companyId ? this.sessions.get(msg.companyId) : undefined;
    // Sem company ou sem socket aberto → não há por onde enviar; deixa pendente.
    if (!session || session.status !== 'open' || !session.sock) return;
    try {
      // TRAVA 2 (estudo 60): o que envelheceu na fila não sai. Lembrete de 1h
      // atrás ainda faz sentido; de ontem, não — e foi exatamente isso que
      // chegou ao cliente quando a fila drenou.
      const validade = expirouNaFila(msg.kind, msg.createdAt);
      if (!validade.ok) {
        await this.descartarOutbox(msg, validade.motivo ?? 'Expirada na fila');
        return;
      }

      // Teto de quem ficou ESPERANDO a conexão voltar (estudo 85). `attempts=0`
      // é "nunca houve tentativa de envio": linha criada com o canal aberto sai
      // em segundos e nunca chega perto do teto. Isto substitui a recusa cega na
      // porta de entrada — reinício de 10 min fica transparente, queda longa não
      // vira rajada.
      const espera = expirouEsperandoConexao(msg.kind, msg.createdAt, msg.attempts);
      if (!espera.ok) {
        await this.descartarOutbox(msg, espera.motivo ?? 'Esperou a conexão por tempo demais');
        return;
      }

      // TRAVA 3 (estudo 60): a autorização é revalidada AGORA. A decisão não
      // pode ficar congelada do momento em que a linha nasceu — o dono pode ter
      // desligado o aviso, o agendamento pode ter sido cancelado ou já ter
      // passado. Envio que uma pessoa autorizou (authorizedAt) não passa por
      // aqui: ela clicou sabendo o que estava mandando.
      if (isAutomationKind(msg.kind) && !msg.authorizedAt && msg.companyId) {
        const ainda = autorizacaoAindaVale({
          kind: msg.kind,
          agendamento: msg.appointmentId
            ? await this.agendamentoDaLinha(msg.companyId, msg.appointmentId)
            : undefined,
          automacao: await this.automacaoDaConta(msg.companyId),
          cliente: msg.customerId
            ? await this.prisma.client.customer.findFirst({
                where: { id: msg.customerId, companyId: msg.companyId },
                select: { notificationsEnabled: true, whatsappOptIn: true },
              })
            : undefined,
        });
        if (!ainda.ok) {
          await this.descartarOutbox(msg, ainda.motivo ?? 'Sem autorização');
          return;
        }
      }

      if (await this.deferIfRateLimited(msg)) return;
      // Ordem: JID da própria linha > JID já conhecido da conversa > telefone.
      //
      // O do meio é o que faltava. A automação de agendamento nasce sem toJid,
      // caía direto no telefone e mandava para `<telefone>@s.whatsapp.net` — um
      // endereço Signal DIFERENTE do da conversa quando o WhatsApp endereça o
      // contato por LID. Os outros aparelhos da própria conta acompanham o chat
      // pelo LID, não abriam a cópia, e a mensagem aparecia como "Aguardando
      // mensagem" até o retry. Ver estudo 83.
      const jid =
        this.normalizeRecipientJid(msg.toJid ?? undefined) ??
        (await this.jidConhecidoDoTelefone(msg.companyId, msg.toPhone)) ??
        (await this.resolveJid(session, msg.toPhone));
      if (!jid) {
        await db.whatsappOutbox.update({
          where: { id: msg.id },
          data: {
            status: 'failed',
            attempts: msg.attempts + 1,
            lastError: 'Número sem WhatsApp / JID irresolúvel',
          },
        });
        if (msg.inboxMessageId) {
          await db.whatsappInboxMessage.updateMany({
            where: { id: msg.inboxMessageId },
            data: { status: 'failed' },
          });
        }
        this.logger.warn(`Outbox ${msg.id}: número ${msg.toPhone} sem WhatsApp — descartado.`);
        return;
      }
      const mediaSource = msg.mediaUrl
        ? await this.outboundMediaSource(msg.mediaUrl, session.companyId)
        : null;
      const sent =
        msg.mediaType === 'image' && mediaSource
          ? await session.sock.sendMessage(jid, {
              image: mediaSource,
              ...(msg.text && !msg.text.startsWith('📷 Imagem')
                ? { caption: msg.text }
                : {}),
              ...(msg.mediaMimeType ? { mimetype: msg.mediaMimeType } : {}),
            })
          : msg.mediaType === 'audio' && mediaSource
            ? await session.sock.sendMessage(jid, {
                audio: mediaSource,
                mimetype: msg.mediaMimeType || 'audio/ogg',
                ptt: msg.mediaPtt,
              })
            : await session.sock.sendMessage(jid, { text: msg.text });
      // Guarda o conteúdo enviado para o getMessage responder aos retry-receipts
      // (ver makeWASocket) — é isso que tira a mensagem do "Aguardando esta
      // mensagem…" no celular do dono. Mantém o cache limitado (FIFO).
      if (sent?.key?.id && sent.message) {
        this.guardarNoCache(session, sent.key.id, sent.message);
      }
      await db.whatsappOutbox.update({
        where: { id: msg.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          attempts: msg.attempts + 1,
          lastError: null,
          // Cópia PERSISTENTE para responder ao pedido de reenvio depois de um
          // deploy — o cache de memória morre junto com o processo, e sem isto
          // a mensagem fica em "Aguardando mensagem" no aparelho de destino.
          // Ver estudo 69.
          whatsappMessageId: sent?.key?.id ?? null,
          sentMessageJson: sent?.message
            ? (JSON.parse(JSON.stringify(sent.message)) as Prisma.InputJsonValue)
            : Prisma.DbNull,
        },
      });
      if (msg.inboxMessageId) {
        await db.whatsappInboxMessage.updateMany({
          where: { id: msg.inboxMessageId },
          data: {
            status: 'sent',
            sentAt: new Date(),
            whatsappMessageId: sent?.key?.id ?? undefined,
          },
        });
      }
      session.nextSendAt = Date.now() + this.nextPacingDelay(msg.kind);
      this.logger.log(`Outbox ${msg.id}: enviado para ${jid} (company=${msg.companyId}).`);
    } catch (err) {
      const attempts = msg.attempts + 1;
      const failed = attempts >= OUTBOX_MAX_ATTEMPTS;
      const backoffMs = Math.min(60000, 2 ** attempts * 1000);
      await db.whatsappOutbox.update({
        where: { id: msg.id },
        data: {
          status: failed ? 'failed' : 'pending',
          attempts,
          lastError: (err as Error).message.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + backoffMs),
        },
      });
      if (msg.inboxMessageId) {
        await db.whatsappInboxMessage.updateMany({
          where: { id: msg.inboxMessageId },
          data: {
            status: failed ? 'failed' : 'pending',
          },
        });
      }
      this.logger.error(
        `Outbox ${msg.id}: falha (tentativa ${attempts}/${OUTBOX_MAX_ATTEMPTS}) — ${(err as Error).message}`,
      );
    }
  }

  /**
   * Descarta uma linha sem enviar: status `expired` (não `sent`, não `failed` —
   * não foi erro de entrega, foi decisão de política) com o motivo em texto para
   * o dono entender no histórico. Ver estudo 60.
   */
  private async descartarOutbox(
    msg: { id: string; kind: string | null; toPhone: string; companyId: string | null; inboxMessageId: string | null; attempts: number },
    motivo: string,
  ): Promise<void> {
    await this.prisma.client.whatsappOutbox.update({
      where: { id: msg.id },
      data: {
        status: 'expired',
        attempts: msg.attempts + 1,
        lastError: motivo.slice(0, 500),
      },
    });
    if (msg.inboxMessageId) {
      await this.prisma.client.whatsappInboxMessage.updateMany({
        where: { id: msg.inboxMessageId },
        data: { status: 'failed' },
      });
    }
    this.logger.warn(
      `Outbox ${msg.id}: descartada sem enviar (${msg.kind} → ${msg.toPhone}, company=${msg.companyId ?? 'sem-company'}) — ${motivo}.`,
    );
  }

  /** Agendamento da linha, ou null quando não existe mais. */
  private async agendamentoDaLinha(companyId: string, appointmentId: string) {
    return this.prisma.client.appointment.findFirst({
      where: { id: appointmentId, companyId },
      select: {
        status: true,
        start: true,
        remindClient: true,
        notifyConfirmation: true,
        notifyCancellation: true,
      },
    });
  }

  /**
   * Padrão de automação da empresa, lido direto do Setting.
   *
   * Não injeto o NotificationSettingsService aqui de propósito: o módulo de
   * notificações já depende do WhatsappService, e injetar de volta fecharia um
   * ciclo. O default é o mesmo do serviço: TUDO DESLIGADO quando não há linha.
   */
  private async automacaoDaConta(companyId: string): Promise<AutomacaoDaConta> {
    const desligado: AutomacaoDaConta = {
      confirmation: false,
      cancellation: false,
      reminder: false,
      followUp: false,
    };
    try {
      const row = await this.prisma.client.setting.findUnique({
        where: {
          companyId_key: { companyId, key: 'notifications.automation' },
        },
        select: { valueJson: true },
      });
      const value = (row?.valueJson ?? null) as Record<string, unknown> | null;
      if (!value) return desligado;
      const ler = (chave: string) => value[chave] === true;
      return {
        confirmation: ler('confirmation'),
        cancellation: ler('cancellation'),
        reminder: ler('reminder'),
        followUp: ler('followUp'),
      };
    } catch (err) {
      this.logger.warn(
        `Outbox: não deu para ler o padrão de automação de ${companyId} (${(err as Error).message}) — tratando como desligado.`,
      );
      return desligado;
    }
  }

  /**
   * Proteções duráveis (sobrevivem a restart):
   *   1. não manda duas automações ao mesmo número dentro do cooldown;
   *   2. campanha/follow-up respeita um teto deslizante por empresa/hora.
   *
   * Ao atingir um limite, apenas move nextAttemptAt; nada é perdido e mensagens
   * transacionais de outros destinatários continuam passando.
   */
  private async deferIfRateLimited(msg: {
    id: string;
    toPhone: string;
    companyId: string | null;
    kind: string | null;
  }): Promise<boolean> {
    if (!msg.companyId) return false;
    const db = this.prisma.client;
    const now = Date.now();

    // O cooldown por destinatário vale só para DISPARO EM MASSA.
    //
    // Antes pegava todo `isClientAutomationKind`, então confirmação, cancelamento
    // e lembrete também esperavam 5 min. Foi isso que segurou o cancelamento do
    // dono: criou 18:35:53, cancelou 18:36:04, e a mensagem só saiu 18:41:44.
    // Mas esses três não são repetição — são eventos distintos, cada um vindo de
    // uma ação real, e chegar atrasado destrói o propósito deles. O risco de
    // parecer spam mora em campanha/follow-up, e lá o cooldown continua.
    // Ver estudo 85.
    if (RECIPIENT_COOLDOWN_MS > 0 && this.isBulkKind(msg.kind)) {
      const previous = await db.whatsappOutbox.findFirst({
        where: {
          id: { not: msg.id },
          companyId: msg.companyId,
          toPhone: msg.toPhone,
          status: 'sent',
          sentAt: { gte: new Date(now - RECIPIENT_COOLDOWN_MS) },
        },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
      });
      if (previous?.sentAt) {
        const nextAttemptAt = new Date(
          previous.sentAt.getTime() +
            RECIPIENT_COOLDOWN_MS +
            this.randomBetween(500, 2500),
        );
        await db.whatsappOutbox.update({
          where: { id: msg.id },
          data: {
            nextAttemptAt,
            lastError: 'Adiado pelo cooldown do destinatário',
          },
        });
        return true;
      }
    }

    if (this.isBulkKind(msg.kind)) {
      const windowStart = new Date(now - 60 * 60 * 1000);
      const sentInWindow = await db.whatsappOutbox.count({
        where: {
          companyId: msg.companyId,
          status: 'sent',
          kind: { in: [...BULK_KINDS] },
          sentAt: { gte: windowStart },
        },
      });
      if (sentInWindow >= BULK_HOURLY_LIMIT) {
        const oldest = await db.whatsappOutbox.findFirst({
          where: {
            companyId: msg.companyId,
            status: 'sent',
            kind: { in: [...BULK_KINDS] },
            sentAt: { gte: windowStart },
          },
          orderBy: { sentAt: 'asc' },
          select: { sentAt: true },
        });
        const nextAttemptAt = new Date(
          (oldest?.sentAt?.getTime() ?? now) +
            60 * 60 * 1000 +
            this.randomBetween(1000, 5000),
        );
        await db.whatsappOutbox.update({
          where: { id: msg.id },
          data: {
            nextAttemptAt,
            lastError: `Adiado pelo limite de ${BULK_HOURLY_LIMIT} envios em massa/hora`,
          },
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Resolves a phone to the JID WhatsApp actually serves, using a SPECIFIC
   * company's socket. Brazilian numbers are ambiguous about the 9th mobile digit,
   * so only they are looked up via onWhatsApp. Other explicit E.164 numbers map
   * directly to their country-code JID. Falls back to the naive
   * "<digits>@s.whatsapp.net" if the Brazilian lookup throws (network blip), so a
   * transient error still gets a delivery attempt.
   */
  /**
   * O endereço que o WhatsApp realmente usa para este telefone, se já
   * conversamos com ele. Ver estudo 83.
   *
   * Prefere `@lid`: quando o contato tem as duas formas gravadas (acontece — o
   * mesmo Paulo tinha `19182384714@s.whatsapp.net` e `49040423161879@lid`), o
   * LID é o endereço vivo do chat. Cifrar para a forma por telefone gera uma
   * mensagem que os outros aparelhos da própria conta não abrem.
   */
  private async jidConhecidoDoTelefone(
    companyId: string | null,
    phone: string,
  ): Promise<string | null> {
    if (!companyId) return null;
    const digitos = (phone ?? '').replace(/\D/g, '');
    if (digitos.length < 8) return null;
    try {
      const conversas = await this.prisma.client.whatsappConversation.findMany({
        // Filtro barato pelos últimos 8 dígitos; quem decide de fato é
        // `escolherJidConhecido`, que também recusa caso ambíguo.
        where: { companyId, phone: { contains: digitos.slice(-8) } },
        select: { remoteJid: true, phone: true, lastMessageAt: true },
        orderBy: { lastMessageAt: 'desc' },
        take: 20,
      });
      return escolherJidConhecido(phone, conversas);
    } catch (err) {
      // Descobrir o endereço é melhoria, não pré-requisito: sem isso o envio
      // segue pelo telefone, como antes.
      this.logger.warn(`Não deu para achar o JID conhecido: ${(err as Error).message}`);
      return null;
    }
  }

  private async resolveJid(session: SessionState, phone: string): Promise<string | null> {
    const normalized = this.normalizeOutgoingPhone(phone);
    if (!normalized) return null;

    let digits = normalized.digits;
    // A number without + is a local Brazilian number. Keep recognizing old
    // outbox rows that were stored as 55-prefixed digits before E.164 values
    // started preserving the leading +.
    if (!normalized.hasExplicitCountryCode && !this.isBrazilianE164Digits(digits)) {
      digits = `55${digits}`;
    }
    const isBrazilian = this.isBrazilianE164Digits(digits);
    if (!session.sock) return null;
    if (isBrazilian) {
      try {
        const results = await session.sock.onWhatsApp(digits);
        const hit = results?.find((r) => r.exists && r.jid);
        if (hit?.jid) return hit.jid;
        // onWhatsApp answered but the number has no account → don't keep retrying.
        if (results && results.length > 0) return null;
      } catch {
        // Lookup failed (transient) — fall through to the naive JID below.
      }
    }
    return `${digits}@s.whatsapp.net`;
  }

  /**
   * Conteúdo durável para retry-receipts. O cache em memória resolve a janela
   * imediata; o banco resolve pedidos que chegam depois de restart/deploy.
   */
  /** Guarda no cache de memória da sessão, com teto FIFO. */
  private guardarNoCache(
    session: SessionState,
    messageId: string,
    message: proto.IMessage,
  ): void {
    if (session.sentCache.size >= SENT_CACHE_MAX) {
      const maisAntigo = session.sentCache.keys().next().value;
      if (maisAntigo !== undefined) session.sentCache.delete(maisAntigo);
    }
    session.sentCache.set(messageId, message);
  }

  private async getMessageForRetry(
    session: SessionState,
    messageId?: string | null,
  ): Promise<proto.IMessage | undefined> {
    if (!messageId) return undefined;
    const cached = session.sentCache.get(messageId);
    if (cached) return cached;
    // 1º) a fila: cobre TUDO que sai por aqui (confirmação, lembrete, convite,
    // campanha, resposta do atendente) e sobrevive a deploy. Guarda o proto
    // inteiro, então mídia também é reenviável. Ver estudo 69.
    const daFila = await this.prisma.client.whatsappOutbox.findFirst({
      where: { companyId: session.companyId, whatsappMessageId: messageId },
      select: { sentMessageJson: true, text: true },
    });
    if (daFila?.sentMessageJson) {
      const message = proto.Message.fromObject(
        daFila.sentMessageJson as Record<string, unknown>,
      );
      this.guardarNoCache(session, messageId, message);
      return message;
    }

    const persisted = daFila
      ? { text: daFila.text }
      : await this.prisma.client.whatsappInboxMessage.findFirst({
          where: {
            companyId: session.companyId,
            whatsappMessageId: messageId,
            direction: 'outbound',
          },
          select: { text: true },
        });
    if (!persisted?.text) return undefined;
    const message = proto.Message.fromObject({
      conversation: persisted.text,
    });
    this.guardarNoCache(session, messageId, message);
    return message;
  }

  // ------------------------------------------------------------- conexão

  /**
   * Adquire/renova atomically o lease de uma empresa. A linha usa a própria
   * WhatsappAuthState para não exigir outra migration. O UPSERT só substitui um
   * dono diferente quando o TTL expirou; duas instâncias que concorram recebem
   * resultados distintos e apenas uma abre o Baileys.
   */
  private async acquireConnectionLease(companyId: string): Promise<boolean> {
    const expiresAt = new Date(Date.now() + CONNECTION_LEASE_TTL_MS).toISOString();
    const data = JSON.stringify({
      ownerId: this.instanceId,
      expiresAt,
      generation: this.instanceStartedAt,
    });
    try {
      const rows = await this.prisma.client.$queryRaw<Array<{ data: unknown }>>(
        Prisma.sql`
          INSERT INTO "WhatsappAuthState"
            ("sessionId", "category", "itemId", "data", "updatedAt")
          VALUES (
            ${companyId},
            ${RUNTIME_CATEGORY},
            ${CONNECTION_LEASE_ITEM_ID},
            CAST(${data} AS JSONB),
            NOW()
          )
          ON CONFLICT ("sessionId", "category", "itemId") DO UPDATE
          SET "data" = EXCLUDED."data", "updatedAt" = NOW()
          WHERE
            "WhatsappAuthState"."data"->>'ownerId' = ${this.instanceId}
            OR COALESCE(
              NULLIF("WhatsappAuthState"."data"->>'generation', '')::bigint,
              0
            ) < ${this.instanceStartedAt}
            OR COALESCE(
              NULLIF("WhatsappAuthState"."data"->>'expiresAt', '')::timestamptz,
              to_timestamp(0)
            ) < NOW()
          RETURNING "data"
        `,
      );
      return rows.length === 1;
    } catch (err) {
      this.logger.error(
        `Falha ao adquirir lease do WhatsApp (company=${companyId}): ${(err as Error).message}`,
      );
      return false;
    }
  }

  /** Libera somente o lease pertencente a este processo. */
  private async releaseConnectionLease(companyId: string): Promise<void> {
    try {
      await this.prisma.client.$executeRaw(
        Prisma.sql`
          DELETE FROM "WhatsappAuthState"
          WHERE "sessionId" = ${companyId}
            AND "category" = ${RUNTIME_CATEGORY}
            AND "itemId" = ${CONNECTION_LEASE_ITEM_ID}
            AND "data"->>'ownerId' = ${this.instanceId}
        `,
      );
    } catch {
      // Best effort: se o processo morrer abruptamente, o TTL libera sozinho.
    }
    const session = this.sessions.get(companyId);
    if (session) session.hasLease = false;
  }

  private scheduleLeaseRetry(session: SessionState): void {
    if (session.connectTimeout) clearTimeout(session.connectTimeout);
    session.connectTimeout = setTimeout(() => {
      session.connectTimeout = null;
      void this.connect(session.companyId);
    }, CONNECTION_LEASE_HEARTBEAT_MS);
  }

  private startLeaseHeartbeat(session: SessionState): void {
    if (session.leaseHeartbeat) clearInterval(session.leaseHeartbeat);
    session.leaseHeartbeat = setInterval(() => {
      void this.acquireConnectionLease(session.companyId).then((renewed) => {
        if (renewed) return;
        // Outro processo assumiu (ou o banco deixou de renovar): fecha antes de
        // tentar novamente para nunca manter dois sockets para a mesma empresa.
        session.hasLease = false;
        if (session.leaseHeartbeat) {
          clearInterval(session.leaseHeartbeat);
          session.leaseHeartbeat = null;
        }
        this.teardownSocket(session);
        session.status = 'closed';
        session.connecting = false;
        this.scheduleLeaseRetry(session);
      });
    }, CONNECTION_LEASE_HEARTBEAT_MS);
  }

  /**
   * Conecta (ou reconecta) o socket de UMA empresa. Idempotente por company: se
   * já estiver conectando/aberta, não faz nada. Cada company tem seu próprio
   * ciclo de vida (timeout, backoff, teardown).
   */
  private async connect(companyId: string): Promise<void> {
    if (!this.enabled) return;
    const session = this.getSession(companyId);
    if (session.connecting || session.status === 'open') return;
    session.connecting = true;
    session.status = 'connecting';
    const hasLease = await this.acquireConnectionLease(companyId);
    if (!hasLease) {
      session.hasLease = false;
      session.connecting = false;
      session.status = 'closed';
      this.scheduleLeaseRetry(session);
      return;
    }
    session.hasLease = true;
    this.startLeaseHeartbeat(session);
    // Descarta qualquer socket anterior antes de abrir um novo (ver teardownSocket).
    this.teardownSocket(session);
    // Baileys pode travar no handshake do WebSocket sem emitir 'open'/'close',
    // deixando connecting=true para sempre. Um timeout de 45s pega isso e força
    // um retry.
    if (session.connectTimeout) clearTimeout(session.connectTimeout);
    session.connectTimeout = setTimeout(() => {
      if (session.connecting && session.status !== 'open') {
        this.logger.warn(
          `WhatsApp (company=${companyId}): timeout de conexão (45s) — forçando reconexão.`,
        );
        session.connecting = false;
        session.status = 'closed';
        this.teardownSocket(session);
        void this.connect(companyId);
      }
    }, 45_000);
    try {
      // Credenciais keyed pela empresa: sessionId = companyId.
      const { state, saveCreds } = await useDbAuthState(
        this.prisma,
        companyId,
        this.instanceId,
      );
      const version = await this.getCurrentWaVersion();
      const sock = makeWASocket({
        auth: state,
        ...(version ? { version } : {}),
        logger: silentLogger(),
        // Identidade estável e coerente com o container Linux. Usar
        // Browsers.appropriate aqui incorporava a versão do kernel/WSL no
        // handshake, o que já causou rejeições de pareamento no Baileys.
        browser: Browsers.ubuntu('Salonpass'),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        // Multi-device: responde aos "retry receipts". Quando um aparelho (em
        // especial o CELULAR DO PRÓPRIO DONO) recebe a cópia de uma mensagem que
        // enviamos mas não consegue decifrar, ele pede reenvio; o Baileys chama
        // este getMessage(key) pra recuperar o conteúdo original e re-enviar
        // criptografado. Sem isso, a mensagem fica eternamente em "Aguardando
        // esta mensagem…" no WhatsApp do dono (o sintoma relatado). O conteúdo
        // vem do sentCache alimentado no deliverOutbox.
        maxMsgRetryCount: 5,
        retryRequestDelayMs: 1000,
        // Fora do socket de propósito: sobrevive à reconexão, como a doc pede.
        msgRetryCounterCache: RETRY_COUNTER_CACHE,
        getMessage: async (key) =>
          this.getMessageForRetry(session, key.id),
      });
      session.sock = sock;

      sock.ev.on('creds.update', () => {
        void saveCreds();
      });

      // Inbound manager replies ("1" / "2 motivo" / "3 sugestão"). Só interessa
      // texto puro de chats individuais; grupos e não-texto são ignorados. Como
      // o socket é DESTA empresa, já sabemos o companyId de origem.
      sock.ev.on('messages.upsert', (evt) => {
        for (const m of evt.messages) {
          const jid = m.key.remoteJid ?? '';
          const participant = whatsappParticipantIdentity(
            jid,
            Boolean(m.key.fromMe),
            m.key.senderPn,
            m.key.participantPn,
          );
          if (!participant.individual) continue; // skip groups/status/newsletters
          // Remove wrappers ephemeral/view-once antes de identificar o conteúdo.
          // O inbox mantém uma representação textual de mídia, mesmo sem baixar
          // o arquivo, para a conversa nunca "sumir" quando chega áudio/foto.
          const content = normalizeMessageContent(m.message);
          let kind = 'text';
          let metadata:
            | Record<string, string | number | boolean | null>
            | undefined;
          let text =
            content?.conversation ??
            content?.extendedTextMessage?.text ??
            content?.imageMessage?.caption ??
            content?.videoMessage?.caption;
          if (content?.imageMessage) {
            kind = 'image';
            text =
              text?.trim() ||
              (m.key.fromMe ? '📷 Imagem' : '📷 Imagem recebida');
            metadata = {
              mimetype: content.imageMessage.mimetype ?? null,
              media: true,
            };
          } else if (content?.videoMessage) {
            kind = 'video';
            text = text?.trim() || '🎥 Vídeo recebido';
            metadata = {
              mimetype: content.videoMessage.mimetype ?? null,
              media: true,
            };
          } else if (content?.audioMessage) {
            kind = 'audio';
            text = m.key.fromMe ? '🎤 Áudio' : '🎤 Áudio recebido';
            metadata = {
              mimetype: content.audioMessage.mimetype ?? null,
              seconds: content.audioMessage.seconds ?? 0,
              ptt: content.audioMessage.ptt ?? false,
              media: true,
            };
          } else if (content?.documentMessage) {
            kind = 'document';
            text = `📎 ${content.documentMessage.fileName || 'Documento recebido'}`;
            metadata = {
              mimetype: content.documentMessage.mimetype ?? null,
              fileName: content.documentMessage.fileName ?? null,
              media: true,
            };
          } else if (content?.stickerMessage) {
            kind = 'sticker';
            text = '🏷️ Figurinha recebida';
            metadata = { media: true };
          } else if (content?.locationMessage) {
            kind = 'location';
            text = '📍 Localização recebida';
            metadata = {
              latitude: content.locationMessage.degreesLatitude ?? 0,
              longitude: content.locationMessage.degreesLongitude ?? 0,
            };
          } else if (
            content?.contactMessage ||
            content?.contactsArrayMessage
          ) {
            kind = 'contact';
            text = '👤 Contato recebido';
          }
          if (!text || !text.trim()) continue;
          const trimmed = text.trim();
          // Normalmente nossos próprios envios (fromMe) são ignorados — mas um
          // salão que usa UM número para bot + gerente responde ao prompt no chat
          // "conversar consigo mesmo", onde as respostas chegam como fromMe.
          // Permite só lá, e só quando parece um comando 1/2/3.
          if (m.key.fromMe) {
            const selfChat =
              !!session.selfDigitsTail &&
              this.digitsTail(this.jidUserDigits(jid)) === session.selfDigitsTail;
            // Mensagens enviadas pelo celular para clientes também alimentam o
            // inbox. O self-chat só interessa ao roteador 1/2/3; os demais
            // handlers decidem se querem ignorá-lo.
            if (selfChat && !/^[123]\b/.test(trimmed)) continue;
          }
          // Em chats LID, o identificador antes de @lid não é telefone. Para
          // mensagens recebidas, o Baileys 6.7 expõe o PN alternativo no key.
          // Quando ele não vier, preservamos o JID e ainda conseguimos responder
          // por ele graças a WhatsappOutbox.toJid.
          const fromDigits = participant.phoneDigits;
          if (participant.isLid) {
            metadata = {
              ...(metadata ?? {}),
              lid: true,
              phoneKnown: Boolean(fromDigits),
            };
          }
          const quoted =
            content?.extendedTextMessage?.contextInfo?.quotedMessage;
          const quotedText = quoted?.conversation ?? quoted?.extendedTextMessage?.text ?? undefined;
          const timestampSeconds =
            typeof m.messageTimestamp === 'number'
              ? m.messageTimestamp
              : Number(m.messageTimestamp ?? 0);
          const inbound: WhatsappInbound = {
            fromDigits,
            text: trimmed,
            quotedText,
            messageId: m.key.id ?? undefined,
            remoteJid: jid,
            pushName: m.pushName ?? undefined,
            kind,
            metadata,
            fromMe: Boolean(m.key.fromMe),
            timestamp: timestampSeconds
              ? new Date(timestampSeconds * 1000)
              : new Date(),
            companyId,
          };
          void this.dispatchInbound(inbound, m, sock, session);
        }
      });

      // ACKs de chats individuais: SERVER_ACK (enviado), DELIVERY_ACK
      // (entregue) e READ/PLAYED (lido). Persistidos pelo inbox para renderizar
      // os mesmos ✓ / ✓✓ / ✓✓ azuis do WhatsApp.
      sock.ev.on('messages.update', (updates) => {
        for (const { key, update } of updates) {
          if (!key.id || key.fromMe === false || update.status == null) continue;
          const waStatus = Number(update.status);
          const status: WhatsappDeliveryUpdate['status'] | null =
            waStatus >= proto.WebMessageInfo.Status.READ
              ? 'read'
              : waStatus >= proto.WebMessageInfo.Status.DELIVERY_ACK
                ? 'delivered'
                : waStatus >= proto.WebMessageInfo.Status.SERVER_ACK
                  ? 'sent'
                  : null;
          if (!status) continue;
          void this.emitDeliveryUpdate({
            companyId,
            whatsappMessageId: key.id,
            status,
            at: new Date(),
          });
        }
      });

      // Grupos não entram no inbox, mas algumas versões/dispositivos também
      // publicam recibos individuais por este evento. Ouvi-lo torna a
      // integração resiliente sem criar duplicidade (updates são idempotentes).
      sock.ev.on('message-receipt.update', (updates) => {
        for (const { key, receipt } of updates) {
          if (!key.id || key.fromMe === false) continue;
          const readTimestamp = receipt.readTimestamp ?? receipt.playedTimestamp;
          const deliveredTimestamp = receipt.receiptTimestamp;
          const status: WhatsappDeliveryUpdate['status'] | null = readTimestamp
            ? 'read'
            : deliveredTimestamp
              ? 'delivered'
              : null;
          if (!status) continue;
          const rawTimestamp = Number(readTimestamp ?? deliveredTimestamp ?? 0);
          void this.emitDeliveryUpdate({
            companyId,
            whatsappMessageId: key.id,
            status,
            at: rawTimestamp ? new Date(rawTimestamp * 1000) : new Date(),
          });
        }
      });

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          session.currentQr = qr;
          session.status = 'qr';
          this.logger.log(`QR do WhatsApp disponível (company=${companyId}).`);
        }
        if (connection === 'open') {
          if (session.connectTimeout) {
            clearTimeout(session.connectTimeout);
            session.connectTimeout = null;
          }
          session.currentQr = null;
          session.status = 'open';
          session.connecting = false;
          session.reconnectAttempts = 0; // conexão saudável — zera backoff
          // Evita despejar imediatamente todo o backlog após um reconnect.
          session.nextSendAt =
            Date.now() +
            this.randomBetween(
              TRANSACTIONAL_DELAY_MIN_MS,
              TRANSACTIONAL_DELAY_MAX_MS,
            );
          // Lembra o próprio número para reconhecer o self-chat (salões de um
          // número só respondem ao prompt como fromMe nele).
          session.selfDigitsTail = this.digitsTail(this.jidUserDigits(sock.user?.id ?? ''));
          this.logger.log(`WhatsApp conectado (company=${companyId}).`);
          // Esvazia o que ficou na fila enquanto estávamos offline.
          void this.drainOutbox();
        }
        if (connection === 'close') {
          if (session.connectTimeout) {
            clearTimeout(session.connectTimeout);
            session.connectTimeout = null;
          }
          session.status = 'closed';
          session.connecting = false;
          const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
            ?.statusCode;
          const loggedOut = code === DisconnectReason.loggedOut;
          // Descarta o socket morto para ele não "substituir" o próximo.
          this.teardownSocket(session);
          if (loggedOut) {
            this.logger.warn(
              `WhatsApp desconectado (company=${companyId}): sessão encerrada — novo QR necessário.`,
            );
            void this.handleLoggedOut(companyId);
          } else {
            // Code 440 = "replaced by another device" — acontece em deploy rolling
            // do App Runner quando duas instâncias dividem a sessão. Backoff longo
            // (30s) para a instância antiga morrer. Outros códigos: backoff
            // exponencial (3s → 6s → 12s … teto 30s).
            const replaced = code === 440;
            const delay = replaced
              ? 30_000
              : Math.min(30000, 3000 * 2 ** session.reconnectAttempts);
            session.reconnectAttempts += 1;
            this.logger.warn(
              `WhatsApp desconectado (company=${companyId}, code=${code ?? '?'}). Reconectando em ${delay / 1000}s…`,
            );
            setTimeout(() => void this.connect(companyId), delay);
          }
        }
      });
    } catch (err) {
      if (session.connectTimeout) {
        clearTimeout(session.connectTimeout);
        session.connectTimeout = null;
      }
      session.connecting = false;
      session.status = 'closed';
      this.logger.error(
        `Erro ao conectar no WhatsApp (company=${companyId}): ${(err as Error).message}`,
      );
      setTimeout(() => void this.connect(companyId), 5000);
    }
  }

  private async handleLoggedOut(companyId: string): Promise<void> {
    const session = this.getSession(companyId);
    try {
      const { clear } = await useDbAuthState(this.prisma, companyId);
      await clear();
    } catch {
      // ignore
    }
    this.teardownSocket(session);
    session.currentQr = null;
    session.selfDigitsTail = null;
    // Reconecta para expor um QR fresco para re-link.
    setTimeout(() => void this.connect(companyId), 2000);
  }

  /**
   * Descarta por completo o socket de uma sessão: remove todos os listeners e
   * fecha o websocket. Pular isso causava um loop de reconexão code=440 — um
   * deploy rolling rodava brevemente duas conexões, e cada `close` deixava um
   * socket zumbi ainda segurando a sessão, então todo connect novo era
   * instantaneamente "substituído" (440). Derrubar o socket antigo primeiro
   * garante uma única conexão viva por empresa.
   */
  private teardownSocket(session: SessionState): void {
    const sock = session.sock;
    if (!sock) return;
    session.sock = null;
    try {
      sock.ev.removeAllListeners('connection.update');
      sock.ev.removeAllListeners('creds.update');
      sock.ev.removeAllListeners('messages.upsert');
      sock.ev.removeAllListeners('messages.update');
      sock.ev.removeAllListeners('message-receipt.update');
    } catch {
      // ignore — best-effort cleanup
    }
    try {
      sock.end(undefined);
    } catch {
      // ignore — socket may already be dead
    }
  }
}
