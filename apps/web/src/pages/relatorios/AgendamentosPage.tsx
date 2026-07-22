import { useState } from 'react';
import { IconCalendar, IconChevron } from '../../components/icons';
import { isoDate } from '../../lib/format';
import { useReportsOverview } from '../../lib/queries/relatorios';
import { CalendarReportShell } from './reportNav';

/* -------------------------------------------------------------------------- */
/*  Clone 100% fiel da página "Todos os Agendamentos" do Belasis              */
/*  (rota /reports/calendars/all). É um GERADOR de relatório: menu de tipos   */
/*  à esquerda + formulário de configuração à direita + "Gerar relatório".    */
/*  Cores 100% themeable via tokens (--sp-*). Mobile-first.                    */
/* -------------------------------------------------------------------------- */

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: isoDate(from), to: isoDate(to) };
}

// ---- Colunas selecionáveis do relatório (ordem idêntica ao Belasis) --------
const COLUMN_OPTIONS = [
  { value: 'employee', label: 'Profissional' },
  { value: 'date', label: 'Data' },
  { value: 'start_hour', label: 'Horário inicial' },
  { value: 'end_hour', label: 'Horário final' },
  { value: 'service', label: 'Serviço' },
  { value: 'client', label: 'Cliente' },
  { value: 'client_cellphone', label: 'Celular' },
  { value: 'address', label: 'Endereço' },
  { value: 'city_state', label: 'Cidade e Estado' },
  { value: 'obs', label: 'Observação' },
  { value: 'duration', label: 'Duração' },
  { value: 'status', label: 'Status' },
  { value: 'color', label: 'Cor' },
] as const;

// ---- Controle segmentado (ant-radio-group-solid) — themeable --------------
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-line">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              'px-4 py-1.5 text-sm font-medium transition-colors',
              i > 0 ? 'border-l border-line' : '',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-ink hover:bg-canvas',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Rótulo de campo de formulário (ant-form-item-label) -------------------
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm text-ink" title={String(children)}>
      {children}
    </span>
  );
}

export function AgendamentosPage() {
  const [range, setRange] = useState(defaultRange);
  const [layout, setLayout] = useState<'portrait' | 'landscape'>('portrait');
  const [employeeStatus, setEmployeeStatus] = useState<'all' | 'actives' | 'inactives'>('all');
  const [columnsOption, setColumnsOption] = useState<'columns' | 'empty_columns'>('columns');
  const [groupBy, setGroupBy] = useState('all');
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(COLUMN_OPTIONS.map((c) => c.value)),
  );

  // Data-wiring preservado: dispara a query de overview para o período escolhido.
  const query = useReportsOverview(range.from, range.to);

  function toggleColumn(v: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  function gerarRelatorio() {
    // TODO: endpoint de geração de relatório de agendamentos (PDF) não existe
    // ainda no backend SalonPass — por ora reprocessa a query do período.
    query.refetch();
  }

  return (
    <CalendarReportShell
      activeKey="all"
      title="Todos os Agendamentos"
      subtitle="Configure e gere o relatório de agendamentos do período"
    >
        {/* ---- Formulário de configuração do relatório ------------------- */}
        <form
          className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:p-6"
          onSubmit={(e) => {
            e.preventDefault();
            gerarRelatorio();
          }}
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
            {/* Layout */}
            <div>
              <FieldLabel>Layout</FieldLabel>
              <Segmented
                value={layout}
                onChange={setLayout}
                options={[
                  { value: 'portrait', label: 'Retrato' },
                  { value: 'landscape', label: 'Paisagem' },
                ]}
              />
            </div>

            {/* Período */}
            <div>
              <FieldLabel>Período</FieldLabel>
              <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-card px-3 text-sm text-ink focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/30">
                <input
                  type="date"
                  value={range.from}
                  max={range.to || undefined}
                  onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                  aria-label="Data inicial"
                  className="min-w-0 flex-1 bg-transparent outline-none [color-scheme:light]"
                />
                <IconChevron size={14} className="shrink-0 -rotate-90 text-muted-ink" />
                <input
                  type="date"
                  value={range.to}
                  min={range.from || undefined}
                  onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                  aria-label="Data final"
                  className="min-w-0 flex-1 bg-transparent outline-none [color-scheme:light]"
                />
                <IconCalendar size={16} className="shrink-0 text-muted-ink" />
              </div>
            </div>

            {/* Profissionais */}
            <div>
              <FieldLabel>Profissionais</FieldLabel>
              <Segmented
                value={employeeStatus}
                onChange={setEmployeeStatus}
                options={[
                  { value: 'all', label: 'Todos' },
                  { value: 'actives', label: 'Ativos' },
                  { value: 'inactives', label: 'Inativos' },
                ]}
              />
            </div>

            {/* Colunas */}
            <div>
              <FieldLabel>Colunas</FieldLabel>
              <Segmented
                value={columnsOption}
                onChange={setColumnsOption}
                options={[
                  { value: 'columns', label: 'Informativa' },
                  { value: 'empty_columns', label: 'Em Branco' },
                ]}
              />
            </div>

            {/* Agrupar por */}
            <div>
              <FieldLabel>Agrupar por</FieldLabel>
              <div className="relative">
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  aria-label="Agrupar por"
                  className="h-11 w-full appearance-none rounded-xl border border-line bg-card px-3 pr-9 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30"
                >
                  <option value="all">Todos</option>
                  <option value="employee">Profissional</option>
                  <option value="date">Data</option>
                </select>
                <IconChevron
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink"
                />
              </div>
            </div>
          </div>

          {/* Checklist de colunas do relatório */}
          <div className="mt-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 md:grid-cols-3">
              {COLUMN_OPTIONS.map((c) => (
                <label
                  key={c.value}
                  className="flex cursor-pointer items-center gap-2 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(c.value)}
                    onChange={() => toggleColumn(c.value)}
                    className="h-4 w-4 shrink-0 rounded border-line accent-[var(--sp-primary)]"
                  />
                  <span className="min-w-0 truncate">{c.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Ação: Gerar relatório (botão primário) */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={query.isFetching}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {query.isFetching ? 'Gerando…' : 'Gerar relatório'}
              <IconChevron size={16} className="rotate-180" />
            </button>
          </div>
        </form>
    </CalendarReportShell>
  );
}
