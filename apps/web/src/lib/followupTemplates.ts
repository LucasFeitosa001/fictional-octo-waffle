/**
 * Pre-baked follow-up message templates the salon owner can pick as a starting
 * point in Configurações → Notificações → Follow-up. Clicking one just fills the
 * message textarea (the owner can still edit freely afterwards), so the backend
 * never needs to know these exist — only the final `message` string is saved.
 *
 * All templates use the same variables the backend understands:
 *   {cliente}         → first name of the customer
 *   {estabelecimento} → salon/company name
 *   {servico}         → services performed
 *   {link}            → re-booking link (only rendered if "incluir link" is on)
 */
export interface FollowUpTemplate {
  /** Stable id for React keys / selection. */
  id: string;
  /** Short chip label shown in the UI. */
  label: string;
  /** The message body that gets dropped into the textarea. */
  message: string;
}

export const FOLLOWUP_TEMPLATES: FollowUpTemplate[] = [
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
