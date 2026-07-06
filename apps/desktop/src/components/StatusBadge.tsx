const TONES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  accent: 'bg-accent-50 text-accent-700 ring-accent-200',
  neutral: 'bg-ink-100/60 text-ink-700 ring-ink-100',
} as const;

export type BadgeTone = keyof typeof TONES;

export function StatusBadge({ tone = 'neutral', children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/** Badge de ativo/inativo usado nas listagens de cadastro. */
export function ActiveBadge({ active }: { active: boolean }) {
  return <StatusBadge tone={active ? 'success' : 'neutral'}>{active ? 'Ativo' : 'Inativo'}</StatusBadge>;
}

export const appointmentStatusTones: Record<string, BadgeTone> = {
  agendado: 'brand',
  confirmado: 'success',
  em_atendimento: 'accent',
  finalizado: 'info',
  cancelado: 'danger',
};

export const commandStatusTones: Record<string, BadgeTone> = {
  aberta: 'warning',
  paga: 'success',
  cancelada: 'danger',
};

export const financialStatusTones: Record<string, BadgeTone> = {
  aberto: 'warning',
  pago: 'success',
  vencido: 'danger',
  cancelado: 'neutral',
};
