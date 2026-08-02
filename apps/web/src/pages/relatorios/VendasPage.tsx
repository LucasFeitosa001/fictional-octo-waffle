import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DateRangePicker } from '../../components/DatePicker';
import { Drawer } from '../../components/Drawer';
import {
  IconDollar,
  IconDownload,
  IconReceipt,
  IconTrendUp,
} from '../../components/icons';
import {
  ReportCategoriesBar,
  ReportSubmenu,
  SALES_REPORTS,
} from './reportNav';
import { formatMoney, formatNumber, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsSales } from '../../lib/queries/relatorios';
import { useThemeColors } from '../../theme/useThemeColors';
import { getCategoricalColor } from '../../theme/dataColors';
import { BackToReports, shortDay } from './reportShared';
import { ErrorState } from '../../components/States';
import { requestReportPdf } from './ReportPdfButton';

// ── card no estilo Belasis (branco + sombra suave), 100% themeable ────────────
const CARD = 'rounded-xl border border-line bg-card shadow-[var(--shadow-card)]';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - 1);
  return { from: isoDate(from), to: isoDate(to) };
}

// Categorias de relatório (topo do módulo Relatórios no Belasis). "Financeiro"
// é a categoria ativa desta página.
// Submenu vertical de relatórios financeiros (coluna esquerda do Belasis).
// "Resultado Líquido de Serviços" (rota service-revenue) é o item selecionado.
function Kpi({
  icon,
  title,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint?: string;
  tone: 'sales' | 'orders';
}) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: `var(--sp-data-${tone}-soft)`,
            color: `var(--sp-data-${tone})`,
          }}
        >
          {icon}
        </span>
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <div className="mt-3 text-2xl font-bold text-ink sm:text-3xl">{value}</div>
      {hint && <p className="mt-1 text-sm text-muted-ink">{hint}</p>}
    </div>
  );
}

