import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  proto,
} from 'baileys';
import type { WASocket } from 'baileys';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { useDbAuthState } from './whatsapp-auth';

type WaStatus = 'disabled' | 'connecting' | 'qr' | 'open' | 'closed';

// Config rows (manager number) live under a SEPARATE sessionId so a WhatsApp
// re-link (which wipes every credential row of a company's sessionId) never
// erases the salon's manager-number settings. itemId = companyId.
const CONFIG_SESSION_ID = 'config';
const CONFIG_CATEGORY = 'owner';

// O antigo socket global usava este sessionId. Multi-tenant NÃO o usa mais (cada
// empresa vira seu próprio sessionId = companyId). Mantido só para o boot ignorar
// essa linha ao varrer credenciais e para documentar a migração (re-link único).
const LEGACY_GLOBAL_SESSION_ID = 'default';

// A plain-text reply that arrived at the salon's WhatsApp from the manager.
export interface WhatsappInbound {
  fromDigits: string; // sender number, digits only (e.g. "5511988887777")
  text: string;
  quotedText?: string; // text of the message being replied to (swipe-reply)
  // Empresa dona do socket em que a mensagem chegou. Como cada company tem seu
  // PRÓPRIO número/socket, sabemos de imediato de qual salão veio a resposta.
  companyId: string;
}
export type WhatsappInboundHandler = (msg: WhatsappInbound) => void;

