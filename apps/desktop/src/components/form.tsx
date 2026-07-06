// Campos de formulário declarativos: as páginas de CRUD descrevem os campos
// (FieldDef) e o FormModal monta o grid, o estado e a validação básica.

export type FormValues = Record<string, string | number | boolean>;

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
  | (BaseField & { kind: 'textarea'; rows?: number })
  | (BaseField & { kind: 'number'; step?: number; min?: number })
  | (BaseField & { kind: 'select'; options: { value: string; label: string }[] })
  | (BaseField & { kind: 'checkbox' });

const inputClass =
  'w-full rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100';

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
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-ink-100 bg-white px-3 py-2.5">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded accent-brand-600"
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
      ) : field.kind === 'number' ? (
        <input
          type="number"
          value={Number(value ?? 0)}
          step={field.step ?? 1}
          min={field.min}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className={inputClass}
        />
      ) : (
        <input
          type={field.kind === 'date' ? 'date' : 'text'}
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
