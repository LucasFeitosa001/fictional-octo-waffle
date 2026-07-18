import { useState } from 'react';
import { Card, Chip } from '@heroui/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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
import { useFinancialSummary } from '../../lib/queries/financeiro';
import { formatMoney, isoDate } from '../../lib/format';

const CARD_CLASS =
  'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

// Cores dos gráficos (verde = entrada, rosa = saída, dourado = saldo/vendas).
const COLOR_IN = '#16a34a';
const COLOR_OUT = '#ec4899';
const COLOR_GOLD = '#f2b33d';

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

/** "YYYY-MM-DD" -> "DD/MM" para os eixos. */
function shortDay(d: string): string {
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
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

/** Item compacto de total do período. */
function TotalRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'danger';
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-soft-border)] bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`text-base font-semibold ${
          tone === 'success' ? 'text-success' : 'text-danger'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function FinanceiroPainelPage() {
  const [range, setRange] = useState(defaultRange);
  const summary = useFinancialSummary(range.from, range.to);
  const d = summary.data;

  const byMethod =
    d?.byPaymentMethod.map((m) => ({
      name: m.paymentMethodName,
      total: m.total,
    })) ?? [];

  const accounts = d?.accounts.filter((a) => a.active) ?? [];
  const cashFlow = d?.cashFlow ?? [];
  const salesByDay = d?.salesByDay ?? [];
  const hasSales = salesByDay.some((s) => s.total > 0 || s.count > 0);

  return (
    <div>
      <PageHeader
        title="Painel financeiro"
        subtitle="A receber, a pagar, contas e fluxo de caixa"
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
          {/* Cards "hoje" + saldo do período */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              icon={<IconArrowUp size={18} />}
              title="A receber hoje"
              value={formatMoney(d?.receivableToday ?? 0)}
              tone="success"
            />
            <KpiCard
              icon={<IconArrowDown size={18} />}
              title="A pagar hoje"
              value={formatMoney(d?.payableToday ?? 0)}
              tone="danger"
            />
            <KpiCard
              icon={<IconWallet size={18} />}
              title="Saldo do período"
              value={formatMoney(d?.balance ?? 0)}
              tone="accent"
            />
          </div>

          {/* Contas (saldo corrente) */}
          {accounts.length > 0 && (
            <Card className={`mt-4 ${CARD_CLASS}`}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Contas
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {accounts.map((a) => (
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
                      <span
                        className={`shrink-0 text-sm font-semibold ${
                          a.currentBalance < 0 ? 'text-danger' : 'text-foreground'
                        }`}
                      >
                        {formatMoney(a.currentBalance)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">
                  Saldo corrente = saldo inicial + movimentos pagos.
                </p>
              </Card.Content>
            </Card>
          )}

          {/* Totais do período */}
          <Card className={`mt-4 ${CARD_CLASS}`}>
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Totais do período
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <TotalRow
                  label="Recebidos"
                  value={formatMoney(d?.totals.received ?? 0)}
                  tone="success"
                />
                <TotalRow
                  label="A Receber"
                  value={formatMoney(d?.totals.toReceive ?? 0)}
                  tone="success"
                />
                <TotalRow
                  label="Pagos"
                  value={formatMoney(d?.totals.paid ?? 0)}
                  tone="danger"
                />
                <TotalRow
                  label="A Pagar"
                  value={formatMoney(d?.totals.toPay ?? 0)}
                  tone="danger"
                />
              </div>
            </Card.Content>
          </Card>

          {/* Fluxo de caixa */}
          <Card className={`mt-4 ${CARD_CLASS}`}>
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Fluxo de caixa
              </h3>
              {cashFlow.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  Sem movimentações no período.
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={cashFlow}
                      margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                    >
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
                        formatter={(value: number, name) => [
                          formatMoney(value),
                          name === 'inflow'
                            ? 'Entrada'
                            : name === 'outflow'
                              ? 'Saída'
                              : 'Saldo acumulado',
                        ]}
                      />
                      <Legend
                        formatter={(value) =>
                          value === 'inflow'
                            ? 'Entrada'
                            : value === 'outflow'
                              ? 'Saída'
                              : 'Saldo acumulado'
                        }
                      />
                      <Bar dataKey="inflow" fill={COLOR_IN} radius={[3, 3, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="outflow" fill={COLOR_OUT} radius={[3, 3, 0, 0]} maxBarSize={28} />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        stroke={COLOR_GOLD}
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Content>
          </Card>

          {/* Vendas por dia */}
          <Card className={`mt-4 ${CARD_CLASS}`}>
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Vendas por dia
              </h3>
              {!hasSales ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  Sem vendas no período.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesByDay}
                      margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                    >
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
                        formatter={(value: number) => [formatMoney(value), 'Vendas']}
                      />
                      <Bar dataKey="total" fill={COLOR_GOLD} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Content>
          </Card>

          {/* Recebimentos por forma de pagamento */}
          <Card className={`mt-4 ${CARD_CLASS}`}>
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Recebimentos por forma de pagamento
              </h3>
              {byMethod.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  Sem recebimentos no período selecionado.
                </div>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={byMethod}
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
                        <Bar dataKey="total" fill={COLOR_GOLD} radius={[4, 4, 0, 0]} maxBarSize={48} />
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
