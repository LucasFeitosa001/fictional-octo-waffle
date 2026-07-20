import { useState } from 'react';
import { Button } from '@heroui/react';
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
import { Drawer } from '../../components/Drawer';
import { IconChevron, IconFilter } from '../../components/icons';
import { useSetPageActions } from '../../layout/PageActions';
import { useFinancialSummary } from '../../lib/queries/financeiro';
import { useThemeColors } from '../../theme/useThemeColors';
import { formatMoney, isoDate } from '../../lib/format';

// ── Cores de data-viz FIXAS do Belasis (SVG recharts, independentes do tema) ──
// Entrada = verde, Saída = vermelho; a linha de saldo e as barras de vendas
// seguem a cor primária do Belasis (via useThemeColors).
const CASH_IN = '#5cb85c';
const CASH_OUT = '#c73d3d';

// Card branco genérico (mesma superfície/sombra do Belasis, themeable).
const SHADOW = 'shadow-[var(--shadow-soft)]';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14); // Belasis: últimos 14 dias
  return { from: isoDate(from), to: isoDate(to) };
}

const MONTHS_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/** "YYYY-MM-DD" -> "05 jul, 2026" (rótulo do intervalo, igual ao Belasis). */
function longDay(d: string): string {
  const [y, m, day] = d.split('-');
  const mi = Number(m) - 1;
  return `${day} ${MONTHS_PT[mi] ?? m}, ${y}`;
}

/** "YYYY-MM-DD" -> "DD/MM" para os eixos. */
function shortDay(d: string): string {
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
}

/** Título de seção (Belasis: Text $size:20 $bold). */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-2.5 block text-xl font-bold text-foreground">
      {children}
    </span>
  );
}

/**
 * Linha do "Resumo": card branco, texto colorido (verde/vermelho) e chevron.
 * Belasis: wb__sc-u678pu-1 — bg #FFF, radius 12, padding 10, sombra suave.
 */
function SummaryRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'danger';
}) {
  const color = tone === 'success' ? 'text-success' : 'text-danger';
  return (
    <button
      type="button"
      className={`flex w-full items-center justify-between gap-3 rounded-xl bg-card p-2.5 text-left ${SHADOW}`}
    >
      <div className={color}>
        <span className="block text-lg font-medium leading-tight">{label}</span>
        <span className="mt-0.5 block text-2xl font-bold leading-tight">
          {value}
        </span>
      </div>
      <IconChevron size={22} className={`-rotate-90 shrink-0 ${color}`} />
    </button>
  );
}

/**
 * Tile de conta: fundo colorido conforme o saldo, texto branco.
 * Belasis: wb__sc-1tme506-0 — verde (>0), laranja (=0), vermelho (<0).
 */
function AccountTile({
  name,
  balance,
}: {
  name: string;
  balance: number;
}) {
  const bg =
    balance === 0 ? 'bg-warning' : balance > 0 ? 'bg-success' : 'bg-danger';
  const fg =
    balance === 0
      ? 'text-warning-foreground'
      : balance > 0
        ? 'text-success-foreground'
        : 'text-danger-foreground';
  return (
    <div className={`rounded-xl p-2.5 ${bg} ${fg} ${SHADOW}`}>
      <span className="block truncate text-lg font-medium leading-tight opacity-95">
        {name}
      </span>
      <span className="mt-0.5 block text-2xl font-bold leading-tight">
        {formatMoney(balance)}
      </span>
    </div>
  );
}

/**
 * Tile de total: fundo colorido cheio, texto branco + chevron.
 * Belasis: wb__sc-1hd3h3j-0 — Recebidos(verde) / A Receber(azul→primary) /
 * Pagos(laranja) / A Pagar(vermelho).
 */
function TotalTile({
  label,
  value,
  bg,
  fg,
}: {
  label: string;
  value: string;
  bg: string;
  fg: string;
}) {
  return (
    <button
      type="button"
      className={`flex items-center justify-between gap-2 rounded-xl p-2.5 text-left ${bg} ${fg} ${SHADOW}`}
    >
      <div className="min-w-0">
        <span className="block text-lg font-medium leading-tight">{label}</span>
        <span className="mt-0.5 block truncate text-2xl font-bold leading-tight">
          {value}
        </span>
      </div>
      <IconChevron size={22} className="-rotate-90 shrink-0" />
    </button>
  );
}

