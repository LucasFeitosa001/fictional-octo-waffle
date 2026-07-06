import { useState } from 'react';
import { Button, Card, Chip } from '@heroui/react';
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
import { PageHeader } from '../components/PageHeader';
import { EmptyState, LoadingState } from '../components/States';
import { DateRangeFilter } from '../components/DateRangeFilter';
import {
  IconChart,
  IconDollar,
  IconDownload,
  IconScissors,
  IconStar,
  IconUsers,
} from '../components/icons';
import { formatMoney, formatNumber, isoDate } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import {
  useReportsOverview,
  type ProfessionalRankItem,
  type RankItem,
} from '../lib/queries/relatorios';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const PIE_COLORS = ['#f2b33d', '#f08ca5', '#111111', '#f0ce84', '#d99a7c', '#b8893f', '#8a6d3b'];

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

function RankCard({
  icon,
  title,
  items,
  emptyLabel,
  showCount = true,
}: {
  icon: React.ReactNode;
  title: string;
  items: { id: string; name: string; total: number; count?: number }[];
  emptyLabel: string;
  showCount?: boolean;
}) {
  return (
    <Card className={CARD}>
      <Card.Content className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
            {icon}
          </span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.slice(0, 5).map((it, i) => (
              <li key={it.id} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f2b33d]/15 text-xs font-semibold text-[#a67c1e]">
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm text-foreground">{it.name}</span>
                {showCount && it.count !== undefined && (
                  <Chip variant="soft" color="accent" size="sm">
                    {formatNumber(it.count)}x
                  </Chip>
                )}
                <span className="text-sm font-semibold text-foreground">
                  {formatMoney(it.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card.Content>
    </Card>
  );
}

type Segment = 'services' | 'products' | 'professionals';

export function RelatoriosPage() {
  const [range, setRange] = useState(defaultRange);
  const [segment, setSegment] = useState<Segment>('services');
  const query = useReportsOverview(range.from, range.to);
  const d = query.data;

  const salesSeries = (d?.salesByDay ?? []).map((s) => ({
    d: s.date.slice(8, 10) + '/' + s.date.slice(5, 7),
    v: s.total,
  }));
  const paymentSeries = (d?.paymentsByMethod ?? []).map((p) => ({
    name: p.name,
    value: p.total,
  }));

  const topServices: RankItem[] = d?.topServices ?? [];
  const topProducts: RankItem[] = d?.topProducts ?? [];
  const topProfessionals: ProfessionalRankItem[] = d?.topProfessionals ?? [];

  const segmentData: { id: string; name: string; total: number; count?: number }[] =
    segment === 'services'
      ? topServices
      : segment === 'products'
        ? topProducts
        : topProfessionals;
  const SEGMENT_LABEL: Record<Segment, string> = {
    services: 'Serviços',
    products: 'Produtos',
    professionals: 'Profissionais',
  };

  function exportCsv() {
    downloadCsv(
      `relatorio-${range.from}_a_${range.to}`,
      [
        { header: 'Categoria', value: (r: { cat: string; label: string; value: string }) => r.cat },
        { header: 'Item', value: (r) => r.label },
        { header: 'Valor', value: (r) => r.value },
      ],
      [
        { cat: 'Resumo', label: 'Vendas no período', value: String(d?.salesTotal ?? 0) },
        { cat: 'Resumo', label: 'Comandas finalizadas', value: String(d?.ordersCount ?? 0) },
        { cat: 'Resumo', label: 'Ocupação (%)', value: String(Math.round((d?.occupancy.rate ?? 0) * 100)) },
        { cat: 'Resumo', label: 'Novos clientes', value: String(d?.newCustomersCount ?? 0) },
        ...topServices.map((s) => ({ cat: 'Serviço', label: s.name, value: String(s.total) })),
        ...topProducts.map((p) => ({ cat: 'Produto', label: p.name, value: String(p.total) })),
        ...topProfessionals.map((p) => ({ cat: 'Profissional', label: p.name, value: String(p.total) })),
      ],
    );
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Indicadores e rankings do período"
        onRefresh={() => query.refetch()}
        isRefreshing={query.isFetching}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              Imprimir
            </Button>
            <Button variant="outline" onClick={exportCsv} isDisabled={!d}>
              <IconDownload size={16} /> Exportar CSV
            </Button>
          </div>
        }
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#a67c1e]">
              Período do relatório
            </p>
            <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
          </div>
          <p className="text-sm text-muted">
            {range.from} → {range.to}
          </p>
        </Card.Content>
      </Card>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* KPI summary */}
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card className={CARD}>
              <Card.Content className="p-5">
                <div className="flex items-center gap-2 text-muted">
                  <IconDollar size={18} className="text-[#a67c1e]" />
                  <span className="text-sm font-medium text-foreground">Vendas no período</span>
                </div>
                <div className="mt-2 text-3xl font-bold text-foreground">
                  {formatMoney(d?.salesTotal ?? 0)}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatNumber(d?.ordersCount ?? 0)} comandas finalizadas
                </p>
              </Card.Content>
            </Card>
            <Card className={CARD}>
              <Card.Content className="p-5">
                <div className="flex items-center gap-2 text-muted">
                  <IconChart size={18} className="text-[#a67c1e]" />
                  <span className="text-sm font-medium text-foreground">Ocupação da agenda</span>
                </div>
                <div className="mt-2 text-3xl font-bold text-foreground">
                  {Math.round((d?.occupancy.rate ?? 0) * 100)}%
                </div>
                <p className="mt-1 text-sm text-muted">
                  {formatNumber(d?.occupancy.done ?? 0)} de {formatNumber(d?.occupancy.total ?? 0)}{' '}
                  agendamentos
                </p>
              </Card.Content>
            </Card>
            <Card className={CARD}>
              <Card.Content className="p-5">
                <div className="flex items-center gap-2 text-muted">
                  <IconUsers size={18} className="text-[#a67c1e]" />
                  <span className="text-sm font-medium text-foreground">Novos clientes</span>
                </div>
                <div className="mt-2 text-3xl font-bold text-foreground">
                  {formatNumber(d?.newCustomersCount ?? 0)}
                </div>
                <p className="mt-1 text-sm text-muted">no período selecionado</p>
              </Card.Content>
            </Card>
          </div>

          {/* Drill-down segment */}
          <Card className={`mb-4 ${CARD}`}>
            <Card.Content className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Detalhamento por {SEGMENT_LABEL[segment].toLowerCase()}
                  <span className="ml-2 text-xs font-normal text-muted">
                    {segmentData.length} item(ns)
                  </span>
                </h3>
                <div className="inline-flex gap-1 rounded-xl border border-[var(--color-soft-border)] bg-[#f7f3ea] p-1">
                  {(['services', 'products', 'professionals'] as Segment[]).map((s) => {
                    const active = s === segment;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSegment(s)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                          active
                            ? 'bg-[#f2b33d] text-[#1a1a1a] shadow-[var(--shadow-gold)]'
                            : 'text-muted hover:text-foreground'
                        }`}
                      >
                        {SEGMENT_LABEL[s]}
                      </button>
                    );
                  })}
                </div>
              </div>
              {segmentData.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Sem dados no período.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--color-soft-border)]">
                  {segmentData.map((it, i) => (
                    <li key={it.id} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f2b33d]/15 text-xs font-semibold text-[#a67c1e]">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm text-foreground">{it.name}</span>
                      {it.count !== undefined && (
                        <span className="text-xs text-muted">{formatNumber(it.count)}x</span>
                      )}
                      <span className="text-sm font-semibold text-foreground">
                        {formatMoney(it.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Content>
          </Card>

          {/* Ranking cards */}
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RankCard
              icon={<IconScissors size={16} />}
              title="Serviços mais realizados"
              items={topServices}
              emptyLabel="Sem serviços no período."
            />
            <RankCard
              icon={<IconStar size={16} />}
              title="Produtos mais vendidos"
              items={topProducts}
              emptyLabel="Sem produtos no período."
            />
            <RankCard
              icon={<IconUsers size={16} />}
              title="Profissionais que mais venderam"
              items={topProfessionals.map((p) => ({ id: p.id, name: p.name, total: p.total }))}
              emptyLabel="Sem dados no período."
              showCount={false}
            />
          </div>

          {/* Charts */}
          <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className={`${CARD} lg:col-span-2`}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Vendas por dia</h3>
                {salesSeries.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted">
                    Sem vendas no período.
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                        <XAxis dataKey="d" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v: number) => formatMoney(v)} />
                        <Line
                          type="monotone"
                          dataKey="v"
                          stroke="#f2b33d"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: '#f2b33d' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card.Content>
            </Card>

            <Card className={CARD}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Recebimentos por forma
                </h3>
                {paymentSeries.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted">
                    Sem recebimentos.
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentSeries}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={40}
                        >
                          {paymentSeries.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatMoney(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card.Content>
            </Card>
          </div>

          {/* Lists */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className={CARD}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Novos clientes no período
                </h3>
                {(d?.newCustomers ?? []).length === 0 ? (
                  <EmptyState title="Nenhum novo cliente" />
                ) : (
                  <ul className="flex flex-col divide-y divide-default-100">
                    {(d?.newCustomers ?? []).slice(0, 10).map((c) => (
                      <li key={c.id} className="flex items-center justify-between py-2">
                        <span className="truncate text-sm text-foreground">{c.name}</span>
                        <span className="text-xs text-muted">{c.phone ?? c.email ?? '—'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card.Content>
            </Card>

            <Card className={CARD}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Aniversariantes — {MONTHS[(d?.birthdaysMonth ?? 1) - 1]}
                </h3>
                {(d?.birthdays ?? []).length === 0 ? (
                  <EmptyState title="Nenhum aniversariante neste mês" />
                ) : (
                  <ul className="flex flex-col divide-y divide-default-100">
                    {(d?.birthdays ?? []).map((b) => (
                      <li key={b.id} className="flex items-center justify-between py-2">
                        <span className="truncate text-sm text-foreground">{b.name}</span>
                        <Chip variant="soft" color="accent" size="sm">
                          dia {b.day ?? '—'}
                        </Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </Card.Content>
            </Card>
          </div>

          {/* Top professionals revenue bar (extra viz) */}
          {topProfessionals.length > 0 && (
            <Card className={`mt-4 ${CARD}`}>
              <Card.Content className="p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Receita por profissional
                </h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topProfessionals.map((p) => ({ name: p.name, v: p.total }))}
                      margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v: number) => formatMoney(v)} />
                      <Bar dataKey="v" fill="#f2b33d" radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
