import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
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
  Label,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { FilterAside } from '../components/FilterAside';
import { AppTabs } from '../components/AppTabs';
import { Drawer } from '../components/Drawer';
import { useIsMobile } from '../hooks/useIsMobile';
import { useSetPageActions } from '../layout/PageActions';
import { EmptyState, LoadingState } from '../components/States';
import {
  IconCalendar,
  IconClock,
  IconDollar,
  IconFilter,
  IconX,
  IconReceipt,
  IconRefresh,
  IconUsers,
} from '../components/icons';
import { useDashboard } from '../lib/queries/dashboard';
import type { Dashboard } from '../lib/queries/dashboard';
import { formatMoney, formatNumber, isoDate, timeAgo } from '../lib/format';
import { useSession } from '../lib/auth';
import { useThemeColors } from '../theme/useThemeColors';
import {
  BUSINESS_COLORS,
  CHART_COLORS,
  getAppointmentStatusColor,
  getCategoricalColor,
} from '../theme/dataColors';
import { HelpTooltip, LabelWithHelp } from '../components/HelpTooltip';

/** "2026-07-05" → "05 jul, 2026" (mesmo formato de período do topo do painel). */
const MESES_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function periodoLabel(iso: string): string {
  const [y, m, d] = (iso || '').split('-');
  if (!y || !m || !d) return iso;
  return `${d} ${MESES_ABBR[Number(m) - 1] ?? m}, ${y}`;
}

/** "2026-07-05" → "05/07" (rótulos do eixo X das barras da tendência). */
function ddmm(iso: string): string {
  const [, m, d] = (iso || '').split('-');
  return m && d ? `${d}/${m}` : iso;
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

/** Medalhas usam cores fixas de pódio, independentes do tema da interface. */
function medalColor(i: number): string {
  if (i === 0) return '#b28600';
  if (i === 1) return '#c0c0c0';
  if (i === 2) return '#cd7f32';
  return '#64748b';
}

/** Belasis default: the last 15 days (e.g. 05 → 19 when today is the 19th). */
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14);
  return { from: isoDate(from), to: isoDate(to) };
}

// ---------------------------------------------------------------------------
// Ícones locais (paths capturados do Belasis / antd) — usados só neste painel.

/** antd info-circle (outline), muted — Belasis card corner affordance. */
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

/** antd crown (1º lugar) — Belasis Podium. */
function IconCrown({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="64 64 896 896" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M899.6 276.5L705 396.4 518.4 147.5a8.06 8.06 0 00-12.9 0L319 396.4 124.3 276.5c-5.7-3.5-13.1 1.2-12.2 7.9L188.5 865c1.1 7.9 7.9 14 16 14h615.1c8 0 14.9-6 15.9-14l76.4-580.6c.8-6.7-6.5-11.4-12.3-7.9zM512 509c-62.1 0-112.6 50.5-112.6 112.6S449.9 734.2 512 734.2s112.6-50.5 112.6-112.6S574.1 509 512 509z" />
    </svg>
  );
}

/** antd trophy (2º/3º/demais) — Belasis Podium. */
function IconTrophy({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="64 64 896 896" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M868 160h-92v-40c0-4.4-3.6-8-8-8H256c-4.4 0-8 3.6-8 8v40h-92a44 44 0 00-44 44v148c0 81.7 60 149.6 138.2 162C265.7 630.2 359 721.7 476 734.5v105.2H280c-17.7 0-32 14.3-32 32V904c0 4.4 3.6 8 8 8h512c4.4 0 8-3.6 8-8v-32.3c0-17.7-14.3-32-32-32H548V734.5C665 721.7 758.3 630.2 773.8 514 852 501.6 912 433.7 912 352V204a44 44 0 00-44-44zM184 352V232h64v207.6a91.99 91.99 0 01-64-87.6zm656 0c0 41-26.9 75.8-64 87.6V232h64v120z" />
    </svg>
  );
}

