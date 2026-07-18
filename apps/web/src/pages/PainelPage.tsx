import { useMemo, useState } from 'react';
import { Card } from '@heroui/react';
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
import { DateRangeFilter } from '../components/DateRangeFilter';
import { EmptyState, LoadingState } from '../components/States';
import {
  IconCalendar,
  IconChart,
  IconClock,
  IconDollar,
  IconReceipt,
  IconTrendUp,
  IconUsers,
} from '../components/icons';
import { useDashboard } from '../lib/queries/dashboard';
import type { Dashboard } from '../lib/queries/dashboard';
import { formatMoney, formatNumber, isoDate } from '../lib/format';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';
const PIE_COLORS = ['#f2b33d', '#f08ca5', '#111111', '#f0ce84', '#d99a7c', '#b8893f', '#8a6d3b', '#c25d77'];

/** Compact currency for the tight KPI cards: R$ 0 · R$ 850 · R$ 3,4k · R$ 78k. */
function compactMoney(v: number): string {
  if (v >= 1000) {
    const k = v / 1000;
    return 'R$ ' + (k >= 100 ? Math.round(k) : k.toFixed(1).replace('.', ',')) + 'k';
  }
  return 'R$ ' + Math.round(v);
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendado',
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_progress: 'Em atendimento',
  arrived: 'Chegou',
  finished: 'Finalizado',
  completed: 'Finalizado',
  done: 'Finalizado',
  canceled: 'Cancelado',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Last-30-days default range ending today (matches the backend default). */
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}

// ---------------------------------------------------------------------------

