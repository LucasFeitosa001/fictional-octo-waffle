import { useMemo, useState } from 'react';
import { Button, Card } from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
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
import { Drawer } from '../components/Drawer';
import { useSetPageActions } from '../layout/PageActions';
import { EmptyState, LoadingState } from '../components/States';
import {
  IconCalendar,
  IconChart,
  IconClock,
  IconDollar,
  IconFilter,
  IconReceipt,
  IconRefresh,
  IconTrendUp,
  IconUsers,
} from '../components/icons';
import { useDashboard } from '../lib/queries/dashboard';
import type { Dashboard } from '../lib/queries/dashboard';
import { formatMoney, formatNumber, isoDate } from '../lib/format';
import { useSession } from '../lib/auth';
import { useThemeColors } from '../theme/useThemeColors';

/** "2026-07-05" → "05 jul, 2026" (mesmo formato de período do topo do painel). */
const MESES_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function periodoLabel(iso: string): string {
  const [y, m, d] = (iso || '').split('-');
  if (!y || !m || !d) return iso;
  return `${d} ${MESES_ABBR[Number(m) - 1] ?? m}, ${y}`;
}

const CARD = 'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

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

// Belasis weekday labels (index = JS getDay(), 0 = domingo). Full on desktop,
// abbreviated on mobile — matches belasis.app's heatmap header.
const WEEKDAY_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const WEEKDAY_ABBR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Belasis occupancy levels (from their i18n): baixa / moderada / boa. */
function nivelOcupacao(pct: number): string {
  if (pct >= 70) return 'Boa ocupação';
  if (pct >= 40) return 'Ocupação moderada';
  return 'Baixa ocupação';
}

/** Small user-silhouette avatar (antd user icon), matches Belasis ant-avatar-icon. */
function UserAvatar() {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/15 text-gold-strong" aria-hidden>
      <svg viewBox="64 64 896 896" width={16} height={16} fill="currentColor">
        <path d="M858.5 763.6a374 374 0 00-80.6-119.5 375.63 375.63 0 00-119.5-80.6c-.4-.2-.8-.3-1.2-.5C719.5 518 760 444.7 760 362c0-137-111-248-248-248S264 225 264 362c0 82.7 40.5 156 102.8 201.1-.4.2-.8.3-1.2.5-44.8 18.9-85 46-119.5 80.6a375.63 375.63 0 00-80.6 119.5A371.7 371.7 0 00136 901.8a8 8 0 008 8.2h60c4.4 0 7.9-3.5 8-7.8 2-77.2 33-149.5 87.8-204.3 56.7-56.7 132-87.9 212.2-87.9s155.5 31.2 212.2 87.9C779 752.7 810 825 812 902.2c.1 4.4 3.6 7.8 8 7.8h60a8 8 0 008-8.2c-1-47.8-10.9-94.3-29.5-138.2zM512 534c-45.9 0-89.1-17.9-121.6-50.4S340 407.9 340 362c0-45.9 17.9-89.1 50.4-121.6S466.1 190 512 190s89.1 17.9 121.6 50.4S684 316.1 684 362c0 45.9-17.9 89.1-50.4 121.6S557.9 534 512 534z" />
      </svg>
    </span>
  );
}

/** Belasis default: the last 15 days (e.g. 05 → 19 when today is the 19th). */
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14);
  return { from: isoDate(from), to: isoDate(to) };
}

// ---------------------------------------------------------------------------

/** antd info-circle (outline), muted — matches Belasis's card corner affordance. */
function InfoIcon({ size = 16 }: { size?: number }) {
  return (
    <span className="shrink-0 text-muted-ink/70" aria-hidden>
      <svg viewBox="64 64 896 896" width={size} height={size} fill="currentColor">
        <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" />
        <path d="M464 336a48 48 0 1096 0 48 48 0 10-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z" />
      </svg>
    </span>
  );
}

/** Footer status pill — Belasis `.card-footer > .ant-tag`. Positive→green, negative→red,
 *  or a fixed purple for conversion. Success/danger stay semantic across themes. */
function DeltaTag({ pct, label, tone = 'auto' }: { pct: number; label: string; tone?: 'auto' | 'purple' }) {
  const up = pct >= 0;
  const cls =
    tone === 'purple'
      ? 'bg-violet-50 text-violet-700'
      : up
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-red-50 text-red-600';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${cls}`}>
      {tone !== 'purple' && <span aria-hidden>{up ? '↑' : '↓'}</span>}
      <span className="font-semibold">{Math.abs(Math.round(pct))}%</span>
      <span className="font-normal opacity-80">{label}</span>
    </span>
  );
}

