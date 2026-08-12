import { type ReactNode } from 'react';
import { DatePicker, DateRangePicker } from './DatePicker';

/**
 * Shared, brand-styled date fields for filter bars and forms.
 *
 * Todos usam o `DatePicker` reutilizável do projeto (popover no desktop,
 * bottom-sheet no mobile, pt-BR). A API pública destes wrappers foi mantida
 * (`value`/`onChange` em ISO "YYYY-MM-DD") para não quebrar os consumidores.
 * As props `min`/`max` são aceitas por compatibilidade, mas hoje só servem de
 * dica de ordenação; a validação real fica com quem monta o intervalo.
 */

const wrapClass = 'w-full sm:w-auto sm:min-w-[10.5rem]';

/** Campo de data única (label + DatePicker). Valor de entrada/saída em ISO. */
export function DateField({
  label,
  value,
  onChange,
  className,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Aceitos por compat.; não usados como restrição hard. */
  min?: string;
  max?: string;
  className?: string;
}) {
  return (
    <DatePicker
      label={label}
      value={value}
      onChange={onChange}
      ariaLabel={label}
      className={`${wrapClass} ${className ?? ''}`}
    />
  );
}

/**
 * Campo de data pt-BR. Antes era um input mascarado (dd/mm/aaaa); agora usa o
 * `DatePicker` — o formato pt-BR já é garantido pelo calendário. Mantido como
 * alias de `DateField` para os consumidores existentes.
 */
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
  return (
    <DatePicker
      label={label}
      value={value}
      onChange={onChange}
      ariaLabel={label}
      placeholder="dd/mm/aaaa"
      className={`${wrapClass} ${className ?? ''}`}
    />
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
        className={
          'h-11 w-full rounded-xl border border-default-200 bg-white px-3 text-base text-foreground sm:h-10 sm:text-sm ' +
          'shadow-sm outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30 [color-scheme:light]'
        }
      />
    </label>
  );
}

/**
 * A "from → to" date range, used in dashboards and report headers. Agora um
 * único `DateRangePicker` com presets (Hoje, Mês passado…). Expõe
 * `from`/`to` como strings ISO "YYYY-MM-DD".
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  fromLabel,
  className,
}: {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  /** Rótulo do campo. `toLabel` mantido por compat., mas não usado. */
  fromLabel?: string;
  toLabel?: string;
  className?: string;
}) {
  return (
    <DateRangePicker
      label={fromLabel}
      from={from}
      to={to}
      onChange={onChange}
      ariaLabel="Período"
      className={`${wrapClass} ${className ?? ''}`}
    />
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
