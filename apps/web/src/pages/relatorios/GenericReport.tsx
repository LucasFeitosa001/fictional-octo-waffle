import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatMoney, isoDate } from '../../lib/format';
import { LoadingState } from '../../components/States';

/* -------------------------------------------------------------------------- */
/*  Relatório genérico sobre um endpoint /reports/<x> que devolve             */
/*  { rows: [...], totals: {...} }. Filtro de Período + "Gerar relatório"      */
/*  (refetch → feedback), tabela no desktop e cards no mobile, linha de total. */
/* -------------------------------------------------------------------------- */

export type ReportCol = {
  key: string;
  label: string;
  kind?: 'money' | 'number' | 'date' | 'datetime' | 'text';
  align?: 'left' | 'right';
};

interface ReportPayload {
  rows: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  period?: { from: string; to: string };
  date?: string;
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from: isoDate(from), to: isoDate(to) };
}

function fmt(v: unknown, kind: ReportCol['kind']): ReactNode {
  if (v === null || v === undefined || v === '') return '—';
  switch (kind) {
    case 'money':
      return formatMoney(Number(v));
    case 'number':
      return new Intl.NumberFormat('pt-BR').format(Number(v));
    case 'date':
      return String(v).slice(0, 10).split('-').reverse().join('/');
    case 'datetime': {
      const d = new Date(String(v));
      return isNaN(d.getTime())
        ? String(v)
        : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    default:
      return String(v);
  }
}

export function GenericReport({
  endpoint,
  columns,
  hasRange = true,
  totalCols,
  emptyMsg = 'Nenhum dado no período selecionado.',
}: {
  endpoint: string;
  columns: ReportCol[];
  hasRange?: boolean;
  /** keys do objeto `totals` a exibir na linha de total, mapeados por coluna. */
  totalCols?: Record<string, string>;
  emptyMsg?: string;
}) {
  const [range, setRange] = useState(defaultRange);
  const [pending, setPending] = useState(range);

  const query = useQuery({
    queryKey: ['report', endpoint, hasRange ? range.from : '', hasRange ? range.to : ''],
    queryFn: () =>
      api.get<ReportPayload>(
        `/reports/${endpoint}`,
        hasRange ? { from: range.from || undefined, to: range.to || undefined } : {},
      ),
  });

  const rows = query.data?.rows ?? [];
  const totals = query.data?.totals ?? {};

  function gerar() {
    setRange(pending);
    // refetch garante feedback (loading + dados) mesmo com filtro igual.
    void query.refetch();
  }

  const gridCols = columns
    .map((c) => (c.align === 'right' ? 'minmax(0,0.8fr)' : 'minmax(0,1.4fr)'))
    .join(' ');

  return (
    <div className="flex flex-col gap-4">
      {/* Filtro: Período + Gerar relatório */}
      <div className="rounded-2xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            gerar();
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          {hasRange && (
            <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink">De</span>
                <input
                  type="date"
                  value={pending.from}
                  onChange={(e) => setPending((r) => ({ ...r, from: e.target.value }))}
                  className="h-10 rounded-lg border border-[var(--color-soft-border)] bg-white px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink">Até</span>
                <input
                  type="date"
                  value={pending.to}
                  onChange={(e) => setPending((r) => ({ ...r, to: e.target.value }))}
                  className="h-10 rounded-lg border border-[var(--color-soft-border)] bg-white px-3 text-sm"
                />
              </label>
            </div>
          )}
          <button
            type="submit"
            className="h-10 shrink-0 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            disabled={query.isFetching}
          >
            {query.isFetching ? 'Gerando…' : 'Gerar relatório'}
          </button>
        </form>
      </div>

      {/* Resultado */}
      {query.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-soft-border)] bg-white p-10 text-center text-sm text-muted-ink">
          {emptyMsg}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-soft-border)] bg-white shadow-[var(--shadow-soft)]">
          {/* Desktop: tabela */}
          <div className="hidden lg:block">
            <div
              className="grid items-center gap-2 border-b border-[var(--color-soft-border)] bg-[color-mix(in_oklab,var(--sp-ink)_3%,transparent)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-ink"
              style={{ gridTemplateColumns: gridCols }}
            >
              {columns.map((c) => (
                <span key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                  {c.label}
                </span>
              ))}
            </div>
            {rows.map((row, i) => (
              <div
                key={i}
                className="grid items-center gap-2 border-b border-[var(--color-soft-border)] px-4 py-2.5 text-sm last:border-0"
                style={{ gridTemplateColumns: gridCols }}
              >
                {columns.map((c) => (
                  <span
                    key={c.key}
                    className={[
                      'truncate',
                      c.align === 'right' ? 'text-right tabular-nums' : '',
                      c.kind === 'money' ? 'font-semibold' : '',
                    ].join(' ')}
                  >
                    {fmt(row[c.key], c.kind)}
                  </span>
                ))}
              </div>
            ))}
            {totalCols && (
              <div
                className="grid items-center gap-2 border-t-2 border-[var(--color-soft-border)] bg-[color-mix(in_oklab,var(--sp-ink)_2%,transparent)] px-4 py-2.5 text-sm font-bold"
                style={{ gridTemplateColumns: gridCols }}
              >
                {columns.map((c, idx) => (
                  <span key={c.key} className={c.align === 'right' ? 'text-right tabular-nums' : ''}>
                    {idx === 0 ? 'Total' : totalCols[c.key] ? fmt(totals[totalCols[c.key]], c.kind) : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mobile: cards */}
          <ul className="flex flex-col divide-y divide-[var(--color-soft-border)] lg:hidden">
            {rows.map((row, i) => (
              <li key={i} className="flex flex-col gap-1 px-3 py-2.5">
                {columns.map((c, idx) => (
                  <div key={c.key} className="flex items-baseline justify-between gap-3">
                    <span className={idx === 0 ? 'text-sm font-semibold text-foreground' : 'text-xs text-muted-ink'}>
                      {idx === 0 ? fmt(row[c.key], c.kind) : c.label}
                    </span>
                    {idx > 0 && (
                      <span className={['text-sm tabular-nums', c.kind === 'money' ? 'font-semibold' : 'text-foreground'].join(' ')}>
                        {fmt(row[c.key], c.kind)}
                      </span>
                    )}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
