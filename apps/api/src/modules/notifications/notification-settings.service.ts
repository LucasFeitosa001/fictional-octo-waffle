import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type ConfirmationTemplate,
  type ConfirmationTemplateSettings,
} from './confirmation.templates';
import { type CancellationTemplateSettings } from './cancellation.templates';
import {
  MESSAGE_TEMPLATE_SPECS,
  type MessageTemplateKind,
  type MessageTemplateSpec,
} from './message-templates';

/**
 * Per-company toggles for the AUTOMATIC client-facing WhatsApp/email messages.
 *
 * This is a SECOND lock on top of the env-level NOTIFICATIONS_MODE /
 * WHATSAPP_ENABLED gate (see messaging.helpers.ts). Even with the transport
 * "live", the salon owner can silence a whole class of automatic client
 * messages here — the recurring complaint was too many confirmation/cancel
 * messages hitting the customer.
 *
 * Persisted in the generic Setting table (one row per company) under a single
 * key, so no schema migration is needed.
 */
export const NOTIFICATION_AUTOMATION_KEY = 'notifications.automation';

export interface NotificationAutomationSettings {
  /** Send the client a WhatsApp/email on appointment created/confirmed. */
  confirmation: boolean;
  /** Send the client a WhatsApp/email when the appointment is canceled. */
  cancellation: boolean;
  /** Send the client the 24h/2h-before reminder. */
  reminder: boolean;
  /** Send the client the post-service follow-up ("como foi seu atendimento?"). */
  followUp: boolean;
  /**
   * Notify the PROFESSIONAL/manager over WhatsApp about a new appointment (the
   * "📋 Novo agendamento para você!" heads-up, and the manager heads-up on the
   * online booking flow). OFF by default — the salon opts in.
   */
  notifyProfessional: boolean;
}

/**
 * DEFAULT when the company never touched the setting: EVERYTHING OFF.
 * No automatic WhatsApp/email leaves the salon (client OR professional/manager)
 * until the owner explicitly opts in. This is the hard "nothing goes out by
 * default" guarantee — confirmation, cancellation, reminder, follow-up and the
 * professional heads-up all start OFF.
 */
export const NOTIFICATION_AUTOMATION_DEFAULTS: NotificationAutomationSettings = {
  confirmation: false,
  cancellation: false,
  reminder: false,
  followUp: false,
  notifyProfessional: false,
};

/**
 * Rich, per-company configuration of the post-service follow-up ("lembrete de
 * retorno"). Lives under its OWN Setting key (notifications.followup) rather than
 * inside notifications.automation, because that key is a tight dictionary of four
 * booleans (persisted as Record<string, boolean>). Mixing a string template and
 * numbers there would break its normalize/serialization contract, so the follow-up
 * gets a dedicated key.
 *
 * The `enabled` flag here is the SAME on/off switch as automation.followUp — the
 * two are kept in sync (see NotificationSettingsService.updateFollowUp / update),
 * so the processor can keep reading auto.followUp unchanged while the UI edits the
 * whole config through this key.
 */
export const NOTIFICATION_FOLLOWUP_KEY = 'notifications.followup';

/**
 * Time units the owner can pick for the delay and the recurrence interval. The
 * whole point of exposing seconds/minutes is to fire jobs FAST while testing the
 * BullMQ cron/delay plumbing (a 24h delay is impossible to eyeball). Everything
 * is normalized to seconds internally (delaySeconds / recurringSeconds) so the
 * queue math is unit-agnostic.
 */
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

/** Seconds per unit — the single conversion table used everywhere. */
export const TIME_UNIT_SECONDS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 60 * 60,
  days: 24 * 60 * 60,
};

const TIME_UNITS: TimeUnit[] = ['seconds', 'minutes', 'hours', 'days'];

/** Lower bound (seconds) for any delay/interval — low enough to test cron jobs. */
export const MIN_DELAY_SECONDS = 5;
/** Upper bound (seconds) ≈ 1 year, matching the old delayHours clamp. */
export const MAX_DELAY_SECONDS = 365 * 24 * 60 * 60;

