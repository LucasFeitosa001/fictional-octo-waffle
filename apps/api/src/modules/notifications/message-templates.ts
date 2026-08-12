/**
 * Kit genérico de MODELOS DE MENSAGEM por tipo.
 *
 * Antes só a confirmação tinha modelo editável — e ainda assim o aviso
 * automático ignorava o modelo e mandava uma linha fixa do código. Cancelamento
 * e lembretes não tinham editor nenhum. O dono cobrou: "Tem que ter
 * personalizacao". Ver estudo 61.
 *
 * Este arquivo só descreve os tipos (chave de Setting, variáveis permitidas,
 * textos embutidos) e renderiza. Quem lê/grava é o
 * `NotificationSettingsService`; quem envia continua sendo quem já enviava — a
 * autorização de envio NÃO passa por aqui (regra do estudo 59: padrão da conta
 * ou toggle do agendamento).
 */
import {
  BUILTIN_CONFIRMATION_TEMPLATES,
  CONFIRMATION_TEMPLATE_VARIABLES,
  DEFAULT_CONFIRMATION_TEMPLATE_ID,
  NOTIFICATION_CONFIRMATION_TEMPLATES_KEY,
  type ConfirmationTemplate,
} from './confirmation.templates';
import {
  BUILTIN_CANCELLATION_TEMPLATES,
  CANCELLATION_TEMPLATE_VARIABLES,
  DEFAULT_CANCELLATION_TEMPLATE_ID,
  NOTIFICATION_CANCELLATION_TEMPLATES_KEY,
} from './cancellation.templates';

export const MESSAGE_TEMPLATE_KINDS = [
  'confirmation',
  'cancellation',
  'reminder24h',
  'reminder2h',
] as const;

export type MessageTemplateKind = (typeof MESSAGE_TEMPLATE_KINDS)[number];

export interface MessageTemplateSpec {
  kind: MessageTemplateKind;
  /** Chave em `Setting` (por empresa). */
  settingKey: string;
  /** Rótulo humano — aparece nas mensagens de erro da API. */
  label: string;
  variables: readonly string[];
  builtIns: readonly ConfirmationTemplate[];
  defaultTemplateId: string;
}

/**
 * Embutidos dos lembretes. Reproduzem o texto fixo que já saía hoje
 * (`queues/reminder.templates.ts`), agora como modelo editável — por isso o
 * `{profissional}` teve de existir.
 */
const BUILTIN_REMINDER_24H_TEMPLATES: readonly ConfirmationTemplate[] = [
  {
    id: 'lembrete-24h-padrao',
    label: 'Lembrete da véspera',
    message:
      'Olá, {cliente}! Passando para lembrar do seu {servico} com {profissional} {quando}, às {hora}, no {estabelecimento}. Até lá! 💕',
    builtIn: true,
  },
] as const;

const BUILTIN_REMINDER_2H_TEMPLATES: readonly ConfirmationTemplate[] = [
  {
    id: 'lembrete-2h-padrao',
    label: 'Lembrete de poucas horas',
    message:
      'Olá, {cliente}! Seu {servico} com {profissional} é {quando} às {hora} no {estabelecimento}. Estamos te esperando! 💕',
    builtIn: true,
  },
] as const;

export const MESSAGE_TEMPLATE_SPECS: Record<
  MessageTemplateKind,
  MessageTemplateSpec
> = {
  confirmation: {
    kind: 'confirmation',
    settingKey: NOTIFICATION_CONFIRMATION_TEMPLATES_KEY,
    label: 'confirmação',
    variables: CONFIRMATION_TEMPLATE_VARIABLES,
    builtIns: BUILTIN_CONFIRMATION_TEMPLATES,
    defaultTemplateId: DEFAULT_CONFIRMATION_TEMPLATE_ID,
  },
  cancellation: {
    kind: 'cancellation',
    settingKey: NOTIFICATION_CANCELLATION_TEMPLATES_KEY,
    label: 'cancelamento',
    variables: CANCELLATION_TEMPLATE_VARIABLES,
    builtIns: BUILTIN_CANCELLATION_TEMPLATES,
    defaultTemplateId: DEFAULT_CANCELLATION_TEMPLATE_ID,
  },
  reminder24h: {
    kind: 'reminder24h',
    settingKey: 'notifications.reminder24hTemplates',
    label: 'lembrete de véspera',
    variables: CONFIRMATION_TEMPLATE_VARIABLES,
    builtIns: BUILTIN_REMINDER_24H_TEMPLATES,
    defaultTemplateId: BUILTIN_REMINDER_24H_TEMPLATES[0].id,
  },
  reminder2h: {
    kind: 'reminder2h',
    settingKey: 'notifications.reminder2hTemplates',
    label: 'lembrete de poucas horas',
    variables: CONFIRMATION_TEMPLATE_VARIABLES,
    builtIns: BUILTIN_REMINDER_2H_TEMPLATES,
    defaultTemplateId: BUILTIN_REMINDER_2H_TEMPLATES[0].id,
  },
};

/** Valida o `:kind` que chega pela rota. Devolve null quando não existe. */
export function messageTemplateKind(value: unknown): MessageTemplateKind | null {
  return typeof value === 'string' &&
    (MESSAGE_TEMPLATE_KINDS as readonly string[]).includes(value)
    ? (value as MessageTemplateKind)
    : null;
}

/**
 * Substitui as variáveis do tipo. Uma variável VAZIA apaga a linha inteira em
 * que aparece — é assim que "Motivo: {motivo}" desaparece quando o cancelamento
 * não tem motivo, em vez de mandar "Motivo:" solto para a cliente.
 */
export function renderMessageTemplate(
  kind: MessageTemplateKind,
  template: string,
  variables: Record<string, string | null | undefined>,
): string {
  const spec = MESSAGE_TEMPLATE_SPECS[kind];
  const lines = template.split('\n');
  const kept: string[] = [];
  for (const line of lines) {
    let rendered = line;
    let drop = false;
    for (const variable of spec.variables) {
      if (!rendered.includes(`{${variable}}`)) continue;
      const value = (variables[variable] ?? '').trim();
      if (!value) {
        drop = true;
        break;
      }
      rendered = rendered.split(`{${variable}}`).join(value);
    }
    if (!drop) kept.push(rendered);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
