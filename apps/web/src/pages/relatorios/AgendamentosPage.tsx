import { useState } from 'react';
import { Card } from '@heroui/react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { LoadingState } from '../../components/States';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { IconCalendar, IconCircleCheck, IconX } from '../../components/icons';
import { formatNumber, isoDate } from '../../lib/format';
import { useReportsOverview } from '../../lib/queries/relatorios';
import { BackToReports, CARD, COLOR_GREEN } from './reportShared';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

function Kpi({
  icon,
  title,
  value,
  tone = 'accent',
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  tone?: 'accent' | 'success' | 'danger';
}) {
  const wrap =
    tone === 'success'
      ? 'bg-success/12 text-success'
      : tone === 'danger'
        ? 'bg-danger/12 text-danger'
        : 'bg-[#f2b33d]/15 text-[#a67c1e]';
  return (
    <Card className={CARD}>
      <Card.Content className="p-5">
        <div className="flex items-center gap-2 text-muted">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${wrap}`}>
            {icon}
          </span>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <div className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">{value}</div>
      </Card.Content>
    </Card>
  );
}

export function AgendamentosPage() {
  const [range, setRange] = useState(defaultRange);
  const query = useReportsOverview(range.from, range.to);
  const occ = query.data?.occupancy;

  const total = occ?.total ?? 0;
  const done = occ?.done ?? 0;
  const canceled = occ?.canceled ?? 0;
  const others = Math.max(0, total - done - canceled);
  const rate = Math.round((occ?.rate ?? 0) * 100);

  const pieData = [
    { name: 'Realizados', value: done, color: COLOR_GREEN },
    { name: 'Cancelados', value: canceled, color: '#ec4899' },
    { name: 'Outros', value: others, color: '#f0ce84' },
  ].filter((s) => s.value > 0);

  return (
    <div>
      <BackToReports />
      <PageHeader
        title="Agendamentos"
        subtitle="Ocupação da agenda e cancelamentos no período"
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              icon={<IconCalendar size={18} />}
              title="Total"
              value={formatNumber(total)}
            />
            <Kpi
              icon={<IconCircleCheck size={18} />}
              title="Realizados"
              value={formatNumber(done)}
              tone="success"
            />
            <Kpi icon={<IconX size={18} />} title="Cancelados" value={formatNumber(canceled)} tone="danger" />
            <Kpi
              icon={<IconCalendar size={18} />}
              title="Ocupação"
              value={`${rate}%`}
            />
          </div>

          <Card className={CARD}>
            <Card.Content className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Distribuição dos agendamentos
              </h3>
              {pieData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted">
                  Sem agendamentos no período.
                </div>
              ) : (
                <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          innerRadius={40}
                        >
                          {pieData.map((s) => (
                            <Cell key={s.name} fill={s.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatNumber(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="flex flex-col divide-y divide-[var(--color-soft-border)]">
                    {pieData.map((s) => (
                      <li key={s.name} className="flex items-center gap-3 py-2">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: s.color }}
                        />
                        <span className="flex-1 text-sm text-foreground">{s.name}</span>
                        <span className="text-sm font-semibold text-foreground">
                          {formatNumber(s.value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card.Content>
          </Card>
        </>
      )}
    </div>
  );
}