export interface FollowUpSettings {
  /** Master on/off — mirrors automation.followUp (default FALSE, opt-in). */
  enabled: boolean;
  /**
   * Message template. Supports the variables {cliente} (first name),
   * {estabelecimento}, {servico} (services) and {link} (booking link — only
   * substituted when includeBookingLink is on and a slug exists). Empty string
   * ("" ) means "use the built-in default text".
   */
  message: string;
  /**
   * How long after the service to send the first follow-up, as a value + unit.
   * `delayValue: 24, delayUnit: 'hours'` = one day. Use `seconds` to test jobs.
   */
  delayValue: number;
  delayUnit: TimeUnit;
  /**
   * Canonical delay in SECONDS (derived from delayValue/delayUnit). This is what
   * the queue reads; the value/unit pair is just the human-friendly editing form.
   */
  delaySeconds: number;
  /**
   * DEPRECATED compat field: the old "delay in hours" number. Kept in the shape
   * (derived from delaySeconds) so any legacy reader/round-trip still works.
   */
  delayHours: number;
  /** Repeat the follow-up on a cadence? (default false) */
  recurring: boolean;
  /**
   * If recurring, how long between sends, as value + unit (default 30 days). Use
   * `seconds`/`minutes` to test recurrence quickly.
   */
  recurringValue: number;
  recurringUnit: TimeUnit;
  /** Canonical recurrence interval in SECONDS (derived from value/unit). */
  recurringSeconds: number;
  /** DEPRECATED compat field: the old "every N days" number (derived). */
  recurringDays: number;
  /** Hard cap on how many follow-ups a single visit can generate (default 3). */
  maxRecurrences: number;
  /** Append the re-booking link to the message (default true). */
  includeBookingLink: boolean;
}

/**
 * DEFAULTS: OFF (opt-in), no custom text (falls back to the built-in copy), 24h
 * delay, not recurring, and — if the owner later turns recurrence on — every 30
 * days capped at 3 sends, with the booking link attached. The follow-up only
 * fires after the owner explicitly enables it.
 */
export const NOTIFICATION_FOLLOWUP_DEFAULTS: FollowUpSettings = {
  enabled: false,
  message: '',
  delayValue: 24,
  delayUnit: 'hours',
  delaySeconds: 24 * 60 * 60,
  delayHours: 24,
  recurring: false,
  recurringValue: 30,
  recurringUnit: 'days',
  recurringSeconds: 30 * 24 * 60 * 60,
  recurringDays: 30,
  maxRecurrences: 3,
  includeBookingLink: true,
};

