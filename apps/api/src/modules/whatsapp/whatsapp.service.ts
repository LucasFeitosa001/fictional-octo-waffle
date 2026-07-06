import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from 'baileys';
import type { WASocket } from 'baileys';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { useDbAuthState } from './whatsapp-auth';

type WaStatus = 'disabled' | 'connecting' | 'qr' | 'open' | 'closed';

const SESSION_ID = 'default';
// Config rows live under a SEPARATE sessionId so logout()/clear() (which wipes
// every row of SESSION_ID) never erases the salon's manager-number settings.
const CONFIG_SESSION_ID = 'config';
const CONFIG_CATEGORY = 'owner';

// A plain-text reply that arrived at the salon's WhatsApp from the manager.
export interface WhatsappInbound {
  fromDigits: string; // sender number, digits only (e.g. "5511988887777")
  text: string;
  quotedText?: string; // text of the message being replied to (swipe-reply)
}
export type WhatsappInboundHandler = (msg: WhatsappInbound) => void;

// Outbox worker tuning.
const OUTBOX_TICK_MS = 5000; // how often the drain loop wakes up
const OUTBOX_PACING_MS = 1500; // gap between consecutive sends (ban-avoidance)
const OUTBOX_MAX_ATTEMPTS = 5; // give up after this many tries → status 'failed'

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
 * Owns a single long-lived Baileys (WhatsApp Web) connection for the salon's
 * own number. The session is persisted in Postgres (see useDbAuthState), so a
 * container restart reconnects silently without a new QR scan.
 *
 * IMPORTANT: only one process may hold the session at a time, or WhatsApp will
 * fight the two devices and log out. App Runner must therefore stay at a single
 * instance (autoscaling MaxSize = 1).
 *
 * Disabled unless WHATSAPP_ENABLED=true so the connection never starts in dev or
 * before the account is meant to be linked.
 */
