import type { ReactNode } from 'react';
import { Drawer } from '../../components/Drawer';
import { IconCalendar, IconChevron, IconDownload } from '../../components/icons';
import { isoDate } from '../../lib/format';

/* -------------------------------------------------------------------------- */
/*  Kit compartilhado dos GERADORES de relatório do módulo Financeiro.         */
/*  Mesma casca/estilo do Belasis (VendasPage / DrePage): card de filtro com   */
/*  Período + "Gerar relatório" (split "…" abre o drawer de exportação),       */
/*  KPIs, estados de loading/vazio e drawer de export CSV. Cores 100%          */
/*  themeable via tokens (--sp-*). Mobile-first.                               */
/* -------------------------------------------------------------------------- */

/** Card no estilo Belasis (branco + sombra suave), 100% themeable. */
export const CARD = 'rounded-xl border border-line bg-card shadow-[var(--shadow-card)]';

export interface DateRange {
  from: string;
  to: string;
}

/** Intervalo padrão dos últimos N dias (para receitas/aging). */
export function rangeLastDays(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from: isoDate(from), to: isoDate(to) };
}

/** Intervalo padrão dos últimos N meses (para projeção/histórico). */
export function rangeLastMonths(months: number): DateRange {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - months, 1);
  return { from: isoDate(from), to: isoDate(to) };
}

/** "YYYY-MM" -> "MM/AA" para eixos e labels de gráficos por mês. */
export function shortMonth(m: string): string {
  const [y, mo] = m.split('-');
  return mo ? `${mo}/${(y ?? '').slice(2)}` : m;
}

const TONE: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/12 text-success',
  danger: 'bg-danger/12 text-danger',
  gold: 'bg-gold/15 text-gold-strong',
};

/** Cartão de KPI (mesmo layout das outras páginas de relatório). */
export function Kpi({
  icon,
  title,
  value,
  hint,
  tone = 'primary',
  valueTone,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  hint?: string;
  tone?: keyof typeof TONE;
  valueTone?: 'success' | 'danger';
}) {
  const valueClass =
    valueTone === 'success'
      ? 'text-success'
      : valueTone === 'danger'
        ? 'text-danger'
        : 'text-ink';
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE[tone]}`}>
          {icon}
        </span>
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <div className={`mt-3 text-2xl font-bold sm:text-3xl ${valueClass}`}>{value}</div>
      {hint && <p className="mt-1 text-sm text-muted-ink">{hint}</p>}
    </div>
  );
}

/**
 * Card de filtro: Período (range picker) + botão "Gerar relatório" (split "…").
 * `children` permite injetar filtros extras (selects) na mesma grade.
 */
export function FinancialFilterCard({
  range,
  onRange,
  onSubmit,
  onExport,
  isFetching = false,
  children,
}: {
  range: DateRange;
  onRange: (r: DateRange) => void;
  onSubmit: () => void;
  onExport?: () => void;
  isFetching?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink">Período</label>
            <div className="flex h-11 items-center gap-2 rounded-lg border border-line bg-card px-3 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 sm:h-10">
              <input
                type="date"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) => onRange({ ...range, from: e.target.value })}
                aria-label="Data inicial"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none [color-scheme:light]"
              />
              <IconChevron size={14} className="-rotate-90 shrink-0 text-muted-ink" aria-hidden />
              <input
                type="date"
                value={range.to}
                min={range.from || undefined}
                onChange={(e) => onRange({ ...range, to: e.target.value })}
                aria-label="Data final"
                className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none [color-scheme:light]"
              />
              <IconCalendar size={16} className="shrink-0 text-muted-ink" aria-hidden />
            </div>
          </div>
          {children}
        </div>

        {/* Botão split: Gerar relatório + "…" (opções de exportação) */}
        <div className="flex w-full items-stretch sm:w-auto sm:self-end">
          <button
            type="submit"
            disabled={isFetching}
            className="flex h-10 flex-1 items-center justify-center rounded-l-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:min-w-[168px]"
          >
            {isFetching ? 'Gerando…' : 'Gerar relatório'}
          </button>
          <button
            type="button"
            onClick={onExport}
            aria-label="Mais opções"
            title="Mais opções"
            className="flex h-10 w-10 items-center justify-center rounded-r-lg border-l border-primary-foreground/20 bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          >
            <span className="text-lg leading-none tracking-widest" aria-hidden>
              ···
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}

/** Estado de carregamento inline (mesmo visual das outras páginas). */
export function ReportLoading() {
  return (
    <div className={`${CARD} mt-4 flex h-64 items-center justify-center text-sm text-muted-ink`}>
      Carregando…
    </div>
  );
}

/** Estado vazio inline. */
export function ReportEmpty({
  title = 'Não há dados',
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div
      className={`${CARD} mt-4 flex h-64 flex-col items-center justify-center gap-1 text-center`}
    >
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-sm px-6 text-sm text-muted-ink">{description}</p>}
    </div>
  );
}

/** Drawer de exportação (CSV agora; PDF marcado "Em breve"). */
export function ExportDrawer({
  open,
  onClose,
  description,
  onExportCsv,
  canExport,
}: {
  open: boolean;
  onClose: () => void;
  description: string;
  onExportCsv: () => void;
  canExport: boolean;
}) {
  return (
    <Drawer isOpen={open} onClose={onClose} title="Exportar relatório">
      <p className="mb-4 text-sm text-muted-ink">{description}</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onExportCsv}
          disabled={!canExport}
          className="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:bg-primary/5 disabled:opacity-50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconDownload size={18} />
          </span>
          <span className="flex flex-col">
            <span>Exportar CSV</span>
            <span className="text-xs font-normal text-muted-ink">Planilha com o resumo do período</span>
          </span>
        </button>
        {/* TODO: exportação em Excel/PDF depende de endpoint dedicado no backend */}
        <button
          type="button"
          disabled
          className="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 text-left text-sm font-medium text-muted-ink opacity-60"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconDownload size={18} />
          </span>
          <span className="flex flex-col">
            <span>Exportar PDF</span>
            <span className="text-xs font-normal text-muted-ink">Em breve</span>
          </span>
        </button>
      </div>
    </Drawer>
  );
}

/** Badge de status para itens de contas (aberto / vencido / liquidado). */
export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const overdue = s.includes('overdue') || s.includes('vencid');
  const settled =
    s.includes('paid') || s.includes('received') || s.includes('pago') || s.includes('receb');
  const cls = overdue
    ? 'bg-danger/12 text-danger'
    : settled
      ? 'bg-success/12 text-success'
      : 'bg-gold/15 text-gold-strong';
  const label = overdue ? 'Vencido' : settled ? 'Liquidado' : 'Em aberto';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
