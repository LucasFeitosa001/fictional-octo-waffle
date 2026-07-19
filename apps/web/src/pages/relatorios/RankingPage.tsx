import { useState } from 'react';
import { Card, Chip } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { LoadingState } from '../../components/States';
import { IconScissors, IconStar, IconUsers } from '../../components/icons';
import { formatMoney, formatNumber, isoDate } from '../../lib/format';
import { useReportsOverview } from '../../lib/queries/relatorios';
import { BackToReports, CARD } from './reportShared';

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
            {items.slice(0, 10).map((it, i) => (
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

export function RankingPage() {
  const [range, setRange] = useState(defaultRange);
  const query = useReportsOverview(range.from, range.to);
  const d = query.data;

  return (
    <div>
      <BackToReports />
      <PageHeader
        title="Ranking"
        subtitle="Serviços, produtos e profissionais que mais venderam"
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </Card.Content>
      </Card>

      {query.isLoading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <RankCard
            icon={<IconScissors size={16} />}
            title="Serviços mais realizados"
            items={d?.topServices ?? []}
            emptyLabel="Sem serviços no período."
          />
          <RankCard
            icon={<IconStar size={16} />}
            title="Produtos mais vendidos"
            items={d?.topProducts ?? []}
            emptyLabel="Sem produtos no período."
          />
          <RankCard
            icon={<IconUsers size={16} />}
            title="Profissionais que mais venderam"
            items={(d?.topProfessionals ?? []).map((p) => ({
              id: p.id,
              name: p.name,
              total: p.total,
            }))}
            emptyLabel="Sem dados no período."
            showCount={false}
          />
        </div>
      )}
    </div>
  );
}
