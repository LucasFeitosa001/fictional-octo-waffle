import { useMemo, useState } from 'react';
import { Cake, CreditCard, PackageX, Wallet } from 'lucide-react';
import { financialStatusLabels, formatBRL, formatDate, monthOfISO, todayISO } from '@silvia/core';
import { repos } from '../lib/repos';
import { useCollection } from '../lib/hooks';
import { PageHeader } from '../components/PageHeader';
import { Tabs } from '../components/Tabs';
import { DataTable } from '../components/DataTable';
import { StatusBadge, financialStatusTones } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function ConsultasPage() {
  const [tab, setTab] = useState('aniversariantes');
  const clients = useCollection(repos.clients);
  const products = useCollection(repos.products);
  const financial = useCollection(repos.financialAccounts);

  const hoje = todayISO();
  const [month, setMonth] = useState(Number(hoje.split('-')[1]));

  const birthdays = useMemo(
    () =>
      clients.items
        .filter((c) => c.active && monthOfISO(c.birthDate) === month)
        .sort((a, b) => (a.birthDate ?? '').slice(8).localeCompare((b.birthDate ?? '').slice(8))),
    [clients.items, month],
  );

  const lowStock = products.items.filter((p) => p.trackStock && p.active && p.stock <= p.reorderLevel);
  const pendencias = financial.items.filter((f) => f.status === 'aberto' || f.status === 'vencido');

  return (
    <div>
      <PageHeader title="Consultas" description="Consultas rápidas do dia a dia do salão." />
      <div className="mb-5">
        <Tabs
          tabs={[
            { key: 'aniversariantes', label: 'Aniversariantes' },
            { key: 'estoque', label: 'Estoque baixo' },
            { key: 'pendencias', label: 'Contas em aberto' },
            { key: 'saldos', label: 'Cartões e bônus (em breve)' },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'aniversariantes' ? (
        <div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3 sm:inline-flex sm:p-2">
            <Cake className="size-5 text-brand-500" />
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-ink-100 bg-white px-3 py-2.5 text-base focus:border-brand-300 focus:outline-none sm:flex-none sm:text-sm"
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <DataTable
            columns={[
              { key: 'day', header: 'Dia', render: (c) => c.birthDate?.slice(8) ?? '—' },
              { key: 'name', header: 'Cliente', render: (c) => <span className="font-medium text-ink-900">{c.name}</span> },
              { key: 'phone', header: 'WhatsApp', render: (c) => c.whatsapp ?? c.phone ?? '—' },
              { key: 'email', header: 'E-mail', render: (c) => c.email ?? '—' },
            ]}
            items={birthdays}
            loading={clients.loading}
            emptyTitle={`Nenhuma aniversariante em ${MESES[month - 1]}`}
          />
        </div>
      ) : null}

      {tab === 'estoque' ? (
        <DataTable
          columns={[
            { key: 'code', header: 'Código', render: (p) => <span className="font-mono text-xs text-ink-500">{p.code}</span> },
            {
              key: 'name',
              header: 'Produto',
              render: (p) => (
                <span className="flex items-center gap-2 font-medium text-ink-900">
                  <PackageX className="size-4 text-amber-500" />
                  {p.name}
                </span>
              ),
            },
            { key: 'stock', header: 'Estoque', render: (p) => <span className="font-semibold text-amber-600">{p.stock}</span>, className: 'text-right' },
            { key: 'reorder', header: 'Nível de reposição', render: (p) => p.reorderLevel, className: 'text-right' },
            { key: 'max', header: 'Estoque máximo', render: (p) => p.maxStock, className: 'text-right' },
            { key: 'buy', header: 'Reposição estimada', render: (p) => formatBRL((p.maxStock - p.stock) * p.purchasePrice), className: 'text-right' },
          ]}
          items={lowStock}
          loading={products.loading}
          emptyTitle="Nenhum produto abaixo do nível de reposição"
        />
      ) : null}

      {tab === 'pendencias' ? (
        <DataTable
          columns={[
            { key: 'desc', header: 'Descrição', render: (f) => <span className="font-medium text-ink-900">{f.description}</span> },
            { key: 'kind', header: 'Tipo', render: (f) => (f.kind === 'pagar' ? 'A pagar' : 'A receber') },
            { key: 'amount', header: 'Valor', render: (f) => formatBRL(f.amount), className: 'text-right' },
            { key: 'due', header: 'Vencimento', render: (f) => formatDate(f.dueDate) },
            {
              key: 'status',
              header: 'Status',
              render: (f) => <StatusBadge tone={financialStatusTones[f.status]}>{financialStatusLabels[f.status]}</StatusBadge>,
            },
          ]}
          items={pendencias}
          loading={financial.loading}
          emptyTitle="Nenhuma conta em aberto"
        />
      ) : null}

      {tab === 'saldos' ? (
        <EmptyState
          icon={CreditCard}
          title="Saldos de cartões e bônus"
          description="Os saldos de cartões-presente e programas de bônus serão consultados aqui quando o módulo de fidelidade for ativado (fase backend)."
          action={
            <span className="inline-flex items-center gap-2 rounded-full bg-gold-100 px-3 py-1.5 text-sm font-medium text-gold-700">
              <Wallet className="size-4" />
              Planejado para a próxima fase
            </span>
          }
        />
      ) : null}
    </div>
  );
}