/** antd user silhouette — avatar da Ocupação da agenda. */
function UserGlyph({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="64 64 896 896" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M858.5 763.6a374 374 0 00-80.6-119.5 375.63 375.63 0 00-119.5-80.6c-.4-.2-.8-.3-1.2-.5C719.5 518 760 444.7 760 362c0-137-111-248-248-248S264 225 264 362c0 82.7 40.5 156 102.8 201.1-.4.2-.8.3-1.2.5-44.8 18.9-85 46-119.5 80.6a375.63 375.63 0 00-80.6 119.5A371.7 371.7 0 00136 901.8a8 8 0 008 8.2h60c4.4 0 7.9-3.5 8-7.8 2-77.2 33-149.5 87.8-204.3 56.7-56.7 132-87.9 212.2-87.9s155.5 31.2 212.2 87.9C779 752.7 810 825 812 902.2c.1 4.4 3.6 7.8 8 7.8h60a8 8 0 008-8.2c-1-47.8-10.9-94.3-29.5-138.2zM512 534c-45.9 0-89.1-17.9-121.6-50.4S340 407.9 340 362c0-45.9 17.9-89.1 50.4-121.6S466.1 190 512 190s89.1 17.9 121.6 50.4S684 316.1 684 362c0 45.9-17.9 89.1-50.4 121.6S557.9 534 512 534z" />
    </svg>
  );
}

/** Rótulo central themeable para donuts recharts (`<Label content=…>`).
 *  Tipado como `never` p/ satisfazer o `ContentType` do recharts sem perder o render. */
function renderCenterLabel(text: string, color: string, fontSize: number) {
  const render = (props: { viewBox?: { cx?: number; cy?: number } }) => {
    const cx = props.viewBox?.cx ?? 0;
    const cy = props.viewBox?.cy ?? 0;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill={color} fontSize={fontSize} fontWeight={600}>
        {text}
      </text>
    );
  };
  return render as never;
}

// ---------------------------------------------------------------------------
// Blocos reutilizáveis.

/** Pílula do rodapé dos metric-cards (Belasis `.card-footer > .ant-tag`): pílula
 *  UPPERCASE. `delta` → verde↑/vermelho↓ semânticos; `conversao` → rosa/roxo (token pink). */
function StatusPill({
  pct,
  label,
  variant = 'delta',
}: {
  pct: number;
  label: string;
  variant?: 'delta' | 'conversao';
}) {
  if (variant === 'conversao') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sp-data-conversion-soft)] px-3 py-1.5 text-xs uppercase text-data-conversion">
        <span className="font-semibold">{Math.abs(Math.round(pct))}%</span>
        <span className="font-semibold">{label}</span>
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs uppercase ${
        up
          ? 'bg-status-success-soft text-status-success-fg'
          : 'bg-status-danger-soft text-status-danger-fg'
      }`}
    >
      <span aria-hidden>{up ? '↑' : '↓'}</span>
      <span className="font-semibold">{Math.abs(Math.round(pct))}%</span>
      <span className="font-semibold">{label}</span>
    </span>
  );
}

/** Mini área sparkline dos metric-cards (Belasis: h=70, stroke 2.5, gradiente .4→0). */
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
    <div className="h-[70px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gid})`}
            fillOpacity={0.6}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Belasis ChartCard — cada métrica recebe um papel fixo de negócio. */
function MetricCard({
  icon,
  title,
  total,
  tone,
  children,
  footer,
  help,
}: {
  icon: React.ReactNode;
  title: string;
  total: string;
  tone: 'sales' | 'appointments' | 'orders';
  children?: React.ReactNode;
  footer?: React.ReactNode;
  help?: React.ReactNode;
}) {
  return (
    <Card className={`min-w-0 ${CARD}`}>
      <Card.Content className="h-full">
        <div className="flex flex-col gap-3">
          <div className="flex min-h-10 items-center">
            <div className="flex flex-1 items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] text-[24px]"
                style={{
                  background: `var(--sp-data-${tone}-soft)`,
                  color: `var(--sp-data-${tone})`,
                }}
              >
                {icon}
              </span>
              <span className="min-w-0 flex-1 text-base text-ink">{title}</span>
            </div>
            {help ? <HelpTooltip>{help}</HelpTooltip> : <InfoIcon />}
          </div>
          <div className="flex min-h-[34px] items-center text-[28px] font-bold leading-[1.2] text-ink">{total}</div>
        </div>
        {children && <div className="-mx-2 mt-2 flex min-h-[70px] items-center [&>*]:w-full">{children}</div>}
        {footer && <div className="mt-auto border-t border-line pt-2">{footer}</div>}
      </Card.Content>
    </Card>
  );
}

