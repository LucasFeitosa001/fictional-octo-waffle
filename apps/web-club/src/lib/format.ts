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

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  arrived: 'Chegou',
  in_progress: 'Em atendimento',
  done: 'Concluído',
  finished: 'Finalizado',
  canceled: 'Cancelado',
  no_show: 'Não compareceu',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