// Outbox worker tuning.
const OUTBOX_TICK_MS = 5000; // how often the drain loop wakes up
const OUTBOX_PACING_MS = 1500; // gap between consecutive sends (ban-avoidance)
const OUTBOX_MAX_ATTEMPTS = 5; // give up after this many tries → status 'failed'
// Quantas mensagens enviadas guardar por sessão para responder aos retry-receipts
// (ver getMessage). Cobre com folga a janela em que um aparelho pede reenvio.
const SENT_CACHE_MAX = 300;

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
  private inboundHandler: WhatsappInboundHandler | null = null;
  private outboxTimer: ReturnType<typeof setInterval> | null = null;
  private draining = false;
  private readonly enabled = process.env.WHATSAPP_ENABLED === 'true';

  constructor(private readonly prisma: PrismaService) {}

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
  }

  async onModuleDestroy() {
    if (this.outboxTimer) clearInterval(this.outboxTimer);
    for (const session of this.sessions.values()) {
      if (session.connectTimeout) clearTimeout(session.connectTimeout);
      this.teardownSocket(session);
      session.status = 'closed';
      session.connecting = false;
    }
  }

  /**
   * Registers the single consumer of inbound manager replies (the booking flow
   * wires this so a "1/2/3" answer from the salon drives the confirmation). Only
   * one handler is supported — last registration wins.
   */
  setInboundHandler(fn: WhatsappInboundHandler): void {
    this.inboundHandler = fn;
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
    return (jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
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
  getStatus(companyId: string): { status: WaStatus; hasQr: boolean } {
    if (!this.enabled) return { status: 'disabled', hasQr: false };
    const session = this.sessions.get(companyId);
    if (!session) return { status: 'closed', hasQr: false };
    return { status: session.status, hasQr: Boolean(session.currentQr) };
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
  async enqueueText(
    phone: string,
    text: string,
    ctx?: { companyId?: string; customerId?: string; kind?: string },
  ): Promise<void> {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      this.logger.warn(`Outbox: número inválido ignorado (${phone}).`);
      return;
    }
    await this.prisma.client.whatsappOutbox.create({
      data: {
        toPhone: digits,
        text,
        // Só grava o que veio — undefined vira NULL na coluna (retrocompatível).
        companyId: ctx?.companyId ?? null,
        customerId: ctx?.customerId ?? null,
        kind: ctx?.kind ?? null,
      },
    });
    // Try to deliver immediately; if no socket is open yet the timer drains it
    // later. drainOutbox guards itself, so this is safe to call any time.
    void this.drainOutbox();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Empresas com socket aberto agora — usado para filtrar o outbox no drain. */
  private openCompanyIds(): string[] {
    const ids: string[] = [];
    for (const session of this.sessions.values()) {
      if (session.status === 'open' && session.sock) ids.push(session.companyId);
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
        const openNow = this.openCompanyIds();
        if (openNow.length === 0) break;
        const msg = await this.prisma.client.whatsappOutbox.findFirst({
          where: {
            status: 'pending',
            nextAttemptAt: { lte: new Date() },
            companyId: { in: openNow },
          },
          orderBy: { createdAt: 'asc' },
        });
        if (!msg) break;
        await this.deliverOutbox(msg);
        await this.sleep(OUTBOX_PACING_MS);
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
    text: string;
    attempts: number;
    companyId: string | null;
  }): Promise<void> {
    const db = this.prisma.client;
    const session = msg.companyId ? this.sessions.get(msg.companyId) : undefined;
    // Sem company ou sem socket aberto → não há por onde enviar; deixa pendente.
    if (!session || session.status !== 'open' || !session.sock) return;
    try {
      const jid = await this.resolveJid(session, msg.toPhone);
      if (!jid) {
        await db.whatsappOutbox.update({
          where: { id: msg.id },
          data: {
            status: 'failed',
            attempts: msg.attempts + 1,
            lastError: 'Número sem WhatsApp / JID irresolúvel',
          },
        });
        this.logger.warn(`Outbox ${msg.id}: número ${msg.toPhone} sem WhatsApp — descartado.`);
        return;
      }
      const sent = await session.sock.sendMessage(jid, { text: msg.text });
      // Guarda o conteúdo enviado para o getMessage responder aos retry-receipts
      // (ver makeWASocket) — é isso que tira a mensagem do "Aguardando esta
      // mensagem…" no celular do dono. Mantém o cache limitado (FIFO).
      if (sent?.key?.id && sent.message) {
        if (session.sentCache.size >= SENT_CACHE_MAX) {
          const oldest = session.sentCache.keys().next().value;
          if (oldest !== undefined) session.sentCache.delete(oldest);
        }
        session.sentCache.set(sent.key.id, sent.message);
      }
      await db.whatsappOutbox.update({
        where: { id: msg.id },
        data: { status: 'sent', sentAt: new Date(), attempts: msg.attempts + 1, lastError: null },
      });
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
      this.logger.error(
        `Outbox ${msg.id}: falha (tentativa ${attempts}/${OUTBOX_MAX_ATTEMPTS}) — ${(err as Error).message}`,
      );
    }
  }

  /**
   * Resolves a phone to the JID WhatsApp actually serves, using a SPECIFIC
   * company's socket. Brazilian numbers are ambiguous about the 9th mobile digit,
   * so we ask the server via onWhatsApp which canonical JID exists rather than
   * guessing. Falls back to the naive "<digits>@s.whatsapp.net" if the lookup
   * throws (network blip), so a transient error still gets a delivery attempt.
   */
  private async resolveJid(session: SessionState, phone: string): Promise<string | null> {
    let digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (!digits.startsWith('55')) digits = `55${digits}`;
    if (!session.sock) return null;
    try {
      const results = await session.sock.onWhatsApp(digits);
      const hit = results?.find((r) => r.exists && r.jid);
      if (hit?.jid) return hit.jid;
      // onWhatsApp answered but the number has no account → don't keep retrying.
      if (results && results.length > 0) return null;
    } catch {
      // Lookup failed (transient) — fall through to the naive JID below.
    }
    return `${digits}@s.whatsapp.net`;
  }

  // ------------------------------------------------------------- conexão

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
      const { state, saveCreds } = await useDbAuthState(this.prisma, companyId);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        logger: silentLogger(),
        browser: Browsers.appropriate('Salonpass'),
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
        getMessage: async (key) =>
          (key.id ? session.sentCache.get(key.id) : undefined) ?? undefined,
      });
      session.sock = sock;

      sock.ev.on('creds.update', () => {
        void saveCreds();
      });

      // Inbound manager replies ("1" / "2 motivo" / "3 sugestão"). Só interessa
      // texto puro de chats individuais; grupos e não-texto são ignorados. Como
      // o socket é DESTA empresa, já sabemos o companyId de origem.
      sock.ev.on('messages.upsert', (evt) => {
        if (evt.type !== 'notify') return;
        for (const m of evt.messages) {
          const jid = m.key.remoteJid ?? '';
          if (!jid.endsWith('@s.whatsapp.net')) continue; // skip groups/status
          const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text;
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
            if (!selfChat || !/^[123]\b/.test(trimmed)) continue;
          }
          const fromDigits = this.jidUserDigits(jid);
          const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const quotedText = quoted?.conversation ?? quoted?.extendedTextMessage?.text ?? undefined;
          try {
            this.inboundHandler?.({ fromDigits, text: trimmed, quotedText, companyId });
          } catch (err) {
            this.logger.error(`Erro no handler de mensagem recebida: ${(err as Error).message}`);
          }
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