@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private sock: WASocket | null = null;
  private status: WaStatus = 'disabled';
  private currentQr: string | null = null;
  private connecting = false;
  private inboundHandler: WhatsappInboundHandler | null = null;
  private outboxTimer: ReturnType<typeof setInterval> | null = null;
  private draining = false;
  private reconnectAttempts = 0;
  // Last 8 digits of the connected bot's own number, captured on 'open'. Used to
  // recognise the "message yourself" chat: when a salon uses ONE WhatsApp number
  // for both the bot and the manager, the manager's 1/2/3 replies arrive as
  // fromMe in the self-chat and would otherwise be dropped.
  private selfDigitsTail: string | null = null;
  private readonly enabled = process.env.WHATSAPP_ENABLED === 'true';

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('WhatsApp desabilitado (defina WHATSAPP_ENABLED=true para ativar).');
      return;
    }
    // Fire-and-forget: never block app boot on the WhatsApp socket.
    void this.connect();
    // Drain the outbox queue on a timer; it no-ops until the socket is open.
    this.outboxTimer = setInterval(() => void this.drainOutbox(), OUTBOX_TICK_MS);
  }

  async onModuleDestroy() {
    if (this.outboxTimer) clearInterval(this.outboxTimer);
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.teardownSocket();
    this.status = 'closed';
    this.connecting = false;
  }

  /**
   * Registers the single consumer of inbound manager replies (the booking flow
   * wires this so a "1/2/3" answer from the salon drives the confirmation). Only
   * one handler is supported — last registration wins.
   */
  setInboundHandler(fn: WhatsappInboundHandler): void {
    this.inboundHandler = fn;
  }

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

  getStatus(): { status: WaStatus; hasQr: boolean } {
    return { status: this.status, hasQr: Boolean(this.currentQr) };
  }

  /** Current pairing QR as a PNG data URL, or null when none is pending. */
  async getQrDataUrl(): Promise<string | null> {
    if (!this.currentQr) return null;
    return QRCode.toDataURL(this.currentQr, { margin: 1, width: 320 });
  }

  /**
   * Mints an 8-char pairing code for "link with phone number" — the alternative
   * to scanning the QR. The salon types this code into WhatsApp → Linked devices
   * → Link with phone number instead. Only valid while a pairing is pending
   * (status 'qr' / not yet registered). Returns null otherwise.
   */
  async requestPairingCode(phone: string): Promise<string | null> {
    if (!this.enabled || !this.sock) return null;
    if (this.status === 'open') return null;
    let digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (!digits.startsWith('55')) digits = `55${digits}`;
    if (digits.length < 12 || digits.length > 13) return null;
    try {
      const code = await this.sock.requestPairingCode(digits);
      this.logger.log('Código de pareamento do WhatsApp gerado.');
      return code;
    } catch (err) {
      this.logger.error(`Falha ao gerar código de pareamento: ${(err as Error).message}`);
      return null;
    }
  }

  /** Drops the stored session so a fresh QR can be generated (re-link). */
  async logout(): Promise<void> {
    try {
      await this.sock?.logout();
    } catch {
      // ignore — we clear state regardless
    }
    const { clear } = await useDbAuthState(this.prisma, SESSION_ID);
    await clear();
    this.sock = null;
    this.currentQr = null;
    this.status = 'closed';
    if (this.enabled) void this.connect();
  }

  /**
   * Sends a plain-text WhatsApp message. Fails soft: returns false (never
   * throws) when WhatsApp is disabled, not yet connected, or the send errors —
   * a booking must never break because of messaging.
   */
  async sendText(phone: string, text: string): Promise<boolean> {
    if (!this.enabled || this.status !== 'open' || !this.sock) return false;
    const jid = this.toJid(phone);
    if (!jid) return false;
    try {
      await this.sock.sendMessage(jid, { text });
      return true;
    } catch (err) {
      this.logger.error(`Falha ao enviar WhatsApp para ${phone}: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Enqueues a plain-text WhatsApp message instead of sending it inline. This is
   * the path the booking flow uses: fire-and-forget Baileys sends were silently
   * lost (the socket can accept a send right after connect and drop it, and the
   * Brazilian 9th-digit JID is ambiguous). Persisting to an outbox guarantees the
   * message survives a restart and is retried until the salon actually receives
   * it. Fails soft — bad numbers are dropped with a warning, never thrown.
   */
  async enqueueText(phone: string, text: string): Promise<void> {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      this.logger.warn(`Outbox: número inválido ignorado (${phone}).`);
      return;
    }
    await this.prisma.client.whatsappOutbox.create({ data: { toPhone: digits, text } });
    // Try to deliver immediately; if the socket isn't open yet the timer drains
    // it later. drainOutbox guards itself, so this is safe to call any time.
    void this.drainOutbox();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Drains pending outbox rows one at a time, oldest first, pacing sends to avoid
   * tripping WhatsApp's anti-spam. Re-entrancy guarded (`draining`) so the timer
   * and the inline nudge never overlap. No-ops until the socket is open.
   */
  private async drainOutbox(): Promise<void> {
    if (this.draining || !this.enabled) return;
    if (this.status !== 'open' || !this.sock) return;
    this.draining = true;
    try {
      for (;;) {
        if (this.status !== 'open' || !this.sock) break;
        const msg = await this.prisma.client.whatsappOutbox.findFirst({
          where: { status: 'pending', nextAttemptAt: { lte: new Date() } },
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
   * Delivers a single outbox row. On success marks it 'sent'; on failure bumps
   * the attempt count with exponential backoff, giving up (status 'failed') after
   * OUTBOX_MAX_ATTEMPTS so a permanently-bad number can't block the queue.
   */
  private async deliverOutbox(msg: {
    id: string;
    toPhone: string;
    text: string;
    attempts: number;
  }): Promise<void> {
    const db = this.prisma.client;
    try {
      const jid = await this.resolveJid(msg.toPhone);
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
      await this.sock!.sendMessage(jid, { text: msg.text });
      await db.whatsappOutbox.update({
        where: { id: msg.id },
        data: { status: 'sent', sentAt: new Date(), attempts: msg.attempts + 1, lastError: null },
      });
      this.logger.log(`Outbox ${msg.id}: enviado para ${jid}.`);
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
   * Resolves a phone to the JID WhatsApp actually serves. Brazilian numbers are
   * ambiguous about the 9th mobile digit, so we ask the server via onWhatsApp
   * which canonical JID exists rather than guessing. Falls back to the naive
   * "<digits>@s.whatsapp.net" if the lookup throws (network blip), so a transient
   * error still gets a delivery attempt.
   */
  private async resolveJid(phone: string): Promise<string | null> {
    let digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (!digits.startsWith('55')) digits = `55${digits}`;
    if (!this.sock) return null;
    try {
      const results = await this.sock.onWhatsApp(digits);
      const hit = results?.find((r) => r.exists && r.jid);
      if (hit?.jid) return hit.jid;
      // onWhatsApp answered but the number has no account → don't keep retrying.
      if (results && results.length > 0) return null;
    } catch {
      // Lookup failed (transient) — fall through to the naive JID below.
    }
    return `${digits}@s.whatsapp.net`;
  }

  // "(11) 98888-7777" → "5511988887777@s.whatsapp.net". Assumes Brazil (55) when
  // no country code is present. Returns null for clearly invalid numbers.
  private toJid(phone: string): string | null {
    let digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    if (!digits.startsWith('55')) digits = `55${digits}`;
    if (digits.length < 12 || digits.length > 13) return null;
    return `${digits}@s.whatsapp.net`;
  }

  /**
   * Fully disposes the current socket: detaches every listener and closes the
   * underlying websocket. Skipping this was the cause of a code=440 reconnect
   * loop — a rolling deploy briefly ran two connections, and each `close` left a
   * zombie socket still holding the session, so every fresh connect was instantly
   * "replaced" (440) by the lingering one. Tearing the old socket down first
   * guarantees only ever one live connection.
   */
  private teardownSocket(): void {
    const sock = this.sock;
    if (!sock) return;
    this.sock = null;
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

  private connectTimeout: ReturnType<typeof setTimeout> | null = null;

  private async connect(): Promise<void> {
    if (this.connecting || this.status === 'open') return;
    this.connecting = true;
    this.status = 'connecting';
    // Drop any previous socket before opening a new one (see teardownSocket).
    this.teardownSocket();
    // Baileys can hang during the WebSocket handshake without emitting 'open'
    // or 'close', leaving `connecting = true` forever. A 45s timeout catches
    // this and forces a retry.
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.connectTimeout = setTimeout(() => {
      if (this.connecting && this.status !== 'open') {
        this.logger.warn('WhatsApp: timeout de conexão (45s) — forçando reconexão.');
        this.connecting = false;
        this.status = 'closed';
        this.teardownSocket();
        void this.connect();
      }
    }, 45_000);
    try {
      const { state, saveCreds } = await useDbAuthState(this.prisma, SESSION_ID);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        logger: silentLogger(),
        browser: Browsers.appropriate('Salonpass'),
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        syncFullHistory: false,
      });
      this.sock = sock;

      sock.ev.on('creds.update', () => {
        void saveCreds();
      });

      // Inbound manager replies ("1" / "2 motivo" / "3 sugestão"). We only care
      // about plain text from individual chats; groups and non-text messages are
      // ignored. The booking flow decides what to do.
      sock.ev.on('messages.upsert', (evt) => {
        if (evt.type !== 'notify') return;
        for (const m of evt.messages) {
          const jid = m.key.remoteJid ?? '';
          if (!jid.endsWith('@s.whatsapp.net')) continue; // skip groups/status
          const text = m.message?.conversation ?? m.message?.extendedTextMessage?.text;
          if (!text || !text.trim()) continue;
          const trimmed = text.trim();
          // Normally our own sends (fromMe) are skipped — but a salon that uses a
          // single WhatsApp number for both the bot and the manager replies to
          // the confirm-prompt inside the "message yourself" chat, where those
          // replies arrive as fromMe. Allow them only there, and only when they
          // look like a 1/2/3 command, so our own auto-sent prompts/acks (which
          // never start with a digit) can't be fed back in and loop.
          if (m.key.fromMe) {
            const selfChat =
              !!this.selfDigitsTail && this.digitsTail(this.jidUserDigits(jid)) === this.selfDigitsTail;
            if (!selfChat || !/^[123]\b/.test(trimmed)) continue;
          }
          const fromDigits = this.jidUserDigits(jid);
          const quoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
          const quotedText = quoted?.conversation ?? quoted?.extendedTextMessage?.text ?? undefined;
          try {
            this.inboundHandler?.({ fromDigits, text: trimmed, quotedText });
          } catch (err) {
            this.logger.error(`Erro no handler de mensagem recebida: ${(err as Error).message}`);
          }
        }
      });

      sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          this.currentQr = qr;
          this.status = 'qr';
          this.logger.log('QR do WhatsApp disponível — escaneie em /api/v1/whatsapp/qr.');
        }
        if (connection === 'open') {
          if (this.connectTimeout) { clearTimeout(this.connectTimeout); this.connectTimeout = null; }
          this.currentQr = null;
          this.status = 'open';
          this.connecting = false;
          this.reconnectAttempts = 0; // healthy connection — reset backoff
          // Remember our own number so we can recognise the self-chat (single-
          // number salons reply to the confirm-prompt as fromMe in it).
          this.selfDigitsTail = this.digitsTail(this.jidUserDigits(sock.user?.id ?? ''));
          this.logger.log('WhatsApp conectado.');
          // Flush anything that queued up while we were offline.
          void this.drainOutbox();
        }
        if (connection === 'close') {
          if (this.connectTimeout) { clearTimeout(this.connectTimeout); this.connectTimeout = null; }
          this.status = 'closed';
          this.connecting = false;
          const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
            ?.statusCode;
          const loggedOut = code === DisconnectReason.loggedOut;
          // Dispose the dead socket so it can't keep "replacing" the next one.
          this.teardownSocket();
          if (loggedOut) {
            this.logger.warn('WhatsApp desconectado: sessão encerrada — novo QR necessário.');
            void this.handleLoggedOut();
          } else {
            // Code 440 = "replaced by another device" — happens during App Runner
            // rolling deploys when two instances share the session. Use a long
            // backoff (30s) so the old instance has time to die. Other codes use
            // exponential backoff (3s → 6s → 12s … capped at 30s).
            const replaced = code === 440;
            const delay = replaced
              ? 30_000
              : Math.min(30000, 3000 * 2 ** this.reconnectAttempts);
            this.reconnectAttempts += 1;
            this.logger.warn(
              `WhatsApp desconectado (code=${code ?? '?'}). Reconectando em ${delay / 1000}s…`,
            );
            setTimeout(() => void this.connect(), delay);
          }
        }
      });
    } catch (err) {
      if (this.connectTimeout) { clearTimeout(this.connectTimeout); this.connectTimeout = null; }
      this.connecting = false;
      this.status = 'closed';
      this.logger.error(`Erro ao conectar no WhatsApp: ${(err as Error).message}`);
      setTimeout(() => void this.connect(), 5000);
    }
  }

  private async handleLoggedOut(): Promise<void> {
    try {
      const { clear } = await useDbAuthState(this.prisma, SESSION_ID);
      await clear();
    } catch {
      // ignore
    }
    this.sock = null;
    this.currentQr = null;
    // Reconnect to surface a fresh QR for re-linking.
    setTimeout(() => void this.connect(), 2000);
  }
}
