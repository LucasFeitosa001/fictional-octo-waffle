import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';

/**
 * Modelos de mensagem por tipo (estudo 61).
 *
 * Antes só a confirmação tinha texto editável — e o aviso AUTOMÁTICO ignorava o
 * modelo, mandando uma linha fixa do código. Agora os quatro tipos têm modelo,
 * e é o modelo padrão da empresa que o automático usa.
 *
 * IMPORTANTE: modelo é TEXTO, não autorização. Ligar/desligar envio continua em
 * "Notificações automáticas" (padrão da conta) ou no toggle do agendamento.
 */
export const MESSAGE_TEMPLATE_KINDS = [
  'confirmation',
  'cancellation',
  'reminder24h',
  'reminder2h',
] as const;

export type MessageTemplateKind = (typeof MESSAGE_TEMPLATE_KINDS)[number];

export interface MessageTemplate {
  id: string;
  label: string;
  message: string;
  builtIn: boolean;
}

export interface MessageTemplateSettings {
  defaultTemplateId: string;
  templates: MessageTemplate[];
}

export interface TemplateVariable {
  token: string;
  label: string;
  sample: string;
}

/** Variáveis comuns a todos os tipos, com exemplo para o preview. */
const BASE_VARIABLES: TemplateVariable[] = [
  { token: '{cliente}', label: 'primeiro nome da cliente', sample: 'Maria' },
  { token: '{quando}', label: 'hoje / amanhã / dia da semana', sample: 'amanhã' },
  { token: '{hora}', label: 'horário por extenso', sample: '14h30' },
  { token: '{hora_curta}', label: 'horário curto', sample: '14h30' },
  { token: '{servico}', label: 'serviços do agendamento', sample: 'Corte, Escova' },
  { token: '{profissional}', label: 'quem vai atender', sample: 'Vitória' },
  { token: '{estabelecimento}', label: 'nome do salão', sample: 'Studio Bela' },
];

const MOTIVO_VARIABLE: TemplateVariable = {
  token: '{motivo}',
  label: 'motivo do cancelamento (a linha desaparece se não houver)',
  sample: 'imprevisto da profissional',
};

export interface MessageTemplateKindMeta {
  kind: MessageTemplateKind;
  title: string;
  short: string;
  description: string;
  variables: TemplateVariable[];
}

export const MESSAGE_TEMPLATE_META: Record<
  MessageTemplateKind,
  MessageTemplateKindMeta
> = {
  confirmation: {
    kind: 'confirmation',
    title: 'Agendamento marcado/confirmado',
    short: 'Confirmação',
    description:
      'Texto enviado à cliente quando o agendamento é criado ou confirmado — inclusive no botão "Enviar confirmação" dentro do agendamento.',
    variables: BASE_VARIABLES,
  },
  cancellation: {
    kind: 'cancellation',
    title: 'Agendamento cancelado',
    short: 'Cancelamento',
    description:
      'Texto enviado à cliente quando o agendamento é cancelado. Use {motivo} para citar o motivo — sem motivo, a linha inteira desaparece.',
    variables: [...BASE_VARIABLES, MOTIVO_VARIABLE],
  },
  reminder24h: {
    kind: 'reminder24h',
    title: 'Lembrete da véspera (24h antes)',
    short: 'Lembrete 24h',
    description:
      'Texto do lembrete enviado no dia anterior ao atendimento. Lembrete é ANTES; follow-up é depois.',
    variables: BASE_VARIABLES,
  },
  reminder2h: {
    kind: 'reminder2h',
    title: 'Lembrete de poucas horas (2h antes)',
    short: 'Lembrete 2h',
    description:
      'Texto do lembrete enviado poucas horas antes do atendimento, no mesmo dia.',
    variables: BASE_VARIABLES,
  },
};

const templatesKey = (kind: MessageTemplateKind) =>
  ['notification-settings', 'message-templates', kind] as const;

export function useMessageTemplates(kind: MessageTemplateKind) {
  return useQuery({
    queryKey: templatesKey(kind),
    queryFn: () =>
      api.get<MessageTemplateSettings>(
        `/notification-settings/message-templates/${kind}`,
      ),
  });
}

