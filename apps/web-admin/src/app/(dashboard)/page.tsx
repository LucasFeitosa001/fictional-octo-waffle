'use client';

import { useMemo, useState } from 'react';
import { Avatar, Card, Chip, Tabs } from '@heroui/react';
import {
  Area,
  AreaChart,
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
import { IconCalendar, IconDollar, IconInfo, IconReceipt } from '@/components/icons';
import { useAppointments, useDashboard, useOrders } from '@/lib/queries';
import { formatMoney, formatNumber, initials, isoDate } from '@/lib/format';
import type { AppointmentRow } from '@/lib/types';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14);
  return { from: isoDate(from), to: isoDate(to) };
}

function StatCard({
  icon,
  title,
  value,
  subValue,
  chip,
  spark,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subValue?: React.ReactNode;
  chip?: React.ReactNode;
  spark?: { d: string; v: number }[];
}) {
  return (
    <Card className="db-card">
      <Card.Content className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white">
              {icon}
            </span>
            <span className="eyebrow text-muted">{title}</span>
          </div>
          <IconInfo size={16} className="text-muted" />
        </div>

        <div className="tnum mt-4 text-[32px] font-semibold leading-none tracking-tight text-foreground">
          {value}
        </div>
        {subValue && <div className="tnum mt-2 text-sm text-muted">{subValue}</div>}

        {spark && (
          <div className="mt-3 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                <defs>
                  <linearGradient id={`sp-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="#ffffff"
                  strokeWidth={2}
                  fill={`url(#sp-${title})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {chip && <div className="mt-4">{chip}</div>}
      </Card.Content>
    </Card>
  );
}

function buildDailyCounts(rows: AppointmentRow[], from: string, to: string) {
  const counts = new Map<string, number>();
  const start = new Date(from);
  const end = new Date(to);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    counts.set(isoDate(d), 0);
  }
  for (const r of rows) {
    const key = r.start.slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([d, v]) => ({
    d: d.slice(8, 10) + '/' + d.slice(5, 7),
    v,
  }));
}

function buildRanking(rows: AppointmentRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const name = r.professional?.name ?? 'Sem profissional';
    map.set(name, (map.get(name) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export default function PainelPage() {
  const [range, setRange] = useState(defaultRange);
  const [tab, setTab] = useState<string>('agendamentos');

  const dashboard = useDashboard(range.from, range.to);
  const appts = useAppointments({ from: range.from, to: range.to });
  const orders = useOrders();

  const apptRows = appts.data?.data ?? [];
  const orderRows = orders.data?.data ?? [];

  const visitTrend = useMemo(
    () => buildDailyCounts(apptRows, range.from, range.to),
    [apptRows, range.from, range.to],
  );
  const ranking = useMemo(() => buildRanking(apptRows), [apptRows]);
  const ordersTrend = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orderRows) {
      const key = o.date.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort()
      .map(([d, v]) => ({ d: d.slice(8, 10), v }));
  }, [orderRows]);

  function refresh() {
    dashboard.refetch();
    appts.refetch();
    orders.refetch();
  }

  const d = dashboard.data;

  return (
    <div>
      <PageHeader
        title="Painel do salão"
        onRefresh={refresh}
        isRefreshing={dashboard.isFetching}
      />

      {/* Date range bar */}
      <Card className="db-card mb-4">
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {dashboard.isLoading ? (
        <LoadingState />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              icon={<IconDollar size={18} />}
              title="Vendas totais"
              value={formatMoney(d?.salesTotal ?? 0)}
              subValue={
                <>
                  Comandas finalizadas
                  <span className="ml-1 font-semibold text-foreground">
                    {formatNumber(d?.finishedOrders ?? 0)}
                  </span>
                </>
              }
              chip={
                <Chip color="success" variant="soft" size="sm">
                  {formatNumber(d?.finishedOrders ?? 0)} fechadas no período
                </Chip>
              }
            />
            <StatCard
              icon={<IconCalendar size={18} />}
              title="Agendamentos"
              value={formatNumber(d?.appointments ?? 0)}
              spark={visitTrend}
              chip={
                <Chip color="success" variant="soft" size="sm">
                  {formatNumber(apptRows.length)} no intervalo selecionado
                </Chip>
              }
            />
            <StatCard
              icon={<IconReceipt size={18} />}
              title="Comandas"
              value={formatNumber(d?.orders ?? 0)}
              spark={ordersTrend.length ? ordersTrend : visitTrend}
              chip={
                <Chip color="accent" variant="soft" size="sm">
                  {formatNumber(orderRows.length)} comandas registradas
                </Chip>
              }
            />
          </div>

          {/* Tabs + chart + ranking */}
          <Card className="db-card mt-4">
            <Card.Content className="p-5">
              <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
                <Tabs.List>
                  <Tabs.Tab id="agendamentos">Agendamentos</Tabs.Tab>
                  <Tabs.Tab id="comandas">Comandas</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel id="agendamentos">
                  <ChartAndRanking
                    title="Tendência de visitas"
                    rankingTitle="Ranking de profissionais"
                    data={visitTrend}
                    ranking={ranking}
                    empty={!apptRows.length}
                  />
                </Tabs.Panel>
                <Tabs.Panel id="comandas">
                  <ChartAndRanking
                    title="Comandas por dia"
                    rankingTitle="Ranking de clientes"
                    data={ordersTrend}
                    ranking={Array.from(
                      orderRows.reduce((m, o) => {
                        const n = o.customer?.name ?? `#${o.number}`;
                        m.set(n, (m.get(n) ?? 0) + 1);
                        return m;
                      }, new Map<string, number>()),
                    )
                      .map(([name, count]) => ({ name, count }))
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 8)}
                    empty={!orderRows.length}
                  />
                </Tabs.Panel>
              </Tabs>
            </Card.Content>
          </Card>
        </>
      )}
    </div>
  );
}

function ChartAndRanking({
  title,
  rankingTitle,
  data,
  ranking,
  empty,
}: {
  title: string;
  rankingTitle: string;
  data: { d: string; v: number }[];
  ranking: { name: string; count: number }[];
  empty: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 pt-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
        {empty ? (
          <div className="flex h-64 items-center justify-center text-sm text-muted">
            Sem dados no período selecionado.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2a2a" />
                <XAxis dataKey="d" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="v" fill="#ffffff" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">{rankingTitle}</h3>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted">Sem dados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ranking.map((r, i) => (
              <li key={r.name} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <Avatar size="sm">
                  <Avatar.Fallback>{initials(r.name)}</Avatar.Fallback>
                </Avatar>
                <span className="flex-1 truncate text-sm text-foreground">{r.name}</span>
                <span className="text-sm font-semibold text-foreground">{r.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
