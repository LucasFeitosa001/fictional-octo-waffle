import { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, PackageX } from 'lucide-react';
import type { StockMovementKind } from '@silvia/core';
import { formatBRL, formatDate, todayISO } from '@silvia/core';
import { repos } from '../lib/repos';
import { useCollection, useLookups } from '../lib/hooks';
import { PageHeader } from '../components/PageHeader';
import { DataTable } from '../components/DataTable';
import { FormModal } from '../components/FormModal';
import { StatusBadge } from '../components/StatusBadge';
import { SearchInput } from '../components/SearchInput';
import type { FieldDef, FormValues } from '../components/form';

export function EstoquePage() {
  const movements = useCollection(repos.stockMovements);
  const products = useCollection(repos.products);
  const suppliers = useCollection(repos.suppliers);
  const lookups = useLookups();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState<StockMovementKind>('entrada');

  const critical = products.items.filter((p) => p.trackStock && p.active && p.stock <= p.reorderLevel);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...movements.items].sort((a, b) => b.date.localeCompare(a.date));
    if (!q) return sorted;
    return sorted.filter((m) =>
      `${lookups.productName(m.productId)} ${m.reason ?? ''} ${m.invoice ?? ''}`.toLowerCase().includes(q),
    );
  }, [movements.items, search, lookups]);

  const fields: FieldDef[] = [
    {
      kind: 'select',
      name: 'productId',
      label: 'Produto',
      required: true,
      span: 2,
      options: [
        { value: '', label: 'Selecione...' },
        ...products.items.filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
      ],
    },
    { kind: 'number', name: 'quantity', label: 'Quantidade', required: true, min: 1 },
    { kind: 'date', name: 'date', label: 'Data', required: true },
    ...(formKind === 'entrada'
      ? ([
          { kind: 'number', name: 'unitCost', label: 'Valor de compra un. (R$)', step: 0.01 },
          { kind: 'number', name: 'unitPrice', label: 'Valor de venda un. (R$)', step: 0.01 },
          {
            kind: 'select',
            name: 'supplierId',
            label: 'Fornecedor',
            options: [
              { value: '', label: 'Sem fornecedor' },
              ...suppliers.items.filter((s) => s.active).map((s) => ({ value: s.id, label: s.tradeName ?? s.legalName })),
            ],
          },
          { kind: 'text', name: 'invoice', label: 'Nota fiscal' },
        ] as FieldDef[])
      : ([{ kind: 'text', name: 'reason', label: 'Motivo da saída', span: 2, placeholder: 'Venda, uso interno, perda...' }] as FieldDef[])),
  ];

  async function handleSubmit(values: FormValues) {
    const productId = String(values.productId);
    const quantity = Number(values.quantity) || 0;
    // Saída não pode exceder o saldo: senão o razão de movimentações diverge do estoque.
    const target = products.items.find((p) => p.id === productId);
    if (formKind === 'saida' && target?.trackStock && quantity > target.stock) {
      window.alert(
        `Saída de ${quantity} un é maior que o saldo atual de ${target.stock} un de "${target.name}". Ajuste a quantidade.`,
      );
      return false;
    }
    await movements.create({
      productId,
      kind: formKind,
      quantity,
      date: String(values.date),
      unitCost: Number(values.unitCost) || undefined,
      unitPrice: Number(values.unitPrice) || undefined,
      reason: String(values.reason ?? '') || undefined,
      supplierId: String(values.supplierId ?? '') || undefined,
      invoice: String(values.invoice ?? '') || undefined,
    });
    // Atualiza o saldo do produto
    const product = products.items.find((p) => p.id === productId);
    if (product?.trackStock) {
      const delta = formKind === 'entrada' ? quantity : -quantity;
      await products.update(productId, { stock: Math.max(0, product.stock + delta) });
    }
  }

  return (
    <div>
      <PageHeader title="Estoque" description="Entradas, saídas e produtos no nível crítico.">
        <button
          type="button"
          onClick={() => {
            setFormKind('saida');
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-ink-100 transition hover:bg-paper"
        >
          <ArrowDownCircle className="size-4 text-rose-500" />
          Saída
        </button>
        <button
          type="button"
          onClick={() => {
            setFormKind('entrada');
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <ArrowUpCircle className="size-4" />
          Entrada
        </button>
      </PageHeader>

      {critical.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <PackageX className="size-4" />
            Estoque crítico ({critical.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {critical.map((p) => (
              <span key={p.id} className="rounded-full bg-white px-3 py-1 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
                {p.name}: <strong>{p.stock}</strong> (repor em {p.reorderLevel})
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-4 w-full sm:max-w-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por produto, motivo ou nota..." />
      </div>

      <DataTable
        columns={[
          { key: 'date', header: 'Data', render: (m) => formatDate(m.date) },
          {
            key: 'kind',
            header: 'Tipo',
            render: (m) => (
              <StatusBadge tone={m.kind === 'entrada' ? 'success' : 'danger'}>
                {m.kind === 'entrada' ? 'Entrada' : 'Saída'}
              </StatusBadge>
            ),
          },
          { key: 'product', header: 'Produto', render: (m) => <span className="font-medium text-ink-900">{lookups.productName(m.productId)}</span> },
          { key: 'qty', header: 'Qtd.', render: (m) => m.quantity, className: 'text-right' },
          { key: 'cost', header: 'Compra un.', render: (m) => (m.unitCost ? formatBRL(m.unitCost) : '—'), className: 'text-right' },
          { key: 'price', header: 'Venda un.', render: (m) => (m.unitPrice ? formatBRL(m.unitPrice) : '—'), className: 'text-right' },
          { key: 'reason', header: 'Motivo / Nota', render: (m) => m.reason ?? m.invoice ?? '—' },
        ]}
        items={filtered}
        loading={movements.loading}
        emptyTitle="Nenhuma movimentação registrada"
      />

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={formKind === 'entrada' ? 'Entrada de estoque' : 'Saída de estoque'}
        subtitle="O saldo do produto é atualizado automaticamente."
        fields={fields}
        initialValues={{
          productId: '',
          quantity: 1,
          date: todayISO(),
          unitCost: 0,
          unitPrice: 0,
          supplierId: '',
          invoice: '',
          reason: '',
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
