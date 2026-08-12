import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { IconDollar, IconPercent, IconScissors, IconWallet } from '../../components/icons';
import { formatMoney, formatNumber } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import {
  useReportsServiceRevenue,
  type ServiceRevenueItem,
} from '../../lib/queries/relatorios';
import { useThemeColors } from '../../theme/useThemeColors';
import { FinancialReportShell } from './reportNav';
import {
  CARD,
  ExportDrawer,
  FinancialFilterCard,
  Kpi,
  rangeLastDays,
  ReportEmpty,
  ReportLoading,
  type DateRange,
} from './financialReportKit';

/* -------------------------------------------------------------------------- */
/*  Resultado Líquido de Serviços (rota /reports/financial/service-revenue).   */
/*  Receita bruta de serviços − custos − comissões, por serviço. Gerador de   */
/*  relatório fiel ao Belasis: filtro de Período + "Gerar relatório", depois   */
/*  KPIs, gráfico e tabela detalhada. Loading + vazio. Web e mobile.           */
/* -------------------------------------------------------------------------- */

export function ResultadoServicosPage() {
  const colors = useThemeColors();
  const [range, setRange] = useState<DateRange>(() => rangeLastDays(30));
  const [pending, setPending] = useState<DateRange>(range);
  const [exportOpen, setExportOpen] = useState(false);

  const query = useReportsServiceRevenue(range.from, range.to);
  const d = query.data;
  const items = d?.items ?? [];
  const hasData = items.length > 0;
  const chart = items.slice(0, 8).map((s) => ({ name: s.name, v: s.net }));
  const totalNet = d?.totalNet ?? 0;

  function gerarRelatorio() {
    const sameRange = pending.from === range.from && pending.to === range.to;
    setRange(pending);
    // refetch() garante feedback (loading + dados) mesmo quando o período não
    // mudou — senão o React Query vê a mesma queryKey e não faz nada.
    if (sameRange) void query.refetch();
  }

  function exportCsv() {
    downloadCsv(
      `resultado-servicos-${range.from}_a_${range.to}`,
      [
        { header: 'Serviço', value: (r: ServiceRevenueItem) => r.name },
        { header: 'Quantidade', value: (r) => String(r.count) },
        { header: 'Receita', value: (r) => String(r.revenue) },
        { header: 'Custo', value: (r) => String(r.cost) },
        { header: 'Comissão', value: (r) => String(r.commission) },
        { header: 'Líquido', value: (r) => String(r.net) },
      ],
      items,
    );
    setExportOpen(false);
  }

  return (
    <>
      <FinancialReportShell
        activeKey="service"
        title="Resultado Líquido de Serviços"
        subtitle="Receita de serviços menos custos e comissões"
      >
        <FinancialFilterCard
          range={pending}
          onRange={setPending}
          onSubmit={gerarRelatorio}
          onExport={() => setExportOpen(true)}
          isFetching={query.isFetching}
        />

        {query.isLoading ? (
          <ReportLoading />
        ) : !hasData ? (
          <ReportEmpty description="Nenhum serviço com receita no período selecionado." />
        ) : (
          <>
            {/* KPIs */}
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icon={<IconDollar size={18} />}
                title="Receita bruta"
                tone="services"
                value={formatMoney(d?.totalRevenue ?? 0)}
              />
              <Kpi
                icon={<IconWallet size={18} />}
                title="Custos"
                tone="expense"
                value={formatMoney(d?.totalCost ?? 0)}
              />
              <Kpi
                icon={<IconPercent size={18} />}
                title="Comissões"
                tone="payable"
                value={formatMoney(d?.totalCommission ?? 0)}
              />
              <Kpi
                icon={<IconScissors size={18} />}
                title="Resultado líquido"
                tone="success"
                valueTone={totalNet >= 0 ? 'success' : 'danger'}
                value={formatMoney(totalNet)}
              />
            </div>

            {/* Gráfico: líquido por serviço (top 8) */}
            <div className={`${CARD} mt-4 p-5`}>
              <h3 className="mb-3 text-sm font-semibold text-ink">
                Resultado líquido por serviço
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
                    <Bar dataKey="v" fill={colors.services} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabela detalhada */}
            <div className={`${CARD} mt-4 overflow-hidden`}>
              <div className="border-b border-line px-5 py-4">
                <h3 className="text-sm font-semibold text-ink">Detalhamento por serviço</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                      <th className="px-5 py-3">Serviço</th>
                      <th className="px-5 py-3 text-right">Qtd</th>
                      <th className="px-5 py-3 text-right">Receita</th>
                      <th className="px-5 py-3 text-right">Custo</th>
                      <th className="px-5 py-3 text-right">Comissão</th>
                      <th className="px-5 py-3 text-right">Líquido</th>
                      <th className="px-5 py-3 text-right">Margem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => {
                      const margin = s.revenue > 0 ? (s.net / s.revenue) * 100 : 0;
                      return (
                        <tr
                          key={s.id}
                          className="border-b border-line/70 last:border-0 hover:bg-ink/5"
                        >
                          <td className="px-5 py-3 font-medium text-ink">{s.name}</td>
                          <td className="px-5 py-3 text-right text-muted-ink">
                            {formatNumber(s.count)}
                          </td>
                          <td className="px-5 py-3 text-right text-ink">
                            {formatMoney(s.revenue)}
                          </td>
                          <td className="px-5 py-3 text-right text-muted-ink">
                            {formatMoney(s.cost)}
                          </td>
                          <td className="px-5 py-3 text-right text-muted-ink">
                            {formatMoney(s.commission)}
                          </td>
                          <td
                            className={`px-5 py-3 text-right font-semibold ${
                              s.net >= 0 ? 'text-success' : 'text-danger'
                            }`}
                          >
                            {formatMoney(s.net)}
                          </td>
                          <td className="px-5 py-3 text-right text-muted-ink">
                            {margin.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink/5 font-semibold text-ink">
                      <td className="px-5 py-3">Total</td>
                      <td className="px-5 py-3 text-right">
                        {formatNumber(items.reduce((a, s) => a + s.count, 0))}
                      </td>
                      <td className="px-5 py-3 text-right">{formatMoney(d?.totalRevenue ?? 0)}</td>
                      <td className="px-5 py-3 text-right">{formatMoney(d?.totalCost ?? 0)}</td>
                      <td className="px-5 py-3 text-right">
                        {formatMoney(d?.totalCommission ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-right">{formatMoney(totalNet)}</td>
                      <td className="px-5 py-3" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </FinancialReportShell>

      <ExportDrawer
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        description={`Exportar o Resultado Líquido de Serviços do período ${range.from} – ${range.to}.`}
        onExportCsv={exportCsv}
        canExport={hasData}
      />
    </>
  );
}