function KpiCard({
  icon,
  label,
  value,
  deltaPct,
  deltaLabel,
  accent = 'gold',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  deltaPct?: number;
  deltaLabel?: string;
  accent?: 'gold' | 'pink';
}) {
  const up = (deltaPct ?? 0) >= 0;
  const tones =
    accent === 'pink' ? 'bg-[#f08ca5]/15 text-[#c25d77]' : 'bg-[#f2b33d]/15 text-[#a67c1e]';
  return (
    <Card className={`min-w-0 ${CARD}`}>
      <Card.Content className="flex min-h-32 flex-col items-start gap-1.5 p-4 text-left lg:min-h-0 lg:p-5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tones}`}>
          {icon}
        </span>
        <p className="text-xs font-medium leading-tight text-muted">{label}</p>
        <p className="max-w-full truncate text-xl font-bold leading-tight text-[#111111] lg:text-2xl">{value}</p>
        {deltaPct != null && (
          <div className="mt-auto flex flex-wrap items-baseline gap-1 leading-none">
            <span className={`text-xs font-semibold lg:text-sm ${up ? 'text-emerald-600' : 'text-red-500'}`}>
              {up ? '+' : ''}{Math.round(deltaPct)}%
            </span>
            <p className="text-[10px] text-muted lg:text-[11px]">{deltaLabel}</p>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

/** Section card with a titled header and optional icon. */
function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className={`min-w-0 ${CARD}`}>
      <Card.Content className="p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          {icon && (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
              {icon}
            </span>
          )}
          <p className="font-brand text-sm font-semibold text-[#111111]">{title}</p>
        </div>
        {children}
      </Card.Content>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function TendenciaVisitas({ data }: { data: Dashboard['tendenciaVisitas'] }) {
  const chartData = useMemo(
    () => data.map((d) => ({ ...d, label: d.date.slice(5) })),
    [data],
  );
  const empty = data.every((d) => d.agendamentos === 0 && d.comandas === 0);
  return (
    <SectionCard title="Tendência de visitas" icon={<IconTrendUp size={18} />}>
      {data.length === 0 || empty ? (
        <p className="py-8 text-center text-sm text-muted">Sem visitas no período.</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f2b33d]" /> Agendamentos
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f08ca5]" /> Comandas
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#999' }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.ceil(chartData.length / 8) - 1)}
                />
                <YAxis tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip cursor={{ stroke: '#f2b33d', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="agendamentos" name="Agendamentos" stroke="#f2b33d" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="comandas" name="Comandas" stroke="#f08ca5" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function AgendamentosPorStatus({ data }: { data: Dashboard['agendamentosPorStatus'] }) {
  const chartData = useMemo(
    () => data.map((d) => ({ name: statusLabel(d.status), value: d.count, pct: d.pct })),
    [data],
  );
  return (
    <SectionCard title="Agendamentos por status" icon={<IconChart size={18} />}>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Sem agendamentos no período.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-48 w-full max-w-[220px] sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={72} innerRadius={40}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatNumber(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex w-full flex-col gap-2 sm:w-1/2">
            {chartData.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate text-[#111111]">{s.name}</span>
                <span className="shrink-0 font-semibold text-[#111111]">{formatNumber(s.value)}</span>
                <span className="w-10 shrink-0 text-right text-xs text-muted">{Math.round(s.pct)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

function ComparacaoPeriodos({ data }: { data: Dashboard['comparacaoPeriodos'] }) {
  const chartData = [
    { name: 'Anterior', v: data.anterior, fill: '#d9c9a8' },
    { name: 'Atual', v: data.atual, fill: '#f2b33d' },
  ];
  const empty = data.anterior === 0 && data.atual === 0;
  return (
    <SectionCard title="Comparação entre períodos" icon={<IconChart size={18} />}>
      {empty ? (
        <p className="py-8 text-center text-sm text-muted">Sem vendas para comparar.</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#888' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatMoney(Number(v))} />
              <Tooltip formatter={(v: number) => [formatMoney(v), 'Vendas']} cursor={{ fill: '#f2b33d11' }} />
              <Bar dataKey="v" radius={[6, 6, 0, 0]} maxBarSize={72}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </SectionCard>
  );
}

function AtendimentosPorProfissional({ data }: { data: Dashboard['atendimentosPorProfissional'] }) {
  return (
    <SectionCard title="Atendimentos por profissional" icon={<IconUsers size={18} />}>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Sem atendimentos no período.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((p, i) => (
            <li key={p.professionalId ?? `sem-${i}`} className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f2b33d]/15 text-xs font-bold text-[#a67c1e]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-[#111111]">{p.name}</p>
                  <p className="shrink-0 text-sm font-semibold text-[#111111]">{formatMoney(p.receita)}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f2b33d]/15">
                    <div className="h-full rounded-full bg-[#f2b33d]" style={{ width: `${Math.min(100, p.pct)}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-muted">
                    {formatNumber(p.servicos)} · {Math.round(p.pct)}%
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function VendasPorCategoria({ data }: { data: Dashboard['vendasPorCategoria'] }) {
  const maxVal = Math.max(1, ...data.map((d) => d.valor));
  return (
    <SectionCard title="Vendas por categoria" icon={<IconDollar size={18} />}>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Sem vendas no período.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((c, i) => (
            <li key={c.categoria}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate text-[#111111]">{c.categoria}</span>
                <span className="shrink-0 font-semibold text-[#111111]">
                  {formatMoney(c.valor)}
                  <span className="ml-1.5 text-xs font-normal text-muted">{Math.round(c.pct)}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#f2b33d]/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(c.valor / maxVal) * 100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function FunilWidget({ data }: { data: Dashboard['funil'] }) {
  const steps = [
    { label: 'Todos', value: data.todos, tone: '#f0ce84' },
    { label: 'Confirmados', value: data.confirmados, tone: '#f2b33d' },
    { label: 'Faturados', value: data.faturados, tone: '#c25d77' },
  ];
  const top = Math.max(1, data.todos);
  const empty = data.todos === 0 && data.confirmados === 0 && data.faturados === 0;
  return (
    <SectionCard title="Funil de agendamentos" icon={<IconReceipt size={18} />}>
      {empty ? (
        <p className="py-8 text-center text-sm text-muted">Sem agendamentos no período.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {steps.map((s, i) => {
            const width = Math.max(6, (s.value / top) * 100);
            const conv = i === 0 ? 100 : data.todos > 0 ? Math.round((s.value / data.todos) * 100) : 0;
            return (
              <div key={s.label}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-[#111111]">{s.label}</span>
                  <span className="text-[#111111]">
                    <span className="font-semibold">{formatNumber(s.value)}</span>
                    <span className="ml-1.5 text-xs text-muted">{conv}%</span>
                  </span>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-lg bg-[#f7f3ea]">
                  <div
                    className="flex h-full items-center rounded-lg px-2 text-xs font-semibold text-[#111111] transition-all"
                    style={{ width: `${width}%`, background: s.tone }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function OcupacaoAgenda({ data }: { data: Dashboard['ocupacaoAgenda'] }) {
  return (
    <SectionCard title="Ocupação da agenda" icon={<IconClock size={18} />}>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Sem dados de ocupação.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.map((p) => (
            <li key={p.professionalId} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate text-[#111111]">{p.name}</span>
                  <span className="shrink-0 font-semibold text-[#111111]">{Math.round(p.pct)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f08ca5]/10">
                  <div className="h-full rounded-full bg-[#f08ca5]" style={{ width: `${Math.min(100, p.pct)}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function MapaCalor({ data }: { data: Dashboard['mapaCalor'] }) {
  const { hours, matrix, max } = data;
  const hasData = max > 0;
  function cellColor(v: number): string {
    if (v <= 0) return '#f7f3ea';
    const t = v / max;
    // interpolate opacity of the gold accent
    const alpha = 0.15 + t * 0.85;
    return `rgba(242, 179, 61, ${alpha.toFixed(2)})`;
  }
  return (
    <SectionCard title="Mapa de calor · horários" icon={<IconCalendar size={18} />}>
      {!hasData ? (
        <p className="py-8 text-center text-sm text-muted">Sem agendamentos para o mapa.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            {/* Weekday header */}
            <div className="mb-1 grid grid-cols-[2.5rem_repeat(7,1fr)] gap-1">
              <span />
              {WEEKDAY_LABELS.map((w) => (
                <span key={w} className="text-center text-[10px] font-medium text-muted">{w}</span>
              ))}
            </div>
            {hours.map((h, r) => (
              <div key={h} className="mb-1 grid grid-cols-[2.5rem_repeat(7,1fr)] items-center gap-1">
                <span className="text-right text-[10px] tabular-nums text-muted pr-1">{String(h).padStart(2, '0')}h</span>
                {WEEKDAY_LABELS.map((_, c) => {
                  const v = matrix[r]?.[c] ?? 0;
                  return (
                    <div
                      key={c}
                      className="flex aspect-square items-center justify-center rounded-[4px] text-[9px] font-semibold text-[#7a5a12]"
                      style={{ background: cellColor(v) }}
                      title={`${WEEKDAY_LABELS[c]} ${String(h).padStart(2, '0')}h: ${v}`}
                    >
                      {v > 0 ? v : ''}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted">
              <span>Menos</span>
              <span className="h-3 w-3 rounded-[3px]" style={{ background: '#f7f3ea' }} />
              <span className="h-3 w-3 rounded-[3px]" style={{ background: 'rgba(242,179,61,0.4)' }} />
              <span className="h-3 w-3 rounded-[3px]" style={{ background: 'rgba(242,179,61,0.7)' }} />
              <span className="h-3 w-3 rounded-[3px]" style={{ background: 'rgba(242,179,61,1)' }} />
              <span>Mais</span>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------

export function PainelPage() {
  const [range, setRange] = useState(defaultRange);

  const dashboard = useDashboard(range.from, range.to);
  const d = dashboard.data;

  return (
    <div>
      <PageHeader
        title="Painel"
        subtitle="Resumo do seu salão"
        onRefresh={() => dashboard.refetch()}
        isRefreshing={dashboard.isFetching}
      />

      {/* Period filter */}
      <div className="mb-5">
        <DateRangeFilter
          from={range.from}
          to={range.to}
          onChange={setRange}
        />
      </div>

      {dashboard.isLoading ? (
        <LoadingState />
      ) : dashboard.isError || !d ? (
        <EmptyState
          title="Não foi possível carregar o painel"
          description="Tente atualizar novamente em instantes."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── (1-4) KPIs ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              icon={<IconDollar size={14} />}
              label="Vendas totais"
              value={compactMoney(d.vendasTotais.valor)}
              deltaPct={d.vendasTotais.deltaPct}
              deltaLabel="vs período anterior"
            />
            <KpiCard
              icon={<IconTrendUp size={14} />}
              label="Vendas do dia"
              value={compactMoney(d.vendasDia)}
            />
            <KpiCard
              icon={<IconCalendar size={14} />}
              label="Agendamentos"
              value={formatNumber(d.agendamentosCount.valor)}
              deltaPct={d.agendamentosCount.deltaPct}
              deltaLabel="vs período anterior"
              accent="pink"
            />
            <KpiCard
              icon={<IconReceipt size={14} />}
              label="Comandas"
              value={formatNumber(d.comandasCount.valor)}
              deltaPct={d.comandasCount.taxaConversao}
              deltaLabel="conversão"
              accent="pink"
            />
          </div>

          {/* ── (7) Ticket médio + (8) Comparação de períodos ──────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card className={`min-w-0 ${CARD}`}>
              <Card.Content className="flex flex-col justify-center p-4 sm:p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Ticket médio</p>
                <p className="mt-2 break-words text-2xl font-bold text-[#111111] sm:text-3xl">
                  {formatMoney(d.ticketMedio.valor)}
                </p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span
                    className={`text-sm font-semibold ${d.ticketMedio.deltaPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
                  >
                    {d.ticketMedio.deltaPct >= 0 ? '↑' : '↓'} {Math.abs(Math.round(d.ticketMedio.deltaPct))}%
                  </span>
                  <span className="text-xs text-muted">vs período anterior</span>
                </div>
              </Card.Content>
            </Card>
            <div className="lg:col-span-2">
              <ComparacaoPeriodos data={d.comparacaoPeriodos} />
            </div>
          </div>

          {/* ── (5) Tendência de visitas ───────────────────────────────────── */}
          <TendenciaVisitas data={d.tendenciaVisitas} />

          {/* ── (6) status + (11) funil ────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <AgendamentosPorStatus data={d.agendamentosPorStatus} />
            <FunilWidget data={d.funil} />
          </div>

          {/* ── (9) profissional + (10) categoria ──────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <AtendimentosPorProfissional data={d.atendimentosPorProfissional} />
            <VendasPorCategoria data={d.vendasPorCategoria} />
          </div>

          {/* ── (12) ocupação + (13) mapa de calor ─────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <OcupacaoAgenda data={d.ocupacaoAgenda} />
            <MapaCalor data={d.mapaCalor} />
          </div>
        </div>
      )}
    </div>
  );
}
