import { useState } from 'react';
import { Button, Card } from '@heroui/react';
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
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { IconDownload, IconDollar, IconReceipt, IconTrendUp } from '../../components/icons';
import { formatMoney, formatNumber, isoDate } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useReportsSales } from '../../lib/queries/relatorios';
import { BackToReports, CARD, COLOR_GOLD, PIE_COLORS, shortDay } from './reportShared';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

function Kpi({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className={CARD}>
      <Card.Content className="p-5">
        <div className="flex items-center gap-2 text-muted">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
            {icon}
          </span>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <div className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">{value}</div>
        {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      </Card.Content>
    </Card>
  );
}

export function VendasPage() {
  const [range, setRange] = useState(defaultRange);
  const query = useReportsSales(range.from, range.to);
  const d = query.data;

  const byDay = (d?.byDay ?? []).map((s) => ({ date: s.date, total: s.total }));
  const byCategory = d?.byCategory ?? [];
  const byProfessional = d?.byProfessional ?? [];
  const ticketMedio =
    d && d.ordersCount > 0 ? d.salesTotal / d.ordersCount : 0;

  function exportCsv() {
    downloadCsv(
      `vendas-${range.from}_a_${range.to}`,
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
  }

  return (
    <div>
      <BackToReports />
      <PageHeader
        title="Vendas"
        subtitle="Faturamento por dia, categoria e profissional"
        onRefresh={() => query.refetch()}
        isRefreshing={query.isFetching}
        actions={
          <Button variant="outline" onClick={exportCsv} isDisabled={!d}>
            <IconDownload size={16} /> Exportar CSV
          </Button>
        }
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Kpi
              icon={<IconDollar size={18} />}
              title="Vendas no período"
              value={formatMoney(d?.salesTotal ?? 0)}
            />
            <Kpi
              icon={<IconReceipt size={18} />}
              title="Comandas finalizadas"
              value={formatNumber(d?.ordersCount ?? 0)}
            />
            <Kpi
              icon={<IconTrendUp size={18} />}
              title="Ticket médio"
              value={formatMoney(ticketMedio)}
            />
          </div>

          {/* Vendas por dia */}
          <Card className={`mb-4 ${CARD}`}>
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">Vendas por dia</h3>
              {byDay.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  Sem vendas no período.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={byDay} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDay}
                        tick={{ fontSize: 11, fill: '#888' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#888' }}
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
                        stroke={COLOR_GOLD}
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: COLOR_GOLD }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Content>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Por categoria */}
            <Card className={CARD}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Vendas por categoria</h3>
                {byCategory.length === 0 ? (
                  <EmptyState title="Sem vendas por categoria" />
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
                            {byCategory.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatMoney(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="mt-3 flex flex-col divide-y divide-[var(--color-soft-border)]">
                      {byCategory.map((c, i) => (
                        <li key={c.category} className="flex items-center gap-3 py-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                          <span className="flex-1 truncate text-sm text-foreground">
                            {c.category}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatMoney(c.total)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card.Content>
            </Card>

            {/* Por profissional */}
            <Card className={CARD}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Receita por profissional
                </h3>
                {byProfessional.length === 0 ? (
                  <EmptyState title="Sem vendas por profissional" />
                ) : (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={byProfessional.map((p) => ({ name: p.name, v: p.total }))}
                        margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#888' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#888' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip formatter={(v: number) => formatMoney(v)} />
                        <Bar dataKey="v" fill={COLOR_GOLD} radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card.Content>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
