import type { Product } from '@silvia/core';
import { formatBRL, formatDate, formatPercent, todayISO } from '@silvia/core';
import { AlertTriangle } from 'lucide-react';
import { repos } from '../lib/repos';
import { useCollection, useLookups } from '../lib/hooks';
import { CrudPage } from '../components/CrudPage';
import { ActiveBadge, StatusBadge } from '../components/StatusBadge';
import type { FieldDef, FormValues } from '../components/form';

function toValues(item: Product | null): FormValues {
  return {
    code: item?.code ?? '',
    name: item?.name ?? '',
    groupId: item?.groupId ?? '',
    manufacturer: item?.manufacturer ?? '',
    unit: item?.unit ?? 'un',
    purchasePrice: item?.purchasePrice ?? 0,
    salePrice: item?.salePrice ?? 0,
    saleCommissionPercent: item?.saleCommissionPercent ?? 10,
    stock: item?.stock ?? 0,
    trackStock: item?.trackStock ?? true,
    reorderLevel: item?.reorderLevel ?? 0,
    maxStock: item?.maxStock ?? 0,
    taxable: item?.taxable ?? true,
    sendHistoryToClient: item?.sendHistoryToClient ?? false,
    continuity: item?.continuity ?? true,
    active: item?.active ?? true,
    expiresAt: item?.expiresAt ?? '',
  };
}

export function ProdutosPage() {
  const groups = useCollection(repos.groups);
  const lookups = useLookups();
  const hoje = todayISO();

  const fields: FieldDef[] = [
    { kind: 'text', name: 'code', label: 'Código', required: true },
    { kind: 'text', name: 'name', label: 'Descrição', required: true, span: 2 },
    {
      kind: 'select',
      name: 'groupId',
      label: 'Grupo',
      options: [
        { value: '', label: 'Sem grupo' },
        ...groups.items.filter((g) => g.kind === 'produtos').map((g) => ({ value: g.id, label: g.name })),
      ],
    },
    { kind: 'text', name: 'manufacturer', label: 'Fabricante' },
    { kind: 'text', name: 'unit', label: 'Unidade de medida', placeholder: 'un, ml, g...' },
    { kind: 'number', name: 'purchasePrice', label: 'Valor de compra (R$)', step: 0.01 },
    { kind: 'number', name: 'salePrice', label: 'Valor de venda (R$)', step: 0.01, required: true },
    { kind: 'number', name: 'saleCommissionPercent', label: 'Comissão de venda (%)', step: 0.5 },
    { kind: 'number', name: 'stock', label: 'Estoque atual' },
    { kind: 'number', name: 'reorderLevel', label: 'Nível de reposição' },
    { kind: 'number', name: 'maxStock', label: 'Estoque máximo' },
    { kind: 'date', name: 'expiresAt', label: 'Validade do lote' },
    { kind: 'checkbox', name: 'trackStock', label: 'Controlar estoque' },
    { kind: 'checkbox', name: 'taxable', label: 'Tributável' },
    { kind: 'checkbox', name: 'sendHistoryToClient', label: 'Envia histórico à cliente' },
    { kind: 'checkbox', name: 'continuity', label: 'Com continuidade' },
    { kind: 'checkbox', name: 'active', label: 'Produto ativo' },
  ];

  return (
    <CrudPage<Product>
      title="Produtos"
      description="Catálogo com preços, comissão de venda, estoque e validade."
      searchPlaceholder="Buscar por código, descrição ou fabricante..."
      newLabel="Novo produto"
      repo={repos.products}
      searchText={(p) => `${p.code} ${p.name} ${p.manufacturer ?? ''}`}
      columns={[
        { key: 'code', header: 'Código', render: (p) => <span className="font-mono text-xs text-ink-500">{p.code}</span> },
        {
          key: 'name',
          header: 'Produto',
          render: (p) => (
            <div className="flex items-center gap-2">
              <span className="font-medium text-ink-900">{p.name}</span>
              {p.trackStock && p.active && p.stock <= p.reorderLevel ? (
                <span title="Estoque no nível de reposição">
                  <AlertTriangle className="size-4 text-amber-500" />
                </span>
              ) : null}
            </div>
          ),
        },
        { key: 'group', header: 'Grupo', render: (p) => lookups.groupName(p.groupId) },
        { key: 'buy', header: 'Compra', render: (p) => formatBRL(p.purchasePrice), className: 'text-right' },
        { key: 'sell', header: 'Venda', render: (p) => formatBRL(p.salePrice), className: 'text-right' },
        {
          key: 'margin',
          header: 'Lucro',
          render: (p) =>
            p.purchasePrice > 0 ? formatPercent(((p.salePrice - p.purchasePrice) / p.purchasePrice) * 100) : '—',
          className: 'text-right',
        },
        {
          key: 'stock',
          header: 'Estoque',
          render: (p) =>
            p.trackStock ? (
              <span className={p.stock <= p.reorderLevel ? 'font-semibold text-amber-600' : ''}>
                {p.stock} {p.unit}
              </span>
            ) : (
              <span className="text-ink-300">não controla</span>
            ),
          className: 'text-right',
        },
        {
          key: 'expiry',
          header: 'Validade',
          render: (p) =>
            p.expiresAt ? (
              <StatusBadge tone={p.expiresAt <= hoje ? 'danger' : 'neutral'}>{formatDate(p.expiresAt)}</StatusBadge>
            ) : (
              '—'
            ),
        },
        { key: 'status', header: 'Status', render: (p) => <ActiveBadge active={p.active} /> },
      ]}
      fields={fields}
      toValues={toValues}
      fromValues={(values) => {
        const purchase = Number(values.purchasePrice) || 0;
        const sale = Number(values.salePrice) || 0;
        return {
          code: String(values.code),
          name: String(values.name),
          groupId: String(values.groupId) || undefined,
          manufacturer: String(values.manufacturer) || undefined,
          unit: String(values.unit) || 'un',
          purchasePrice: purchase,
          salePrice: sale,
          profitPercent: purchase > 0 ? Math.round(((sale - purchase) / purchase) * 100) : 0,
          saleCommissionPercent: Number(values.saleCommissionPercent) || 0,
          stock: Number(values.stock) || 0,
          trackStock: Boolean(values.trackStock),
          reorderLevel: Number(values.reorderLevel) || 0,
          maxStock: Number(values.maxStock) || 0,
          taxable: Boolean(values.taxable),
          sendHistoryToClient: Boolean(values.sendHistoryToClient),
          continuity: Boolean(values.continuity),
          active: Boolean(values.active),
          expiresAt: String(values.expiresAt) || undefined,
        };
      }}
    />
  );
}
