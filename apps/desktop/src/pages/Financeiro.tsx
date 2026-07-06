import { useMemo, useState } from 'react';
import { CheckCircle2, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { FinancialAccount, FinancialKind, FinancialStatus } from '@silvia/core';
import { financialStatusLabels, formatBRL, formatDate, todayISO } from '@silvia/core';
import { repos } from '../lib/repos';
import { useCollection } from '../lib/hooks';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { FormModal } from '../components/FormModal';
import { StatCard } from '../components/StatCard';
import { StatusBadge, financialStatusTones } from '../components/StatusBadge';
import { Tabs } from '../components/Tabs';
import type { FieldDef, FormValues } from '../components/form';

const fields: FieldDef[] = [
  { kind: 'text', name: 'description', label: 'Descrição', required: true, span: 2 },
  {
    kind: 'select',
    name: 'kind',
    label: 'Tipo',
    options: [
      { value: 'pagar', label: 'Conta a pagar' },
      { value: 'receber', label: 'Conta a receber' },
    ],
  },
  { kind: 'text', name: 'category', label: 'Categoria', placeholder: 'Fornecedores, Ocupação...' },
  { kind: 'number', name: 'amount', label: 'Valor (R$)', step: 0.01, required: true },
  { kind: 'date', name: 'dueDate', label: 'Vencimento', required: true },
  {
    kind: 'select',
    name: 'status',
    label: 'Status',
    options: (Object.keys(financialStatusLabels) as FinancialStatus[]).map((s) => ({
      value: s,
      label: financialStatusLabels[s],
    })),
  },
];

function toValues(item: FinancialAccount | null, defaultKind: FinancialKind): FormValues {
  return {
    description: item?.description ?? '',
    kind: item?.kind ?? defaultKind,
    category: item?.category ?? '',
    amount: item?.amount ?? 0,
    dueDate: item?.dueDate ?? todayISO(),
    status: item?.status ?? 'aberto',
  };
}

export function FinanceiroPage() {
  const accounts = useCollection(repos.financialAccounts);
  const [tab, setTab] = useState<'pagar' | 'receber' | 'fluxo'>('pagar');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialAccount | null>(null);

  const hoje = todayISO();

  // Marca vencidos automaticamente na visualização
  const items = useMemo(
    () =>
      accounts.items.map((a) =>
        a.status === 'aberto' && a.dueDate < hoje ? { ...a, status: 'vencido' as FinancialStatus } : a,
      ),
    [accounts.items, hoje],
  );

  const pagar = items.filter((a) => a.kind === 'pagar');
  const receber = items.filter((a) => a.kind === 'receber');
  const abertoPagar = pagar.filter((a) => a.status === 'aberto' || a.status === 'vencido').reduce((s, a) => s + a.amount, 0);
  const abertoReceber = receber.filter((a) => a.status === 'aberto' || a.status === 'vencido').reduce((s, a) => s + a.amount, 0);

  const fluxo = useMemo(() => {
    const ordered = [...items]
      .filter((a) => a.status !== 'cancelado')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    let saldo = 0;
    return ordered.map((a) => {
      saldo += a.kind === 'receber' ? a.amount : -a.amount;
      return { ...a, saldo };
    });
  }, [items]);

  const list = tab === 'pagar' ? pagar : receber;

  async function handleSubmit(values: FormValues) {
    const data: Omit<FinancialAccount, 'id'> = {
      description: String(values.description),
      kind: values.kind === 'receber' ? 'receber' : 'pagar',
      category: String(values.category) || undefined,
      amount: Number(values.amount) || 0,
      dueDate: String(values.dueDate),
      status: String(values.status) as FinancialStatus,
      paidAt: values.status === 'pago' ? (editing?.paidAt ?? hoje) : undefined,
    };
    if (editing) await accounts.update(editing.id, data);
    else await accounts.create(data);
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Contas a pagar, contas a receber e fluxo de caixa."
        onNew={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        newLabel="Novo lançamento"
      />

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard icon={TrendingDown} label="A pagar em aberto" value={formatBRL(abertoPagar)} tone="danger" />
        <StatCard icon={TrendingUp} label="A receber em aberto" value={formatBRL(abertoReceber)} tone="success" />
        <StatCard
          icon={Wallet}
          label="Saldo projetado"
          value={formatBRL(abertoReceber - abertoPagar)}
          tone={abertoReceber - abertoPagar >= 0 ? 'info' : 'warning'}
        />
      </div>

      <div className="mb-4">
        <Tabs
          tabs={[
            { key: 'pagar', label: `A pagar (${pagar.length})` },
            { key: 'receber', label: `A receber (${receber.length})` },
            { key: 'fluxo', label: 'Fluxo de caixa' },
          ]}
          active={tab}
          onChange={(k) => setTab(k as typeof tab)}
        />
      </div>

      {tab === 'fluxo' ? (
        <DataTable
          columns={[
            { key: 'due', header: 'Vencimento', render: (a) => formatDate(a.dueDate) },
            { key: 'desc', header: 'Descrição', render: (a) => <span className="font-medium text-ink-900">{a.description}</span> },
            { key: 'cat', header: 'Categoria', render: (a) => a.category ?? '—' },
            {
              key: 'in',
              header: 'Entrada',
              render: (a) => (a.kind === 'receber' ? <span className="text-emerald-600">{formatBRL(a.amount)}</span> : '—'),
              className: 'text-right',
            },
            {
              key: 'out',
              header: 'Saída',
              render: (a) => (a.kind === 'pagar' ? <span className="text-rose-600">{formatBRL(a.amount)}</span> : '—'),
              className: 'text-right',
            },
            {
              key: 'saldo',
              header: 'Saldo acumulado',
              render: (a) => (
                <span className={`font-semibold ${a.saldo >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{formatBRL(a.saldo)}</span>
              ),
              className: 'text-right',
            },
          ]}
          items={fluxo}
          loading={accounts.loading}
          emptyTitle="Nenhum lançamento"
        />
      ) : (
        <DataTable
          columns={[
            { key: 'desc', header: 'Descrição', render: (a) => <span className="font-medium text-ink-900">{a.description}</span> },
            { key: 'cat', header: 'Categoria', render: (a) => a.category ?? '—' },
            { key: 'amount', header: 'Valor', render: (a) => <span className="font-semibold">{formatBRL(a.amount)}</span>, className: 'text-right' },
            {
              key: 'due',
              header: 'Vencimento',
              render: (a) => (
                <span className={a.status === 'vencido' ? 'font-semibold text-rose-600' : ''}>{formatDate(a.dueDate)}</span>
              ),
            },
            { key: 'paid', header: 'Pago em', render: (a) => formatDate(a.paidAt) },
            {
              key: 'status',
              header: 'Status',
              render: (a) => <StatusBadge tone={financialStatusTones[a.status]}>{financialStatusLabels[a.status]}</StatusBadge>,
            },
          ]}
          items={list}
          loading={accounts.loading}
          onEdit={(a) => {
            const original = accounts.items.find((x) => x.id === a.id) ?? a;
            setEditing(original);
            setFormOpen(true);
          }}
          onDelete={(a) => accounts.remove(a.id)}
          rowActions={(a) =>
            a.status === 'aberto' || a.status === 'vencido' ? (
              <button
                type="button"
                onClick={() => accounts.update(a.id, { status: 'pago', paidAt: hoje })}
                title={a.kind === 'pagar' ? 'Marcar como paga' : 'Marcar como recebida'}
                className="rounded-lg p-2 text-ink-500 transition hover:bg-emerald-50 hover:text-emerald-600"
              >
                <CheckCircle2 className="size-4" />
              </button>
            ) : null
          }
          emptyTitle={tab === 'pagar' ? 'Nenhuma conta a pagar' : 'Nenhuma conta a receber'}
        />
      )}

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar lançamento' : 'Novo lançamento'}
        fields={fields}
        initialValues={toValues(editing, tab === 'receber' ? 'receber' : 'pagar')}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