export function useSaveMessageTemplates(kind: MessageTemplateKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      defaultTemplateId: string;
      templates: Array<{ id: string; label: string; message: string }>;
    }) =>
      api.put<MessageTemplateSettings>(
        `/notification-settings/message-templates/${kind}`,
        body,
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(templatesKey(kind), data);
      // O drawer de confirmação do agendamento lê a mesma coleção.
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toastSuccess('Modelo salvo');
    },
  });
}

/** Preview local com os exemplos — o texto real é renderizado no servidor. */
export function renderTemplateSample(
  kind: MessageTemplateKind,
  template: string,
): string {
  const linhas = template.split('\n');
  const mantidas: string[] = [];
  for (const linha of linhas) {
    let saida = linha;
    let apagar = false;
    for (const variable of MESSAGE_TEMPLATE_META[kind].variables) {
      if (!saida.includes(variable.token)) continue;
      if (!variable.sample.trim()) {
        apagar = true;
        break;
      }
      saida = saida.split(variable.token).join(variable.sample);
    }
    if (!apagar) mantidas.push(saida);
  }
  return mantidas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ────────────────────────── prévia com dados reais do agendamento ───────── */

/**
 * Variáveis do modelo para UM agendamento, com as MESMAS regras do backend
 * (`apps/api/src/modules/notifications/confirmation.templates.ts`): primeiro
 * nome, hoje/amanhã/dia por extenso, "16 horas" quando é hora cheia e "14h30"
 * quando não é, serviços em lista.
 *
 * Isto é PRÉVIA. Quem monta o texto que sai de verdade é o backend — se um dia
 * as regras divergirem, a verdade é a de lá. Ver estudo 64.
 */
export function variaveisDoAgendamento(dados: {
  estabelecimento: string;
  cliente?: string | null;
  profissional?: string | null;
  servicos: string[];
  inicio: Date;
  agora?: Date;
}): Record<string, string> {
  const tz = 'America/Sao_Paulo';
  const agora = dados.agora ?? new Date();
  const diaLocal = (d: Date) => {
    const p = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const ler = (t: string) => Number(p.find((x) => x.type === t)?.value ?? '0');
    return Date.UTC(ler('year'), ler('month') - 1, ler('day'));
  };
  const dias = Math.round((diaLocal(dados.inicio) - diaLocal(agora)) / 86_400_000);
  const quando =
    dias === 0
      ? 'hoje'
      : dias === 1
        ? 'amanhã'
        : new Intl.DateTimeFormat('pt-BR', {
            timeZone: tz,
            weekday: 'long',
            day: '2-digit',
            month: 'long',
          }).format(dados.inicio);

  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(dados.inicio);
  const hora24 = Number(partes.find((x) => x.type === 'hour')?.value ?? '0');
  const minuto = partes.find((x) => x.type === 'minute')?.value ?? '00';
  const hora = minuto === '00' ? `${hora24} horas` : `${hora24}h${minuto}`;
  const horaCurta = minuto === '00' ? `${hora24}hrs` : `${hora24}h${minuto}`;

  const limpos = dados.servicos.map((n) => n.trim()).filter(Boolean);
  const servico =
    limpos.length === 0
      ? 'seu atendimento'
      : limpos.length === 1
        ? limpos[0]
        : `${limpos.slice(0, -1).join(', ')} e ${limpos.at(-1)}`;

  return {
    cliente: dados.cliente?.trim().split(/\s+/)[0] || 'cliente',
    quando,
    hora,
    hora_curta: horaCurta,
    servico,
    profissional: dados.profissional?.trim() || 'nossa equipe',
    estabelecimento: dados.estabelecimento.trim() || 'salão',
    motivo: '',
  };
}

/** Substitui as variáveis; linha com variável vazia some (igual ao backend). */
export function renderTemplateComVariaveis(
  template: string,
  variaveis: Record<string, string>,
): string {
  const mantidas: string[] = [];
  for (const linha of template.split('\n')) {
    let saida = linha;
    let apagar = false;
    for (const [nome, valor] of Object.entries(variaveis)) {
      if (!saida.includes(`{${nome}}`)) continue;
      if (!valor.trim()) {
        apagar = true;
        break;
      }
      saida = saida.split(`{${nome}}`).join(valor);
    }
    if (!apagar) mantidas.push(saida);
  }
  return mantidas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
