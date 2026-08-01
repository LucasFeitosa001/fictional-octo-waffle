import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LoadingState } from '../../components/States';
import {
  IconArrowDown,
  IconArrowUp,
  IconDownload,
  IconWallet,
} from '../../components/icons';
import { formatMoney, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useFinancialSummary } from '../../lib/queries/financeiro';
import { DateRangePicker } from '../../components/DatePicker';
import { useThemeColors } from '../../theme/useThemeColors';
import { FinancialReportShell } from './reportNav';
import { COLOR_GREEN, COLOR_RED, shortDay } from './reportShared';

/* -------------------------------------------------------------------------- */
/*  Fluxo de Caixa — relatório SOBRE DADOS EXISTENTES.                         */
/*  Reaproveita GET /financial/summary (cashFlow por dia: entradas, saídas e   */
/*  saldo acumulado). Sem backend novo: KPIs + gráfico + tabela + CSV.         */
/* -------------------------------------------------------------------------- */

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1); // início do mês
  return { from: isoDate(from), to: isoDate(to) };
}

interface Row {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  balance: number;
}

export function FluxoCaixaPage() {
  const colors = useThemeColors();
  const [range, setRange] = useState(defaultRange);
  const query = useFinancialSummary(range.from, range.to);
  const d = query.data;

  const rows = useMemo<Row[]>(
    () =>
      (d?.cashFlow ?? []).map((c) => ({
        date: c.date,
        inflow: c.inflow,
        outflow: c.outflow,
        net: c.inflow - c.outflow,
        balance: c.balance,
      })),
    [d],
  );

  const chartData = rows.map((r) => ({
    name: shortDay(r.date),
    entradas: r.inflow,
    saidas: r.outflow,
  }));
  const hasData = rows.some((r) => r.inflow !== 0 || r.outflow !== 0);

  function exportCsv() {
    downloadCsv(
      `fluxo-de-caixa-${range.from}_a_${range.to}`,
      [
        { header: 'Data', value: (r: Row) => r.date },
        { header: 'Entradas', value: (r) => String(r.inflow) },
        { header: 'Saídas', value: (r) => String(r.outflow) },
        { header: 'Saldo do dia', value: (r) => String(r.net) },
        { header: 'Saldo acumulado', value: (r) => String(r.balance) },
      ],
      rows,
    );
  }

  return (
    <FinancialReportShell
      activeKey="cash"
      title="Fluxo de Caixa"
      subtitle="Entradas, saídas e saldo acumulado por dia no período"
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
      {/* Período */}
      <div className="mb-4 rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
        <span className="mb-1.5 block text-sm text-ink">Período</span>
        <DateRangePicker
          from={range.from}
          to={range.to}
          onChange={setRange}
          ariaLabel="Período"
          className="max-w-md"
        />
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
                {formatMoney(d?.totalIncome ?? 0)}
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
                {formatMoney(d?.totalExpense ?? 0)}
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
                  (d?.balance ?? 0) >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatMoney(d?.balance ?? 0)}
              </div>
            </div>
          </div>

          {/* Recebimentos separados por forma: o backend já agrupa pelas
              transações pagas; aqui deixamos Pix, dinheiro e cartão visíveis
              sem misturar com o saldo geral. */}
          <div className="mt-4 rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="m-0 text-sm font-semibold text-ink">Recebimentos por forma de pagamento</h3>
              <span className="text-xs text-muted-ink">Somente entradas pagas no período</span>
            </div>
            {(d?.byPaymentMethod ?? []).length === 0 ? (
              <p className="m-0 text-sm text-muted-ink">Nenhum recebimento no período.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {(d?.byPaymentMethod ?? []).map((m) => (
                  <div key={m.paymentMethodId ?? 'none'} className="rounded-xl border border-line/70 bg-canvas/40 px-4 py-3">
                    <div className="truncate text-xs font-medium text-muted-ink">{m.paymentMethodName}</div>
                    <div className="mt-1 text-xl font-bold text-success">{formatMoney(m.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gráfico */}
          <div className="mt-4 rounded-2xl border border-line bg-card p-5 shadow-[var(--shadow-card)]">
            <h3 className="mb-3 text-sm font-semibold text-ink">Entradas × Saídas por dia</h3>
            {!hasData ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-ink">
                Sem movimentações no período.
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.chartGrid} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: colors.chartAxis }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: colors.chartAxis }}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                      tickFormatter={(v: number) => formatMoney(v)}
                    />
                    <Tooltip formatter={(v: number) => formatMoney(v)} />
                    <Bar dataKey="entradas" radius={[4, 4, 0, 0]} maxBarSize={28}>
                      {chartData.map((row) => (
                        <Cell key={`in-${row.name}`} fill={COLOR_GREEN} />
                      ))}
                    </Bar>
                    <Bar dataKey="saidas" radius={[4, 4, 0, 0]} maxBarSize={28}>
                      {chartData.map((row) => (
                        <Cell key={`out-${row.name}`} fill={COLOR_RED} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Tabela */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="text-sm font-semibold text-ink">Movimentações por dia</h3>
              <span className="text-xs text-muted-ink">{rows.length} dia(s)</span>
            </div>
            {rows.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-ink">
                Sem movimentações no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3 text-right">Entradas</th>
                      <th className="px-5 py-3 text-right">Saídas</th>
                      <th className="px-5 py-3 text-right">Saldo do dia</th>
                      <th className="px-5 py-3 text-right">Saldo acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.date}
                        className="border-b border-line/70 last:border-0 hover:bg-ink/5"
                      >
                        <td className="px-5 py-3 font-medium text-ink">{shortDay(r.date)}</td>
                        <td className="px-5 py-3 text-right text-success">
                          {formatMoney(r.inflow)}
                        </td>
                        <td className="px-5 py-3 text-right text-danger">
                          {formatMoney(r.outflow)}
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-medium ${
                            r.net >= 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {formatMoney(r.net)}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-ink">
                          {formatMoney(r.balance)}
                        </td>
                      </tr>
                    ))}
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
