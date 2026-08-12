import type { AppointmentStatus } from '@beautypass/shared';

const dtf = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const tf = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

const df = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});

export function formatDateTime(iso: string): string {
  return dtf.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return tf.format(new Date(iso));
}

export function formatDay(iso: string): string {
  return df.format(new Date(iso));
}

export function formatPrice(value: string | number | null): string {
  if (value == null) return '';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n);
}

/** YYYY-MM-DD for a Date in local time (used for the availability date param). */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Situação do agendamento, na tela da CLIENTE. Ver estudo 137.
 *
 * `Record<AppointmentStatus, …>` de propósito: o TS passa a EXIGIR uma frase
 * para cada valor do enum, então um status novo quebra o build em vez de vazar
 * cru na tela. Era exatamente o que acontecia — o mapa era
 * `Record<string, string>`, não tinha `unconfirmed` nem `waiting`, e o fallback
 * `?? status` mostrava "unconfirmed" em inglês no cartão de "Meus
 * agendamentos". E não era caso raro: é o estado NORMAL de quem agenda pelo
 * portal quando o salão confirma primeiro (`public-booking.service`,
 * `salonConfirms`). De quebra o mapa tinha dois rótulos órfãos (`arrived`,
 * `no_show`) que nem existem no enum.
 *
 * `unconfirmed` aqui não é o "Não confirmado" do painel: quem lê é a cliente, e
 * para ela isso soaria como problema. O que de fato acontece é o que
 * `notifications.service` descreve — "pedido online que ainda aguarda o salão".
 */
const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  unconfirmed: 'Aguardando confirmação',
  waiting: 'Aguardando',
  in_progress: 'Em atendimento',
  done: 'Concluído',
  finished: 'Finalizado',
  canceled: 'Cancelado',
};

export function statusLabel(status: string): string {
  // Sem eco do valor cru: status fora do enum é defeito de dado, e mostrar
  // "unconfirmed" para a cliente é pior do que não mostrar selo nenhum.
  return STATUS_LABELS[status as AppointmentStatus] ?? '';
}
