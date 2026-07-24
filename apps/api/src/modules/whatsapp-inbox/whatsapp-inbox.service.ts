import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AppointmentSource,
  AppointmentStatus,
  Prisma,
} from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import {
  WhatsappInbound,
  WhatsappService,
} from '../whatsapp/whatsapp.service';
import {
  UpdateAiAttendantDto,
  UpdateWhatsappConversationDto,
} from './dto';

type Tone = 'simpatico' | 'profissional' | 'direto';
type Faq = { question: string; answer: string };

interface BusinessContext {
  company: {
    name: string;
    timezone: string;
    addressJson: Prisma.JsonValue | null;
    businessHoursJson: Prisma.JsonValue | null;
  };
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    durationMin: number;
    price: string;
  }>;
  professionals: Array<{
    id: string;
    name: string;
    serviceIds: string[];
  }>;
}

interface AiDecision {
  reply: string;
  action: 'none' | 'availability' | 'book' | 'handoff';
  serviceId?: string;
  professionalId?: string;
  date?: string;
  time?: string;
  customerName?: string;
}

interface ReplyPlan {
  text: string;
  kind?: string;
  metadata?: Prisma.InputJsonValue;
  handoff?: boolean;
}

const DEFAULT_GREETING =
  'Olá! Sou a assistente virtual do salão. Como posso ajudar?';
const DEFAULT_AUTOMATIONS = {
  confirm: true,
  reminders: true,
  handoff: true,
};

