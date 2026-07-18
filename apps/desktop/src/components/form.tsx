// Campos de formulário declarativos: as páginas de CRUD descrevem os campos
// (FieldDef) e o FormModal monta o grid, o estado e a validação básica.
//
// Datas e horários NÃO usam <input type="date|time|month">: o popover de
// calendário do WebKitGTK trava a janela inteira no Tauri (pointer grab sem
// render em WSLg/containers). Data é texto mascarado dd/mm/aaaa; horário é
// select de slots.

import { useEffect, useRef, useState } from 'react';

export type FormValues = Record<string, string | number | boolean>;

interface DateSegments {
  d: string;
  m: string;
  y: string;
}

function segmentsFromISO(iso: string): DateSegments {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { d: m[3], m: m[2], y: m[1] } : { d: '', m: '', y: '' };
}

/** {d,m,y} completos -> ISO; null se a data não existe no calendário. */
function segmentsToISO({ d, m, y }: DateSegments): string | null {
  if (d.length !== 2 || m.length !== 2 || y.length !== 4) return null;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const probe = new Date(year, month - 1, day);
  const valid =
    year >= 1900 && probe.getFullYear() === year && probe.getMonth() === month - 1 && probe.getDate() === day;
  return valid ? `${y}-${m}-${d}` : null;
}

/** Campo de data segmentado (dia/mês/ano) que emite/recebe ISO (YYYY-MM-DD).
 *  Clicar num segmento seleciona o valor (digitar substitui), completar um
 *  segmento pula para o próximo e Backspace num segmento vazio volta.
 *  Ao sair do campo, dia/mês com 1 dígito e ano com 2 são completados
 *  (6/7/26 -> 06/07/2026); se a data ficar inválida, volta ao último valor. */
export function DateTextInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
}) {
  const [seg, setSeg] = useState<DateSegments>(() => segmentsFromISO(value));
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const inside = useRef(false);

  useEffect(() => {
    if (!inside.current) setSeg(segmentsFromISO(value));
  }, [value]);

  const complete = seg.d.length === 2 && seg.m.length === 2 && seg.y.length === 4;
  const invalid = complete && segmentsToISO(seg) === null;

  function commit(next: DateSegments) {
    setSeg(next);
    const iso = segmentsToISO(next);
    if (iso) onChange(iso);
    else if (!next.d && !next.m && !next.y) onChange('');
  }

  function handleDay(raw: string) {
    const digits = raw.replace(/\D/g, '');
    // Colou a data inteira no primeiro campo? Distribui nos três segmentos.
    if (digits.length > 4) {
      commit({ d: digits.slice(0, 2), m: digits.slice(2, 4), y: digits.slice(4, 8) });
      yearRef.current?.focus();
      return;
    }
    let d = digits.slice(0, 2);
    if (d.length === 1 && Number(d) > 3) d = `0${d}`;
    commit({ ...seg, d });
    if (d.length === 2) monthRef.current?.focus();
  }

  function handleMonth(raw: string) {
    let m = raw.replace(/\D/g, '').slice(0, 2);
    if (m.length === 1 && Number(m) > 1) m = `0${m}`;
    commit({ ...seg, m });
    if (m.length === 2) yearRef.current?.focus();
  }

  function handleYear(raw: string) {
    commit({ ...seg, y: raw.replace(/\D/g, '').slice(0, 4) });
  }

  /** Backspace num segmento vazio volta o foco para o segmento anterior. */
  function backTo(prev: React.RefObject<HTMLInputElement | null>, current: string) {
    return (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace' && current === '') {
        e.preventDefault();
        prev.current?.focus();
        prev.current?.select();
      }
    };
  }

  function handleBlurOut(e: React.FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    inside.current = false;
    // Completa segmentos curtos (6/7/26 -> 06/07/2026) e valida.
    const padded: DateSegments = {
      d: seg.d.length === 1 ? `0${seg.d}` : seg.d,
      m: seg.m.length === 1 ? `0${seg.m}` : seg.m,
      y: seg.y.length === 2 ? `20${seg.y}` : seg.y,
    };
    const iso = segmentsToISO(padded);
    if (iso) {
      setSeg(padded);
      onChange(iso);
    } else if (!padded.d && !padded.m && !padded.y) {
      onChange('');
    } else {
      setSeg(segmentsFromISO(value));
    }
  }

  const segClass = 'bg-transparent text-center focus:outline-none focus:bg-brand-50 rounded placeholder:text-ink-300';

  return (
    <div
      className={`flex items-center ${className ?? `${inputClass} cursor-text`} ${invalid ? '!border-rose-300 !ring-2 !ring-rose-100' : ''}`}
      onFocus={() => {
        inside.current = true;
      }}
      onBlur={handleBlurOut}
      onClick={(e) => {
        // clicar no espaço do contêiner (fora dos segmentos) foca o dia
        if (e.target === e.currentTarget) dayRef.current?.focus();
      }}
      title={invalid ? 'Data inválida' : undefined}
    >
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        placeholder="dd"
        value={seg.d}
        onFocus={(e) => e.target.select()}
        onChange={(e) => handleDay(e.target.value)}
        className={`w-7 ${segClass}`}
        aria-label="Dia"
      />
      <span className="select-none text-ink-300">/</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        placeholder="mm"
        value={seg.m}
        onFocus={(e) => e.target.select()}
        onChange={(e) => handleMonth(e.target.value)}
        onKeyDown={backTo(dayRef, seg.m)}
        className={`w-7 ${segClass}`}
        aria-label="Mês"
      />
      <span className="select-none text-ink-300">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        placeholder="aaaa"
        value={seg.y}
        onFocus={(e) => e.target.select()}
        onChange={(e) => handleYear(e.target.value)}
        onKeyDown={backTo(monthRef, seg.y)}
        className={`w-11 ${segClass}`}
        aria-label="Ano"
      />
    </div>
  );
}

