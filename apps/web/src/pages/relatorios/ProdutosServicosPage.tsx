import { useMemo, useState } from 'react';
import { LoadingState } from '../../components/States';
import { IconChevron, IconDownload } from '../../components/icons';
import { formatMoney, formatNumber } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useProductCategories, useProducts } from '../../lib/queries/catalogo';
import { useServiceCategories, useServices } from '../../lib/queries';
import { InventoryReportShell } from './reportNav';

/* -------------------------------------------------------------------------- */
/*  Lista de Produtos e Serviços — relatório SOBRE DADOS EXISTENTES.          */
/*  Reúne o catálogo (GET /products + GET /services) num único relatório com    */
/*  filtros de tipo (produto/serviço), status (ativo/inativo) e categoria.      */
/*  Sem backend novo. Tabela + CSV.                                            */
/* -------------------------------------------------------------------------- */

type ItemType = 'all' | 'product' | 'service';
type Status = 'all' | 'active' | 'inactive';

interface Row {
  id: string;
  name: string;
  type: 'product' | 'service';
  category: string;
  price: string | number;
  stock: number | null;
  active: boolean;
}

const TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'product', label: 'Produtos' },
  { value: 'service', label: 'Serviços' },
];

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
];

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors',
              i > 0 ? 'border-l border-line' : '',
              active ? 'bg-primary text-primary-foreground' : 'bg-card text-ink hover:bg-canvas',
            ].join(' ')}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProdutosServicosPage() {
  const [type, setType] = useState<ItemType>('all');
  const [status, setStatus] = useState<Status>('all');
  const [categoryId, setCategoryId] = useState<string>('');

  const productsQuery = useProducts();
  const servicesQuery = useServices();
  const productCategories = useProductCategories();
  const serviceCategories = useServiceCategories();

  const serviceCatName = useMemo(() => {
    const map = new Map<string, string>();
    (serviceCategories.data ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [serviceCategories.data]);

  const allRows = useMemo<Row[]>(() => {
    const products: Row[] = (productsQuery.data?.data ?? []).map((p) => ({
      id: `p-${p.id}`,
      name: p.name,
      type: 'product',
      category: p.category?.name ?? '—',
      price: p.salePrice,
      stock: Number(p.stock),
      active: p.active,
    }));
    const services: Row[] = (servicesQuery.data?.data ?? []).map((s) => ({
      id: `s-${s.id}`,
      name: s.name,
      type: 'service',
      category: (s.categoryId ? serviceCatName.get(s.categoryId) : undefined) ?? '—',
      price: s.price,
      stock: null,
      active: s.active ?? true,
    }));
    return [...products, ...services].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [productsQuery.data, servicesQuery.data, serviceCatName]);

  // Opções de categoria dependem do tipo selecionado (produtos × serviços).
  const categoryOptions = useMemo(() => {
    if (type === 'product') {
      return (productCategories.data ?? []).map((c) => ({ id: c.name, name: c.name }));
    }
    if (type === 'service') {
      return (serviceCategories.data ?? []).map((c) => ({ id: c.name, name: c.name }));
    }
    return [];
  }, [type, productCategories.data, serviceCategories.data]);

  const rows = useMemo(
    () =>
      allRows.filter((r) => {
        if (type !== 'all' && r.type !== type) return false;
        if (status === 'active' && !r.active) return false;
        if (status === 'inactive' && r.active) return false;
        if (categoryId && r.category !== categoryId) return false;
        return true;
      }),
    [allRows, type, status, categoryId],
  );

  const isLoading = productsQuery.isLoading || servicesQuery.isLoading;

  function exportCsv() {
    downloadCsv(
      'lista-produtos-servicos',
      [
        { header: 'Nome', value: (r: Row) => r.name },
        { header: 'Tipo', value: (r) => (r.type === 'product' ? 'Produto' : 'Serviço') },
        { header: 'Categoria', value: (r) => r.category },
        { header: 'Preço', value: (r) => String(r.price) },
        { header: 'Estoque', value: (r) => (r.stock == null ? '' : String(r.stock)) },
        { header: 'Status', value: (r) => (r.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
  }

  return (
    <InventoryReportShell activeKey="products-services">
      <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
          <div>
            <span className="mb-1.5 block text-sm text-ink">Tipo</span>
            <Segmented
              options={TYPE_OPTIONS}
              value={type}
              onChange={(v) => {
                setType(v);
                setCategoryId('');
              }}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm text-ink">Status</span>
            <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          </div>
          {type !== 'all' && (
            <div className="min-w-0 sm:w-56">
              <span className="mb-1.5 block text-sm text-ink">Categoria</span>
              <div className="relative">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  aria-label="Categoria"
                  className="h-11 w-full appearance-none rounded-xl border border-line bg-card px-3 pr-9 text-sm text-ink outline-none transition-colors focus:border-gold focus:ring-2 focus:ring-gold/30"
                >
                  <option value="">Todas</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <IconChevron
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink"
                />
              </div>
            </div>
          )}
          <div className="sm:ml-auto">
            <button
              type="button"
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-medium text-ink transition-colors hover:bg-canvas disabled:opacity-50"
            >
              <IconDownload size={16} /> Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4">
          <LoadingState />
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h3 className="text-sm font-semibold text-ink">Produtos e serviços</h3>
            <span className="text-xs text-muted-ink">{formatNumber(rows.length)} item(ns)</span>
          </div>
          {rows.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-ink">
              Nenhum item para os filtros selecionados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-muted-ink">
                    <th className="px-5 py-3">Nome</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Categoria</th>
                    <th className="px-5 py-3 text-right">Preço</th>
                    <th className="px-5 py-3 text-right">Estoque</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-line/70 last:border-0 hover:bg-ink/5"
                    >
                      <td className="px-5 py-3 font-medium text-ink">{r.name}</td>
                      <td className="px-5 py-3">
                        <span
                          className={[
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                            r.type === 'product'
                              ? 'bg-[var(--sp-data-products-soft)] text-data-products'
                              : 'bg-[var(--sp-data-services-soft)] text-data-services',
                          ].join(' ')}
                        >
                          {r.type === 'product' ? 'Produto' : 'Serviço'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-muted-ink">{r.category}</td>
                      <td className="px-5 py-3 text-right font-medium text-ink">
                        {formatMoney(r.price)}
                      </td>
                      <td className="px-5 py-3 text-right text-muted-ink">
                        {r.stock == null ? '—' : formatNumber(r.stock)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={[
                            'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                            r.active
                              ? 'bg-success/12 text-success'
                              : 'bg-muted-ink/10 text-muted-ink',
                          ].join(' ')}
                        >
                          {r.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </InventoryReportShell>
  );
}
