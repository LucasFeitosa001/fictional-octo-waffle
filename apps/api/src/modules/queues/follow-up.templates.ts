/**
 * Pure message builder for the post-service follow-up ("como foi seu
 * atendimento? agende seu retorno"). No I/O — turns the relevant rows into the
 * WhatsApp text the client would receive. Kept separate from the lifecycle
 * (notifications.templates.ts) and reminder (queues/reminder.templates.ts)
 * builders because the follow-up is fired by a delayed job after the service is
 * done.
 *
 * The text is now per-company configurable: the processor passes the owner's
 * template (with {cliente} {estabelecimento} {servico} {link} variables) plus an
 * optional booking link. When the template is empty we fall back to the built-in
 * default copy.
 */

export interface FollowUpData {
  companyName: string;
  customerName: string | null;
  customerPhone: string | null;
  /** Services rendered (from the appointment items or the order). May be empty. */
  serviceNames: string[];
  /**
   * Custom message template from the company's FollowUpSettings. Empty/undefined
   * → use the default copy below.
   */
  template?: string | null;
  /**
   * Public booking link to substitute into {link} and/or append. Only provided
   * when includeBookingLink is on and the company has a slug. Omitted gracefully
   * otherwise.
   */
  bookingLink?: string | null;
}

/** First name (fallback "cliente"). */
function firstName(name: string | null): string {
  return name?.trim().split(' ')[0] || 'cliente';
}

/** Human list of services (fallback "seu atendimento"). */
function serviceList(names: string[]): string {
  return names.length ? names.join(', ') : 'seu atendimento';
}

/**
 * Substitutes the supported variables into a template. {link} is replaced with
 * the booking link when present, otherwise removed (and any dangling whitespace
 * around it collapsed) so the message never shows a raw "{link}".
 */
function renderTemplate(
  template: string,
  vars: { cliente: string; estabelecimento: string; servico: string; link: string | null },
): string {
  let out = template
    .replace(/\{cliente\}/g, vars.cliente)
    .replace(/\{estabelecimento\}/g, vars.estabelecimento)
    .replace(/\{servico\}/g, vars.servico);

  if (vars.link) {
    out = out.replace(/\{link\}/g, vars.link);
  } else {
    // Drop the placeholder and tidy up the surrounding whitespace/blank lines.
    out = out
      .replace(/[ \t]*\{link\}[ \t]*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  return out;
}

/** The original hardcoded copy, now used only as the fallback. */
function defaultMessage(
  client: string,
  services: string,
  companyName: string,
  bookingLink: string | null,
): string {
  const lines = [
    `Olá, ${client}! 💕`,
    ``,
    `Passando para saber como foi ${services} aqui no *${companyName}*. Esperamos que tenha adorado! ✨`,
    ``,
    `Quando quiser agendar seu retorno, é só chamar por aqui. Até logo! 💖`,
  ];
  if (bookingLink) {
    lines.push(``, `Agende seu retorno: ${bookingLink}`);
  }
  return lines.join('\n');
}

/**
 * Builds the client-facing follow-up text. Returns `null` when there is no phone
 * on file (nothing to enqueue). Uses the company's custom template when set,
 * otherwise the default copy; the booking link is substituted into {link} (or
 * appended, in the default copy) only when provided.
 */
export function composeFollowUpMessage(
  data: FollowUpData,
): { to: string; text: string } | null {
  if (!data.customerPhone) return null;

  const client = firstName(data.customerName);
  const services = serviceList(data.serviceNames);
  const link = data.bookingLink?.trim() || null;
  const template = data.template?.trim();

  const text = template
    ? renderTemplate(template, {
        cliente: client,
        estabelecimento: data.companyName,
        servico: services,
        link,
      })
    : defaultMessage(client, services, data.companyName, link);

  return { to: data.customerPhone, text };
}

/**
 * Modelos prontos de follow-up (espelham apps/web/src/lib/followupTemplates.ts).
 * O drawer "Avisar o cliente" pode enviar apenas o `templateId`; o processor
 * resolve o texto por aqui quando não há mensagem custom. As variáveis
 * {cliente}{estabelecimento}{servico}{link} são renderizadas em composeFollowUpMessage.
 */
export const FOLLOWUP_TEMPLATES: { id: string; label: string; message: string }[] = [
  {
    id: 'como-foi',
    label: 'Como foi seu atendimento?',
    message:
      'Olá, {cliente}! 💕 Como foi {servico} aqui no *{estabelecimento}*? ' +
      'Queremos muito saber sua opinião. Quando quiser voltar, é só chamar! ✨\n\n{link}',
  },
  {
    id: 'sentimos-falta',
    label: 'Sentimos sua falta',
    message:
      'Oi, {cliente}! Sentimos sua falta aqui no *{estabelecimento}* 💖 ' +
      'Que tal agendar seu retorno e cuidar de você de novo?\n\n{link}',
  },
  {
    id: 'ja-faz-tempo',
    label: 'Já faz um tempinho!',
    message:
      'Oi, {cliente}! Já faz um tempinho desde {servico} 😊 ' +
      'Bora remarcar e deixar tudo em dia? Seu horário te espera no *{estabelecimento}*.\n\n{link}',
  },
  {
    id: 'obrigado-visita',
    label: 'Obrigado pela visita',
    message:
      'Obrigado pela visita, {cliente}! 💖 Foi um prazer cuidar de você no ' +
      '*{estabelecimento}*. Agende já o seu próximo horário:\n\n{link}',
  },
  {
    id: 'hora-de-voltar',
    label: 'Hora de voltar?',
    message:
      'Oi, {cliente}! ✨ Está na hora de renovar {servico}? ' +
      'Garanta seu horário no *{estabelecimento}* antes que lote.\n\n{link}',
  },
  {
    id: 'oferta-retorno',
    label: 'Convite para retornar',
    message:
      'Olá, {cliente}! 🌸 Preparamos tudo para receber você de novo no ' +
      '*{estabelecimento}*. Vamos agendar seu retorno? É rapidinho:\n\n{link}',
  },
];

/** Resolve o texto de um template pelo id (undefined quando o id não existe). */
export function followUpTemplateById(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return FOLLOWUP_TEMPLATES.find((t) => t.id === id)?.message;
}
