import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { CampaignsService } from '../../campaigns/campaigns.service';
import {
  QUEUE_CAMPAIGNS,
  JOB_CAMPAIGN_MESSAGE,
  JOB_BIRTHDAY_SCAN,
  type CampaignMessageJob,
} from '../queue-names';
import { readMessagingMode, dispatchWhatsapp } from '../messaging.helpers';

/**
 * Campaign delivery worker. Two job kinds share this queue:
 *
 *   - campaign-message: one materialized CampaignMessage to deliver. The text was
 *     pre-rendered at dispatch time; here we just re-check opt-in and either send
 *     (live) or log (dryrun), then stamp the CampaignMessage status/sentAt. Retry
 *     is per-message (attempts/backoff) so one bad number doesn't sink the batch.
 *
 *   - birthday-scan: the daily repeatable. Delegates to CampaignsService to find
 *     every tenant's active "aniversariantes do dia" campaign and fan-out enqueue
 *     one campaign-message job per matched customer.
 *
 * Both honor NOTIFICATIONS_MODE / WHATSAPP_ENABLED and customer opt-in.
 */
@Processor(QUEUE_CAMPAIGNS)
export class CampaignsProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignsProcessor.name);
  private readonly mode = readMessagingMode();

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly campaigns: CampaignsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === JOB_BIRTHDAY_SCAN) {
      await this.runBirthdayScan();
      return;
    }
    if (job.name === JOB_CAMPAIGN_MESSAGE) {
      await this.deliverCampaignMessage(job as Job<CampaignMessageJob>);
      return;
    }
    this.logger.warn(`Job de campanha desconhecido: ${job.name}`);
  }

  /** Delivers one pre-rendered campaign message and records its outcome. */
  private async deliverCampaignMessage(job: Job<CampaignMessageJob>): Promise<void> {
    const { companyId, campaignId, campaignMessageId, customerId, text } = job.data;
    const tag = `[campaign ${this.mode.mode}] company=${companyId} campaign=${campaignId} customer=${customerId}`;

    // The message row was created at dispatch time; re-read customer for a fresh
    // opt-in + phone (they may have changed since enqueue).
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: customerId, companyId },
      select: {
        phone: true,
        notificationsEnabled: true,
        whatsappOptIn: true,
        active: true,
        deletedAt: true,
      },
    });

    const blocked =
      !customer ||
      !customer.active ||
      customer.deletedAt !== null ||
      !customer.phone ||
      customer.notificationsEnabled === false ||
      customer.whatsappOptIn === false;

    if (blocked) {
      this.logger.debug(`${tag} bloqueado (opt-out/sem telefone/inativo) — marcado skipped.`);
      await this.updateMessage(campaignMessageId, 'skipped', false);
      return;
    }

    const sent = await dispatchWhatsapp(
      this.logger,
      this.whatsapp,
      this.mode,
      tag,
      customer.phone!,
      text,
      // Interações: mensagem de campanha ao cliente.
      { companyId, customerId, kind: 'campaign' },
    );
    await this.updateMessage(campaignMessageId, sent ? 'sent' : 'dryrun', sent);
  }

  private async updateMessage(
    id: string,
    status: string,
    sent: boolean,
  ): Promise<void> {
    await this.prisma.client.campaignMessage
      .update({
        where: { id },
        data: { status, sentAt: sent ? new Date() : null },
      })
      .catch((err) =>
        this.logger.warn(`updateMessage(${id}) falhou: ${(err as Error).message}`),
      );
  }

  /** Daily sweep: enqueue per-customer sends for every active birthday campaign. */
  private async runBirthdayScan(): Promise<void> {
    try {
      const total = await this.campaigns.enqueueBirthdayCampaigns();
      if (total > 0) {
        this.logger.log(`birthday-scan: ${total} mensagem(ns) de aniversário enfileirada(s).`);
      }
    } catch (err) {
      this.logger.error(`birthday-scan falhou: ${(err as Error).message}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error): void {
    this.logger.error(
      `Campaign job ${job?.id} (${job?.name}) falhou (tentativa ${job?.attemptsMade}): ${err?.message}`,
    );
  }
}