@Injectable()
export class WhatsappInboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappInboxService.name);
  private unsubscribeInbound: (() => void) | null = null;
  private readonly aiTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly aiRunning = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly appointments: AppointmentsService,
  ) {}

  onModuleInit() {
    this.unsubscribeInbound = this.whatsapp.addInboundHandler((message) =>
      this.captureWhatsappMessage(message),
    );
  }

  onModuleDestroy() {
    this.unsubscribeInbound?.();
    for (const timer of this.aiTimers.values()) clearTimeout(timer);
    this.aiTimers.clear();
  }

  private faq(value: Prisma.JsonValue | null): Faq[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is { question: string; answer: string } =>
          Boolean(
            item &&
              typeof item === 'object' &&
              !Array.isArray(item) &&
              typeof item.question === 'string' &&
              typeof item.answer === 'string',
          ),
      )
      .map((item) => ({
        question: item.question.trim(),
        answer: item.answer.trim(),
      }))
      .filter((item) => item.question && item.answer);
  }

  private async ensureConfig(companyId: string) {
    return this.prisma.client.aiAttendantConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        agentName: 'Duda',
        greeting: DEFAULT_GREETING,
        faqJson: [],
        automationsJson: DEFAULT_AUTOMATIONS,
      },
      update: {},
    });
  }

  async getConfig(companyId: string) {
    const [config, channel] = await Promise.all([
      this.ensureConfig(companyId),
      Promise.resolve(this.whatsapp.getStatus(companyId)),
    ]);
    return {
      ...config,
      tone: config.tone as Tone,
      faq: this.faq(config.faqJson),
      channel,
      aiAvailable: Boolean(process.env.ANTHROPIC_API_KEY),
    };
  }

  async updateConfig(companyId: string, dto: UpdateAiAttendantDto) {
    await this.ensureConfig(companyId);
    const saved = await this.prisma.client.aiAttendantConfig.update({
      where: { companyId },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.agentName !== undefined
          ? { agentName: dto.agentName.trim() || 'Duda' }
          : {}),
        ...(dto.greeting !== undefined
          ? { greeting: dto.greeting.trim() || DEFAULT_GREETING }
          : {}),
        ...(dto.tone !== undefined ? { tone: dto.tone } : {}),
        ...(dto.autoReply !== undefined ? { autoReply: dto.autoReply } : {}),
        ...(dto.bookingViaChat !== undefined
          ? { bookingViaChat: dto.bookingViaChat }
          : {}),
        ...(dto.handoffEnabled !== undefined
          ? { handoffEnabled: dto.handoffEnabled }
          : {}),
        ...(dto.knowledgeBase !== undefined
          ? { knowledgeBase: dto.knowledgeBase.trim() || null }
          : {}),
        ...(dto.faq !== undefined
          ? {
              faqJson: dto.faq
                .map((item) => ({
                  question: item.question.trim(),
                  answer: item.answer.trim(),
                }))
                .filter((item) => item.question && item.answer),
            }
          : {}),
      },
    });
    return {
      ...saved,
      tone: saved.tone as Tone,
      faq: this.faq(saved.faqJson),
      channel: this.whatsapp.getStatus(companyId),
      aiAvailable: Boolean(process.env.ANTHROPIC_API_KEY),
    };
  }

  async stats(companyId: string) {
    const now = new Date();
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const [
      conversationsToday,
      aiMessagesToday,
      totalOpen,
      resolved,
      bookingsViaAi,
      unread,
    ] = await Promise.all([
      this.prisma.client.whatsappConversation.count({
        where: { companyId, lastMessageAt: { gte: today } },
      }),
      this.prisma.client.whatsappInboxMessage.count({
        where: { companyId, sender: 'ai', createdAt: { gte: today } },
      }),
      this.prisma.client.whatsappConversation.count({ where: { companyId } }),
      this.prisma.client.whatsappConversation.count({
        where: { companyId, resolved: true },
      }),
      this.prisma.client.whatsappInboxMessage.count({
        where: {
          companyId,
          kind: 'ai_booking',
          createdAt: { gte: month },
        },
      }),
      this.prisma.client.whatsappConversation.aggregate({
        where: { companyId },
        _sum: { unreadCount: true },
      }),
    ]);
    return {
      conversationsToday,
      aiMessagesToday,
      bookingsViaAi,
      resolutionRate:
        totalOpen > 0 ? Math.round((resolved / totalOpen) * 100) : 0,
      unread: unread._sum.unreadCount ?? 0,
    };
  }

  async listConversations(
    companyId: string,
    filters: { q?: string; status?: string },
  ) {
    const q = filters.q?.trim();
    const status = filters.status;
    const data = await this.prisma.client.whatsappConversation.findMany({
      where: {
        companyId,
        ...(status === 'unread' ? { unreadCount: { gt: 0 } } : {}),
        ...(status === 'resolved' ? { resolved: true } : {}),
        ...(status === 'open' ? { resolved: false } : {}),
        ...(q
          ? {
              OR: [
                { displayName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q.replace(/\D/g, '') || q } },
                { customer: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        customer: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
    });
    return {
      data: data.map((conversation) => ({
        ...conversation,
        name:
          conversation.customer?.name ||
          conversation.displayName ||
          conversation.phone,
      })),
    };
  }

  async listMessages(companyId: string, conversationId: string) {
    await this.findConversation(companyId, conversationId);
    const data = await this.prisma.client.whatsappInboxMessage.findMany({
      where: { companyId, conversationId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    return { data };
  }

  async updateConversation(
    companyId: string,
    id: string,
    dto: UpdateWhatsappConversationDto,
  ) {
    await this.findConversation(companyId, id);
    return this.prisma.client.whatsappConversation.update({
      where: { id },
      data: {
        ...(dto.handledByAi !== undefined
          ? { handledByAi: dto.handledByAi }
          : {}),
        ...(dto.resolved !== undefined ? { resolved: dto.resolved } : {}),
        ...(dto.read ? { unreadCount: 0 } : {}),
      },
      include: {
        customer: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async sendAgentMessage(
    companyId: string,
    conversationId: string,
    rawText: string,
  ) {
    const text = rawText.trim();
    const conversation = await this.findConversation(companyId, conversationId);
    const message = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.whatsappInboxMessage.create({
        data: {
          companyId,
          conversationId,
          direction: 'outbound',
          sender: 'agent',
          text,
          status: 'pending',
          kind: 'manual',
        },
      });
      await tx.whatsappConversation.update({
        where: { id: conversationId },
        data: {
          handledByAi: false,
          resolved: false,
          lastMessageText: text,
          lastMessageAt: new Date(),
          lastOutboundAt: new Date(),
        },
      });
      return created;
    });
    await this.whatsapp.enqueueText(conversation.phone, text, {
      companyId,
      customerId: conversation.customerId ?? undefined,
      kind: 'manual',
      inboxMessageId: message.id,
    });
    return message;
  }

  private async findConversation(companyId: string, id: string) {
    const conversation =
      await this.prisma.client.whatsappConversation.findFirst({
        where: { id, companyId },
      });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    return conversation;
  }

  private digitsTail(value: string): string {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 8 ? digits.slice(-8) : digits;
  }

  private async findCustomerByPhone(companyId: string, phone: string) {
    const tail = this.digitsTail(phone);
    if (!tail) return null;
    const candidates = await this.prisma.client.customer.findMany({
      where: {
        companyId,
        phone: { not: null },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        notificationsEnabled: true,
        whatsappOptIn: true,
      },
      take: 5000,
    });
    return (
      candidates.find(
        (customer) => this.digitsTail(customer.phone ?? '') === tail,
      ) ?? null
    );
  }

  /**
   * Entrada única do Baileys. Persiste tanto mensagens do cliente quanto as
   * enviadas pelo celular conectado; mensagens administrativas do número do
   * gerente continuam no fluxo 1/2/3 e não poluem o inbox de clientes.
   */
  private async captureWhatsappMessage(message: WhatsappInbound): Promise<void> {
    try {
      if (
        await this.whatsapp.isManagerPhone(
          message.companyId,
          message.fromDigits,
        )
      ) {
        return;
      }
      if (message.messageId) {
        const duplicate =
          await this.prisma.client.whatsappInboxMessage.findFirst({
            where: {
              companyId: message.companyId,
              whatsappMessageId: message.messageId,
            },
            select: { id: true },
          });
        if (duplicate) return;
      }

      const customer = await this.findCustomerByPhone(
        message.companyId,
        message.fromDigits,
      );
      const receivedAt = message.timestamp;
      // Um envio iniciado pela própria caixa (IA/atendente) também volta no
      // events.upsert do Baileys como `fromMe`. Reconhecemos o balão pending
      // antes do upsert para não duplicá-lo e, sobretudo, para não pausar a IA
      // quando a própria IA acabou de responder.
      const pendingOutbound = message.fromMe
        ? await this.prisma.client.whatsappInboxMessage.findFirst({
            where: {
              companyId: message.companyId,
              direction: 'outbound',
              status: 'pending',
              text: message.text,
              conversation: { remoteJid: message.remoteJid },
            },
            orderBy: { createdAt: 'desc' },
          })
        : null;
      const conversation =
        await this.prisma.client.whatsappConversation.upsert({
          where: {
            companyId_remoteJid: {
              companyId: message.companyId,
              remoteJid: message.remoteJid,
            },
          },
          create: {
            companyId: message.companyId,
            remoteJid: message.remoteJid,
            phone: message.fromDigits,
            displayName:
              customer?.name || message.pushName?.trim() || message.fromDigits,
            customerId: customer?.id,
            unreadCount: message.fromMe ? 0 : 1,
            lastMessageText: message.text,
            lastMessageAt: receivedAt,
            ...(message.fromMe
              ? {
                  lastOutboundAt: receivedAt,
                  ...(pendingOutbound?.sender === 'ai'
                    ? {}
                    : { handledByAi: false }),
                }
              : { lastInboundAt: receivedAt }),
          },
          update: {
            phone: message.fromDigits,
            ...(customer?.id ? { customerId: customer.id } : {}),
            ...(message.pushName?.trim()
              ? { displayName: message.pushName.trim() }
              : {}),
            ...(message.fromMe
              ? {
                  lastOutboundAt: receivedAt,
                  ...(pendingOutbound?.sender === 'ai'
                    ? {}
                    : { handledByAi: false }),
                }
              : {
                  lastInboundAt: receivedAt,
                  unreadCount: { increment: 1 },
                  resolved: false,
                }),
            lastMessageText: message.text,
            lastMessageAt: receivedAt,
          },
        });

      if (pendingOutbound) {
        await this.prisma.client.whatsappInboxMessage.update({
          where: { id: pendingOutbound.id },
          data: {
            whatsappMessageId:
              message.messageId ?? pendingOutbound.whatsappMessageId,
            status: 'sent',
            sentAt: receivedAt,
          },
        });
        return;
      }

      await this.prisma.client.whatsappInboxMessage.create({
        data: {
          companyId: message.companyId,
          conversationId: conversation.id,
          whatsappMessageId: message.messageId,
          direction: message.fromMe ? 'outbound' : 'inbound',
          sender: message.fromMe ? 'agent' : 'customer',
          text: message.text,
          status: message.fromMe ? 'sent' : 'received',
          kind: message.kind ?? 'text',
          metadataJson: message.metadata,
          sentAt: message.fromMe ? receivedAt : null,
          receivedAt: message.fromMe ? null : receivedAt,
        },
      });

      if (!message.fromMe) {
        this.scheduleAiReply(message.companyId, conversation.id);
      }
    } catch (err) {
      this.logger.error(
        `Falha ao persistir mensagem WhatsApp: ${(err as Error).message}`,
      );
    }
  }

  private scheduleAiReply(companyId: string, conversationId: string) {
    const previous = this.aiTimers.get(conversationId);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.aiTimers.delete(conversationId);
      void this.maybeReplyWithAi(companyId, conversationId);
    }, 2200);
    this.aiTimers.set(conversationId, timer);
  }

  private async maybeReplyWithAi(
    companyId: string,
    conversationId: string,
  ) {
    if (this.aiRunning.has(conversationId)) {
      // Uma nova mensagem chegou enquanto a decisão anterior ainda estava em
      // andamento. Mantém um retry debounced para ela não ficar sem resposta.
      this.scheduleAiReply(companyId, conversationId);
      return;
    }
    this.aiRunning.add(conversationId);
    try {
      const [config, conversation, history] = await Promise.all([
        this.ensureConfig(companyId),
        this.prisma.client.whatsappConversation.findFirst({
          where: { id: conversationId, companyId },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                notificationsEnabled: true,
                whatsappOptIn: true,
              },
            },
          },
        }),
        this.prisma.client.whatsappInboxMessage.findMany({
          where: { companyId, conversationId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);
      if (!conversation || history.length === 0) return;
      if (!config.enabled || !config.autoReply || !conversation.handledByAi) {
        return;
      }
      if (
        conversation.customer?.notificationsEnabled === false ||
        conversation.customer?.whatsappOptIn === false
      ) {
        return;
      }
      const chronological = [...history].reverse();
      const triggerMessage = chronological.at(-1);
      if (triggerMessage?.sender !== 'customer') return;

      const context = await this.businessContext(companyId);
      const decision = await this.aiDecision(
        config,
        conversation,
        chronological,
        context,
      );
      // A chamada do modelo pode levar segundos. Se o cliente falou novamente
      // nesse intervalo, descarta a resposta agora desatualizada e reprocessa
      // todo o contexto depois do debounce. Isso também impede agendar algo
      // após um "não, cancela" que chegou durante a decisão.
      const latestMessage =
        await this.prisma.client.whatsappInboxMessage.findFirst({
          where: { companyId, conversationId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
      if (latestMessage?.id !== triggerMessage.id) {
        this.scheduleAiReply(companyId, conversationId);
        return;
      }
      const plan = await this.executeDecision(
        companyId,
        conversation,
        config,
        context,
        decision,
      );
      if (!plan.text.trim()) return;
      await this.sendAiMessage(companyId, conversation, plan);
      if (plan.handoff) {
        await this.prisma.client.whatsappConversation.update({
          where: { id: conversation.id },
          data: { handledByAi: false },
        });
      }
    } catch (err) {
      this.logger.error(
        `IA da conversa ${conversationId} falhou: ${(err as Error).message}`,
      );
    } finally {
      this.aiRunning.delete(conversationId);
    }
  }

  private async businessContext(companyId: string): Promise<BusinessContext> {
    const [company, services, professionals] = await Promise.all([
      this.prisma.client.company.findUniqueOrThrow({
        where: { id: companyId },
        select: {
          name: true,
          timezone: true,
          addressJson: true,
          businessHoursJson: true,
        },
      }),
      this.prisma.client.service.findMany({
        where: {
          companyId,
          active: true,
          visible: true,
          onlineBookable: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          description: true,
          durationMin: true,
          price: true,
        },
        orderBy: [{ favorite: 'desc' }, { name: 'asc' }],
        take: 80,
      }),
      this.prisma.client.professional.findMany({
        where: {
          companyId,
          active: true,
          onlineBookable: true,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          services: { select: { serviceId: true } },
        },
        orderBy: { name: 'asc' },
        take: 80,
      }),
    ]);
    return {
      company,
      services: services.map((service) => ({
        ...service,
        price: service.price.toFixed(2),
      })),
      professionals: professionals.map((professional) => ({
        id: professional.id,
        name: professional.name,
        serviceIds: professional.services.map((item) => item.serviceId),
      })),
    };
  }

  private async aiDecision(
    config: {
      agentName: string;
      greeting: string;
      tone: string;
      knowledgeBase: string | null;
      faqJson: Prisma.JsonValue | null;
      bookingViaChat: boolean;
      handoffEnabled: boolean;
    },
    conversation: { displayName: string | null },
    history: Array<{ sender: string; text: string }>,
    context: BusinessContext,
  ): Promise<AiDecision> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return this.fallbackDecision(config, history, context);
    }

    const faq = this.faq(config.faqJson);
    const today = this.ymd(new Date(), context.company.timezone);
    const compactContext = {
      today,
      timezone: context.company.timezone,
      salon: context.company,
      services: context.services,
      professionals: context.professionals,
      knowledgeBase: config.knowledgeBase,
      faq,
    };
    const system = [
      `Você é ${config.agentName}, recepcionista virtual do ${context.company.name}.`,
      `Fale em português do Brasil, tom ${config.tone}, de forma curta e natural.`,
      `Saudação configurada para primeiro contato: ${config.greeting}`,
      `Nome visível do contato: ${conversation.displayName ?? 'cliente'}.`,
      'Use SOMENTE os dados fornecidos. Nunca invente preço, profissional, horário ou confirmação.',
      config.bookingViaChat
        ? 'Você pode consultar disponibilidade e agendar.'
        : 'Agendamento pelo chat está desativado; apenas informe e ofereça atendimento humano.',
      config.handoffEnabled
        ? 'Se o cliente pedir uma pessoa ou faltar informação confiável, use action="handoff".'
        : 'Não transfira automaticamente.',
      'Só use action="book" quando o cliente confirmar explicitamente serviço, data e horário.',
      'Para apenas procurar horários use action="availability".',
      'Pedidos de cancelamento ou remarcação exigem validação humana: use action="handoff".',
      'Responda APENAS JSON válido, sem markdown, neste formato:',
      '{"reply":"texto","action":"none|availability|book|handoff","serviceId":"opcional","professionalId":"opcional","date":"YYYY-MM-DD opcional","time":"HH:mm opcional","customerName":"opcional"}',
      `DADOS DO SALÃO:\n${JSON.stringify(compactContext)}`,
    ].join('\n');
    const messages = this.anthropicHistory(history);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:
            process.env.ANTHROPIC_WHATSAPP_MODEL ??
            'claude-haiku-4-5-20251001',
          max_tokens: 900,
          temperature: 0.2,
          system,
          messages,
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Anthropic ${response.status}: ${body.slice(0, 200)}`);
      }
      const json = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
      };
      const raw =
        json.content
          ?.filter((item) => item.type === 'text')
          .map((item) => item.text ?? '')
          .join('\n') ?? '';
      return this.parseDecision(raw);
    } catch (err) {
      this.logger.warn(
        `Anthropic indisponível; usando fallback: ${(err as Error).message}`,
      );
      return this.fallbackDecision(config, history, context);
    }
  }

  private anthropicHistory(history: Array<{ sender: string; text: string }>) {
    const rows = history.slice(-16).map((message) => ({
      role:
        message.sender === 'customer'
          ? ('user' as const)
          : ('assistant' as const),
      content: message.text.slice(0, 4000),
    }));
    const merged: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [];
    for (const row of rows) {
      const previous = merged.at(-1);
      if (previous?.role === row.role) previous.content += `\n${row.content}`;
      else merged.push({ ...row });
    }
    if (merged[0]?.role === 'assistant') merged.shift();
    return merged;
  }

  private parseDecision(raw: string): AiDecision {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('Resposta da IA sem JSON');
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Partial<AiDecision>;
    const actions = ['none', 'availability', 'book', 'handoff'] as const;
    const action = actions.includes(parsed.action as (typeof actions)[number])
      ? (parsed.action as AiDecision['action'])
      : 'none';
    return {
      reply:
        typeof parsed.reply === 'string' && parsed.reply.trim()
          ? parsed.reply.trim()
          : 'Como posso ajudar?',
      action,
      ...(typeof parsed.serviceId === 'string'
        ? { serviceId: parsed.serviceId }
        : {}),
      ...(typeof parsed.professionalId === 'string'
        ? { professionalId: parsed.professionalId }
        : {}),
      ...(typeof parsed.date === 'string' ? { date: parsed.date } : {}),
      ...(typeof parsed.time === 'string' ? { time: parsed.time } : {}),
      ...(typeof parsed.customerName === 'string'
        ? { customerName: parsed.customerName }
        : {}),
    };
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  private fallbackDecision(
    config: {
      greeting: string;
      knowledgeBase: string | null;
      faqJson: Prisma.JsonValue | null;
      bookingViaChat: boolean;
      handoffEnabled: boolean;
    },
    history: Array<{ sender: string; text: string }>,
    context: BusinessContext,
  ): AiDecision {
    const latest = history.at(-1)?.text ?? '';
    const allCustomerText = history
      .filter((message) => message.sender === 'customer')
      .slice(-8)
      .map((message) => message.text)
      .join(' ');
    const normalized = this.normalize(latest);
    const tokens = new Set(
      normalized.split(/\W+/).filter((token) => token.length >= 3),
    );
    const faqMatch = this.faq(config.faqJson)
      .map((item) => ({
        item,
        score: this.normalize(item.question)
          .split(/\W+/)
          .filter((token) => tokens.has(token)).length,
      }))
      .sort((a, b) => b.score - a.score)[0];
    if (faqMatch && faqMatch.score >= 1) {
      return { reply: faqMatch.item.answer, action: 'none' };
    }
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite)\b/.test(normalized)) {
      return { reply: config.greeting || DEFAULT_GREETING, action: 'none' };
    }
    if (/cancel|desmarc|remarc|reagend/.test(normalized)) {
      return {
        reply:
          'Vou chamar uma pessoa da equipe para confirmar essa alteração com segurança.',
        action: config.handoffEnabled ? 'handoff' : 'none',
      };
    }

    const joined = this.normalize(allCustomerText);
    const service = context.services.find((item) =>
      joined.includes(this.normalize(item.name)),
    );
    const professional = context.professionals.find((item) =>
      joined.includes(this.normalize(item.name)),
    );
    const date = this.parseDate(allCustomerText, context.company.timezone);
    const timeMatch = allCustomerText.match(
      /(?:às?|as)?\s*(\d{1,2})(?::|h)(\d{2})?\b/i,
    );
    const time = timeMatch
      ? `${timeMatch[1].padStart(2, '0')}:${(timeMatch[2] ?? '00').padStart(2, '0')}`
      : undefined;
    const bookingIntent =
      /agend|marc|reserv|horari|horári|dispon|vaga/.test(joined);

    if (config.bookingViaChat && bookingIntent) {
      if (!service) {
        return {
          reply: `Qual serviço você quer marcar? Temos: ${context.services
            .slice(0, 8)
            .map((item) => item.name)
            .join(', ')}.`,
          action: 'none',
        };
      }
      if (!date) {
        return {
          reply: `Para qual dia você quer ${service.name}?`,
          action: 'none',
        };
      }
      const selectedProfessional =
        professional ??
        context.professionals.find((item) =>
          item.serviceIds.includes(service.id),
        );
      if (!selectedProfessional) {
        return {
          reply:
            'Não encontrei um profissional disponível para esse serviço. Vou chamar a equipe.',
          action: config.handoffEnabled ? 'handoff' : 'none',
        };
      }
      return {
        reply: time
          ? 'Vou confirmar esse horário na agenda.'
          : 'Vou consultar os horários livres.',
        action: time ? 'book' : 'availability',
        serviceId: service.id,
        professionalId: selectedProfessional.id,
        date,
        time,
      };
    }

    if (/preco|preço|valor|quanto|servico|serviço/.test(normalized)) {
      return {
        reply: context.services
          .slice(0, 10)
          .map(
            (item) =>
              `${item.name}: ${Number(item.price).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}`,
          )
          .join('\n'),
        action: 'none',
      };
    }
    if (config.knowledgeBase?.trim()) {
      return {
        reply: `${config.knowledgeBase.trim().slice(0, 700)}`,
        action: 'none',
      };
    }
    return {
      reply: config.handoffEnabled
        ? 'Não tenho certeza dessa informação. Vou chamar uma pessoa da equipe para continuar com você.'
        : 'Não tenho essa informação agora. Pode explicar um pouco mais?',
      action: config.handoffEnabled ? 'handoff' : 'none',
    };
  }

  private parseDate(text: string, timezone: string): string | undefined {
    const normalized = this.normalize(text);
    if (normalized.includes('amanha')) {
      return this.ymd(new Date(Date.now() + 24 * 60 * 60 * 1000), timezone);
    }
    if (normalized.includes('hoje')) return this.ymd(new Date(), timezone);
    const match = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (!match) return undefined;
    const currentYear = Number(this.ymd(new Date(), timezone).slice(0, 4));
    let year = match[3] ? Number(match[3]) : currentYear;
    if (year < 100) year += 2000;
    return `${year}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  private ymd(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    return `${values.year}-${values.month}-${values.day}`;
  }

  private async executeDecision(
    companyId: string,
    conversation: {
      id: string;
      phone: string;
      customerId: string | null;
      displayName: string | null;
    },
    config: { bookingViaChat: boolean; handoffEnabled: boolean },
    context: BusinessContext,
    decision: AiDecision,
  ): Promise<ReplyPlan> {
    if (decision.action === 'handoff') {
      return {
        text: decision.reply,
        kind: 'ai_handoff',
        handoff: config.handoffEnabled,
      };
    }
    if (
      !config.bookingViaChat ||
      (decision.action !== 'availability' && decision.action !== 'book')
    ) {
      return { text: decision.reply, kind: 'ai_reply' };
    }

    const service = context.services.find(
      (item) => item.id === decision.serviceId,
    );
    let professional = context.professionals.find(
      (item) => item.id === decision.professionalId,
    );
    if (!service || !decision.date) {
      return {
        text:
          decision.reply ||
          'Preciso do serviço e da data para consultar a agenda.',
        kind: 'ai_reply',
      };
    }
    if (!professional || !professional.serviceIds.includes(service.id)) {
      professional = context.professionals.find((item) =>
        item.serviceIds.includes(service.id),
      );
    }
    if (!professional) {
      return {
        text:
          'Não encontrei um profissional cadastrado para esse serviço. Vou chamar a equipe.',
        kind: 'ai_handoff',
        handoff: config.handoffEnabled,
      };
    }

    const availability = await this.appointments.availability(
      companyId,
      service.id,
      professional.id,
      decision.date,
    );
    const slots = availability.slots;
    if (!slots.length) {
      return {
        text: `Não encontrei horário livre para ${service.name} com ${professional.name} nesse dia. Quer tentar outra data?`,
        kind: 'ai_reply',
      };
    }
    const timeOf = (iso: string) =>
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: context.company.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(iso));

    if (decision.action === 'availability' || !decision.time) {
      const options = slots.slice(0, 6).map((slot) => timeOf(slot.start));
      return {
        text: `Tenho estes horários com ${professional.name}: ${options.join(', ')}. Qual você prefere?`,
        kind: 'ai_availability',
      };
    }

    const wanted = decision.time.slice(0, 5).padStart(5, '0');
    const selected = slots.find((slot) => timeOf(slot.start) === wanted);
    if (!selected) {
      const options = slots.slice(0, 6).map((slot) => timeOf(slot.start));
      return {
        text: `Esse horário não está livre. Posso oferecer: ${options.join(', ')}. Qual você prefere?`,
        kind: 'ai_availability',
      };
    }

    const customerId = await this.ensureConversationCustomer(
      companyId,
      conversation,
      decision.customerName,
    );
    try {
      const appointment = await this.appointments.create(
        companyId,
        {
          customerId,
          professionalId: professional.id,
          start: selected.start,
          items: [
            {
              serviceId: service.id,
              professionalId: professional.id,
            },
          ],
          // A própria resposta da IA já confirma o horário; evita uma segunda
          // mensagem automática com o mesmo conteúdo.
          notifyConfirmation: false,
        },
        {
          source: AppointmentSource.online,
          status: AppointmentStatus.confirmed,
        },
      );
      const dateLabel = new Intl.DateTimeFormat('pt-BR', {
        timeZone: context.company.timezone,
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      }).format(new Date(selected.start));
      return {
        text: `Pronto! ${service.name} com ${professional.name} ficou agendado para ${dateLabel}, às ${timeOf(selected.start)}. ✅`,
        kind: 'ai_booking',
        metadata: { appointmentId: appointment.id },
      };
    } catch {
      return {
        text:
          'Esse horário acabou de ficar indisponível. Quer que eu consulte outras opções?',
        kind: 'ai_availability',
      };
    }
  }

  private async ensureConversationCustomer(
    companyId: string,
    conversation: {
      id: string;
      phone: string;
      customerId: string | null;
      displayName: string | null;
    },
    requestedName?: string,
  ): Promise<string> {
    if (conversation.customerId) return conversation.customerId;
    const existing = await this.findCustomerByPhone(
      companyId,
      conversation.phone,
    );
    if (existing) {
      await this.prisma.client.whatsappConversation.update({
        where: { id: conversation.id },
        data: { customerId: existing.id },
      });
      return existing.id;
    }
    const created = await this.prisma.client.customer.create({
      data: {
        companyId,
        name:
          requestedName?.trim() ||
          conversation.displayName?.trim() ||
          `WhatsApp ${conversation.phone}`,
        phone: conversation.phone,
        notificationsEnabled: true,
        whatsappOptIn: true,
      },
      select: { id: true },
    });
    await this.prisma.client.whatsappConversation.update({
      where: { id: conversation.id },
      data: { customerId: created.id },
    });
    return created.id;
  }

  private async sendAiMessage(
    companyId: string,
    conversation: {
      id: string;
      phone: string;
      customerId: string | null;
    },
    plan: ReplyPlan,
  ) {
    const message = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.whatsappInboxMessage.create({
        data: {
          companyId,
          conversationId: conversation.id,
          direction: 'outbound',
          sender: 'ai',
          text: plan.text,
          status: 'pending',
          kind: plan.kind ?? 'ai_reply',
          metadataJson: plan.metadata,
        },
      });
      await tx.whatsappConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageText: plan.text,
          lastMessageAt: new Date(),
          lastOutboundAt: new Date(),
        },
      });
      return created;
    });
    await this.whatsapp.enqueueText(conversation.phone, plan.text, {
      companyId,
      customerId: conversation.customerId ?? undefined,
      kind: 'ai',
      inboxMessageId: message.id,
    });
  }
}