@Injectable()
export class NotificationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Reads the company's automation toggles, applying defaults for anything missing. */
  async get(companyId: string): Promise<NotificationAutomationSettings> {
    const row = await this.prisma.client.setting.findUnique({
      where: { companyId_key: { companyId, key: NOTIFICATION_AUTOMATION_KEY } },
    });
    const stored =
      (row?.valueJson as Partial<NotificationAutomationSettings> | null) ?? {};
    return this.normalize(stored);
  }

  /**
   * Upserts a partial patch of the four booleans, merged over the current
   * (defaults-applied) values. Idempotent — writing the same patch twice yields
   * the same row. Ignores any keys that aren't one of the four toggles.
   *
   * When `followUp` is included, the follow-up config's `enabled` flag is kept in
   * sync so the two representations of the same switch never diverge.
   */
  async update(
    companyId: string,
    patch: Partial<NotificationAutomationSettings>,
  ): Promise<NotificationAutomationSettings> {
    const current = await this.get(companyId);
    const merged = this.normalize({ ...current, ...patch });
    // Prisma's JSON input wants an index-signature object; the typed interface
    // doesn't structurally satisfy InputJsonObject, so retype it as a plain map.
    const valueJson: Record<string, boolean> = {
      confirmation: merged.confirmation,
      cancellation: merged.cancellation,
      reminder: merged.reminder,
      followUp: merged.followUp,
      notifyProfessional: merged.notifyProfessional,
    };
    await this.prisma.client.setting.upsert({
      where: { companyId_key: { companyId, key: NOTIFICATION_AUTOMATION_KEY } },
      create: { companyId, key: NOTIFICATION_AUTOMATION_KEY, valueJson },
      update: { valueJson },
    });
    // Mirror the toggle into the rich follow-up config (keep both in sync).
    if (typeof patch.followUp === 'boolean') {
      await this.writeFollowUp(companyId, { enabled: merged.followUp });
    }
    return merged;
  }

  // ------------------------------------------------------- follow-up config

  /**
   * Reads the company's rich follow-up config, applying defaults for anything
   * missing. `enabled` is reconciled with automation.followUp so a legacy company
   * that only ever toggled the boolean still gets a coherent config.
   */
  async getFollowUp(companyId: string): Promise<FollowUpSettings> {
    const [row, auto] = await Promise.all([
      this.prisma.client.setting.findUnique({
        where: { companyId_key: { companyId, key: NOTIFICATION_FOLLOWUP_KEY } },
      }),
      this.get(companyId),
    ]);
    const stored = (row?.valueJson as Partial<FollowUpSettings> | null) ?? {};
    // If the follow-up row was never written, trust automation.followUp for the
    // enabled flag; otherwise the stored value wins.
    const enabled =
      typeof stored.enabled === 'boolean' ? stored.enabled : auto.followUp;
    return this.normalizeFollowUp({ ...stored, enabled });
  }

  /**
   * Upserts a partial patch of the follow-up config, merged over the current
   * (defaults-applied) values. Idempotent. When `enabled` is included, the
   * automation.followUp boolean is mirrored so the plain toggle stays in sync.
   */
  async updateFollowUp(
    companyId: string,
    patch: Partial<FollowUpSettings>,
  ): Promise<FollowUpSettings> {
    const current = await this.getFollowUp(companyId);
    const merged = this.normalizeFollowUp({ ...current, ...patch });
    await this.writeFollowUp(companyId, merged);
    // Mirror the enabled flag back into automation.followUp (avoid recursion by
    // writing that row directly rather than calling update()).
    if (typeof patch.enabled === 'boolean') {
      const auto = await this.get(companyId);
      if (auto.followUp !== merged.enabled) {
        const valueJson: Record<string, boolean> = {
          confirmation: auto.confirmation,
          cancellation: auto.cancellation,
          reminder: auto.reminder,
          followUp: merged.enabled,
          notifyProfessional: auto.notifyProfessional,
        };
        await this.prisma.client.setting.upsert({
          where: { companyId_key: { companyId, key: NOTIFICATION_AUTOMATION_KEY } },
          create: { companyId, key: NOTIFICATION_AUTOMATION_KEY, valueJson },
          update: { valueJson },
        });
      }
    }
    return merged;
  }

  /** Writes (partial or full) follow-up config to its Setting row. */
  private async writeFollowUp(
    companyId: string,
    patch: Partial<FollowUpSettings>,
  ): Promise<void> {
    const current = await this.getFollowUp(companyId);
    const merged = this.normalizeFollowUp({ ...current, ...patch });
    const valueJson: Record<string, string | number | boolean> = {
      enabled: merged.enabled,
      message: merged.message,
      // Persist the canonical seconds + the value/unit editing pair. We keep
      // delayHours/recurringDays too so an older reader stays compatible.
      delayValue: merged.delayValue,
      delayUnit: merged.delayUnit,
      delaySeconds: merged.delaySeconds,
      delayHours: merged.delayHours,
      recurring: merged.recurring,
      recurringValue: merged.recurringValue,
      recurringUnit: merged.recurringUnit,
      recurringSeconds: merged.recurringSeconds,
      recurringDays: merged.recurringDays,
      maxRecurrences: merged.maxRecurrences,
      includeBookingLink: merged.includeBookingLink,
    };
    await this.prisma.client.setting.upsert({
      where: { companyId_key: { companyId, key: NOTIFICATION_FOLLOWUP_KEY } },
      create: { companyId, key: NOTIFICATION_FOLLOWUP_KEY, valueJson },
      update: { valueJson },
    });
  }

  // ------------------------------------------------------ modelos de mensagem
  //
  // UM mecanismo para os quatro tipos (confirmação, cancelamento, lembrete de
  // véspera, lembrete de poucas horas). Os embutidos do código são mesclados POR
  // CIMA dos customizados gravados, então JSON velho/corrompido nunca apaga o
  // padrão seguro. Modelo de texto NÃO liga automação — a autorização de envio
  // continua sendo o padrão da conta ou o toggle do agendamento. Ver estudo 61.

  async getTemplates(
    companyId: string,
    kind: MessageTemplateKind,
  ): Promise<ConfirmationTemplateSettings> {
    const spec = MESSAGE_TEMPLATE_SPECS[kind];
    const row = await this.prisma.client.setting.findUnique({
      where: { companyId_key: { companyId, key: spec.settingKey } },
    });
    const stored =
      (row?.valueJson as {
        defaultTemplateId?: unknown;
        templates?: unknown;
      } | null) ?? {};
    const custom = this.normalizeCustomTemplates(stored.templates, spec);
    const templates = [
      ...spec.builtIns.map((template) => ({ ...template })),
      ...custom,
    ];
    const requested =
      typeof stored.defaultTemplateId === 'string'
        ? stored.defaultTemplateId
        : spec.defaultTemplateId;
    return {
      defaultTemplateId: templates.some((template) => template.id === requested)
        ? requested
        : spec.defaultTemplateId,
      templates,
    };
  }

  /**
   * Substitui a coleção de modelos customizados da empresa numa escrita
   * idempotente. Os embutidos nunca são gravados/sobrescritos, e o limite de 20
   * impede esse Setting de virar um depósito de mensagens.
   */
  async updateTemplates(
    companyId: string,
    kind: MessageTemplateKind,
    input: { defaultTemplateId?: unknown; templates?: unknown },
  ): Promise<ConfirmationTemplateSettings> {
    const spec = MESSAGE_TEMPLATE_SPECS[kind];
    const custom = this.normalizeCustomTemplates(input.templates, spec);
    const ids = new Set([
      ...spec.builtIns.map((template) => template.id),
      ...custom.map((template) => template.id),
    ]);
    const defaultTemplateId =
      typeof input.defaultTemplateId === 'string' &&
      ids.has(input.defaultTemplateId)
        ? input.defaultTemplateId
        : spec.defaultTemplateId;
    const valueJson = {
      defaultTemplateId,
      templates: custom.map(({ id, label, message }) => ({
        id,
        label,
        message,
      })),
    };
    await this.prisma.client.setting.upsert({
      where: { companyId_key: { companyId, key: spec.settingKey } },
      create: { companyId, key: spec.settingKey, valueJson },
      update: { valueJson },
    });
    return {
      defaultTemplateId,
      templates: [
        ...spec.builtIns.map((template) => ({ ...template })),
        ...custom,
      ],
    };
  }

  /**
   * Texto do modelo PADRÃO da empresa para aquele tipo, ou `null` quando não há
   * nada utilizável. Quem envia usa isto e, no `null`, mantém o texto fixo do
   * código — personalizar nunca pode deixar a cliente sem mensagem.
   */
  async activeTemplateMessage(
    companyId: string,
    kind: MessageTemplateKind,
  ): Promise<string | null> {
    try {
      const settings = await this.getTemplates(companyId, kind);
      const chosen =
        settings.templates.find(
          (template) => template.id === settings.defaultTemplateId,
        ) ?? settings.templates[0];
      const message = chosen?.message?.trim();
      return message ? message : null;
    } catch {
      return null;
    }
  }

  // Compat: rotas e telas que já falavam em "confirmação"/"cancelamento"
  // continuam funcionando, agora só delegando.

  getConfirmationTemplates(
    companyId: string,
  ): Promise<ConfirmationTemplateSettings> {
    return this.getTemplates(companyId, 'confirmation');
  }

  updateConfirmationTemplates(
    companyId: string,
    input: { defaultTemplateId?: unknown; templates?: unknown },
  ): Promise<ConfirmationTemplateSettings> {
    return this.updateTemplates(companyId, 'confirmation', input);
  }

  getCancellationTemplates(
    companyId: string,
  ): Promise<CancellationTemplateSettings> {
    return this.getTemplates(companyId, 'cancellation');
  }

  updateCancellationTemplates(
    companyId: string,
    input: { defaultTemplateId?: unknown; templates?: unknown },
  ): Promise<CancellationTemplateSettings> {
    return this.updateTemplates(companyId, 'cancellation', input);
  }

  private normalizeCustomTemplates(
    value: unknown,
    spec: MessageTemplateSpec,
  ): ConfirmationTemplate[] {
    if (!Array.isArray(value)) return [];
    const custom: ConfirmationTemplate[] = [];
    const seen = new Set<string>();
    for (const raw of value.slice(0, 20)) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const record = raw as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      const label =
        typeof record.label === 'string' ? record.label.trim().slice(0, 80) : '';
      const message =
        typeof record.message === 'string'
          ? record.message.trim().slice(0, 2_000)
          : '';
      if (
        !/^custom-[a-z0-9-]{1,80}$/i.test(id) ||
        seen.has(id) ||
        spec.builtIns.some((template) => template.id === id) ||
        !label ||
        !message
      ) {
        continue;
      }
      seen.add(id);
      custom.push({ id, label, message, builtIn: false });
    }
    return custom;
  }

  /** Coerces an arbitrary partial into a full, typed follow-up config. */
  private normalizeFollowUp(src: Partial<FollowUpSettings>): FollowUpSettings {
    const d = NOTIFICATION_FOLLOWUP_DEFAULTS;
    // Clamp numbers into sane ranges so a bad payload can't schedule spam.
    const intIn = (v: unknown, def: number, min: number, max: number): number => {
      const n = typeof v === 'number' ? Math.round(v) : Number.NaN;
      if (!Number.isFinite(n)) return def;
      return Math.min(max, Math.max(min, n));
    };

    // Resolve a value+unit (or a legacy hours/days number) into a clamped seconds
    // total plus a coherent value/unit/seconds/compat quartet. Precedence:
    //   1. explicit delaySeconds       (canonical, round-trips a saved config);
    //   2. explicit delayValue+unit    (what the new UI sends);
    //   3. legacy compat number        (delayHours / recurringDays);
    //   4. default.
    const resolveDuration = (opts: {
      seconds?: unknown;
      value?: unknown;
      unit?: unknown;
      legacy?: unknown;
      legacyUnit: TimeUnit;
      defSeconds: number;
      defValue: number;
      defUnit: TimeUnit;
    }): { value: number; unit: TimeUnit; seconds: number } => {
      const unit: TimeUnit =
        typeof opts.unit === 'string' && (TIME_UNITS as string[]).includes(opts.unit)
          ? (opts.unit as TimeUnit)
          : opts.defUnit;

      let totalSeconds: number;
      if (typeof opts.seconds === 'number' && Number.isFinite(opts.seconds)) {
        totalSeconds = Math.round(opts.seconds);
      } else if (typeof opts.value === 'number' && Number.isFinite(opts.value)) {
        totalSeconds = Math.round(opts.value) * TIME_UNIT_SECONDS[unit];
      } else if (typeof opts.legacy === 'number' && Number.isFinite(opts.legacy)) {
        // Old config only had delayHours/recurringDays — convert it to seconds.
        totalSeconds = Math.round(opts.legacy) * TIME_UNIT_SECONDS[opts.legacyUnit];
      } else {
        totalSeconds = opts.defSeconds;
      }

      const seconds = Math.min(
        MAX_DELAY_SECONDS,
        Math.max(MIN_DELAY_SECONDS, totalSeconds),
      );

      // Re-derive the value in the requested unit so value*unit === seconds when
      // it divides evenly (keeps the UI number honest after clamping).
      const per = TIME_UNIT_SECONDS[unit];
      const value = seconds % per === 0 ? seconds / per : Math.max(1, Math.round(seconds / per));
      return { value, unit, seconds };
    };

    const delay = resolveDuration({
      seconds: src.delaySeconds,
      value: src.delayValue,
      unit: src.delayUnit,
      legacy: src.delayHours,
      legacyUnit: 'hours',
      defSeconds: d.delaySeconds,
      defValue: d.delayValue,
      defUnit: d.delayUnit,
    });

    const recurring = resolveDuration({
      seconds: src.recurringSeconds,
      value: src.recurringValue,
      unit: src.recurringUnit,
      legacy: src.recurringDays,
      legacyUnit: 'days',
      defSeconds: d.recurringSeconds,
      defValue: d.recurringValue,
      defUnit: d.recurringUnit,
    });

    return {
      enabled: typeof src.enabled === 'boolean' ? src.enabled : d.enabled,
      message: typeof src.message === 'string' ? src.message : d.message,
      delayValue: delay.value,
      delayUnit: delay.unit,
      delaySeconds: delay.seconds,
      // Compat mirror: seconds → hours (rounded, min 1) for legacy readers.
      delayHours: Math.max(1, Math.round(delay.seconds / TIME_UNIT_SECONDS.hours)),
      recurring: typeof src.recurring === 'boolean' ? src.recurring : d.recurring,
      recurringValue: recurring.value,
      recurringUnit: recurring.unit,
      recurringSeconds: recurring.seconds,
      // Compat mirror: seconds → days (rounded, min 1) for legacy readers.
      recurringDays: Math.max(1, Math.round(recurring.seconds / TIME_UNIT_SECONDS.days)),
      maxRecurrences: intIn(src.maxRecurrences, d.maxRecurrences, 1, 12),
      includeBookingLink:
        typeof src.includeBookingLink === 'boolean'
          ? src.includeBookingLink
          : d.includeBookingLink,
    };
  }

  /** Coerces an arbitrary partial into a full, boolean-typed settings object. */
  private normalize(
    src: Partial<NotificationAutomationSettings>,
  ): NotificationAutomationSettings {
    return {
      confirmation:
        typeof src.confirmation === 'boolean'
          ? src.confirmation
          : NOTIFICATION_AUTOMATION_DEFAULTS.confirmation,
      cancellation:
        typeof src.cancellation === 'boolean'
          ? src.cancellation
          : NOTIFICATION_AUTOMATION_DEFAULTS.cancellation,
      reminder:
        typeof src.reminder === 'boolean'
          ? src.reminder
          : NOTIFICATION_AUTOMATION_DEFAULTS.reminder,
      followUp:
        typeof src.followUp === 'boolean'
          ? src.followUp
          : NOTIFICATION_AUTOMATION_DEFAULTS.followUp,
      notifyProfessional:
        typeof src.notifyProfessional === 'boolean'
          ? src.notifyProfessional
          : NOTIFICATION_AUTOMATION_DEFAULTS.notifyProfessional,
    };
  }
}
