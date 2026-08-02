import { useState } from 'react';
import { DateRangePicker } from '../../components/DatePicker';
import { LoadingState } from '../../components/States';
import {
  IconArrowDown,
  IconArrowUp,
  IconDownload,
  IconWallet,
} from '../../components/icons';
import { formatDate, formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import {
  fetchAllTransactions,
  useTransactions,
  type TransactionKind,
  type TransactionRow,
} from '../../lib/queries/financeiro';
import { FinancialReportShell } from './reportNav';

/* -------------------------------------------------------------------------- */
/*  Extrato de Movimentações — relatório SOBRE DADOS EXISTENTES.               */
/*  Extrato cronológico plano de TODAS as movimentações (GET /transactions),   */
/*  com filtro de tipo e período. Sem backend novo. KPIs + tabela + CSV.       */
/* -------------------------------------------------------------------------- */

function defaultRange() {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 1);
  return { from: isoDate(from), to: isoDate(to) };
}

const TYPE_OPTIONS: { value: 'all' | TransactionKind; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'income', label: 'Entradas' },
  { value: 'expense', label: 'Saídas' },
];

function txDate(t: TransactionRow): string {
  return t.paidAt ?? t.dueDate ?? t.createdAt;
}

export function ExtratoMovimentacoesPage() {
  const [range, setRange] = useState(defaultRange);
  const [type, setType] = useState<'all' | TransactionKind>('all');

  const filters = {
    from: range.from || undefined,
    to: range.to || undefined,
    type: type === 'all' ? undefined : type,
    pageSize: 200,
  };
  const query = useTransactions(filters);
  const rows = query.data?.data ?? [];
  const totals = query.data?.totals ?? { income: 0, expense: 0, balance: 0 };

  async function exportCsv() {
    const all = await fetchAllTransactions({
      from: range.from || undefined,
      to: range.to || undefined,
      type: type === 'all' ? undefined : type,
    });
    downloadCsv(
      `extrato-movimentacoes-${range.from}_a_${range.to}`,
      [
        { header: 'Data', value: (t: TransactionRow) => txDate(t)?.slice(0, 10) ?? '' },
        { header: 'Descrição', value: (t) => t.description ?? t.category?.name ?? '' },
        { header: 'Categoria', value: (t) => t.category?.name ?? '' },
        { header: 'Conta', value: (t) => t.account?.name ?? '' },
        { header: 'Forma de pagamento', value: (t) => t.paymentMethod?.name ?? '' },
        { header: 'Tipo', value: (t) => (t.kind === 'income' ? 'Entrada' : 'Saída') },
        { header: 'Valor', value: (t) => String(t.grossAmount) },
      ],
      all,
    );
  }

  return (
    <FinancialReportShell
      activeKey="movements"
      title="Extrato de Movimentações"
      subtitle="Lançamentos de entrada e saída no período, em ordem cronológica"
      actions={
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
        >
          <IconDownload size={16} /> Exportar CSV
        </button>
      }
    >
      {/* Filtros: período + tipo */}
      <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-end sm:gap-6 sm:p-5">
        <div className="min-w-0 flex-1">
          <span className="mb-1.5 block text-sm text-ink">Período</span>
          <DateRangePicker
            from={range.from}
            to={range.to}
            onChange={setRange}
            ariaLabel="Período"
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm text-ink">Tipo</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-line">
            {TYPE_OPTIONS.map((o, i) => {
              const active = o.value === type;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setType(o.value)}
                  className={[
                    'px-4 py-2 text-sm font-medium transition-colors',
                    i > 0 ? 'border-l border-line' : '',
                    active ? 'bg-primary text-primary-foreground' : 'bg-card text-ink hover:bg-canvas',
                  ].join(' ')}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/12 text-success">
                  <IconArrowUp size={18} />
                </span>
                <span className="text-sm font-medium text-ink">Entradas</span>
              </div>
              <div className="mt-3 text-2xl font-bold text-success sm:text-3xl">
                {formatMoney(totals.income)}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger/12 text-danger">
                  <IconArrowDown size={18} />
                </span>
                <span className="text-sm font-medium text-ink">Saídas</span>
              </div>
              <div className="mt-3 text-2xl font-bold text-danger sm:text-3xl">
                {formatMoney(totals.expense)}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sp-data-balance-soft)] text-data-balance">
                  <IconWallet size={18} />
                </span>
                <span className="text-sm font-medium text-ink">Saldo</span>
              </div>
              <div
                className={`mt-3 text-2xl font-bold sm:text-3xl ${
                  totals.balance >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatMoney(totals.balance)}
              </div>
            </div>
          </div>

          {/* Extrato */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-sm font-semibold text-ink">Extrato</h3>
              <span className="text-xs text-muted-ink">{rows.length} lançamento(s)</span>
            </div>
            {rows.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-ink">
                Nenhuma movimentação no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3">Descrição</th>
                      <th className="px-5 py-3">Categoria</th>
                      <th className="px-5 py-3">Conta</th>
                      <th className="px-5 py-3">Forma</th>
                      <th className="px-5 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => {
                      const income = t.kind === 'income';
                      return (
                        <tr
                          key={t.id}
                          className="border-b border-line/70 last:border-0 hover:bg-ink/5"
                        >
                          <td className="whitespace-nowrap px-5 py-3 text-muted-ink">
                            {formatDate(txDate(t))}
                          </td>
                          <td className="px-5 py-3 font-medium text-ink">
                            {t.description ?? t.category?.name ?? '—'}
                            {t.order ? (
                              <span className="ml-1 text-xs text-muted-ink">· C#{t.order.number}</span>
                            ) : null}
                          </td>
                          <td className="px-5 py-3 text-muted-ink">{t.category?.name ?? '—'}</td>
                          <td className="px-5 py-3 text-muted-ink">{t.account?.name ?? '—'}</td>
                          <td className="px-5 py-3 text-muted-ink">{t.paymentMethod?.name ?? '—'}</td>
                          <td
                            className={`whitespace-nowrap px-5 py-3 text-right font-semibold ${
                              income ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {income ? '+' : '−'} {formatMoney(t.grossAmount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </FinancialReportShell>
  );
}
