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
import { PageHeader } from '../../components/PageHeader';
import { LoadingState } from '../../components/States';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import {
  IconArrowDown,
  IconArrowUp,
  IconWallet,
} from '../../components/icons';
import {
  useFinancialAccounts,
  useFinancialSummary,
} from '../../lib/queries/financeiro';
import { formatMoney, isoDate } from '../../lib/format';

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(1); // início do mês
  return { from: isoDate(from), to: isoDate(to) };
}

const ACCOUNT_TYPE_LABEL: Record<'cash' | 'bank', string> = {
  cash: 'Dinheiro',
  bank: 'Banco',
};

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
  const iconWrap =
    tone === 'success'
      ? 'bg-success/12 text-success'
      : tone === 'danger'
        ? 'bg-danger/12 text-danger'
        : 'bg-[#f2b33d]/15 text-[#a67c1e]';
  return (
    <Card className={CARD_CLASS}>
      <Card.Content className="p-5">
        <div className="flex items-center gap-2 text-muted">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconWrap}`}
          >
            {icon}
          </span>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <div className={`mt-3 text-3xl font-bold ${toneText}`}>{value}</div>
      </Card.Content>
    </Card>
  );
}

export function FinanceiroPainelPage() {
  const [range, setRange] = useState(defaultRange);
  const summary = useFinancialSummary(range.from, range.to);
  const accounts = useFinancialAccounts();
  const d = summary.data;

  const chartData =
    d?.byPaymentMethod.map((m) => ({
      name: m.paymentMethodName,
      total: m.total,
    })) ?? [];

  const activeAccounts = (accounts.data ?? []).filter((a) => a.active);

  return (
    <div>
      <PageHeader
        title="Painel financeiro"
        subtitle="Entradas, saídas e recebimentos por forma"
        onRefresh={() => summary.refetch()}
        isRefreshing={summary.isFetching}
      />

      {/* Date range bar */}
      <Card className={`mb-4 ${CARD_CLASS}`}>
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
              icon={<IconArrowUp size={18} />}
              title="Entradas"
              value={formatMoney(d?.totalIncome ?? 0)}
              tone="success"
            />
            <KpiCard
              icon={<IconArrowDown size={18} />}
              title="Saídas"
              value={formatMoney(d?.totalExpense ?? 0)}
              tone="danger"
            />
            <KpiCard
              icon={<IconWallet size={18} />}
              title="Saldo do período"
              value={formatMoney(d?.balance ?? 0)}
              tone="accent"
            />
          </div>

          {/* Account balances */}
          {activeAccounts.length > 0 && (
            <Card className={`mt-4 ${CARD_CLASS}`}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Saldos das contas
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activeAccounts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white px-4 py-3 shadow-[var(--shadow-soft)]"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
                          <IconWallet size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {a.name}
                          </p>
                          <p className="text-xs text-muted">
                            {ACCOUNT_TYPE_LABEL[a.type]}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {formatMoney(a.initialBalance)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">
                  Saldo inicial cadastrado para cada conta.
                </p>
              </Card.Content>
            </Card>
          )}

          <Card className={`mt-4 ${CARD_CLASS}`}>
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
                        <Tooltip
                          formatter={(value: number) => formatMoney(value)}
                        />
                        <Bar dataKey="total" fill="#f2b33d" radius={[4, 4, 0, 0]} maxBarSize={48} />
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
