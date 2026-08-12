/**
 * Datas do drawer "Novo agendamento": a repetição ("Além deste, repetir mais")
 * e a conferência de expediente que avisa, ANTES de salvar, qual data o backend
 * vai recusar.
 *
 * Mora aqui, fora do componente, porque é lógica pura e precisa de teste: o
 * defeito da recorrência mensal (31/01 virando 03/03) só aparece em datas que
 * ninguém repara na tela, e `tests/agendamento-datas.test.ts` trava isso. O
 * componente em si não é importável pelo jest (HeroUI é ESM e o jest-resolve
 * não acha `@heroui/react`).
 */
import { formatDuration } from './format';

export type Freq = 'none' | 'weekly' | 'biweekly' | 'monthly';

/**
 * A data da N-ésima repetição, contada SEMPRE a partir da base (o erro não
 * acumula de uma ocorrência para a seguinte).
 */
export function nextDate(base: Date, freq: Freq, times: number): Date {
  const d = new Date(base);
  if (freq === 'weekly') d.setDate(d.getDate() + 7 * times);
  else if (freq === 'biweekly') d.setDate(d.getDate() + 14 * times);
  else if (freq === 'monthly') {
    // `setMonth(+times)` sozinho TRANSBORDA: a cliente que faz manutenção todo
    // dia 31 pedia "Mensal · repetir mais 3" a partir de 31/01/2026 e o sistema
    // gravava 03/03, 31/03 e 01/05 — datas que ninguém combinou (31 de fevereiro
    // vira 3 de março). Fixamos no ÚLTIMO dia do mês quando o dia não existe:
    // 31/01 → 28/02 → 31/03 → 30/04. Zerar o dia antes de trocar o mês é o que
    // impede o transbordo no meio do caminho.
    const diaDesejado = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + times);
    const ultimoDiaDoMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(diaDesejado, ultimoDiaDoMes));
  }
  return d;
}

// ── Expediente da profissional, conferido AQUI antes de salvar ──────────────
// O backend valida cada ocorrência da série ANTES da transação
// (appointments.service.ts:942-952 → assertWithinSchedule :1661-1687) e, quando
// UMA data não cabe, recusa a série INTEIRA com uma mensagem que não diz qual
// data é a culpada. Espelhamos a mesma checagem no navegador só para AVISAR —
// quem decide continua sendo o backend.

/** Uma janela de expediente. Mesmo formato do `ProfessionalScheduleRow`. */
export interface JanelaDeExpediente {
  weekday: number;
  startTime: string;
  endTime: string;
}

// O expediente é gravado no fuso do salão; `getDay()`/`getHours()` do navegador
// erram o dia e a hora para quem acessa de outro fuso. Mesmo fuso fixo que o
// rótulo dos horários já usa (format.ts:53-62).
const TZ_SALAO = 'America/Sao_Paulo';
const FMT_DIA_SEMANA = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: TZ_SALAO,
});
const INDICE_DIA_SEMANA: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const FMT_HORA_SALAO = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TZ_SALAO,
});

/** Rótulo curto de uma data da série: "sáb., 31/01". */
export const FMT_DATA_SERIE = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: TZ_SALAO,
});

function minutosDoDia(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m || 0);
}
function comoHhmm(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Devolve o motivo, em português, de a data NÃO caber no expediente — ou null
 * quando cabe, e também quando ainda não temos o expediente em mãos (aviso
 * inventado é pior que aviso nenhum).
 */
export function problemaDeExpediente(
  inicio: Date,
  duracaoMin: number,
  expedientes: JanelaDeExpediente[] | undefined,
): string | null {
  if (!expedientes) return null;
  const diaSemana = INDICE_DIA_SEMANA[FMT_DIA_SEMANA.format(inicio)] ?? inicio.getDay();
  const janelas = expedientes.filter((e) => e.weekday === diaSemana);
  if (!janelas.length) return 'a profissional não atende neste dia da semana';
  const [hora, minuto] = FMT_HORA_SALAO.format(inicio).split(':');
  const inicioMin = Number(hora) * 60 + Number(minuto);
  const fimMin = inicioMin + duracaoMin;
  const cabe = janelas.some(
    (j) => inicioMin >= minutosDoDia(j.startTime) && fimMin <= minutosDoDia(j.endTime),
  );
  if (cabe) return null;
  // Quem tem expediente partido (09:00-12:00 e 13:00-18:00) precisa ver o fim da
  // janela em que o horário CAI — dizer "até 18:00" para quem escolheu 11:30
  // mandaria a pessoa procurar erro onde não tem.
  const janelaDoHorario = janelas.find(
    (j) => inicioMin >= minutosDoDia(j.startTime) && inicioMin < minutosDoDia(j.endTime),
  );
  const fimDoExpediente = janelaDoHorario
    ? minutosDoDia(janelaDoHorario.endTime)
    : Math.max(...janelas.map((j) => minutosDoDia(j.endTime)));
  return `o atendimento (${formatDuration(duracaoMin)}) passa do expediente, que vai até ${comoHhmm(fimDoExpediente)}`;
}
