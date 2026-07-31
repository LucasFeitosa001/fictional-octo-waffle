/**
 * Política da fila de saída do WhatsApp — pura, sem I/O, para poder ser testada.
 *
 * Existe por causa de um episódio real (estudo 60): a fila acumulou de 27 a
 * 29/07/2026 com o canal desconectado e, no reconnect, drenou tudo de uma vez —
 * três mensagens ao mesmo cliente em três minutos, inclusive de agendamento que
 * já tinha passado. O dono desconectou o número para não ser banido.
 *
 * São três travas independentes:
 *   1. não ENFILEIRAR automação com o canal fechado (senão a bomba se arma);
 *   2. prazo de validade por tipo (o que envelheceu na fila não sai);
 *   3. revalidar a autorização na ENTREGA (a decisão não pode ficar congelada
 *      do momento em que a linha nasceu).
 *
 * A regra de autorização em si é a permanente do projeto: padrão da conta OU
 * toggle daquele agendamento. Opt-in do cliente é trava adicional, nunca
 * autorização.
 */

/** Tipos gerados por automação — os que precisam de autorização do salão. */
export const OUTBOX_AUTOMATION_KINDS = [
  'confirmation',
  'cancellation',
  'reminder',
  'followup',
  'campaign',
] as const;

export type OutboxAutomationKind = (typeof OUTBOX_AUTOMATION_KINDS)[number];

export function isAutomationKind(
  kind: string | null | undefined,
): kind is OutboxAutomationKind {
  return (
    typeof kind === 'string' &&
    (OUTBOX_AUTOMATION_KINDS as readonly string[]).includes(kind)
  );
}

/**
 * Prazo de validade na fila, por tipo. Escolhidos pelo que a mensagem significa
 * para quem recebe: um "lembrete" que chega depois da hora é o pior caso (foi
 * exatamente o que aconteceu), uma campanha atrasada é spam, e um follow-up é
 * naturalmente de dias — mas não de semanas.
 */
const TTL_MS: Record<OutboxAutomationKind, number> = {
  reminder: 60 * 60 * 1000, // 1h
  confirmation: 2 * 60 * 60 * 1000, // 2h
  cancellation: 6 * 60 * 60 * 1000, // 6h
  campaign: 6 * 60 * 60 * 1000, // 6h
  followup: 24 * 60 * 60 * 1000, // 24h
};

/** Fallback para um tipo de automação novo que ninguém cadastrou aqui. */
const TTL_FALLBACK_MS = 12 * 60 * 60 * 1000;

export interface DecisaoDeFila {
  ok: boolean;
  /** Motivo curto, gravado em `lastError` e no log — o dono precisa entender. */
  motivo?: string;
}

/**
 * A linha pode ser criada?
 *
 * Automação com o canal FECHADO não entra: é o que transforma a fila em bomba.
 * Continuam entrando: envio manual, mensagem nascida no inbox (atendente/IA) e
 * envio que uma pessoa autorizou explicitamente — nesses casos alguém está
 * olhando a tela e o "na fila" é informação honesta, não acúmulo silencioso.
 */
export function podeEnfileirar(
  kind: string | null | undefined,
  socketAberto: boolean,
  opts: { autorizadaPorPessoa?: boolean; doInbox?: boolean } = {},
): DecisaoDeFila {
  if (!isAutomationKind(kind)) return { ok: true };
  if (opts.doInbox || opts.autorizadaPorPessoa) return { ok: true };
  if (socketAberto) return { ok: true };
  return {
    ok: false,
    motivo:
      'WhatsApp desconectado: mensagem automática não é enfileirada (evita rajada no reconnect)',
  };
}

/** Envelheceu na fila? Vale para automação, autorizada por pessoa ou não. */
export function expirouNaFila(
  kind: string | null | undefined,
  createdAt: Date,
  agora: Date = new Date(),
): DecisaoDeFila {
  if (!isAutomationKind(kind)) return { ok: true };
  const ttl = TTL_MS[kind] ?? TTL_FALLBACK_MS;
  const idade = agora.getTime() - createdAt.getTime();
  if (idade <= ttl) return { ok: true };
  const horas = Math.floor(idade / 3_600_000);
  return {
    ok: false,
    motivo: `Expirada na fila: ${horas}h paradas (limite de ${Math.round(ttl / 3_600_000)}h para ${kind})`,
  };
}