/** Card de seção com ícone no papel fixo de negócio correspondente. */
function SectionCard({
  title,
  icon,
  tone,
  children,
  help,
}: {
  title: string;
  icon?: React.ReactNode;
  tone?: keyof typeof BUSINESS_COLORS;
  children: React.ReactNode;
  help?: React.ReactNode;
}) {
  return (
    <Card className={`min-w-0 ${CARD}`}>
      <Card.Content>
        <div className="mb-3 flex min-h-9 items-center gap-2">
          {icon && (
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
              style={
                tone
                  ? {
                      background: `var(--sp-data-${tone}-soft)`,
                      color: BUSINESS_COLORS[tone],
                    }
                  : {
                      background: 'var(--sp-status-neutral-soft)',
                      color: 'var(--sp-status-neutral-fg)',
                    }
              }
            >
              {icon}
            </span>
          )}
          <p className="min-w-0 flex-1 font-brand text-sm font-semibold text-ink">{title}</p>
          {help && <HelpTooltip>{help}</HelpTooltip>}
        </div>
        {children}
      </Card.Content>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// (5) Abas Agendamentos/Comandas — Tendência de Visitas (barras) + Agendamentos por status (donut)

type Aba = 'schedules' | 'sales';
const TABS: Array<{ id: Aba; label: string; icon: React.ReactNode }> = [
  { id: 'schedules', label: 'Agendamentos', icon: <IconCalendar size={16} /> },
  { id: 'sales', label: 'Comandas', icon: <IconReceipt size={16} /> },
];

/** Bloco esquerdo: BarChart "Tendência de Visitas" (barras verticais, radius topo). */
function TendenciaVisitasBars({
  data,
  dataKey,
  title = 'Tendência de Visitas',
  fullWidth = false,
}: {
  data: Dashboard['tendenciaVisitas'];
  dataKey: 'agendamentos' | 'comandas';
  title?: string;
  fullWidth?: boolean;
}) {
  const c = useThemeColors();
  const seriesColor = dataKey === 'agendamentos' ? c.appointments : c.orders;
  const chartData = useMemo(() => data.map((d) => ({ ...d, label: ddmm(d.date) })), [data]);
  const empty = data.every((d) => d.agendamentos === 0 && d.comandas === 0);
  return (
    <div className={fullWidth ? 'w-full min-w-0' : 'min-w-0 flex-[1_1_520px]'}>
      <span className="text-base font-semibold text-ink">{title}</span>
      <HelpTooltip>Evolução diária de {dataKey === 'agendamentos' ? 'agendamentos' : 'comandas'} no período</HelpTooltip>
      {empty ? (
        <p className="py-10 text-center text-sm text-muted">Sem visitas no período.</p>
      ) : (
        <div className="mt-3 w-full overflow-x-auto overflow-y-hidden">
          <div className="h-[280px] min-w-[420px] sm:h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke={c.chartGrid} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  tick={{ fontSize: 11, fill: c.chartAxis }}
                  axisLine={{ stroke: c.chartGrid }}
                  interval="preserveStartEnd"
                  minTickGap={16}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: c.chartAxis }}
                  axisLine={{ stroke: c.chartGrid }}
                  width={30}
                />
                <Tooltip
                  cursor={{ fill: `color-mix(in oklab, ${seriesColor} 8%, transparent)` }}
                  formatter={(v: number) => [formatNumber(v), dataKey === 'agendamentos' ? 'Agendamentos' : 'Comandas']}
                />
                <Bar dataKey={dataKey} fill={seriesColor} radius={[8, 8, 0, 0]} maxBarSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

/** Bloco direito: donut "Agendamentos por status" + legenda DOM (bolinha · nome · count (pct%)). */
function StatusDonut({ slices }: { slices: Dashboard['agendamentosPorStatus'] }) {
  const c = useThemeColors();
  const data = useMemo(
    () =>
      slices.map((s) => ({
        name: statusLabel(s.status),
        value: s.count,
        pct: s.pct,
        color: getAppointmentStatusColor(s.status),
      })),
    [slices],
  );
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex min-w-0 flex-[1_1_260px] flex-col">
      <span className="text-base font-semibold text-ink">
        Agendamentos por status
        <HelpTooltip>Distribuição dos agendamentos por status</HelpTooltip>
      </span>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Sem agendamentos no período.</p>
      ) : (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-3">
          <div className="h-[170px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" paddingAngle={0} stroke="none">
                  {data.map((slice) => (
                    <Cell key={slice.name} fill={slice.color} stroke="#ffffff" strokeWidth={2} />
                  ))}
                  <Label position="center" content={renderCenterLabel(`Total: ${total}`, c.ink, 14)} />
                </Pie>
                <Tooltip formatter={(v: number) => formatNumber(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex w-full flex-col gap-2">
            {data.map((s) => (
              <li key={s.name} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span title={s.name} className="max-w-[130px] truncate text-ink">{s.name}</span>
                </span>
                <span className="shrink-0 whitespace-nowrap font-semibold text-ink">
                  {formatNumber(s.value)} ({Math.round(s.pct)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Card com abas [Agendamentos|Comandas] — troca a série do BarChart (e do donut, quando houver). */
function TabsTendenciaStatus({ d }: { d: Dashboard }) {
  const [aba, setAba] = useState<Aba>('schedules');
  return (
    <Card className={`min-w-0 ${CARD}`}>
      <Card.Content>
        <AppTabs
          items={TABS}
          selectedKey={aba}
          onSelectionChange={setAba}
          ariaLabel="Dados do painel"
          className="mb-4"
        />
        {aba === 'schedules' ? (
          <div className="flex flex-wrap gap-6">
            <TendenciaVisitasBars data={d.tendenciaVisitas} dataKey="agendamentos" />
            <StatusDonut slices={d.agendamentosPorStatus} />
          </div>
        ) : (
          <div>
            <TendenciaVisitasBars data={d.tendenciaVisitas} dataKey="comandas" title="Vendas por dia" fullWidth />
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// (6) Ticket médio + Comparação entre períodos (card único, fiel ao Belasis)

function TicketMedioCard({
  ticket,
  comparacao,
}: {
  ticket: Dashboard['ticketMedio'];
  comparacao: Dashboard['comparacaoPeriodos'];
}) {
  const c = useThemeColors();
  const up = ticket.deltaPct >= 0;
  const chartData = [
    { name: 'Período anterior', value: comparacao.anterior, fill: c.previousPeriod },
    { name: 'Período atual', value: comparacao.atual, fill: c.sales },
  ];
  const empty = comparacao.anterior === 0 && comparacao.atual === 0;
  return (
    <Card className={`min-w-0 ${CARD}`}>
      <div className="flex min-h-9 items-center gap-1.5 border-b border-line pb-3">
        <p className="min-w-0 flex-1 font-brand text-sm font-semibold text-ink">Ticket médio</p>
        <HelpTooltip>Valor médio recebido por cliente no período</HelpTooltip>
      </div>
      <Card.Content className="flex flex-col gap-3">
        {/* (1) caixa métrica */}
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-line p-4 text-center">
          <LabelWithHelp
            label="Ticket médio - Período atual"
            help="Ticket médio calculado no período selecionado"
            className="text-sm text-muted-ink"
          />

          <span className="text-2xl font-bold text-ink">{formatMoney(ticket.valor)}</span>
          <div className="flex items-center gap-1">
            <span className="text-sm leading-none text-muted-ink">Versus período anterior:</span>
            <span className={`text-sm font-bold ${up ? 'text-status-success-fg' : 'text-status-danger-fg'}`}>
              {up ? '▲' : '▼'} {Math.abs(Math.round(ticket.deltaPct))}%
            </span>
          </div>
        </div>
        {/* (2) caixa do gráfico */}
        <div className="rounded-xl border border-line p-3 sm:p-4">
          <p className="mb-4 block text-center text-base text-ink">
            Comparação entre períodos
            <HelpTooltip>Compara o período atual com o anterior</HelpTooltip>
          </p>
          {empty ? (
            <p className="py-8 text-center text-sm text-muted">Sem vendas para comparar.</p>
          ) : (
            <div className="h-[220px] lg:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={c.chartGrid} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: c.chartAxis }} tickLine={false} axisLine={{ stroke: c.chartGrid }} height={36} />
                  <YAxis
                    tick={{ fontSize: 11, fill: c.chartAxis }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v) => formatMoney(Number(v))}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatMoney(v), 'Ticket médio']}
                    cursor={{ fill: `color-mix(in oklab, ${c.sales} 8%, transparent)` }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={80}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </Card.Content>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// (7) Atendimentos por profissional — ranking com COROA (1º) / TROFÉU (demais)

function AtendimentosPorProfissional({
  data,
  serie,
}: {
  data: Dashboard['atendimentosPorProfissional'];
  serie: Dashboard['tendenciaVisitas'];
}) {
  const c = useThemeColors();
  const totalAtend = data.reduce((s, p) => s + p.servicos, 0);
  return (
    <SectionCard
      title="Atendimentos por profissional"
      icon={<IconUsers size={18} />}
      tone="services"
      help="Ranking de profissionais por número de serviços no período"
    >
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Sem atendimentos no período.</p>
      ) : (
        <>
          {/* Parte 1: cabeçalho estatístico + mini area chart (Belasis) */}
          <div className="mb-4 flex items-center justify-between gap-4 border-b border-line pb-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-ink">Atendimentos</p>
              <p className="text-2xl font-semibold leading-tight text-ink">{formatNumber(totalAtend)}</p>
            </div>
            <div className="h-[55px] w-1/2 max-w-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serie} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="atend-spark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={c.services} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={c.services} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="agendamentos" stroke={c.services} strokeWidth={2} fill="url(#atend-spark)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Parte 2: PÓDIO — sempre 3 barras (2º·1º·3º), degraus 80/60/40 (Belasis) */}
          <div className="flex items-end justify-center gap-3 py-2.5 sm:gap-5">
            {data.slice(0, 3).map((p, i) => {
              const rank = i + 1;
              const order = rank === 1 ? 2 : rank === 2 ? 1 : 3;
              const stepH = rank === 1 ? 80 : rank === 2 ? 60 : 40;
              const medal = medalColor(i);
              const first = (p.name || '').trim().split(/\s+/)[0] || p.name;
              // Belasis mostra o TICKET MÉDIO de atendimento (receita / serviços).
              const avgTicket = p.servicos > 0 ? p.receita / p.servicos : 0;
              return (
                <div key={p.professionalId ?? `pod-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1" style={{ order }}>
                  <span className="grid h-12 w-12 place-items-center rounded-full text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)]" style={{ background: medal }}>
                    {rank === 1 ? <IconCrown size={24} /> : <IconTrophy size={24} />}
                  </span>
                  <span className="mt-1 max-w-full truncate text-sm font-medium text-ink">{first}</span>
                  <span className="text-xs font-medium" style={{ color: medal }}>{formatNumber(p.servicos)} serviços</span>
                  <span className="text-xs text-muted-ink">{formatMoney(avgTicket)}</span>
                  <div
                    className="mt-1 flex w-full max-w-[110px] items-center justify-center rounded-t-xl border-2 text-base font-bold"
                    style={{
                      height: stepH,
                      color: medal,
                      borderColor: medal,
                      background: `linear-gradient(135deg, color-mix(in oklab, ${medal} 13%, transparent) 0%, color-mix(in oklab, ${medal} 27%, transparent) 100%)`,
                      boxShadow: `0 4px 12px color-mix(in oklab, ${medal} 20%, transparent)`,
                    }}
                  >
                    {rank}º
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// (8) Vendas por categoria — donut + legenda (Total no centro)

function VendasPorCategoria({ data }: { data: Dashboard['vendasPorCategoria'] }) {
  const c = useThemeColors();
  const total = data.reduce((s, d) => s + d.valor, 0);
  return (
    <SectionCard
      title="Vendas por categoria"
      icon={<IconDollar size={18} />}
      tone="sales"
      help="Distribuição das vendas por categoria de item"
    >
      {data.length === 0 || total === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Sem vendas no período.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="h-[200px] w-full max-w-[220px] sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="valor"
                  nameKey="categoria"
                  cx="50%"
                  cy="50%"
                  innerRadius="70%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={0}
                  stroke="none"
                >
                  {data.map((category) => (
                    <Cell key={category.categoria} fill={getCategoricalColor(category.categoria)} stroke="#ffffff" strokeWidth={2} />
                  ))}
                  <Label position="center" content={renderCenterLabel(`Total: ${formatMoney(total)}`, c.ink, 12)} />
                </Pie>
                <Tooltip formatter={(v: number) => formatMoney(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex w-full flex-col gap-2 sm:w-1/2">
            {data.map((cat) => (
              <li key={cat.categoria} className="flex flex-nowrap items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: getCategoricalColor(cat.categoria) }} />
                <span title={cat.categoria} className="min-w-0 flex-1 truncate text-ink">{cat.categoria}</span>
                <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-ink">
                  {formatMoney(cat.valor)}
                  <span className="ml-1 text-xs font-normal text-muted">({Math.round(cat.pct)}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// (9) Funil de agendamentos — FunnelChart recharts REAL (trapézios) + legenda

function FunilWidget({ data }: { data: Dashboard['funil'] }) {
  const c = useThemeColors();
  const empty = data.todos === 0 && data.confirmados === 0 && data.faturados === 0;
  const pct = (v: number) => (data.todos > 0 ? Math.round((v / data.todos) * 100) : 0);
  const steps = [
    { name: 'Todos', value: data.todos, fill: CHART_COLORS.appointmentFunnel[0], label: `Todos: ${data.todos} (${pct(data.todos)}%)` },
    {
      name: 'Confirmados',
      value: data.confirmados,
      fill: CHART_COLORS.appointmentFunnel[1],
      label: `Confirmados: ${data.confirmados} (${pct(data.confirmados)}%)`,
    },
    {
      name: 'Faturados',
      value: data.faturados,
      fill: CHART_COLORS.appointmentFunnel[2],
      label: `Faturados: ${data.faturados} (${pct(data.faturados)}%)`,
    },
  ];
  return (
    <SectionCard
      title="Funil de agendamentos"
      icon={<IconReceipt size={18} />}
      tone="conversion"
      help="Jornada do agendamento: agendado, confirmado, atendido"
    >
      {empty ? (
        <p className="py-8 text-center text-sm text-muted">Sem agendamentos no período.</p>
      ) : (
        <>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip formatter={(v: number) => formatNumber(v)} />
                <Funnel dataKey="value" data={steps} nameKey="name" isAnimationActive>
                  <LabelList position="center" dataKey="label" fill={c.ink} stroke="none" fontSize={12} />
                  {steps.map((s, i) => (
                    <Cell key={i} fill={s.fill} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {steps.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.fill }} />
                <span className="flex-1 text-ink">{s.name}</span>
                <span className="font-semibold text-ink">{formatNumber(s.value)}</span>
                <span className="w-12 text-right text-xs text-muted">({pct(s.value)}%)</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// (10) Ocupação da agenda — medalha 🥇🥈🥉/#N + avatar + termômetro vertical + % + nível

function OcupacaoAgenda({ data }: { data: Dashboard['ocupacaoAgenda'] }) {
  const ranked = useMemo(() => [...data].sort((a, b) => b.pct - a.pct), [data]);
  return (
    <SectionCard
      title="Ocupação da agenda"
      icon={<IconClock size={18} />}
      tone="appointments"
      help="Percentual da agenda ocupada por profissional no período"
    >
      {ranked.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Sem dados de ocupação.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-3 px-1">
            {ranked.map((p, i) => {
              const rank = i + 1;
              const l = Math.min(p.pct, 100);
              const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`;
              const pctText = p.pct.toFixed(1).replace('.', ',') + '%';
              const firstName = p.name.split(' ')[0] || p.name;
              return (
                <div key={p.professionalId} className="w-[140px] shrink-0">
                  <div
                    className="relative flex flex-col items-center rounded-xl px-3 py-4"
                    style={{ background: 'color-mix(in oklab, var(--sp-ink) 3%, transparent)' }}
                  >
                    <span className={`absolute right-2 top-2 font-bold ${rank <= 3 ? 'text-lg' : 'text-xs text-muted-ink'}`}>
                      {medal}
                    </span>
                    <span className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-data-appointments text-white">
                      <UserGlyph size={24} />
                    </span>
                    <span className="mt-2 w-full truncate text-center text-sm text-ink">{firstName}</span>
                    <div className="relative mb-2 mt-3 h-[120px] w-6">
                      <div className="absolute inset-0 rounded-xl" style={{ background: 'color-mix(in oklab, var(--sp-ink) 8%, transparent)' }} />
                      <div
                        className="absolute bottom-0 z-10 w-full rounded-xl transition-[height] duration-500"
                        style={{
                          height: `${l}%`,
                          background: 'linear-gradient(to top, #5b21b6, #a78bfa)',
                          boxShadow: '0 2px 8px rgb(124 58 237 / 25%)',
                        }}
                      />
                    </div>
                    <span className="text-lg font-bold text-data-appointments">{pctText}</span>
                    <span className="mt-1 text-center text-[11px] uppercase text-muted-ink">{nivelOcupacao(l)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// (11) Mapa de calor de agendamentos — grade flexbox, dias por extenso

function MapaCalor({ data }: { data: Dashboard['mapaCalor'] }) {
  const { hours, weekdays, matrix, max } = data;
  const hasData = max > 0;
  const cols = weekdays.length;
  const gridStyle = { gridTemplateColumns: `2.5rem repeat(${cols}, minmax(1.75rem, 1fr))` };
  function cellColor(v: number): string {
    if (v <= 0 || max <= 0) return 'transparent';
    const level = Math.min(
      CHART_COLORS.heatmap.length - 1,
      Math.max(0, Math.ceil((v / max) * CHART_COLORS.heatmap.length) - 1),
    );
    return CHART_COLORS.heatmap[level];
  }
  return (
    <SectionCard
      title="Mapa de calor de agendamentos"
      icon={<IconCalendar size={18} />}
      tone="appointments"
      help="Densidade de agendamentos por dia da semana e horário"
    >
      {!hasData ? (
        <p className="py-8 text-center text-sm text-muted">Sem agendamentos para o mapa.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            {/* Cabeçalho de dias — nomes completos no desktop, abreviados no mobile */}
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
                {weekdays.map((w, ci) => {
                  const v = matrix[r]?.[ci] ?? 0;
                  return (
                    <div
                      key={ci}
                      className="flex h-[35px] items-center justify-center rounded-[8px] text-[9px] font-semibold"
                      style={{
                        background: cellColor(v),
                        color: v / max >= 0.55 ? '#ffffff' : '#312e81',
                      }}
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
              {CHART_COLORS.heatmap.map((color) => (
                <span key={color} className="h-3 w-3 rounded-[3px]" style={{ background: color }} />
              ))}
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
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [desktopRange, setDesktopRange] = useState(range);
  const isMobile = useIsMobile();

  const dashboard = useDashboard(range.from, range.to);
  const d = dashboard.data;
  const themeColors = useThemeColors();
  const queryClient = useQueryClient();

  // "Atualizar" DE VERDADE: invalida a query do período atual (marca stale) e
  // força um refetch do servidor. `refetch()` já ignora staleTime, mas o
  // invalidate garante que qualquer outro observer/refetch em voo também pegue
  // dados frescos. `void` porque não precisamos aguardar aqui.
  const from = range.from;
  const to = range.to;
  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard', from, to] });
  }, [queryClient, from, to]);

  // "Atualizado há X": deriva de dataUpdatedAt (ms) da query. Um tick a cada
  // 30s re-renderiza o texto ("agora mesmo" → "há 1 min" → ...) sem refetch.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const atualizadoLabel = dashboard.isFetching
    ? 'Atualizando…'
    : dashboard.dataUpdatedAt
      ? `Atualizado ${timeAgo(dashboard.dataUpdatedAt)}`
      : '';

  const { data: session } = useSession();
  const firstName = (session?.user?.name ?? '').trim().split(/\s+/)[0] || 'Administrador';

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
        label: dashboard.isFetching ? 'Atualizando…' : 'Atualizar',
        icon: <IconRefresh size={22} className={dashboard.isFetching ? 'animate-spin' : ''} />,
        onClick: handleRefresh,
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
    [navigateTo, handleRefresh, dashboard.isFetching, range],
  );

  return (
    <div>
      {/* (1) Cabeçalho + saudação + ações desktop (Atualizar / Filtros) */}
      <PageHeader
        title={`Olá, ${firstName}`}
        subtitle="Resumo do seu salão"
        onFilter={
          isMobile
            ? undefined
            : () => {
                setDesktopRange(range);
                setDesktopFiltersOpen((v) => !v);
              }
        }
        actions={
          isMobile ? undefined : (
          <div className="col-span-2 flex w-full items-center justify-end gap-2 sm:w-auto">
            {atualizadoLabel && (
              <span className="hidden whitespace-nowrap text-xs text-muted-ink sm:inline" aria-live="polite">
                {atualizadoLabel}
              </span>
            )}
            <Button
              variant="outline"
              onClick={handleRefresh}
              isDisabled={dashboard.isFetching}
              className="w-full sm:w-auto"
            >
              <IconRefresh size={16} className={dashboard.isFetching ? 'animate-spin' : ''} /> Atualizar
            </Button>
          </div>
          )
        }
      />

      {/* (1) Chip de período — mobile abre Drawer, desktop toggle painel lateral inline. */}
      <button
        type="button"
        onClick={() => {
          if (isMobile) {
            setMobileRange(range);
            setMobileFiltersOpen(true);
          } else {
            setDesktopRange(range);
            setDesktopFiltersOpen((v) => !v);
          }
        }}
        aria-expanded={isMobile ? undefined : desktopFiltersOpen}
        className={[
          'mb-4 flex w-full items-center justify-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-center text-sm font-medium text-ink shadow-[var(--shadow-card)] transition-colors hover:border-gold',
          desktopFiltersOpen && !isMobile ? 'border-gold' : 'border-line',
        ].join(' ')}
      >
        <IconCalendar size={16} className="shrink-0 text-gold-strong" />
        <span>
          {periodoLabel(range.from)}
          <span className="mx-1.5 text-muted-ink">→</span>
          {periodoLabel(range.to)}
        </span>
        <InfoIcon size={14} />
      </button>

      {/* Status "Atualizado há X" — no mobile o header não mostra ações inline,
          então exibimos aqui embaixo do chip de período. Desktop já tem no header. */}
      {atualizadoLabel && (
        <p className="-mt-2 mb-4 text-center text-xs text-muted-ink sm:hidden" aria-live="polite">
          {atualizadoLabel}
        </p>
      )}

      {/* Layout: desktop com painel de filtros inline à esquerda quando aberto.
          Mobile continua usando o Drawer (regra: drawer é só mobile). */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Painel de filtros do dashboard — desliza da esquerda (FilterAside),
            mesma animação das outras listagens. Mobile usa o Drawer abaixo. */}
        <FilterAside open={desktopFiltersOpen} desktopOnly breakpoint="lg" width="lg:w-[280px]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Filtros do painel</span>
              <button
                type="button"
                onClick={() => setDesktopFiltersOpen(false)}
                aria-label="Fechar filtros"
                className="rounded-md p-1 text-muted-ink transition-colors hover:bg-canvas hover:text-ink"
              >
                <IconX size={16} />
              </button>
            </div>
            <p className="mb-3 text-xs text-muted">Escolha o período dos indicadores.</p>
            <DateRangeFilter
              from={desktopRange.from}
              to={desktopRange.to}
              onChange={setDesktopRange}
              fromLabel="Data inicial"
              toLabel="Data final"
              className="flex-col items-stretch [&>label]:!w-full"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDesktopFiltersOpen(false)}>Fechar</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setRange(desktopRange);
                  setDesktopFiltersOpen(false);
                }}
              >
                Aplicar
              </Button>
            </div>
        </FilterAside>

        <div className="min-w-0 flex-1">
      {dashboard.isLoading ? (
        <LoadingState />
      ) : dashboard.isError || !d ? (
        <EmptyState
          title="Não foi possível carregar o painel"
          description="Tente atualizar novamente em instantes."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* (2-4) Vendas totais · Agendamentos · Comandas */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <MetricCard
              icon={<IconDollar size={24} />}
              title="Vendas totais"
              total={formatMoney(d.vendasTotais.valor)}
              tone="sales"
              help="Soma de todas as vendas do período filtrado"
              footer={<StatusPill pct={d.vendasTotais.deltaPct} label="Versus período anterior" />}
            >
              <div className="flex w-full flex-col">
                <LabelWithHelp
                  label="Vendas do dia"
                  help="Soma das vendas realizadas hoje"
                  className="text-sm text-muted-ink"
                />
                <span className="text-[18px] font-semibold text-ink">{formatMoney(d.vendasDia)}</span>
              </div>
            </MetricCard>
            <MetricCard
              icon={<IconCalendar size={24} />}
              title="Agendamentos"
              total={formatNumber(d.agendamentosCount.valor)}
              tone="appointments"
              help="Total de agendamentos no período"
              footer={<StatusPill pct={d.agendamentosCount.deltaPct} label="Taxa de crescimento" />}
            >
              <Sparkline data={d.tendenciaVisitas} dataKey="agendamentos" color={themeColors.appointments} />
            </MetricCard>
            <MetricCard
              icon={<IconReceipt size={24} />}
              title="Comandas"
              total={formatNumber(d.comandasCount.valor)}
              tone="orders"
              help="Quantidade de comandas abertas no período"
              footer={<StatusPill pct={d.comandasCount.taxaConversao} label="Taxa de conversão" variant="conversao" />}
            >
              <Sparkline data={d.tendenciaVisitas} dataKey="comandas" color={themeColors.orders} />
            </MetricCard>
          </div>

          {/* (5) Abas — Tendência de Visitas (barras) + Agendamentos por status (donut) */}
          <TabsTendenciaStatus d={d} />

          {/* (6) Ticket médio + (7) Atendimentos por profissional — lado a lado */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <TicketMedioCard ticket={d.ticketMedio} comparacao={d.comparacaoPeriodos} />
            <AtendimentosPorProfissional data={d.atendimentosPorProfissional} serie={d.tendenciaVisitas} />
          </div>

          {/* (8) categoria + (9) funil */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <VendasPorCategoria data={d.vendasPorCategoria} />
            <FunilWidget data={d.funil} />
          </div>

          {/* (10) ocupação + (11) mapa de calor */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <OcupacaoAgenda data={d.ocupacaoAgenda} />
            <div className="lg:col-span-2">
              <MapaCalor data={d.mapaCalor} />
            </div>
          </div>
        </div>
      )}
        </div>
      </div>

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
            fromLabel="Data inicial"
            toLabel="Data final"
            className="flex-col items-stretch [&>label]:!w-full"
          />
        </div>
      </Drawer>
    </div>
  );
}
