import { useEffect, useState, type ReactNode } from 'react';

/**
 * Shared, brand-styled date inputs for filter bars.
 *
 * The HeroUI v3 DatePicker renders broken inside compact filter bars, so we use
 * native `<input type="date">` elements styled with Tailwind to match the pink
 * Beautypass brand. Clean label, rounded border, accent focus ring, and a
 * consistent height so date filters line up with HeroUI Select/Input/Button.
 */

const fieldClass =
  'h-11 w-full rounded-xl border border-default-200 bg-white px-3 text-base text-foreground sm:h-10 sm:text-sm ' +
  'shadow-sm outline-none transition-colors ' +
  'focus:border-gold focus:ring-2 focus:ring-gold/30 ' +
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
    <label className={`flex w-full flex-col gap-1 sm:w-auto sm:min-w-[9.5rem] ${className ?? ''}`}>
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

// ── pt-BR date field (dd/mm/aaaa) ─────────────────────────────────────────────
// O <input type="date"> nativo mostra o formato do NAVEGADOR (às vezes mm/dd/aaaa).
// Este campo mascarado garante dd/mm/aaaa sempre, convertendo de/para ISO (YYYY-MM-DD).

function isoToBr(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function brToIso(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd), mo = Number(mm);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function maskBr(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** Campo de data pt-BR (dd/mm/aaaa) — valor de entrada/saída em ISO (YYYY-MM-DD). */
export function DateFieldBR({
  label,
  value,
  onChange,
  className,
}: {
  label?: string;
  value: string;
  onChange: (isoValue: string) => void;
  className?: string;
}) {
  const [text, setText] = useState(() => isoToBr(value));
  // Ressincroniza quando o valor externo muda (ex.: abrir para editar).
  useEffect(() => {
    setText(isoToBr(value));
  }, [value]);

  function handle(raw: string) {
    const masked = maskBr(raw);
    setText(masked);
    if (masked === '') {
      onChange('');
      return;
    }
    const iso = brToIso(masked);
    if (iso) onChange(iso);
  }

  return (
    <label className={`flex w-full flex-col gap-1 sm:w-auto sm:min-w-[9.5rem] ${className ?? ''}`}>
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/aaaa"
        value={text}
        onChange={(e) => handle(e.target.value)}
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
    <label className={`flex w-full flex-col gap-1 sm:w-auto sm:min-w-[9.5rem] ${className ?? ''}`}>
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
