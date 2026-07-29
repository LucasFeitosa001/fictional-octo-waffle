/**
 * Modelos de mensagem de CANCELAMENTO.
 *
 * Espelham os de confirmação (`confirmation.templates.ts`): mesmas variáveis,
 * mesma forma de guardar em `Setting`. Só o texto embutido, a chave e uma
 * variável extra mudam.
 *
 * Existem porque não havia NENHUM lugar para editar essa mensagem — o dono
 * cobrou: "não tá dando pra mudar a mensagem personalizada de cancelamento".
 * Ver estudos 59 e 61.
 */
import {
  CONFIRMATION_TEMPLATE_VARIABLES,
  type ConfirmationTemplate,
  type ConfirmationTemplateSettings,
} from './confirmation.templates';

export const NOTIFICATION_CANCELLATION_TEMPLATES_KEY =
  'notifications.cancellationTemplates';

/**
 * As variáveis da confirmação + `{motivo}`. O texto fixo de hoje
 * (`notifications.templates.ts`) inclui "Motivo: …" só quando o cancelamento
 * traz motivo; no modelo isso vira a variável `{motivo}`, e o renderizador
 * apaga a LINHA inteira quando ela vem vazia.
 */
export const CANCELLATION_TEMPLATE_VARIABLES = [
  ...CONFIRMATION_TEMPLATE_VARIABLES,
  'motivo',
] as const;

export type CancellationTemplate = ConfirmationTemplate;
export type CancellationTemplateSettings = ConfirmationTemplateSettings;

export const BUILTIN_CANCELLATION_TEMPLATES: readonly CancellationTemplate[] = [
  {
    id: 'cancelamento-padrao',
    label: 'Cancelamento',
    message: [
      'Olá, {cliente}!',
      'Seu horário de {servico} {quando} às {hora} foi cancelado.',
      'Motivo: {motivo}',
      '',
      'Se quiser remarcar, é só responder esta mensagem — vamos encontrar o melhor dia para você. 💗',
      '',
      '{estabelecimento}',
    ].join('\n'),
    builtIn: true,
  },
  {
    id: 'cancelamento-curto',
    label: 'Cancelamento curto',
    message:
      'Olá, {cliente}! Seu horário de {servico} {quando} às {hora} foi cancelado. Qualquer coisa, chame por aqui. — {estabelecimento}',
    builtIn: true,
  },
] as const;

export const DEFAULT_CANCELLATION_TEMPLATE_ID =
  BUILTIN_CANCELLATION_TEMPLATES[0].id;
