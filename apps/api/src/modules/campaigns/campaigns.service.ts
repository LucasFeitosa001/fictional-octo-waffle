import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  CampaignChannel,
  CampaignStatus,
  AppointmentStatus,
  Prisma,
} from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { QueuesService } from '../queues/queues.service';
import {
  CampaignSegment,
  CreateCampaignDto,
  SegmentKind,
  UpdateCampaignDto,
} from './dto';

/**
 * Marketing campaigns backend.
 *
 * A Campaign targets a `segment` (aniversariantes do dia, clientes inativos há
 * N dias, ou todos) and, when dispatched, materializes one CampaignMessage per
 * matched customer and enqueues the WhatsApp send via the outbox.
 *
 * The `Campaign` model has no `message` column, so the message body lives inside
 * `segmentJson.message` alongside the segment definition — no schema change
 * needed. Per-customer text substitutes `%NOME%` and `%ESTABELECIMENTO%`.
 *
 * MODE: respects NOTIFICATIONS_MODE (dryrun/live) and WHATSAPP_ENABLED like the
 * rest of the system — dispatch always creates CampaignMessage rows (so the
 * campaign is auditable), but only enqueues real WhatsApp sends when live +
 * enabled. In dryrun the would-be messages are logged.
 */

const DEFAULT_INACTIVE_DAYS = 90;