/** Mini area sparkline (Belasis Agendamentos/Comandas cards). */
function Sparkline({
  data,
  dataKey,
  color,
}: {
  data: Dashboard['tendenciaVisitas'];
  dataKey: 'agendamentos' | 'comandas';
  color: string;
}) {
  const gid = `spark-${dataKey}`;
  return (
    <div className="h-14">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Belasis ChartCard — CSS lifted 1:1 from their styled-component:
 *  .header{gap:12} .icon-wrapper{40x40,r12,24px} .total{28px,1.2} .card-footer{border-top,pt8}.
 *  Colors are themeable (icon badge = primary@9%). One card per row (full width). */
function MetricCard({
  icon,
  title,
  total,
  children,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  total: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className={`min-w-0 ${CARD}`}>
      <Card.Content className="p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center">
            <div className="flex flex-1 items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[24px]"
                style={{ background: 'color-mix(in oklab, var(--sp-primary) 9%, transparent)', color: 'var(--sp-primary)' }}
              >
                {icon}
              </span>
              <span className="text-sm font-medium text-ink">{title}</span>
            </div>
            <InfoIcon />
          </div>
          <div className="text-[28px] font-bold leading-[1.2] text-ink">{total}</div>
        </div>
        {children && <div className="mx-[-8px] my-2">{children}</div>}
        {footer && <div className="mt-3 border-t border-line pt-2">{footer}</div>}
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
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/15 text-gold-strong">
              {icon}
            </span>
          )}
          <p className="font-brand text-sm font-semibold text-ink">{title}</p>
        </div>
        {children}
      </Card.Content>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function TendenciaVisitas({ data }: { data: Dashboard['tendenciaVisitas'] }) {
  const c = useThemeColors();
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
              <span className="h-2.5 w-2.5 rounded-full bg-gold" /> Agendamentos
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="h-2.5 w-2.5 rounded-full bg-pink" /> Comandas
            </span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.chartGrid} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: c.chartAxis }}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.ceil(chartData.length / 8) - 1)}
                />
                <YAxis tick={{ fontSize: 10, fill: c.chartAxis }} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
                <Tooltip cursor={{ stroke: c.primary, strokeWidth: 1 }} />
                <Line type="monotone" dataKey="agendamentos" name="Agendamentos" stroke={c.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="comandas" name="Comandas" stroke={c.pink} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function AgendamentosPorStatus({ data }: { data: Dashboard['agendamentosPorStatus'] }) {
  const { palette } = useThemeColors();
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
                    <Cell key={i} fill={palette[i % palette.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatNumber(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex w-full flex-col gap-2 sm:w-1/2">
            {chartData.map((s, i) => (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: palette[i % palette.length] }} />
                <span className="min-w-0 flex-1 truncate text-ink">{s.name}</span>
                <span className="shrink-0 font-semibold text-ink">{formatNumber(s.value)}</span>
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
  const c = useThemeColors();
  const chartData = [
    { name: 'Anterior', v: data.anterior, fill: `color-mix(in oklab, ${c.primary} 45%, ${c.canvas})` },
    { name: 'Atual', v: data.atual, fill: c.primary },
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.chartGrid} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: c.chartAxis }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: c.chartAxis }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatMoney(Number(v))} />
              <Tooltip formatter={(v: number) => [formatMoney(v), 'Vendas']} cursor={{ fill: `color-mix(in oklab, ${c.primary} 8%, transparent)` }} />
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
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold-strong">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                  <p className="shrink-0 text-sm font-semibold text-ink">{formatMoney(p.receita)}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gold/15">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, p.pct)}%` }} />
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
  const { palette } = useThemeColors();
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
                <span className="truncate text-ink">{c.categoria}</span>
                <span className="shrink-0 font-semibold text-ink">
                  {formatMoney(c.valor)}
                  <span className="ml-1.5 text-xs font-normal text-muted">{Math.round(c.pct)}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gold/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(c.valor / maxVal) * 100}%`, background: palette[i % palette.length] }}
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
  const c = useThemeColors();
  const steps = [
    { name: 'Todos', value: data.todos, fill: c.primary },
    { name: 'Confirmados', value: data.confirmados, fill: `color-mix(in oklab, ${c.primary} 65%, ${c.pink})` },
    { name: 'Faturados', value: data.faturados, fill: c.pink },
  ];
  const empty = data.todos === 0 && data.confirmados === 0 && data.faturados === 0;
  return (
    <SectionCard title="Funil de agendamentos" icon={<IconReceipt size={18} />}>
      {empty ? (
        <p className="py-8 text-center text-sm text-muted">Sem agendamentos no período.</p>
      ) : (
        <>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Funnel dataKey="value" data={steps} isAnimationActive nameKey="name">
                  <LabelList position="right" dataKey="name" fill={c.ink} stroke="none" fontSize={12} />
                  {steps.map((s, i) => (
                    <Cell key={i} fill={s.fill} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {steps.map((s) => {
              const pct = data.todos > 0 ? Math.round((s.value / data.todos) * 100) : 0;
              return (
                <li key={s.name} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.fill }} />
                  <span className="flex-1 text-ink">{s.name}</span>
                  <span className="font-semibold text-ink">{formatNumber(s.value)}</span>
                  <span className="w-12 text-right text-xs text-muted">({pct}%)</span>
                </li>
              );
            })}
          </ul>
        </>
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
        <ul className="flex flex-col gap-3.5">
          {data.map((p, i) => {
            const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`;
            const pctText = p.pct.toFixed(1).replace('.', ',') + '%';
            return (
              <li key={p.professionalId} className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 shrink-0 text-center text-base leading-none">{medal}</span>
                  <UserAvatar />
                  <span className="max-w-[6.5rem] shrink-0 truncate text-sm font-medium text-ink">{p.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gold/12">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${Math.min(100, p.pct)}%` }} />
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm font-semibold text-ink">{pctText}</span>
                </div>
                <span className="pl-[3.25rem] text-xs text-muted-ink">{nivelOcupacao(p.pct)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function MapaCalor({ data }: { data: Dashboard['mapaCalor'] }) {
  const { hours, weekdays, matrix, max } = data;
  const hasData = max > 0;
  const cols = weekdays.length;
  const gridStyle = { gridTemplateColumns: `2.25rem repeat(${cols}, minmax(1.75rem, 1fr))` };
  function cellColor(v: number): string {
    if (v <= 0) return 'var(--sp-canvas)';
    const t = v / max;
    // interpolate the theme's primary from faint to full — follows [data-theme].
    const pct = Math.round((0.15 + t * 0.85) * 100);
    return `color-mix(in oklab, var(--sp-primary) ${pct}%, transparent)`;
  }
  return (
    <SectionCard title="Mapa de calor de agendamentos" icon={<IconCalendar size={18} />}>
      {!hasData ? (
        <p className="py-8 text-center text-sm text-muted">Sem agendamentos para o mapa.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            {/* Weekday header — full names on desktop, abbreviated on mobile (Belasis) */}
            <div className="mb-1 grid gap-1" style={gridStyle}>
              <span />
              {weekdays.map((w, ci) => (
                <span key={ci} className="truncate text-center text-[10px] font-medium text-muted-ink">
                  <span className="hidden md:inline">{WEEKDAY_FULL[w] ?? ''}</span>
                  <span className="md:hidden">{WEEKDAY_ABBR[w] ?? ''}</span>
                </span>
              ))}
            </div>
            {hours.map((h, r) => (
              <div key={h} className="mb-1 grid items-center gap-1" style={gridStyle}>
                <span className="pr-1 text-right text-[10px] tabular-nums text-muted-ink">{h}h</span>
                {weekdays.map((w, c) => {
                  const v = matrix[r]?.[c] ?? 0;
                  return (
                    <div
                      key={c}
                      className="flex aspect-square items-center justify-center rounded-[4px] text-[9px] font-semibold text-gold-strong"
                      style={{ background: cellColor(v) }}
                      title={`${WEEKDAY_FULL[w] ?? ''} ${h}h: ${v}`}
                    >
                      {v > 0 ? v : ''}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-muted">
              <span>Menos</span>
              <span className="h-3 w-3 rounded-[3px]" style={{ background: 'var(--sp-canvas)' }} />
              <span className="h-3 w-3 rounded-[3px]" style={{ background: 'color-mix(in oklab, var(--sp-primary) 40%, transparent)' }} />
              <span className="h-3 w-3 rounded-[3px]" style={{ background: 'color-mix(in oklab, var(--sp-primary) 70%, transparent)' }} />
              <span className="h-3 w-3 rounded-[3px]" style={{ background: 'var(--sp-primary)' }} />
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
  const navigateTo = useNavigate();
  const [range, setRange] = useState(defaultRange);
  const [mobileRange, setMobileRange] = useState(range);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const dashboard = useDashboard(range.from, range.to);
  const d = dashboard.data;
  const themeColors = useThemeColors();

  const { data: session } = useSession();
  const firstName =
    (session?.user?.name ?? '').trim().split(/\s+/)[0] || 'Administrador';

  useSetPageActions(
    [
      {
        key: 'agenda',
        label: 'Agenda',
        icon: <IconCalendar size={22} />,
        onClick: () => navigateTo('/agenda'),
      },
      {
        key: 'atualizar',
        label: 'Atualizar',
        icon: <IconRefresh size={22} className={dashboard.isFetching ? 'animate-spin' : ''} />,
        onClick: () => { void dashboard.refetch(); },
        disabled: dashboard.isFetching,
      },
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
    [navigateTo, dashboard.refetch, dashboard.isFetching, range],
  );

  return (
    <div>
      <PageHeader title={`Olá, ${firstName}`} subtitle="Resumo do seu salão" />

      {/* Período filtrado — clicável, abre o drawer de seleção (igual ao Belasis). */}
      <button
        type="button"
        onClick={() => {
          setMobileRange(range);
          setMobileFiltersOpen(true);
        }}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-soft-border)] bg-warm-white px-4 py-2.5 text-center text-sm font-medium text-foreground shadow-[var(--shadow-card)] transition-colors hover:border-gold"
      >
        <IconCalendar size={16} className="shrink-0 text-gold-strong" />
        <span>
          {periodoLabel(range.from)}
          <span className="mx-1.5 text-muted">→</span>
          {periodoLabel(range.to)}
        </span>
      </button>

      {dashboard.isLoading ? (
        <LoadingState />
      ) : dashboard.isError || !d ? (
        <EmptyState
          title="Não foi possível carregar o painel"
          description="Tente atualizar novamente em instantes."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── (1-3) Cards de topo — full-width, um por linha (idêntico ao Belasis) ── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <MetricCard
              icon={<IconDollar size={24} />}
              title="Vendas totais"
              total={formatMoney(d.vendasTotais.valor)}
              footer={<DeltaTag pct={d.vendasTotais.deltaPct} label="Versus período anterior" />}
            >
              <div className="flex items-center justify-between px-2 text-sm">
                <span className="text-muted-ink">Vendas do dia</span>
                <span className="font-semibold text-ink">{formatMoney(d.vendasDia)}</span>
              </div>
            </MetricCard>
            <MetricCard
              icon={<IconCalendar size={24} />}
              title="Agendamentos"
              total={formatNumber(d.agendamentosCount.valor)}
              footer={<DeltaTag pct={d.agendamentosCount.deltaPct} label="Taxa de crescimento" />}
            >
              <Sparkline data={d.tendenciaVisitas} dataKey="agendamentos" color={themeColors.primary} />
            </MetricCard>
            <MetricCard
              icon={<IconReceipt size={24} />}
              title="Comandas"
              total={formatNumber(d.comandasCount.valor)}
              footer={<DeltaTag pct={d.comandasCount.taxaConversao} label="Taxa de conversão" tone="purple" />}
            >
              <Sparkline data={d.tendenciaVisitas} dataKey="comandas" color={themeColors.pink} />
            </MetricCard>
          </div>

          {/* ── (7) Ticket médio + (8) Comparação de períodos ──────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <Card className={`min-w-0 ${CARD}`}>
              <Card.Content className="flex flex-col justify-center p-4 sm:p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Ticket médio</p>
                <p className="mt-2 break-words text-2xl font-bold text-ink sm:text-3xl">
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

      <Drawer
        isOpen={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="Filtros do painel"
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
          <p className="text-sm text-muted">Escolha o período dos indicadores.</p>
          <DateRangeFilter
            from={mobileRange.from}
            to={mobileRange.to}
            onChange={setMobileRange}
            className="flex-col items-stretch [&>label]:!w-full"
          />
        </div>
      </Drawer>
    </div>
  );
}
