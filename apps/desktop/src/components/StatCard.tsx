import type { LucideIcon } from 'lucide-react';

const ICON_TONES = {
  brand: 'bg-brand-50 text-brand-600',
  accent: 'bg-accent-50 text-accent-600',
  gold: 'bg-gold-100 text-gold-700',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
  info: 'bg-sky-50 text-sky-600',
} as const;

export type StatTone = keyof typeof ICON_TONES;

/** Card de indicador do dashboard (também usado como "DashboardCard"). */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'brand',
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-sm sm:gap-4 ${
        onClick ? 'transition hover:border-brand-200 hover:shadow-md' : ''
      }`}
    >
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${ICON_TONES[tone]}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-ink-500">{label}</p>
        <p className="break-words text-lg font-semibold tracking-tight text-ink-900 sm:text-xl">{value}</p>
        {hint ? <p className="truncate text-xs text-ink-300">{hint}</p> : null}
      </div>
    </Wrapper>
  );
}

export const DashboardCard = StatCard;
