import { useState } from 'react';
import { Card } from '@heroui/react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { LoadingState } from '../components/States';
import { DateRangeFilter } from '../components/DateRangeFilter';
import {
  IconBox,
  IconCalendar,
  IconChart,
  IconChevron,
  IconDollar,
  IconGift,
  IconMessage,
  IconStar,
  IconTrendUp,
  IconUsers,
} from '../components/icons';
import { formatMoney, formatNumber, isoDate } from '../lib/format';
import { useReportsOverview } from '../lib/queries/relatorios';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return { from: isoDate(from), to: isoDate(to) };
}

interface Category {
  slug: string;
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const CATEGORIES: Category[] = [
  {
    slug: 'vendas',
    to: '/relatorios/vendas',
    title: 'Vendas',
    description: 'Faturamento por dia, categoria e profissional',
    icon: <IconTrendUp size={20} />,
  },
  {
    slug: 'financeiro',
    to: '/relatorios/financeiro/dre',
    title: 'Financeiro (DRE)',
    description: 'Receitas e despesas por categoria, resultado',
    icon: <IconDollar size={20} />,
  },
  {
    slug: 'agendamentos',
    to: '/relatorios/agendamentos',
    title: 'Agendamentos',
    description: 'Ocupação da agenda e cancelamentos',
    icon: <IconCalendar size={20} />,
  },
  {
    slug: 'clientes',
    to: '/relatorios/clientes',
    title: 'Clientes',
    description: 'Novos clientes captados no período',
    icon: <IconUsers size={20} />,
  },
  {
    slug: 'aniversariantes',
    to: '/relatorios/aniversariantes',
    title: 'Aniversariantes',
    description: 'Lista do mês para felicitações',
    icon: <IconGift size={20} />,
  },
  {
    slug: 'estoque',
    to: '/relatorios/estoque',
    title: 'Estoque',
    description: 'Sugestão de compra — produtos abaixo do mínimo',
    icon: <IconBox size={20} />,
  },
  {
    slug: 'ranking',
    to: '/relatorios/ranking',
    title: 'Ranking',
    description: 'Serviços, produtos e profissionais que mais venderam',
    icon: <IconStar size={20} />,
  },
  {
    slug: 'mensagens',
    to: '/relatorios/mensagens',
    title: 'Mensagens',
    description: 'WhatsApp, SMS, lembretes e felicitações',
    icon: <IconMessage size={20} />,
  },
];

function SummaryCard({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className={CARD}>
      <Card.Content className="p-5">
        <div className="flex items-center gap-2 text-muted">
          <IconWrap>{icon}</IconWrap>
          <span className="text-sm font-medium text-foreground">{title}</span>
        </div>
        <div className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">{value}</div>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </Card.Content>
    </Card>
  );
}

function IconWrap({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
      {children}
    </span>
  );
}

export function RelatoriosPage() {
  const [range, setRange] = useState(defaultRange);
  const query = useReportsOverview(range.from, range.to);
  const d = query.data;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Escolha uma categoria para ver o relatório detalhado"
        onRefresh={() => query.refetch()}
        isRefreshing={query.isFetching}
      />

      {/* Resumo do período (atalho rápido) */}
      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#a67c1e]">
              Resumo do período
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
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard
            icon={<IconDollar size={18} />}
            title="Vendas no período"
            value={formatMoney(d?.salesTotal ?? 0)}
            hint={`${formatNumber(d?.ordersCount ?? 0)} comandas finalizadas`}
          />
          <SummaryCard
            icon={<IconChart size={18} />}
            title="Ocupação da agenda"
            value={`${Math.round((d?.occupancy.rate ?? 0) * 100)}%`}
            hint={`${formatNumber(d?.occupancy.done ?? 0)} de ${formatNumber(d?.occupancy.total ?? 0)} agendamentos`}
          />
          <SummaryCard
            icon={<IconUsers size={18} />}
            title="Novos clientes"
            value={formatNumber(d?.newCustomersCount ?? 0)}
            hint="captados no período"
          />
        </div>
      )}

      {/* Categorias */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#a67c1e]">
        Categorias de relatórios
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CATEGORIES.map((c) => (
          <Link key={c.slug} to={c.to} className="group block focus:outline-none">
            <Card
              className={`${CARD} h-full transition-all group-hover:-translate-y-0.5 group-hover:border-[#f2b33d] group-hover:shadow-[var(--shadow-gold)] group-focus-visible:border-[#f2b33d]`}
            >
              <Card.Content className="flex h-full items-start gap-3 p-5">
                <IconWrap>{c.icon}</IconWrap>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold text-foreground">{c.title}</span>
                    <IconChevron
                      size={16}
                      className="-rotate-90 shrink-0 text-muted transition-colors group-hover:text-[#a67c1e]"
                    />
                  </div>
                  <p className="mt-1 text-sm leading-snug text-muted">{c.description}</p>
                </div>
              </Card.Content>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