interface StoredSegment extends CampaignSegment {
  message?: string;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);
  private readonly mode = (
    process.env.NOTIFICATIONS_MODE ?? 'dryrun'
  ).toLowerCase();
  private readonly whatsappEnabled = process.env.WHATSAPP_ENABLED === 'true';

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    @Inject(forwardRef(() => QueuesService))
    private readonly queues: QueuesService,
  ) {}

  private get isLive(): boolean {
    return this.mode === 'live';
  }

  // ------------------------------------------------------------------ CRUD

  async create(companyId: string, dto: CreateCampaignDto) {
    const segment = this.normalizeSegment(dto.segmentJson);
    const stored: StoredSegment = { ...segment, message: dto.message };
    return this.prisma.client.campaign.create({
      data: {
        companyId,
        name: dto.name,
        channel: dto.channel,
        segmentJson: stored as unknown as Prisma.InputJsonValue,
        status: CampaignStatus.draft,
      },
    });
  }

  async list(companyId: string) {
    return this.prisma.client.campaign.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async get(companyId: string, id: string) {
    const campaign = await this.prisma.client.campaign.findFirst({
      where: { id, companyId },
      include: {
        messages: {
          include: { customer: { select: { id: true, name: true, phone: true } } },
          orderBy: { id: 'desc' },
          take: 200,
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return campaign;
  }

  async update(companyId: string, id: string, dto: UpdateCampaignDto) {
    const existing = await this.prisma.client.campaign.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('Campanha não encontrada.');

    const data: Prisma.CampaignUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.channel !== undefined) data.channel = dto.channel;
    if (dto.status !== undefined) data.status = dto.status;

    // Merge message/segment into the stored JSON so a partial update doesn't
    // clobber the other half.
    if (dto.segmentJson !== undefined || dto.message !== undefined) {
      const prev = (existing.segmentJson ?? {}) as unknown as StoredSegment;
      const segment =
        dto.segmentJson !== undefined
          ? this.normalizeSegment(dto.segmentJson)
          : this.normalizeSegment(prev);
      const message = dto.message !== undefined ? dto.message : prev.message;
      data.segmentJson = {
        ...segment,
        message,
      } as unknown as Prisma.InputJsonValue;
    }

    return this.prisma.client.campaign.update({ where: { id }, data });
  }

  async remove(companyId: string, id: string) {
    const existing = await this.prisma.client.campaign.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('Campanha não encontrada.');
    await this.prisma.client.campaign.delete({ where: { id } });
    return { ok: true };
  }

  // -------------------------------------------------------------- dispatch

  /**
   * Resolves the campaign's segment to a customer list, creates one
   * CampaignMessage per new customer, and ENQUEUES a BullMQ job per sendable
   * message (the actual WhatsApp send now happens in the campaigns worker, with
   * per-message retry — no synchronous send loop). Idempotent per customer: a
   * customer already present in this campaign's messages is skipped, so
   * re-dispatching only fills gaps.
   */
  async dispatch(companyId: string, id: string) {
    const campaign = await this.prisma.client.campaign.findFirst({
      where: { id, companyId },
      include: { company: { select: { name: true } } },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');

    const stored = (campaign.segmentJson ?? {}) as unknown as StoredSegment;
    const message = stored.message?.trim();
    if (!message) {
      throw new BadRequestException(
        'Defina a mensagem da campanha antes de disparar.',
      );
    }

    await this.prisma.client.campaign.update({
      where: { id },
      data: { status: CampaignStatus.sending },
    });

    const result = await this.materializeAndEnqueue(companyId, {
      id: campaign.id,
      channel: campaign.channel,
      companyName: campaign.company.name,
      segment: this.normalizeSegment(stored),
      message,
    });

    await this.prisma.client.campaign.update({
      where: { id },
      data: { status: CampaignStatus.sent },
    });

    return {
      campaignId: id,
      matched: result.matched,
      newlyTargeted: result.newlyTargeted,
      queued: result.queued,
      skipped: result.skipped,
      mode: this.mode,
    };
  }

  /**
   * Core of both manual dispatch and the daily birthday sweep: resolve the
   * segment, create CampaignMessage rows for customers not yet targeted by this
   * campaign, and enqueue one campaign-message job per sendable one. Sendable
   * rows are created as `queued`; non-sendable (no phone / opt-out / wrong
   * channel) are created as `skipped` and not enqueued. The worker later flips
   * `queued` → `sent`/`dryrun`.
   */
  private async materializeAndEnqueue(
    companyId: string,
    campaign: {
      id: string;
      channel: CampaignChannel;
      companyName: string;
      segment: CampaignSegment;
      message: string;
    },
  ): Promise<{ matched: number; newlyTargeted: number; queued: number; skipped: number }> {
    const customers = await this.resolveSegment(companyId, campaign.segment);

    // Skip customers already targeted by a previous dispatch of this campaign.
    const already = await this.prisma.client.campaignMessage.findMany({
      where: { campaignId: campaign.id },
      select: { customerId: true },
    });
    const alreadySet = new Set(already.map((m) => m.customerId));
    const targets = customers.filter((c) => !alreadySet.has(c.id));

    let queued = 0;
    let skipped = 0;

    for (const customer of targets) {
      const canSend =
        campaign.channel === CampaignChannel.whatsapp &&
        !!customer.phone &&
        customer.notificationsEnabled !== false &&
        customer.whatsappOptIn !== false;

      if (!canSend) {
        await this.prisma.client.campaignMessage.create({
          data: { campaignId: campaign.id, customerId: customer.id, status: 'skipped' },
        });
        skipped += 1;
        continue;
      }

      const text = this.renderMessage(campaign.message, {
        name: customer.name,
        companyName: campaign.companyName,
      });

      // Create the row first (audit), then enqueue the send keyed on its id.
      const row = await this.prisma.client.campaignMessage.create({
        data: { campaignId: campaign.id, customerId: customer.id, status: 'queued' },
      });
      await this.queues.enqueueCampaignMessage({
        companyId,
        campaignId: campaign.id,
        campaignMessageId: row.id,
        customerId: customer.id,
        text,
      });
      queued += 1;
    }

    return { matched: customers.length, newlyTargeted: targets.length, queued, skipped };
  }

  /**
   * Daily birthday sweep (driven by the campaigns queue repeatable). For every
   * company that has an active WhatsApp campaign whose segment is
   * `birthday_today`, materialize + enqueue today's birthday customers. Returns
   * the total number of messages enqueued across all tenants.
   *
   * We only act on campaigns already marked `sent` or `sending` (i.e. the studio
   * turned this into a running birthday automation) — drafts are left alone.
   */
  async enqueueBirthdayCampaigns(): Promise<number> {
    const campaigns = await this.prisma.client.campaign.findMany({
      where: {
        channel: CampaignChannel.whatsapp,
        status: { in: [CampaignStatus.sent, CampaignStatus.sending] },
      },
      include: { company: { select: { name: true } } },
    });

    let total = 0;
    for (const campaign of campaigns) {
      const stored = (campaign.segmentJson ?? {}) as unknown as StoredSegment;
      const segment = this.normalizeSegment(stored);
      if (segment.kind !== 'birthday_today') continue;
      const message = stored.message?.trim();
      if (!message) continue;

      try {
        const result = await this.materializeAndEnqueue(campaign.companyId, {
          id: campaign.id,
          channel: campaign.channel,
          companyName: campaign.company.name,
          segment,
          message,
        });
        total += result.queued;
      } catch (err) {
        this.logger.error(
          `enqueueBirthdayCampaigns(campaign=${campaign.id}) falhou: ${(err as Error).message}`,
        );
      }
    }
    return total;
  }

  /** How many customers a segment currently matches — for preview UIs. */
  async previewSegment(companyId: string, segment: CampaignSegment) {
    const normalized = this.normalizeSegment(segment);
    const customers = await this.resolveSegment(companyId, normalized);
    return {
      kind: normalized.kind,
      inactiveDays: normalized.inactiveDays,
      count: customers.length,
      withPhone: customers.filter((c) => !!c.phone).length,
    };
  }

  // -------------------------------------------------------------- segments

  private normalizeSegment(segment?: CampaignSegment | null): CampaignSegment {
    const kind = (segment?.kind ?? 'all') as SegmentKind;
    if (!['birthday_today', 'inactive', 'all'].includes(kind)) {
      throw new BadRequestException(`Segmento inválido: ${kind}`);
    }
    if (kind === 'inactive') {
      return {
        kind,
        inactiveDays:
          segment?.inactiveDays && segment.inactiveDays > 0
            ? segment.inactiveDays
            : DEFAULT_INACTIVE_DAYS,
      };
    }
    return { kind };
  }

  /**
   * Turns a segment into the concrete list of active customers it matches,
   * always scoped by companyId.
   */
  private async resolveSegment(
    companyId: string,
    segment: CampaignSegment,
  ): Promise<
    Array<{
      id: string;
      name: string;
      phone: string | null;
      notificationsEnabled: boolean;
      whatsappOptIn: boolean;
    }>
  > {
    const select = {
      id: true,
      name: true,
      phone: true,
      notificationsEnabled: true,
      whatsappOptIn: true,
    } as const;

    const baseWhere: Prisma.CustomerWhereInput = {
      companyId,
      active: true,
      deletedAt: null,
    };

    if (segment.kind === 'all') {
      return this.prisma.client.customer.findMany({
        where: baseWhere,
        select,
      });
    }

    if (segment.kind === 'birthday_today') {
      // Match on month/day of `birthday`. Prisma can't do month/day extraction
      // portably, so pull customers with a birthday and filter in memory (the
      // set is bounded per tenant, and this runs on explicit dispatch, not a
      // hot path).
      const withBirthday = await this.prisma.client.customer.findMany({
        where: { ...baseWhere, birthday: { not: null } },
        select: { ...select, birthday: true },
      });
      const today = new Date();
      const m = today.getMonth();
      const d = today.getDate();
      return withBirthday
        .filter((c) => {
          if (!c.birthday) return false;
          const b = c.birthday;
          return b.getMonth() === m && b.getDate() === d;
        })
        .map(({ birthday: _birthday, ...rest }) => rest);
    }

    // inactive: no appointment in the last N days (and at least one appointment
    // ever, so brand-new customers with zero history aren't "reconquered").
    const days = segment.inactiveDays ?? DEFAULT_INACTIVE_DAYS;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.client.customer.findMany({
      where: {
        ...baseWhere,
        appointments: {
          some: { status: { not: AppointmentStatus.canceled } },
          none: {
            start: { gte: cutoff },
            status: { not: AppointmentStatus.canceled },
          },
        },
      },
      select,
    });
  }

  private renderMessage(
    template: string,
    vars: { name: string; companyName: string },
  ): string {
    return template
      .replace(/%NOME%/gi, vars.name)
      .replace(/%ESTABELECIMENTO%/gi, vars.companyName);
  }
}
