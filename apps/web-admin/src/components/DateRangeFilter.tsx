import type { ReactNode } from 'react';

/**
 * Brand-styled native date inputs for filter bars (B&W theme).
 *
 * HeroUI v3 DatePicker renders broken inside compact filter bars, so we use
 * native `<input type="date">` styled with Tailwind to match the monochrome
 * Salonpass brand on the dark surface.
 */
const fieldClass =
  'h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#1a1a1a] px-3 text-sm text-foreground ' +
  'shadow-sm outline-none transition-colors ' +
  'focus:border-white focus:ring-2 focus:ring-white/30 ' +
  '[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer ' +
  '[&::-webkit-calendar-picker-indicator]:opacity-60 ' +
  'hover:[&::-webkit-calendar-picker-indicator]:opacity-100';

/** A single labelled native date input. */
export function DateField({
  label,
  value,
  onChange,
  min,
  max,
  className,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className ?? ''}`}>
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={fieldClass}
      />
    </label>
  );
}

/**
 * A two-input "from → to" date range, used in dashboards and report headers.
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  fromLabel = 'De',
  toLabel = 'Até',
  className,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}) {
  return (
    <div className={`grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto sm:gap-3 ${className ?? ''}`}>
      <DateField
        label={fromLabel}
        value={from}
        max={to || undefined}
        onChange={(v) => onChange({ from: v, to })}
      />
      <DateField
        label={toLabel}
        value={to}
        min={from || undefined}
        onChange={(v) => onChange({ from, to: v })}
      />
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-end gap-3 sm:flex sm:flex-wrap">{children}</div>;
}
