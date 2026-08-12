import type { ReactNode } from 'react';
import { DateRangePicker } from '../../components/DatePicker';
import { Drawer } from '../../components/Drawer';
import { IconDownload } from '../../components/icons';
import { isoDate } from '../../lib/format';
import { requestReportPdf, ReportPdfOption } from './ReportPdfButton';

/* -------------------------------------------------------------------------- */
/*  Kit compartilhado dos GERADORES de relatório do módulo Financeiro.         */
/*  Mesma casca/estilo do Belasis (VendasPage / DrePage): card de filtro com   */
/*  Período + "Gerar relatório" (split "…" abre o drawer de exportação),       */
/*  KPIs, estados de loading/vazio e drawer de export CSV. Interações seguem   */
/*  o tema; dados e estados usam papéis fixos. Mobile-first.                   */
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
  // O padrão de todos os relatórios é um mês corrido até hoje. Mantemos o
  // parâmetro para chamadas específicas que realmente pedem outra quantidade
  // de dias.
  if (days === 30) from.setMonth(from.getMonth() - 1);
  else from.setDate(from.getDate() - days);
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

const TONE = {
  sales: 'bg-[var(--sp-data-sales-soft)] text-data-sales',
  appointments: 'bg-[var(--sp-data-appointments-soft)] text-data-appointments',
  orders: 'bg-[var(--sp-data-orders-soft)] text-data-orders',
  customers: 'bg-[var(--sp-data-customers-soft)] text-data-customers',
  services: 'bg-[var(--sp-data-services-soft)] text-data-services',
  products: 'bg-[var(--sp-data-products-soft)] text-data-products',
  stock: 'bg-[var(--sp-data-stock-soft)] text-data-stock',
  messages: 'bg-[var(--sp-data-messages-soft)] text-data-messages',
  reviews: 'bg-[var(--sp-data-reviews-soft)] text-data-reviews',
  income: 'bg-[var(--sp-data-income-soft)] text-data-income',
  expense: 'bg-[var(--sp-data-expense-soft)] text-data-expense',
  receivable: 'bg-[var(--sp-data-receivable-soft)] text-data-receivable',
  payable: 'bg-[var(--sp-data-payable-soft)] text-data-payable',
  balance: 'bg-[var(--sp-data-balance-soft)] text-data-balance',
  success: 'bg-status-success-soft text-status-success-fg',
  danger: 'bg-status-danger-soft text-status-danger-fg',
  warning: 'bg-status-warning-soft text-status-warning-fg',
  neutral: 'bg-status-neutral-soft text-status-neutral-fg',
};

/** Cartão de KPI (mesmo layout das outras páginas de relatório). */
export function Kpi({
  icon,
  title,
  value,
  hint,
  tone,
  valueTone,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  hint?: string;
  tone: keyof typeof TONE;
  valueTone?: 'success' | 'danger';
}) {
  const valueClass =
    valueTone === 'success'
      ? 'text-status-success-fg'
      : valueTone === 'danger'
        ? 'text-status-danger-fg'
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
            <DateRangePicker
              from={range.from}
              to={range.to}
              onChange={onRange}
              ariaLabel="Período"
            />
          </div>
          {children}
        </div>

        {/* Botão split: Gerar relatório + "…" (opções de exportação) */}
        <div className="flex w-full items-stretch gap-2 sm:w-auto sm:self-end">
          <ReportPdfOption />
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

/** Drawer de exportação: CSV e PDF imprimível com assinatura. */
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
          onClick={() => { onClose(); requestReportPdf(); }}
          className="flex items-center gap-3 rounded-lg border border-line bg-card px-4 py-3 text-left text-sm font-medium text-ink transition-colors hover:bg-primary/5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconDownload size={18} />
          </span>
          <span className="flex flex-col">
            <span>Exportar PDF</span>
            <span className="text-xs font-normal text-muted-ink">Abre o PDF com campo de assinatura</span>
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
    ? 'bg-status-danger-soft text-status-danger-fg'
    : settled
      ? 'bg-status-success-soft text-status-success-fg'
      : 'bg-status-warning-soft text-status-warning-fg';
  const label = overdue ? 'Vencido' : settled ? 'Liquidado' : 'Em aberto';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