export interface AgendamentoParaRevalidar {
  status: string;
  start: Date;
  remindClient: boolean | null;
  notifyConfirmation: boolean | null;
  notifyCancellation: boolean | null;
}

export interface AutomacaoDaConta {
  confirmation: boolean;
  cancellation: boolean;
  reminder: boolean;
  followUp: boolean;
}

export interface ClienteParaRevalidar {
  notificationsEnabled: boolean | null;
  whatsappOptIn: boolean | null;
}

/**
 * A autorização ainda vale AGORA, na hora de entregar?
 *
 * `agendamento === null` significa que a linha aponta para um agendamento que
 * não existe mais (apagado) — nesse caso não há o que avisar.
 * `agendamento === undefined` significa que a mensagem não é de agendamento
 * (campanha, follow-up avulso): aí só o padrão da conta e o opt-in valem.
 */
export function autorizacaoAindaVale(input: {
  kind: string | null | undefined;
  agendamento?: AgendamentoParaRevalidar | null;
  automacao: AutomacaoDaConta;
  cliente?: ClienteParaRevalidar | null;
  agora?: Date;
}): DecisaoDeFila {
  const { kind, agendamento, automacao, cliente } = input;
  const agora = input.agora ?? new Date();
  if (!isAutomationKind(kind)) return { ok: true };

  // Trava adicional do cliente — vale para qualquer tipo.
  if (cliente && (cliente.notificationsEnabled === false || cliente.whatsappOptIn === false)) {
    return { ok: false, motivo: 'Cliente pediu para não receber mensagens no WhatsApp' };
  }

  if (kind === 'confirmation' || kind === 'cancellation' || kind === 'reminder') {
    if (agendamento === null) {
      return { ok: false, motivo: 'Agendamento não existe mais' };
    }
    // Sem agendamento para conferir, NÃO sai. Antes este caso escorregava para
    // baixo e caía no padrão da conta, pulando as três travas seguintes — foi
    // assim que lembrete de horário já passado saiu quando a conexão voltou.
    // Aviso automático que não dá para verificar não é enviado. Estudo 73.
    if (agendamento === undefined) {
      return { ok: false, motivo: 'Não deu para verificar o agendamento' };
    }
    if (agendamento) {
      if (agendamento.status === 'canceled' && kind !== 'cancellation') {
        return { ok: false, motivo: 'Agendamento foi cancelado depois' };
      }
      // Avisar de um horário que já passou é o caso que estourou na cara do
      // dono: "lembrete" chegando depois do atendimento.
      if (agendamento.start.getTime() <= agora.getTime()) {
        return { ok: false, motivo: 'O horário já passou' };
      }
      const doAgendamento =
        kind === 'reminder'
          ? agendamento.remindClient
          : kind === 'cancellation'
            ? agendamento.notifyCancellation
            : agendamento.notifyConfirmation;
      const padraoDaConta =
        kind === 'reminder'
          ? automacao.reminder
          : kind === 'cancellation'
            ? automacao.cancellation
            : automacao.confirmation;
      const permitido = doAgendamento ?? padraoDaConta;
      if (!permitido) {
        return {
          ok: false,
          motivo: 'Aviso desligado (no agendamento ou no padrão da conta)',
        };
      }
      return { ok: true };
    }
  }

  const padrao =
    kind === 'followup'
      ? automacao.followUp
      : kind === 'campaign'
        ? true // campanha é disparo explícito do salão, não tem switch de conta
        : kind === 'reminder'
          ? automacao.reminder
          : kind === 'cancellation'
            ? automacao.cancellation
            : automacao.confirmation;
  return padrao
    ? { ok: true }
    : { ok: false, motivo: 'Aviso desligado no padrão da conta' };
}