/** Slots de horário de 15 em 15 min (06:00–21:45), incluindo o valor atual se for fora da grade. */
function timeOptions(current: string): string[] {
  const opts: string[] = [];
  for (let h = 6; h <= 21; h += 1) {
    for (const m of [0, 15, 30, 45]) {
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  if (current && !opts.includes(current)) {
    opts.push(current);
    opts.sort();
  }
  return opts;
}

interface BaseField {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  /** Colunas ocupadas no grid de 3 (padrão 1). */
  span?: 1 | 2 | 3;
}

export type FieldDef =
  | (BaseField & { kind: 'text' })
  | (BaseField & { kind: 'date' })
  | (BaseField & { kind: 'time' })
  | (BaseField & { kind: 'textarea'; rows?: number })
  | (BaseField & { kind: 'number'; step?: number; min?: number })
  | (BaseField & { kind: 'select'; options: { value: string; label: string }[] })
  | (BaseField & { kind: 'checkbox' });

const inputClass =
  'min-h-12 w-full rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-base text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:min-h-11 sm:text-sm';

export function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  if (field.kind === 'checkbox') {
    return (
      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-ink-100 bg-white px-3 py-2.5">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="size-5 rounded accent-brand-600"
        />
        <span className="text-sm text-ink-700">{field.label}</span>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-500">
        {field.label}
        {field.required ? <span className="text-brand-600"> *</span> : null}
      </span>
      {field.kind === 'textarea' ? (
        <textarea
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={field.rows ?? 3}
          className={inputClass}
        />
      ) : field.kind === 'select' ? (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.kind === 'date' ? (
        <DateTextInput value={String(value ?? '')} onChange={onChange} />
      ) : field.kind === 'time' ? (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {!value ? <option value="">Selecione...</option> : null}
          {timeOptions(String(value ?? '')).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      ) : field.kind === 'number' ? (
        <input
          type="number"
          // defaultValue: o input mantém o texto digitado (dá para apagar e redigitar
          // sem o campo voltar a 0); o estado do form recebe o número interpretado.
          defaultValue={value === undefined || value === '' ? '' : String(value)}
          step={field.step ?? 1}
          min={field.min}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className={inputClass}
        />
      ) : (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
    </label>
  );
}

const SPANS = { 1: '', 2: 'sm:col-span-2', 3: 'sm:col-span-3' } as const;

export function FieldGrid({
  fields,
  values,
  onChange,
}: {
  fields: FieldDef[];
  values: FormValues;
  onChange: (name: string, value: string | number | boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {fields.map((field) => (
        <div key={field.name} className={SPANS[field.span ?? 1]}>
          <FieldInput field={field} value={values[field.name] ?? ''} onChange={(v) => onChange(field.name, v)} />
        </div>
      ))}
    </div>
  );
}

/** Campos obrigatórios vazios (para desabilitar o salvar). */
export function missingRequired(fields: FieldDef[], values: FormValues): string[] {
  return fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = values[f.name];
      return v === undefined || v === null || String(v).trim() === '';
    })
    .map((f) => f.label);
}
