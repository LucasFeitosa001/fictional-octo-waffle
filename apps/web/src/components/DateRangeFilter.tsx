import type { ReactNode } from 'react';

/**
 * Shared, brand-styled date inputs for filter bars.
 *
 * The HeroUI v3 DatePicker renders broken inside compact filter bars, so we use
 * native `<input type="date">` elements styled with Tailwind to match the pink
 * Beautypass brand. Clean label, rounded border, accent focus ring, and a
 * consistent height so date filters line up with HeroUI Select/Input/Button.
 */

const fieldClass =
  'h-10 rounded-lg border border-default-200 bg-white px-3 text-sm text-foreground ' +
  'shadow-sm outline-none transition-colors ' +
  'focus:border-[#f2b33d] focus:ring-2 focus:ring-[#f2b33d]/30 ' +
  '[color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer ' +
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
    <label className={`flex min-w-[9.5rem] flex-col gap-1 ${className ?? ''}`}>
      {label && (
        <span className="text-xs font-medium text-muted">{label}</span>
      )}
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

/** A single labelled native month input (YYYY-MM). */
export function MonthField({
  label,
  value,
  onChange,
  className,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`flex min-w-[9.5rem] flex-col gap-1 ${className ?? ''}`}>
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={fieldClass}
      />
    </label>
  );
}

/**
 * A two-input "from → to" date range, used in dashboards and report headers.
 * Exposes `from`/`to` as YYYY-MM-DD strings.
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
    <div className={`flex flex-wrap items-end gap-3 ${className ?? ''}`}>
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

/**
 * A responsive container for filter controls. Lays children out in a neat row
 * that wraps onto multiple lines on small screens instead of overflowing.
 */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3">{children}</div>
  );
}
