'use client';

import { useState } from 'react';
import { Card, Chip } from '@heroui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState } from '@/components/States';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { IconDollar, IconTrendUp } from '@/components/icons';
import { useFinancialSummary } from '@/lib/queries/financeiro';
import { formatMoney, isoDate } from '@/lib/format';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(1); // início do mês
  return { from: isoDate(from), to: isoDate(to) };
}

function KpiCard({
  icon,
  title,
  value,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  tone: 'success' | 'danger' | 'accent';
}) {
  const toneText =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : 'text-foreground';
  return (
    <Card className="db-card">
      <Card.Content className="p-5">
        <div className="flex items-center gap-2 text-muted">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
            {icon}
          </span>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <div className={`mt-3 text-3xl font-bold ${toneText}`}>{value}</div>
      </Card.Content>
    </Card>
  );
}

export default function FinanceiroPainelPage() {
  const [range, setRange] = useState(defaultRange);
  const summary = useFinancialSummary(range.from, range.to);
  const d = summary.data;

  const chartData =
    d?.byPaymentMethod.map((m) => ({
      name: m.paymentMethodName,
      total: m.total,
    })) ?? [];

  return (
    <div>
      <PageHeader
        title="Painel financeiro"
        subtitle="Entradas, saídas e recebimentos por forma"
        onRefresh={() => summary.refetch()}
        isRefreshing={summary.isFetching}
      />

      {/* Date range bar */}
      <Card className="db-card mb-4">
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {summary.isLoading ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              icon={<IconTrendUp size={18} />}
              title="Entradas"
              value={formatMoney(d?.totalIncome ?? 0)}
              tone="success"
            />
            <KpiCard
              icon={<IconDollar size={18} />}
              title="Saídas"
              value={formatMoney(d?.totalExpense ?? 0)}
              tone="danger"
            />
            <KpiCard
              icon={<IconDollar size={18} />}
              title="Saldo acumulado"
              value={formatMoney(d?.balance ?? 0)}
              tone="accent"
            />
          </div>

          <Card className="db-card mt-4">
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Recebimentos por forma de pagamento
              </h3>
              {chartData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  Sem recebimentos no período selecionado.
                </div>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2a2a" />
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
                        <Tooltip formatter={(value: number) => formatMoney(value)} />
                        <Bar dataKey="total" fill="#ffffff" radius={[4, 4, 0, 0]} maxBarSize={48} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="mt-4 flex flex-col gap-2">
                    {d?.byPaymentMethod.map((m) => (
                      <li
                        key={m.paymentMethodId ?? 'none'}
                        className="flex items-center justify-between text-sm"
                      >
                        <Chip variant="soft" color="accent" size="sm">
                          {m.paymentMethodName}
                        </Chip>
                        <span className="font-semibold text-foreground">
                          {formatMoney(m.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card.Content>
          </Card>
        </>
      )}
    </div>
  );
}