export function FinanceiroPainelPage() {
  const [range, setRange] = useState(defaultRange);
  // Filtro mobile: no Belasis o "Filtrar" fica na BottomNav e abre um drawer.
  // Reutiliza exatamente o mesmo `setRange` do filtro inline do desktop.
  const [mobileRange, setMobileRange] = useState(range);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const colors = useThemeColors();
  const summary = useFinancialSummary(range.from, range.to);

  useSetPageActions(
    [
      {
        key: 'filtros',
        label: 'Filtros',
        icon: <IconFilter size={22} />,
        onClick: () => {
          setMobileRange(range);
          setMobileFiltersOpen(true);
        },
      },
    ],
    [range],
  );
  const d = summary.data;

  const accounts = d?.accounts.filter((a) => a.active) ?? [];
  // Fluxo de caixa: entrada positiva acima, saída negativa abaixo do zero
  // (barras empilhadas, igual ao Belasis) + linha de saldo acumulado.
  const cashFlow =
    d?.cashFlow.map((c) => ({
      date: c.date,
      received: c.inflow,
      paid: -Math.abs(c.outflow),
      balance: c.balance,
    })) ?? [];
  const salesByDay = d?.salesByDay ?? [];
  const hasSales = salesByDay.some((s) => s.total > 0 || s.count > 0);

  return (
    <div>
      <PageHeader title="Painel" />

      {/* Intervalo de datas (desktop). No mobile o filtro vive na BottomNav. */}
      <div className={`mb-4 hidden rounded-xl bg-card p-4 md:block ${SHADOW}`}>
        <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
      </div>

      {summary.isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr] lg:items-start">
          {/* ── Coluna esquerda: Resumo + Contas ── */}
          <div className="flex flex-col gap-4">
            {/* Resumo */}
            <section>
              <SectionTitle>Resumo</SectionTitle>
              <div className="flex flex-col gap-2.5">
                <SummaryRow
                  label="A receber hoje"
                  value={formatMoney(d?.receivableToday ?? 0)}
                  tone="success"
                />
                <SummaryRow
                  label="A pagar hoje"
                  value={formatMoney(d?.payableToday ?? 0)}
                  tone="danger"
                />
              </div>
            </section>

            {/* Contas */}
            {accounts.length > 0 && (
              <section>
                <SectionTitle>Contas</SectionTitle>
                <div className="flex max-h-[400px] flex-col gap-2.5 overflow-y-auto overscroll-contain pr-1">
                  {accounts.map((a) => (
                    <AccountTile
                      key={a.id}
                      name={a.name}
                      balance={a.currentBalance}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Coluna direita: Totais + gráficos ── */}
          <div className="flex flex-col gap-6">
            {/* Totais */}
            <section>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <SectionTitle>Totais</SectionTitle>
                <span className="flex items-center gap-1 text-sm font-semibold text-muted">
                  {longDay(range.from)}
                  <IconChevron size={16} className="-rotate-90" />
                  {longDay(range.to)}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                <TotalTile
                  label="Recebidos"
                  value={formatMoney(d?.totals.received ?? 0)}
                  bg="bg-success"
                  fg="text-success-foreground"
                />
                <TotalTile
                  label="A Receber"
                  value={formatMoney(d?.totals.toReceive ?? 0)}
                  bg="bg-primary"
                  fg="text-primary-foreground"
                />
                <TotalTile
                  label="Pagos"
                  value={formatMoney(d?.totals.paid ?? 0)}
                  bg="bg-warning"
                  fg="text-warning-foreground"
                />
                <TotalTile
                  label="A Pagar"
                  value={formatMoney(d?.totals.toPay ?? 0)}
                  bg="bg-danger"
                  fg="text-danger-foreground"
                />
              </div>
            </section>

            {/* Fluxo de caixa */}
            <section>
              <SectionTitle>Fluxo de caixa</SectionTitle>
              {cashFlow.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  Sem movimentações no período.
                </div>
              ) : (
                <div className="h-[295px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={cashFlow}
                      margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={colors.chartGrid}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDay}
                        tick={{ fontSize: 12, fill: colors.chartAxis }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: colors.chartAxis }}
                        width={64}
                        tickFormatter={(v: number) => formatMoney(v)}
                      />
                      <Tooltip
                        labelFormatter={(l: string) => shortDay(l)}
                        formatter={(value: number, name) => [
                          formatMoney(Math.abs(value)),
                          name === 'received'
                            ? 'Entrada'
                            : name === 'paid'
                              ? 'Saída'
                              : 'Saldo acumulado',
                        ]}
                      />
                      <Legend
                        formatter={(value) =>
                          value === 'received'
                            ? 'Entrada'
                            : value === 'paid'
                              ? 'Saída'
                              : 'Saldo acumulado'
                        }
                      />
                      <Bar
                        dataKey="received"
                        stackId="a"
                        fill={CASH_IN}
                        fillOpacity={0.75}
                      />
                      <Bar
                        dataKey="paid"
                        stackId="a"
                        fill={CASH_OUT}
                        fillOpacity={0.75}
                      />
                      <Line
                        type="monotone"
                        dataKey="balance"
                        stroke={colors.primary}
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Vendas por dia */}
            <section>
              <SectionTitle>Vendas por dia</SectionTitle>
              {!hasSales ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  Sem vendas no período.
                </div>
              ) : (
                <div className="h-[295px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesByDay}
                      margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={colors.chartGrid}
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={shortDay}
                        tick={{ fontSize: 12, fill: colors.chartAxis }}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: colors.chartAxis }}
                        width={64}
                        tickFormatter={(v: number) => formatMoney(v)}
                      />
                      <Tooltip
                        labelFormatter={(l: string) => shortDay(l)}
                        formatter={(value: number) => [
                          formatMoney(value),
                          'Vendas',
                        ]}
                      />
                      <Bar
                        dataKey="total"
                        fill={colors.primary}
                        fillOpacity={0.75}
                        radius={[8, 8, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* Filtro mobile: acionado pela BottomNav (Belasis). Aplica o mesmo range. */}
      <Drawer
        isOpen={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="Filtrar"
        placement="bottom"
        footer={(
          <Button
            variant="primary"
            onClick={() => {
              setRange(mobileRange);
              setMobileFiltersOpen(false);
            }}
          >
            Aplicar filtros
          </Button>
        )}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Escolha o período do resumo.</p>
          <DateRangeFilter
            from={mobileRange.from}
            to={mobileRange.to}
            onChange={setMobileRange}
            fromLabel="Data inicial"
            toLabel="Data final"
            className="flex-col items-stretch [&>label]:!w-full"
          />
        </div>
      </Drawer>
    </div>
  );
}
