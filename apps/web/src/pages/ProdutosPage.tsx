import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  ListBox,
  Select,
  Tabs,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../components/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ImageUpload } from '../components/ImageUpload';
import {
  IconBox,
  IconDownload,
  IconFilter,
  IconLayers,
  IconPencil,
  IconPlus,
  IconSearch,
  IconStar,
  IconTrash,
} from '../components/icons';
import { formatMoney, formatNumber } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import {
  useBrands,
  useCreateProduct,
  useDeleteProduct,
  useProductCategories,
  useProducts,
  useStockMovement,
  useUpdateProduct,
  type Product,
  type StockMovementType,
} from '../lib/queries/catalogo';
import { useAutoCreate } from '../lib/useAutoCreate';
import { useSetPageActions } from '../layout/PageActions';

const NONE = '';
const PAGE_SIZE = 20;

// Campos extras vindos da API mas ainda não tipados no client compartilhado.
type ProductExtra = Product & {
  employeePrice?: string | null;
  additionalCost?: string | null;
  unit?: string | null;
  unitEquivalence?: string | null;
  itemCode?: string | null;
  barcode?: string | null;
  observation?: string | null;
  defaultCommissionPercent?: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function stockLabel(qty: number, unit?: string | null) {
  if (unit && unit.trim()) return `${formatNumber(qty)} ${unit.trim()}`;
  // Belasis exibe sempre "unidade" (singular), inclusive para 0 e plural.
  return `${formatNumber(qty)} unidade`;
}

function commissionLabel(value: number) {
  return `% ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function commissionOf(p: Product) {
  const raw = (p as ProductExtra).defaultCommissionPercent;
  return raw != null && raw !== '' ? Number(raw) : null;
}

export function ProdutosPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [lowStock, setLowStock] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>(
    'active',
  );
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [moveProduct, setMoveProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useAutoCreate(() => setCreateOpen(true));

  const products = useProducts({ search: search || undefined, lowStock });
  const categories = useProductCategories();
  const brands = useBrands();
  const deleteProduct = useDeleteProduct();

  const allRows = products.data?.data ?? [];
  const total = products.data?.total ?? 0;

  // Categoria/marca/favoritos/status não são suportados server-side → filtro client-side.
  const rows = useMemo(
    () =>
      allRows.filter(
        (p) =>
          (!categoryFilter || p.categoryId === categoryFilter) &&
          (!brandFilter || p.brandId === brandFilter) &&
          (!favoritesOnly || p.favorite) &&
          (statusFilter === 'all' ||
            (statusFilter === 'active' ? p.active : !p.active)),
      ),
    [allRows, categoryFilter, brandFilter, favoritesOnly, statusFilter],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pagedIds = paged.map((p) => p.id);
  const allSelected =
    pagedIds.length > 0 && pagedIds.every((id) => selected.has(id));
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pagedIds.forEach((id) => next.delete(id));
      else pagedIds.forEach((id) => next.add(id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, brandFilter, favoritesOnly, statusFilter, lowStock]);

  const activeFilterCount =
    (categoryFilter ? 1 : 0) +
    (brandFilter ? 1 : 0) +
    (favoritesOnly ? 1 : 0) +
    (lowStock ? 1 : 0) +
    (statusFilter !== 'active' ? 1 : 0);
  const hasFilters = Boolean(search) || activeFilterCount > 0;

  // Mobile: as ações do header vivem na BottomNav (padrão Belasis). Reutilizam
  // exatamente os mesmos handlers dos botões desktop.
  useSetPageActions(
    [
      {
        key: 'buscar',
        label: 'Buscar',
        icon: <IconSearch size={22} />,
        onClick: () => setSearchOpen((v) => !v),
      },
      {
        key: 'filtrar',
        label: 'Filtrar',
        icon: <IconFilter size={22} />,
        onClick: () => setFilterOpen((v) => !v),
      },
      {
        key: 'exportar',
        label: 'Exportar',
        icon: <IconDownload size={22} />,
        onClick: exportCsv,
        disabled: rows.length === 0,
      },
      {
        key: 'novo',
        label: 'Novo',
        icon: <IconPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
    ],
    [rows],
  );

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setLowStock(false);
    setStatusFilter('active');
    setCategoryFilter('');
    setBrandFilter('');
    setFavoritesOnly(false);
  }

  function exportCsv() {
    downloadCsv<Product>(
      'produtos',
      [
        { header: 'Produto', value: (p) => p.name },
        { header: 'Marca', value: (p) => p.brand?.name },
        { header: 'Categoria', value: (p) => p.category?.name },
        { header: 'Estoque', value: (p) => p.stock },
        { header: 'Estoque mínimo', value: (p) => p.minStock },
        { header: 'Preço de venda', value: (p) => Number(p.salePrice).toFixed(2) },
        { header: 'Custo', value: (p) => Number(p.costPrice).toFixed(2) },
        { header: 'Comissão %', value: (p) => commissionOf(p)?.toFixed(2) ?? '' },
        { header: 'Cashback %', value: (p) => Number(p.cashbackPercent).toFixed(2) },
        { header: 'Favorito', value: (p) => (p.favorite ? 'Sim' : 'Não') },
        { header: 'Status', value: (p) => (p.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
  }

  function isLow(p: Product) {
    return Number(p.stock) <= Number(p.minStock);
  }

  async function handleDelete(p: Product) {
    if (!window.confirm(`Remover o produto "${p.name}"?`)) return;
    await deleteProduct.mutateAsync(p.id);
  }

  const categoryOptions = (categories.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const brandOptions = (brands.data ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="pb-10">
      {/* Cabeçalho: título + Buscar / Filtrar / Novo (igual Belasis) */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Produtos</h1>
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <ToolbarButton
            active={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <IconSearch size={16} /> Buscar
          </ToolbarButton>
          <ToolbarButton
            active={filterOpen || activeFilterCount > 0}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <IconFilter size={16} /> Filtrar
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </ToolbarButton>
          <ToolbarButton onClick={exportCsv} disabled={rows.length === 0}>
            <IconDownload size={16} /> Exportar
          </ToolbarButton>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </header>

      {/* Sub-abas: Produtos / Lotes e validades */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-line">
        <SubTab active>Produtos</SubTab>
        {/* TODO: rota de lotes e validades ainda não implementada */}
        <SubTab active={false} disabled>
          <IconLayers size={14} /> Lotes e validades
        </SubTab>
      </div>

      {/* Barra de busca (toggle) */}
      {searchOpen && (
        <div className="mb-4 flex max-w-xl items-center gap-2">
          <TextField
            value={searchInput}
            onChange={setSearchInput}
            className="min-w-0 flex-1"
            aria-label="Buscar produto"
          >
            <Input
              placeholder="Digite para buscar"
              className="focus:border-primary focus:ring-2 focus:ring-primary/25"
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            />
          </TextField>
          <Button variant="primary" onClick={applySearch}>
            Buscar
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Painel de filtros lateral (Filtrar) */}
        {filterOpen && (
          <aside className="w-full shrink-0 rounded-xl border border-line bg-card p-4 shadow-[var(--shadow-card)] lg:w-72">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Filtros</span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>

            <FilterGroup title="Status">
              <CheckRow
                checked={statusFilter === 'active'}
                onClick={() => setStatusFilter('active')}
              >
                Ativos
              </CheckRow>
              <CheckRow
                checked={statusFilter === 'inactive'}
                onClick={() => setStatusFilter('inactive')}
              >
                Inativos
              </CheckRow>
            </FilterGroup>

            <FilterGroup title="Favoritos">
              <CheckRow
                checked={favoritesOnly}
                onClick={() => setFavoritesOnly(true)}
              >
                Com estrela
              </CheckRow>
              <CheckRow
                checked={!favoritesOnly}
                onClick={() => setFavoritesOnly(false)}
              >
                Sem estrela
              </CheckRow>
            </FilterGroup>

            <FilterGroup title="Estoque">
              <CheckRow checked={lowStock} onClick={() => setLowStock((v) => !v)}>
                Estoque baixo
              </CheckRow>
            </FilterGroup>

            {categoryOptions.length > 0 && (
              <FilterGroup title="Categorias" scroll>
                {categoryOptions.map((c) => (
                  <CheckRow
                    key={c.id}
                    checked={categoryFilter === c.id}
                    onClick={() =>
                      setCategoryFilter((v) => (v === c.id ? NONE : c.id))
                    }
                  >
                    {c.name}
                  </CheckRow>
                ))}
              </FilterGroup>
            )}

            {brandOptions.length > 0 && (
              <FilterGroup title="Marcas" scroll>
                {brandOptions.map((b) => (
                  <CheckRow
                    key={b.id}
                    checked={brandFilter === b.id}
                    onClick={() => setBrandFilter((v) => (v === b.id ? NONE : b.id))}
                  >
                    {b.name}
                  </CheckRow>
                ))}
              </FilterGroup>
            )}
          </aside>
        )}

        {/* Conteúdo principal: tabela / cards */}
        <div className="min-w-0 flex-1">
          {products.isLoading ? (
            <LoadingState />
          ) : products.isError ? (
            <ErrorState onRetry={() => products.refetch()} />
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
              <EmptyState
                icon={<IconBox size={32} />}
                title="Nenhum produto encontrado"
                description={
                  hasFilters
                    ? 'Tente ajustar os filtros.'
                    : 'Cadastre seu primeiro produto.'
                }
              />
            </div>
          ) : (
            <>
              {/* ===== Desktop: tabela ===== */}
              <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <th className="w-10 px-4 py-3">
                        <Checkbox
                          checked={allSelected}
                          onChange={toggleAll}
                          ariaLabel="Selecionar tudo"
                        />
                      </th>
                      <th className="px-4 py-3 font-semibold">Nome</th>
                      <th className="px-4 py-3 font-semibold">Marca</th>
                      <th className="px-4 py-3 font-semibold">Categoria</th>
                      <th className="px-4 py-3 font-semibold">Estoque</th>
                      <th className="px-4 py-3 text-right font-semibold">
                        Preço de venda
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">Comissão</th>
                      <th className="px-4 py-3 text-center font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((p) => {
                      const qty = Number(p.stock);
                      const low = isLow(p);
                      const comm = commissionOf(p);
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                        >
                          <td className="px-4 py-2.5">
                            <Checkbox
                              checked={selected.has(p.id)}
                              onChange={() => toggleOne(p.id)}
                              ariaLabel={`Selecionar ${p.name}`}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setEditing(p)}
                              className="flex w-full items-center gap-2.5 text-left"
                            >
                              <Avatar product={p} />
                              <span className="min-w-0 truncate font-medium text-ink">
                                {p.name}
                              </span>
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-muted-ink">
                            {p.brand?.name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-ink">
                            {p.category?.name ?? '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setMoveProduct(p)}
                              className={[
                                'inline-flex items-center gap-1.5 transition-colors hover:text-primary',
                                low ? 'font-medium text-danger' : 'text-ink',
                              ].join(' ')}
                              title="Movimentar estoque"
                            >
                              {stockLabel(qty, (p as ProductExtra).unit)}
                              <IconPencil size={13} className="opacity-60" />
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-ink">
                            {formatMoney(p.salePrice)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-ink">
                            {comm != null ? commissionLabel(comm) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <RowActions
                              product={p}
                              onEdit={() => setEditing(p)}
                              onDelete={() => handleDelete(p)}
                              deleting={deleteProduct.isPending}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ===== Mobile: cards ===== */}
              <ul className="flex flex-col gap-2 md:hidden">
                {paged.map((p) => {
                  const qty = Number(p.stock);
                  const low = isLow(p);
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-card)]"
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="flex w-full items-center gap-3 text-left"
                      >
                        <Avatar product={p} size={44} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-medium text-ink">
                              {p.name}
                            </span>
                            <IconStar
                              size={18}
                              className={
                                p.favorite
                                  ? 'fill-gold text-gold'
                                  : 'text-muted-ink/40'
                              }
                            />
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2 text-sm">
                            <span className="font-semibold text-primary">
                              {formatMoney(p.salePrice)}
                            </span>
                            <span
                              className={
                                low ? 'text-danger' : 'text-muted-ink'
                              }
                            >
                              {stockLabel(qty, (p as ProductExtra).unit)}
                            </span>
                          </div>
                          {p.brand?.name && (
                            <div className="mt-0.5 truncate text-xs text-muted-ink">
                              {p.brand.name}
                            </div>
                          )}
                        </div>
                      </button>
                      <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-line/60 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMoveProduct(p)}
                        >
                          <IconBox size={14} /> Estoque
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Editar"
                          onClick={() => setEditing(p)}
                        >
                          <IconPencil size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Remover"
                          className="text-danger"
                          isDisabled={deleteProduct.isPending}
                          onClick={() => handleDelete(p)}
                        >
                          <IconTrash size={14} />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Rodapé: contagem + paginação */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-ink">
                <span>
                  {formatNumber(rows.length)} de {formatNumber(total)} produto(s)
                </span>
                {pageCount > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="px-1">
                      {safePage} / {pageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={safePage >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawers laterais (Novo / Editar / Estoque) */}
      <ProductDrawer
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categoryOptions}
        brands={brandOptions}
      />
      <ProductDrawer
        mode="edit"
        product={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        categories={categoryOptions}
        brands={brandOptions}
      />
      <StockMovementDrawer
        product={moveProduct}
        onClose={() => setMoveProduct(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Subcomponentes de apresentação
// ---------------------------------------------------------------------

interface Option {
  id: string;
  name: string;
}

function Avatar({ product, size = 34 }: { product: Product; size?: number }) {
  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt={product.name}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-md object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-[11px] font-semibold text-primary"
    >
      {initials(product.name) || <IconBox size={16} />}
    </div>
  );
}

function RowActions({
  product,
  onEdit,
  onDelete,
  deleting,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1 text-muted-ink">
      <button
        type="button"
        aria-label={product.favorite ? 'Favorito' : 'Marcar favorito'}
        title="Favorito"
        className="rounded p-1 hover:bg-canvas"
      >
        <IconStar
          size={16}
          className={product.favorite ? 'fill-gold text-gold' : 'text-muted-ink/40'}
        />
      </button>
      <span className="h-4 w-px bg-line" />
      <button
        type="button"
        aria-label="Editar"
        title="Editar"
        onClick={onEdit}
        className="rounded p-1 hover:bg-canvas hover:text-primary"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-line" />
      <button
        type="button"
        aria-label="Remover"
        title="Remover"
        onClick={onDelete}
        disabled={deleting}
        className="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={onChange}
      className={[
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-line bg-card hover:border-primary',
      ].join(' ')}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.5l2.5 2.5 4.5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-primary bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] text-primary'
          : 'border-line bg-card text-ink hover:bg-canvas',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function SubTab({
  children,
  active,
  disabled,
}: {
  children: React.ReactNode;
  active: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        '-mb-px inline-flex items-center gap-1.5 border-b-2 px-1 pb-2.5 pt-1 text-sm font-medium transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-ink',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function FilterGroup({
  title,
  children,
  scroll,
}: {
  title: string;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
        {title}
      </p>
      <div
        className={[
          'flex flex-col gap-0.5',
          scroll ? 'max-h-44 overflow-y-auto pr-1' : '',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}

function CheckRow({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded px-1 py-1 text-left text-sm text-ink hover:bg-canvas"
    >
      <span
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-line bg-card',
        ].join(' ')}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.5l2.5 2.5 4.5-5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Drawer de cadastro/edição de produto
// ---------------------------------------------------------------------

function ProductDrawer({
  mode,
  product,
  isOpen,
  onClose,
  categories,
  brands,
}: {
  mode: 'create' | 'edit';
  product?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Option[];
  brands: Option[];
}) {
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [employeePrice, setEmployeePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [additionalCost, setAdditionalCost] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [unit, setUnit] = useState('');
  const [unitEquivalence, setUnitEquivalence] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [observation, setObservation] = useState('');
  const [cashbackPercent, setCashbackPercent] = useState('');
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState('');
  const [active, setActive] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [tab, setTab] = useState('cadastro');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const extra = (product ?? null) as ProductExtra | null;
    setImageUrl(product?.imageUrl ?? null);
    setName(product?.name ?? '');
    setCategoryId(product?.categoryId ?? '');
    setBrandId(product?.brandId ?? '');
    setSalePrice(product ? String(product.salePrice) : '');
    setEmployeePrice(extra?.employeePrice != null ? String(extra.employeePrice) : '');
    setCostPrice(product ? String(product.costPrice) : '');
    setAdditionalCost(
      extra?.additionalCost != null ? String(extra.additionalCost) : '',
    );
    setStock(product ? String(product.stock) : '');
    setMinStock(product ? String(product.minStock) : '');
    setUnit(extra?.unit ?? '');
    setUnitEquivalence(
      extra?.unitEquivalence != null ? String(extra.unitEquivalence) : '',
    );
    setItemCode(extra?.itemCode ?? '');
    setBarcode(extra?.barcode ?? '');
    setObservation(extra?.observation ?? '');
    setCashbackPercent(product ? String(product.cashbackPercent) : '');
    setDefaultCommissionPercent(
      extra?.defaultCommissionPercent != null
        ? String(extra.defaultCommissionPercent)
        : '',
    );
    setActive(product?.active ?? true);
    setFavorite(product?.favorite ?? false);
    setTab('cadastro');
    setError(null);
  }, [isOpen, product]);

  const pending = create.isPending || update.isPending;
  const canSave =
    name.trim().length >= 2 && salePrice !== '' && Number(salePrice) >= 0 && !pending;

  async function handleSave() {
    setError(null);
    const body = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      imageUrl,
      salePrice: Number(salePrice),
      employeePrice: employeePrice !== '' ? Number(employeePrice) : undefined,
      costPrice: costPrice ? Number(costPrice) : undefined,
      additionalCost: additionalCost !== '' ? Number(additionalCost) : undefined,
      minStock: minStock ? Number(minStock) : undefined,
      unit: unit.trim() || undefined,
      unitEquivalence: unitEquivalence !== '' ? Number(unitEquivalence) : undefined,
      itemCode: itemCode.trim() || undefined,
      barcode: barcode.trim() || undefined,
      observation: observation.trim() || undefined,
      cashbackPercent: cashbackPercent !== '' ? Number(cashbackPercent) : undefined,
      defaultCommissionPercent:
        defaultCommissionPercent !== ''
          ? Number(defaultCommissionPercent)
          : undefined,
      favorite,
    };
    try {
      if (mode === 'edit' && product) {
        await update.mutateAsync({
          id: product.id,
          body: { ...body, stock: stock !== '' ? Number(stock) : undefined, active },
        });
      } else {
        await create.mutateAsync({
          ...body,
          stock: stock ? Number(stock) : undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar o produto.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar produto' : 'Novo produto'}
      widthClass="sm:w-[560px]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={!canSave} onClick={handleSave}>
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
        <Tabs.List className="w-full overflow-x-auto">
          <Tabs.Tab id="cadastro">Cadastro</Tabs.Tab>
          <Tabs.Tab id="config">Configurações</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="cadastro" className="flex flex-col gap-4 pt-4">
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
            kind="product"
            shape="square"
            size={88}
            label="Imagem do produto"
            placeholder="Foto"
          />

          <Field label="Nome">
            <TextField value={name} onChange={setName} aria-label="Nome">
              <Input placeholder="Nome do produto" />
            </TextField>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria (opcional)">
              <SelectField
                ariaLabel="Categoria"
                value={categoryId}
                onChange={setCategoryId}
                options={categories}
              />
            </Field>
            <Field label="Marca (opcional)">
              <SelectField
                ariaLabel="Marca"
                value={brandId}
                onChange={setBrandId}
                options={brands}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preço de venda">
              <TextField
                value={salePrice}
                onChange={setSalePrice}
                aria-label="Preço de venda"
              >
                <Input type="number" placeholder="R$ 0,00" />
              </TextField>
            </Field>
            <Field label="Custo de compra">
              <TextField
                value={costPrice}
                onChange={setCostPrice}
                aria-label="Custo de compra"
              >
                <Input type="number" placeholder="R$ 0,00" />
              </TextField>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preço para profissional">
              <TextField
                value={employeePrice}
                onChange={setEmployeePrice}
                aria-label="Preço para profissional"
              >
                <Input type="number" placeholder="R$ 0,00" />
              </TextField>
            </Field>
            <Field label="Custo adicional">
              <TextField
                value={additionalCost}
                onChange={setAdditionalCost}
                aria-label="Custo adicional"
              >
                <Input type="number" placeholder="R$ 0,00" />
              </TextField>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Estoque">
              <TextField value={stock} onChange={setStock} aria-label="Estoque">
                <Input type="number" placeholder="Estoque" />
              </TextField>
            </Field>
            <Field label="Estoque mínimo">
              <TextField
                value={minStock}
                onChange={setMinStock}
                aria-label="Estoque mínimo"
              >
                <Input type="number" placeholder="Estoque mínimo" />
              </TextField>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Unidade">
              <TextField value={unit} onChange={setUnit} aria-label="Unidade">
                <Input placeholder="un, ml, g…" />
              </TextField>
            </Field>
            <Field label="Uma unidade equivale a">
              <TextField
                value={unitEquivalence}
                onChange={setUnitEquivalence}
                aria-label="Uma unidade equivale a"
              >
                <Input type="number" placeholder="0" />
              </TextField>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código do item">
              <TextField
                value={itemCode}
                onChange={setItemCode}
                aria-label="Código do item"
              >
                <Input placeholder="Código do item" />
              </TextField>
            </Field>
            <Field label="Código de barras">
              <TextField
                value={barcode}
                onChange={setBarcode}
                aria-label="Código de barras"
              >
                <Input placeholder="Código de barras" />
              </TextField>
            </Field>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="config" className="flex flex-col gap-4 pt-4">
          <Field label="Comissão padrão (%)">
            <TextField
              value={defaultCommissionPercent}
              onChange={setDefaultCommissionPercent}
              aria-label="Comissão padrão"
            >
              <Input type="number" min={0} max={100} step="0.01" placeholder="% 0.0" />
            </TextField>
            <span className="text-xs text-muted-ink">
              Percentual de comissão aplicado ao profissional na venda deste produto.
            </span>
          </Field>

          <Field label="Cashback (%)">
            <TextField
              value={cashbackPercent}
              onChange={setCashbackPercent}
              aria-label="Cashback"
            >
              <Input type="number" min={0} max={100} step="0.01" placeholder="0" />
            </TextField>
            <span className="text-xs text-muted-ink">
              Percentual de cashback concedido ao cliente nas compras deste produto.
            </span>
          </Field>

          <Field label="Observações">
            <TextField
              value={observation}
              onChange={setObservation}
              aria-label="Observações"
            >
              <Input placeholder="Anotações internas sobre o produto" />
            </TextField>
          </Field>

          <div className="flex flex-col gap-3 rounded-md border border-line bg-canvas p-3">
            <Toggle label="Favorito" checked={favorite} onChange={setFavorite} />
            <span className="text-xs text-muted-ink">
              Produtos favoritos aparecem no topo da listagem.
            </span>
            {mode === 'edit' && (
              <>
                <Toggle label="Ativo" checked={active} onChange={setActive} />
                <span className="text-xs text-muted-ink">
                  Produtos inativos ficam ocultos nas vendas, mas mantêm o histórico.
                </span>
              </>
            )}
          </div>
        </Tabs.Panel>
      </Tabs>

      {error && (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------
// Drawer de movimentação de estoque
// ---------------------------------------------------------------------

function StockMovementDrawer({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const move = useStockMovement();
  const [type, setType] = useState<StockMovementType>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isOpen = Boolean(product);

  useEffect(() => {
    if (product) {
      setType('in');
      setQuantity('');
      setReason('');
      setError(null);
    }
  }, [product]);

  const canSave = product != null && quantity !== '' && Number(quantity) >= 0;

  async function handleSave() {
    if (!product) return;
    setError(null);
    try {
      await move.mutateAsync({
        id: product.id,
        body: { type, quantity: Number(quantity), reason: reason.trim() || undefined },
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível registrar a movimentação.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Movimentar estoque"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            isDisabled={!canSave || move.isPending}
            onClick={handleSave}
          >
            {move.isPending ? 'Salvando…' : 'Registrar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {product && (
          <p className="text-sm text-muted-ink">
            {product.name} — estoque atual:{' '}
            <span className="font-medium text-ink">
              {formatNumber(Number(product.stock))}
            </span>
          </p>
        )}

        <Field label="Tipo">
          <Select
            aria-label="Tipo de movimentação"
            selectedKey={type}
            onSelectionChange={(k) =>
              setType((k ? String(k) : 'in') as StockMovementType)
            }
          >
            <Select.Trigger>
              <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="in" textValue="Entrada">
                  Entrada
                </ListBox.Item>
                <ListBox.Item id="out" textValue="Saída">
                  Saída
                </ListBox.Item>
                <ListBox.Item id="adjust" textValue="Ajuste">
                  Ajuste (define o estoque)
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>

        <Field label="Quantidade">
          <TextField value={quantity} onChange={setQuantity} aria-label="Quantidade">
            <Input type="number" placeholder="0" />
          </TextField>
        </Field>

        <Field label="Motivo (opcional)">
          <TextField value={reason} onChange={setReason} aria-label="Motivo">
            <Input placeholder="Ex.: compra, venda, perda…" />
          </TextField>
        </Field>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------
// Campos reutilizáveis
// ---------------------------------------------------------------------

function SelectField({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value || null}
      onSelectionChange={(k) => onChange(k ? String(k) : NONE)}
    >
      <Select.Trigger>
        <Select.Value>
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? 'Selecione' : selectedText
          }
        </Select.Value>
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
              {o.name}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
