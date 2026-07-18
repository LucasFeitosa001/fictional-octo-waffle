import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@heroui/react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/States';
import {
  IconBox,
  IconCalendar,
  IconChart,
  IconChevron,
  IconClock,
  IconDollar,
  IconLayers,
  IconMegaphone,
  IconReceipt,
  IconScissors,
  IconUserPlus,
  IconUsers,
} from '../components/icons';
import { useAppointments, useOrders, useServices } from '../lib/queries';
import { useReportsOverview } from '../lib/queries/relatorios';
import { formatMoney, formatNumber, formatTime, isoDate } from '../lib/format';
import type { AppointmentRow } from '../lib/types';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

type Period = 'hoje' | 'semana' | 'mes' | 'ano';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes', label: 'Mês' },
  { key: 'ano', label: 'Ano' },
];

function rangeFor(period: Period) {
  const now = new Date();
  const from = new Date(now);
  if (period === 'semana') {
    const dow = (now.getDay() + 6) % 7;
    from.setDate(now.getDate() - dow);
  } else if (period === 'mes') {
    from.setDate(1);
  } else if (period === 'ano') {
    from.setMonth(0, 1);
  }
  const to = new Date(now);
  to.setDate(to.getDate() + 1);
  return { from: isoDate(from), to: isoDate(to) };
}

/** Compact currency for the tight KPI cards: R$ 0 · R$ 850 · R$ 3,4k · R$ 78k. */
function compactMoney(v: number): string {
  if (v >= 1000) {
    const k = v / 1000;
    return 'R$ ' + (k >= 100 ? Math.round(k) : k.toFixed(1).replace('.', ',')) + 'k';
  }
  return 'R$ ' + Math.round(v);
}

/** Previous equivalent range, for the day/week/month/year-over comparison. */
function prevRangeFor(period: Period) {
  const now = new Date();
  if (period === 'hoje') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { from: isoDate(y), to: isoDate(now) };
  }
  if (period === 'semana') {
    const dow = (now.getDay() + 6) % 7;
    const startThis = new Date(now);
    startThis.setDate(now.getDate() - dow);
    const startPrev = new Date(startThis);
    startPrev.setDate(startThis.getDate() - 7);
    return { from: isoDate(startPrev), to: isoDate(startThis) };
  }
  if (period === 'mes') {
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    };
  }
  return {
    from: isoDate(new Date(now.getFullYear() - 1, 0, 1)),
    to: isoDate(new Date(now.getFullYear(), 0, 1)),
  };
}

const DELTA_LABEL: Record<Period, string> = {
  hoje: 'vs ontem',
  semana: 'vs sem.',
  mes: 'vs mês',
  ano: 'vs ano',
};