export function VendasPage() {
  const colors = useThemeColors();

  // `range` é o período aplicado (dispara a query); `pending` é o que está no
  // formulário e só vira `range` ao clicar em "Gerar relatório" (fiel ao Belasis).
  const [range, setRange] = useState(defaultRange);
  const [pending, setPending] = useState(range);
  const [exportOpen, setExportOpen] = useState(false);

  const query = useReportsSales(range.from, range.to);
  const d = query.data;

  const byDay = (d?.byDay ?? []).map((s) => ({ date: s.date, total: s.total }));
  const byCategory = d?.byCategory ?? [];
  const byProfessional = d?.byProfessional ?? [];
  const ticketMedio = d && d.ordersCount > 0 ? d.salesTotal / d.ordersCount : 0;
  // Uma venda válida pode não ter itens vinculados (comanda importada ou
  // serviço removido do cadastro). Nesse caso os agrupamentos ficam vazios,
  // mas o total e a quantidade de comandas continuam sendo dados reais e não
  // podem transformar a tela em "Nenhum item encontrado".
  const hasData = !!d && (
    d.salesTotal !== 0 || d.ordersCount > 0 ||
    byDay.length > 0 || byCategory.length > 0 || byProfessional.length > 0
  );

  function gerarRelatorio() {
    const sameRange = pending.from === range.from && pending.to === range.to;
    setRange(pending);
    // Quando o período muda, a queryKey nova dispara a busca automaticamente.
    // Refetchar aqui também buscava a janela ANTIGA e podia deixar a tela em
    // "Não há dados" mesmo havendo vendas no período escolhido.
    if (sameRange) void query.refetch();
  }

  function exportCsv() {
    downloadCsv(
      `resultado-servicos-${range.from}_a_${range.to}`,
      [
        { header: 'Categoria', value: (r: { cat: string; label: string; value: string }) => r.cat },
        { header: 'Item', value: (r) => r.label },
        { header: 'Valor', value: (r) => r.value },
      ],
      [
        { cat: 'Resumo', label: 'Vendas no período', value: String(d?.salesTotal ?? 0) },
        { cat: 'Resumo', label: 'Comandas finalizadas', value: String(d?.ordersCount ?? 0) },
        ...byCategory.map((c) => ({ cat: 'Categoria', label: c.category, value: String(c.total) })),
        ...byProfessional.map((p) => ({ cat: 'Profissional', label: p.name, value: String(p.total) })),
        ...byDay.map((s) => ({ cat: 'Dia', label: s.date, value: String(s.total) })),
      ],
    );
    setExportOpen(false);
  }

  return (
    <div>
      <BackToReports />

      {/* Cabeçalho do módulo Relatórios */}
      <h1 className="text-xl font-semibold text-ink">Relatórios</h1>

      {/* Barra de categorias e submenu passam a NAVEGAR. Antes eram <button>
          sem onClick e <div> — clicar não fazia nada, e o dono relatou como
          "clico entre os itens e não alterna". Fonte única: reportNav.
          Ver estudo 63. */}
      <ReportCategoriesBar ativa="Vendas" />

      {/* Conteúdo em 2 colunas: submenu de relatórios + card do relatório */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start">
        <ReportSubmenu items={SALES_REPORTS} activeKey="vendas" />

        {/* Coluna direita: filtro + resultados */}
        <div className="min-w-0 flex-1">
          {/* Card de filtro: Período + Gerar relatório (split com "...") */}
          <div className={`${CARD} p-4 sm:p-5`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                gerarRelatorio();
              }}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-ink">Período</label>
                  <DateRangePicker
                    from={pending.from}
                    to={pending.to}
                    onChange={setPending}
                    ariaLabel="Período"
                  />
                </div>
              </div>

              {/* Botão split: Gerar relatório + "..." (opções de exportação) */}
              <div className="flex w-full items-stretch">
                <button
                  type="submit"
                  className="flex h-10 flex-1 items-center justify-center rounded-l-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Gerar relatório
                </button>
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
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

          {/* Resultados */}
          {query.isLoading ? (
            <div className={`${CARD} mt-4 flex h-64 items-center justify-center text-sm text-muted-ink`}>
              Carregando…
            </div>
          ) : query.isError ? (
            <div className={`${CARD} mt-4`}>
              <ErrorState onRetry={() => query.refetch()} />
            </div>
          ) : !hasData ? (
            <div className={`${CARD} mt-4 flex h-64 flex-col items-center justify-center gap-1 text-center`}>
              <p className="text-sm font-medium text-ink">Não há dados</p>
              <p className="text-sm text-muted-ink">
                Nenhum item encontrado para o período selecionado.
              </p>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Kpi
                  icon={<IconDollar size={18} />}
                  title="Vendas no período"
                  value={formatMoney(d?.salesTotal ?? 0)}
                  tone="sales"
                />
                <Kpi
                  icon={<IconReceipt size={18} />}
                  title="Comandas finalizadas"
                  value={formatNumber(d?.ordersCount ?? 0)}
                  tone="orders"
                />
                <Kpi
                  icon={<IconTrendUp size={18} />}
                  title="Ticket médio"
                  value={formatMoney(ticketMedio)}
                  tone="sales"
                />
              </div>

              {/* Vendas por dia */}
              <div className={`${CARD} mt-4 p-5`}>
                <h3 className="mb-3 text-sm font-semibold text-ink">Vendas por dia</h3>
                {byDay.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-ink">
                    Sem vendas no período.
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={byDay} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.chartGrid} />
                        <XAxis
                          dataKey="date"
                          tickFormatter={shortDay}
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
                        <Tooltip
                          labelFormatter={(l: string) => shortDay(l)}
                          formatter={(v: number) => [formatMoney(v), 'Vendas']}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke={colors.sales}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: colors.sales }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Por categoria */}
                <div className={`${CARD} p-5`}>
                  <h3 className="mb-3 text-sm font-semibold text-ink">Vendas por categoria</h3>
                  {byCategory.length === 0 ? (
                    <div className="flex h-56 items-center justify-center text-sm text-muted-ink">
                      Sem vendas por categoria.
                    </div>
                  ) : (
                    <>
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={byCategory}
                              dataKey="total"
                              nameKey="category"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              innerRadius={40}
                            >
                              {byCategory.map((category) => (
                                <Cell key={category.category} fill={getCategoricalColor(category.category)} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatMoney(v)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <ul className="mt-3 flex flex-col divide-y divide-[var(--color-soft-border)]">
                        {byCategory.map((c) => (
                          <li key={c.category} className="flex items-center gap-3 py-2">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full"
                              style={{ background: getCategoricalColor(c.category) }}
                            />
                            <span className="flex-1 truncate text-sm text-ink">{c.category}</span>
                            <span className="text-sm font-semibold text-ink">
                              {formatMoney(c.total)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                {/* Por profissional */}
                <div className={`${CARD} p-5`}>
                  <h3 className="mb-3 text-sm font-semibold text-ink">Receita por profissional</h3>
                  {byProfessional.length === 0 ? (
                    <div className="flex h-56 items-center justify-center text-sm text-muted-ink">
                      Sem vendas por profissional.
                    </div>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={byProfessional.map((p) => ({ name: p.name, v: p.total }))}
                          margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                        >
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
                          />
                          <Tooltip formatter={(v: number) => formatMoney(v)} />
                          <Bar dataKey="v" fill={colors.sales} radius={[4, 4, 0, 0]} maxBarSize={36} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Tabela detalhada por profissional */}
              <div className={`${CARD} mt-4 overflow-hidden`}>
                <div className="border-b border-line px-5 py-4">
                  <h3 className="text-sm font-semibold text-ink">Detalhamento por profissional</h3>
                </div>
                {byProfessional.length === 0 ? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-ink">
                    Nenhum item encontrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                          <th className="px-5 py-3">Profissional</th>
                          <th className="px-5 py-3 text-right">Receita</th>
                          <th className="px-5 py-3 text-right">Participação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {byProfessional.map((p) => {
                          const share =
                            d && d.salesTotal > 0 ? (p.total / d.salesTotal) * 100 : 0;
                          return (
                            <tr
                              key={p.id}
                              className="border-b border-line/70 last:border-0 hover:bg-ink/5"
                            >
                              <td className="px-5 py-3 text-ink">{p.name}</td>
                              <td className="px-5 py-3 text-right font-medium text-ink">
                                {formatMoney(p.total)}
                              </td>
                              <td className="px-5 py-3 text-right text-muted-ink">
                                {share.toFixed(1)}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-ink/5 font-semibold text-ink">
                          <td className="px-5 py-3">Total</td>
                          <td className="px-5 py-3 text-right">{formatMoney(d?.salesTotal ?? 0)}</td>
                          <td className="px-5 py-3 text-right">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawer lateral: opções de exportação (split "..." do Belasis) */}
      <Drawer
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Exportar relatório"
      >
        <p className="mb-4 text-sm text-muted-ink">
          Escolha o formato para exportar o Resultado Líquido de Serviços do período{' '}
          {shortDay(range.from)} – {shortDay(range.to)}.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!d}
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
          <button
            type="button"
            onClick={() => { setExportOpen(false); requestReportPdf(); }}
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
    </div>
  );
}
