import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import { FollowUpSenderService } from './follow-up-sender.service';
import { readMessagingMode } from './messaging.helpers';

const DEFAULT_POLL_MS = 60_000;
const MIN_POLL_MS = 15_000;
/** Marcadores gravados pelo processador; a leitura aqui precisa casar com eles. */
const FOLLOW_UP_TYPE = 'automation.follow_up';
/**
 * Não perseguir atendimento antigo. Se o acompanhamento de uma visita de duas
 * semanas atrás nunca saiu, mandar hoje é pior que não mandar — o cliente já
 * seguiu a vida. Mesmo espírito do prazo de validade da fila.
 */
const JANELA_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Fallback persistente do acompanhamento pós-atendimento.
 *
 * Existe pelo mesmo motivo do fallback de lembretes: produção roda com
 * `QUEUES_ENABLED=false`, então o job atrasado do BullMQ nunca é agendado. A
 * diferença é que o lembrete tinha fallback e o acompanhamento não — resultado,
 * ZERO mensagens de acompanhamento em toda a história da produção, com a tela de
 * configuração funcionando normalmente. Ver estudo 84.
 *
 * Não reimplementa nada: acha o que está vencido e chama
 * `FollowUpSenderService.executarFollowUp`, que é dono da idempotência (marcadores
 * `Notification`), do dedupe entre agendamento e comanda, da regra de parar
 * quando o cliente já reagendou e da composição do texto.
 */
@Injectable()
export class FollowUpPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FollowUpPollerService.name);
  private readonly mode = readMessagingMode();
  private readonly fallbackEnabled =
    process.env.QUEUES_ENABLED === 'false' ||
    process.env.QUEUE_WORKERS_ENABLED === 'false';
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NotificationSettingsService,
    private readonly sender: FollowUpSenderService,
  ) {}

  onModuleInit(): void {
    if (!this.fallbackEnabled) return;
    if (!this.mode.canSendWhatsapp) {
      this.logger.warn(
        'Fallback de acompanhamento aguardando NOTIFICATIONS_MODE=live e WHATSAPP_ENABLED=true.',
      );
      return;
    }
    const requested = Number(process.env.FOLLOWUP_POLL_MS ?? DEFAULT_POLL_MS);
    const pollMs = Number.isFinite(requested)
      ? Math.max(MIN_POLL_MS, requested)
      : DEFAULT_POLL_MS;
    this.logger.log(
      `Fallback persistente de acompanhamento ativo (intervalo ${Math.round(pollMs / 1000)}s).`,
    );
    // Começa depois do boot para não competir com a reconexão do WhatsApp.
    const kickoff = setTimeout(() => void this.runOnce(), 20_000);
    kickoff.unref();
    this.timer = setInterval(() => void this.runOnce(), pollMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Público para exercitar sem esperar o intervalo (testes e verificação). */
  async runOnce(now = new Date()): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      return await this.varrer(now);
    } catch (err) {
      this.logger.error(`Varredura de acompanhamento falhou: ${(err as Error).message}`);
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async varrer(now: Date): Promise<number> {
    const db = this.prisma.client;
    // Só empresa que LIGOU o acompanhamento. Sem isto varreríamos a base inteira
    // a cada minuto para no fim descartar tudo no `cfg.enabled` lá dentro.
    const empresas = await db.company.findMany({ select: { id: true } });
    let tratados = 0;

    for (const { id: companyId } of empresas) {
      const cfg = await this.settings.getFollowUp(companyId).catch(() => null);
      if (!cfg?.enabled) continue;
      const atrasoMs = (cfg.delaySeconds > 0 ? cfg.delaySeconds : 24 * 3600) * 1000;
      const vencidoAte = new Date(now.getTime() - atrasoMs);
      const limiteAntigo = new Date(now.getTime() - atrasoMs - JANELA_MAXIMA_MS);

      // Concluídos cujo carimbo de conclusão + prazo já venceu. O instante vem do
      // histórico de status, não de `updatedAt` — este muda em qualquer edição e
      // reiniciaria a contagem a cada toque no agendamento.
      const concluidos = await db.appointment.findMany({
        where: {
          companyId,
          status: { in: ['done', 'finished'] },
          statusHistory: {
            some: {
              toStatus: { in: ['done', 'finished'] },
              at: { lte: vencidoAte, gte: limiteAntigo },
            },
          },
        },
        select: { id: true },
        take: 50,
      });

      for (const appt of concluidos) {
        // O processador tem a idempotência definitiva (marcador Notification),
        // mas conferir aqui evita chamá-lo à toa a cada minuto para todo
        // atendimento já tratado.
        const jaTem = await db.notification.findFirst({
          where: { companyId, type: FOLLOW_UP_TYPE, entityId: appt.id },
          select: { id: true },
        });
        if (jaTem) continue;
        try {
          await this.sender.executarFollowUp({ companyId, appointmentId: appt.id });
          tratados += 1;
        } catch (err) {
          this.logger.error(
            `Acompanhamento de ${appt.id} falhou: ${(err as Error).message}`,
          );
        }
      }

      tratados += await this.varrerRecorrencias(companyId, cfg, now);
    }

    if (tratados > 0) this.logger.log(`Acompanhamento: ${tratados} tratado(s).`);
    return tratados;
  }

  /**
   * A recorrência do processador reagenda via `queues.enqueueFollowUp`, que é
   * no-op com a fila desligada. Aqui ela é derivada do próprio marcador: o envio
   * `r(n)` vence `recurringSeconds` depois do marcador `r(n-1)`.
   */
  private async varrerRecorrencias(
    companyId: string,
    cfg: { recurring: boolean; recurringSeconds: number; maxRecurrences: number },
    now: Date,
  ): Promise<number> {
    if (!cfg.recurring || cfg.maxRecurrences <= 1) return 0;
    const db = this.prisma.client;
    const intervaloMs = (cfg.recurringSeconds > 0 ? cfg.recurringSeconds : 30 * 86400) * 1000;
    const vencidoAte = new Date(now.getTime() - intervaloMs);

    const marcadores = await db.notification.findMany({
      where: { companyId, type: FOLLOW_UP_TYPE, createdAt: { lte: vencidoAte } },
      select: { entityId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let tratados = 0;
    for (const m of marcadores) {
      if (!m.entityId) continue;
      // `<id>` é o primeiro envio; `<id>:r2` é a segunda repetição, e assim por diante.
      const [entityId, sufixo] = m.entityId.split(':r');
      const atual = sufixo ? Number(sufixo) : 0;
      if (!Number.isFinite(atual)) continue;
      const proxima = atual + 1;
      if (proxima >= cfg.maxRecurrences) continue;
      const jaTem = await db.notification.findFirst({
        where: { companyId, type: FOLLOW_UP_TYPE, entityId: `${entityId}:r${proxima}` },
        select: { id: true },
      });
      if (jaTem) continue;
      try {
        await this.sender.executarFollowUp({
          companyId,
          appointmentId: entityId,
          recurrence: proxima,
        });
        tratados += 1;
      } catch (err) {
        this.logger.error(
          `Recorrência r${proxima} de ${entityId} falhou: ${(err as Error).message}`,
        );
      }
    }
    return tratados;
  }
}