function pct(cur: number, prev: number): number {
  if (prev <= 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

/** Revenue per day of the current month, up to today. */
function buildMonthSeries(salesByDay: { date: string; total: number }[]) {
  const map = new Map(salesByDay.map((s) => [s.date.slice(0, 10), s.total]));
  const now = new Date();
  const out: { d: string; v: number }[] = [];
  for (let i = 1; i <= now.getDate(); i++) {
    const key = isoDate(new Date(now.getFullYear(), now.getMonth(), i));
    out.push({ d: String(i), v: map.get(key) ?? 0 });
  }
  return out;
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
              {up ? '+' : ''}{deltaPct}%
            </span>
            <p className="text-[10px] text-muted lg:text-[11px]">{deltaLabel}</p>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

const SHORTCUTS = [
  { to: '/agenda', label: 'Agenda', icon: IconCalendar },
  { to: '/clientes', label: 'Clientes', icon: IconUsers },
  { to: '/servicos', label: 'Serviços', icon: IconScissors },
  { to: '/produtos', label: 'Produtos', icon: IconBox },
  { to: '/relatorios', label: 'Relatórios', icon: IconChart },
  { to: '/profissionais', label: 'Profissionais', icon: IconUserPlus },
  { to: '/comandas', label: 'Comandas', icon: IconReceipt },
  { to: '/pacotes', label: 'Pacotes', icon: IconLayers },
  { to: '/marketing/link', label: 'Marketing', icon: IconMegaphone },
];

export function PainelPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('mes');
  const [showAllShortcuts, setShowAllShortcuts] = useState(false);

  const range = useMemo(() => rangeFor(period), [period]);
  const prevRange = useMemo(() => prevRangeFor(period), [period]);
  const today = useMemo(() => isoDate(new Date()), []);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }, []);
  const monthRange = useMemo(() => {
    const n = new Date();
    return { from: isoDate(new Date(n.getFullYear(), n.getMonth(), 1)), to: isoDate(new Date(n.getFullYear(), n.getMonth() + 1, 1)) };
  }, []);
  const prevMonthRange = useMemo(() => {
    const n = new Date();
    return { from: isoDate(new Date(n.getFullYear(), n.getMonth() - 1, 1)), to: isoDate(new Date(n.getFullYear(), n.getMonth(), 1)) };
  }, []);

  const overview = useReportsOverview(range.from, range.to);
  const prevOverview = useReportsOverview(prevRange.from, prevRange.to);
  const monthOv = useReportsOverview(monthRange.from, monthRange.to);
  const prevMonthOv = useReportsOverview(prevMonthRange.from, prevMonthRange.to);
  const openOrders = useOrders('open');
  const agenda = useAppointments({ from: today, to: tomorrow });
  const periodAppts = useAppointments({ from: range.from, to: range.to });
  const services = useServices();

  const serviceById = useMemo(
    () => new Map((services.data?.data ?? []).map((s) => [s.id, s.name])),
    [services.data],
  );

  const ov = overview.data;
  const pv = prevOverview.data;
  const deltaLabel = DELTA_LABEL[period];
  const monthTotal = monthOv.data?.salesTotal ?? 0;
  const prevTotal = prevMonthOv.data?.salesTotal ?? 0;
  const deltaPct = prevTotal > 0 ? Math.round(((monthTotal - prevTotal) / prevTotal) * 100) : monthTotal > 0 ? 100 : 0;
  const up = deltaPct >= 0;

  const monthSeries = useMemo(
    () => buildMonthSeries(monthOv.data?.salesByDay ?? []),
    [monthOv.data?.salesByDay],
  );
  // "Mais realizados": prefer the API ranking (from finished comandas); when
  // empty, rank by the period's appointments (most requested + performed).
  const topServices = useMemo(() => {
    const apiTop = ov?.topServices ?? [];
    if (apiTop.length > 0) return apiTop;
    const m = new Map<string, { id: string; name: string; count: number; total: number }>();
    for (const a of periodAppts.data?.data ?? []) {
      for (const it of a.items ?? []) {
        const cur = m.get(it.serviceId) ?? {
          id: it.serviceId,
          name: serviceById.get(it.serviceId) ?? 'Serviço',
          count: 0,
          total: 0,
        };
        cur.count += 1;
        cur.total += Number(it.price) || 0;
        m.set(it.serviceId, cur);
      }
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [ov?.topServices, periodAppts.data?.data, serviceById]);

  const todayRows = useMemo<AppointmentRow[]>(
    () => [...(agenda.data?.data ?? [])].sort((a, b) => a.start.localeCompare(b.start)),
    [agenda.data?.data],
  );
  const todayPreview = todayRows.slice(0, 5);

  const shownShortcuts = showAllShortcuts ? SHORTCUTS : SHORTCUTS.slice(0, 5);

  function refresh() {
    overview.refetch();
    monthOv.refetch();
    prevMonthOv.refetch();
    openOrders.refetch();
    agenda.refetch();
  }

  return (
    <div>
      <PageHeader
        title="Painel"
        subtitle="Resumo do seu salão"
        onRefresh={refresh}
        isRefreshing={overview.isFetching}
      />

      {/* Period selector */}
      <div className="mb-5 grid w-full grid-cols-4 rounded-xl border border-[var(--color-soft-border)] bg-[#fffdf8] p-1 shadow-[var(--shadow-soft)] sm:inline-flex sm:w-auto">
        {PERIODS.map((p) => {
          const active = p.key === period;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={[
                'min-h-10 rounded-lg px-2 py-1.5 text-sm font-medium transition-all sm:px-4',
                active ? 'bg-[#f2b33d] text-[#111111] shadow-[var(--shadow-gold)]' : 'text-[#6f6a63] hover:bg-[#f7f3ea]',
              ].join(' ')}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {overview.isLoading ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-5">
          {/* ── KPIs — readable cards on phones, one row on wide screens. ─── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              icon={<IconCalendar size={14} />}
              label="Agendamentos"
              value={formatNumber(ov?.occupancy.total ?? 0)}
              deltaPct={pct(ov?.occupancy.total ?? 0, pv?.occupancy.total ?? 0)}
              deltaLabel={deltaLabel}
            />
            <KpiCard
              icon={<IconDollar size={14} />}
              label="Faturamento"
              value={compactMoney(ov?.salesTotal ?? 0)}
              deltaPct={pct(ov?.salesTotal ?? 0, pv?.salesTotal ?? 0)}
              deltaLabel={deltaLabel}
            />
            <KpiCard
              icon={<IconUserPlus size={14} />}
              label="Novos clientes"
              value={formatNumber(ov?.newCustomersCount ?? 0)}
              deltaPct={pct(ov?.newCustomersCount ?? 0, pv?.newCustomersCount ?? 0)}
              deltaLabel={deltaLabel}
              accent="pink"
            />
            <KpiCard
              icon={<IconReceipt size={14} />}
              label="Comandas abertas"
              value={formatNumber(openOrders.data?.total ?? 0)}
            />
          </div>

          {/* ── Faturamento do mês + gráfico em linha ─────────────────────── */}
          <Card className={`min-w-0 ${CARD}`}>
            <Card.Content className="p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Faturamento do mês</p>
              <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
                <p className="break-words text-2xl font-bold text-[#111111] sm:text-3xl">{formatMoney(monthTotal)}</p>
                <span
                  className={`mb-1 inline-flex items-center gap-0.5 text-sm font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}
                >
                  {up ? '↑' : '↓'} {Math.abs(deltaPct)}%
                </span>
              </div>
              <p className="text-xs text-muted">vs mês anterior</p>

              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis
                      dataKey="d"
                      tick={{ fontSize: 10, fill: '#999' }}
                      tickLine={false}
                      axisLine={false}
                      interval={Math.max(0, Math.ceil(monthSeries.length / 8) - 1)}
                    />
                    <YAxis tick={{ fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatMoney(Number(v))} />
                    <Tooltip formatter={(v) => [formatMoney(Number(v)), 'Faturamento']} cursor={{ stroke: '#f2b33d', strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="v" stroke="#f2b33d" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Content>
          </Card>

          {/* ── Mais realizados ───────────────────────────────────────────── */}
          <Card className={`min-w-0 ${CARD}`}>
            <Card.Content className="p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f08ca5]/15 text-[#c25d77]">
                  <IconScissors size={18} />
                </span>
                <p className="font-brand text-sm font-semibold text-[#111111]">Mais realizados</p>
              </div>
              {topServices.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Sem serviços no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-soft-border)] text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                        <th className="w-8 py-2 pr-2 font-semibold">#</th>
                        <th className="py-2 pr-2 font-semibold">Serviço</th>
                        <th className="py-2 pr-2 text-right font-semibold">Qtd</th>
                        <th className="py-2 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-soft-border)]">
                      {topServices.slice(0, 5).map((s, i) => (
                        <tr key={s.id}>
                          <td className="py-2.5 pr-2">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f2b33d]/15 text-xs font-bold text-[#a67c1e]">
                              {i + 1}
                            </span>
                          </td>
                          <td className="py-2.5 pr-2">
                            <span className="block truncate font-medium text-[#111111]">{s.name}</span>
                          </td>
                          <td className="py-2.5 pr-2 text-right text-muted">{formatNumber(s.count)}x</td>
                          <td className="py-2.5 text-right font-semibold text-[#111111]">{formatMoney(s.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card.Content>
          </Card>

          {/* ── Atalhos ───────────────────────────────────────────────────── */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-brand text-sm font-semibold text-[#111111]">Atalhos</h2>
              <button
                type="button"
                onClick={() => setShowAllShortcuts((v) => !v)}
                className="text-xs font-medium text-[#a67c1e] hover:underline"
              >
                {showAllShortcuts ? 'Ver menos' : 'Ver todos'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 sm:gap-3">
              {shownShortcuts.map(({ to, label, icon: Icon }) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => navigate(to)}
                  className={`flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-center transition-all active:scale-95 ${CARD}`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#111111] text-[#f2b33d]">
                    <Icon size={20} />
                  </span>
                  <span className="max-w-full text-xs font-semibold leading-tight text-[#111111]">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Agenda de hoje ────────────────────────────────────────────── */}
          <Card className={`min-w-0 ${CARD}`}>
            <Card.Content className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
                    <IconCalendar size={18} />
                  </span>
                  <div>
                    <p className="font-brand text-sm font-semibold text-[#111111]">Agenda de hoje</p>
                    <p className="text-xs text-muted">{formatNumber(todayRows.length)} agendamentos</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/agenda')}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#8a6517] transition-colors hover:bg-[#f2b33d]/10 sm:text-sm"
                >
                  Ver agenda <IconChevron size={15} className="-rotate-90" />
                </button>
              </div>
              {agenda.isLoading ? (
                <LoadingState />
              ) : todayPreview.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted">
                  <IconClock size={26} />
                  <p className="text-sm">Nenhum agendamento para hoje.</p>
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-soft-border)]">
                  {todayPreview.map((a) => {
                    const svc = a.items?.[0] ? serviceById.get(a.items[0].serviceId) : undefined;
                    return (
                      <li key={a.id} className="flex items-center gap-3 py-3">
                        <span className="w-14 shrink-0 text-sm font-bold text-[#111111]">{formatTime(a.start)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#111111]">{a.customer?.name ?? 'Sem cliente'}</p>
                          <p className="truncate text-xs text-muted">{svc ?? a.professional?.name ?? '—'}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card.Content>
          </Card>
        </div>
      )}
    </div>
  );
}
