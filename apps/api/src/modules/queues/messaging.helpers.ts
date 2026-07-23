/**
 * Shared messaging policy for the queue processors. Centralizes the mode gating
 * (NOTIFICATIONS_MODE / WHATSAPP_ENABLED) so reminders, follow-ups and campaigns
 * all behave identically:
 *
 *   - dryrun (default) OR WhatsApp disabled → log the would-be message, DON'T send.
 *   - live + WhatsApp enabled → hand the text to whatsapp.enqueueText (the outbox
 *     drains it to Baileys; we never touch Baileys directly here).
 *
 * The transport itself lives in WhatsappService — this module only decides
 * whether to actually dispatch and returns whether a real send happened, which
 * the caller uses to stamp its idempotency marker (sentAt).
 */
import { Logger } from '@nestjs/common';
import type { WhatsappService } from '../whatsapp/whatsapp.service';

export interface MessagingMode {
  /** 'live' actually sends; anything else (default 'dryrun') only logs. */
  readonly mode: string;
  readonly isLive: boolean;
  /** WHATSAPP_ENABLED — the Baileys socket is only started/used when true. */
  readonly whatsappEnabled: boolean;
  /** Convenience: a real WhatsApp dispatch will occur only when both are true. */
  readonly canSendWhatsapp: boolean;
}

/** Reads the messaging mode from the environment (same knobs as the rest of the app). */
export function readMessagingMode(): MessagingMode {
  const mode = (process.env.NOTIFICATIONS_MODE ?? 'dryrun').toLowerCase();
  const isLive = mode === 'live';
  const whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';
  return { mode, isLive, whatsappEnabled, canSendWhatsapp: isLive && whatsappEnabled };
}

/** A customer opted out of notifications entirely, or specifically of WhatsApp. */
export function isOptedOut(customer: {
  notificationsEnabled?: boolean | null;
  whatsappOptIn?: boolean | null;
}): boolean {
  return customer.notificationsEnabled === false || customer.whatsappOptIn === false;
}

/**
 * Dispatches a WhatsApp text honoring the mode. Returns true when a real send was
 * enqueued to the outbox, false when it was only logged (dryrun / disabled).
 * Never throws — messaging must never break the job.
 */
export async function dispatchWhatsapp(
  logger: Logger,
  whatsapp: WhatsappService,
  mode: MessagingMode,
  tag: string,
  to: string,
  text: string,
  // Contexto da interação (opcional, retrocompatível): repassado ao enqueueText
  // para vincular a mensagem à empresa/cliente/tipo no histórico "Interações".
  ctx?: { companyId?: string; customerId?: string; kind?: string },
): Promise<boolean> {
  const oneLine = text.replace(/\n/g, ' ⏎ ');
  logger.log(`${tag} WhatsApp -> ${to}: ${oneLine}`);
  if (!mode.canSendWhatsapp) return false;
  try {
    await whatsapp.enqueueText(to, text, ctx);
    return true;
  } catch (err) {
    logger.error(`${tag} falha ao enfileirar no outbox: ${(err as Error).message}`);
    return false;
  }
}
