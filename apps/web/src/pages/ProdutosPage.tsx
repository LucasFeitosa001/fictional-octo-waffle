import { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete,
  Button,
  Checkbox as HeroCheckbox,
  Input,
  ListBox,
  Popover,
  SearchField,
  Select,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { useConfirm } from '../components/ConfirmDialog';
import { DatePicker } from '../components/DatePicker';
import { Drawer } from '../components/Drawer';
import { FilterAside } from '../components/FilterAside';
import { FullDrawer } from '../components/FullDrawer';
import { EmptyState, ErrorState } from '../components/States';
import { TableSkeleton } from '../components/Skeletons';
import { ImageUpload } from '../components/ImageUpload';
import { InlineSearch } from '../components/InlineSearch';
import { IconTip } from '../components/IconTip';
import { HelpTooltip } from '../components/HelpTooltip';
import { AppTabs } from '../components/AppTabs';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { AnimatedSelectionCell } from '../components/AnimatedSelectionCell';
import { FilterCheckbox } from '../components/FilterCheckbox';
import { BulkActionsSheet } from '../components/BulkActionsSheet';
import { SwitchRow } from '../components/SwitchRow';
import {
  IconBox,
  IconCircleCheck,
  IconDownload,
  IconFilter,
  IconLayers,
  IconPencil,
  IconPlus,
  IconSearch,
  IconSettings,
  IconStar,
  IconTrash,
  IconX,
} from '../components/icons';
import { formatDate, formatMoney, formatNumber, toDateInput } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import {
  useBrands,
  useCreateProduct,
  useCreateProductBatch,
  useDeleteProduct,
  useDeleteProductBatch,
  useProductBatches,
  useProductCategories,
  useProducts,
  useStockMovement,
  useUpdateProduct,
  useUpdateProductBatch,
  type Product,
  type ProductBatch,
  type StockMovementType,
} from '../lib/queries/catalogo';
import { useAutoCreate } from '../lib/useAutoCreate';
import {
  buildSelectActions,
  useSelectMode,
  type BulkAction,
} from '../hooks/useSelectMode';
import { useSetPageActions } from '../layout/PageActions';

const NONE = '';
const PAGE_SIZE = 20;

type SortBy = 'name' | 'price' | 'stock';
type ProductSubTab = 'produtos' | 'lotes';
const PRODUCT_TABS: { id: ProductSubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'produtos', label: 'Produtos', icon: <IconBox size={16} /> },
  { id: 'lotes', label: 'Lotes e validades', icon: <IconLayers size={16} /> },
];
const SORT_LABEL: Record<SortBy, string> = {
  name: 'Nome',
  price: 'Preço',
  stock: 'Estoque',
};

// ── Colunas ocultáveis (T7) ─────────────────────────────────────────
// Colunas de dados que o usuário pode mostrar/ocultar pelo gear. A
// coluna-título ("Nome") e a de ações NÃO entram aqui — são sempre fixas.
const TOGGLE_COLS = [
  { key: 'brand', label: 'Marca' },
  { key: 'category', label: 'Categoria' },
  { key: 'stock', label: 'Estoque' },
  { key: 'price', label: 'Preço de venda' },
  { key: 'commission', label: 'Comissão' },
] as const;
type ColKey = (typeof TOGGLE_COLS)[number]['key'];

const COLS_STORAGE_KEY = 'sp-cols-produtos';

function readHiddenCols(): Set<string> {
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? new Set(arr.filter((x): x is string => typeof x === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Visibilidade de colunas persistida em localStorage (chave `sp-cols-produtos`).
 * Guarda o conjunto de colunas OCULTAS; `isVisible` responde por coluna.
 */
function useColumnVisibility() {
  const [hidden, setHidden] = useState<Set<string>>(() => readHiddenCols());

  const toggle = (key: ColKey) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem(COLS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* localStorage indisponível — segue sem persistir. */
      }
      return next;
    });
  };

  const isVisible = (key: ColKey) => !hidden.has(key);
  const hiddenCount = TOGGLE_COLS.filter((c) => hidden.has(c.key)).length;

  return { toggle, isVisible, hiddenCount };
}

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
  trackStock?: boolean | null;
  cashbackActive?: boolean | null;
  cashbackType?: string | null;
  cashbackValue?: string | null;
  exitReason?: string | null;
};

// Unidades de "Registro de saída" (Belasis: labels.unit/milliliter/gram… do bundle).
// Determina em qual unidade o estoque é baixado ao vender o produto.
const EXIT_REASONS: { id: string; label: string }[] = [
  { id: 'unit', label: 'em unidade' },
  { id: 'milliliter', label: 'em mililitros (ml)' },
  { id: 'gram', label: 'em gramas (g)' },
  { id: 'liter', label: 'em litros (l)' },
  { id: 'hours', label: 'em horas (h)' },
  { id: 'box', label: 'em caixa' },
  { id: 'kilogram', label: 'em quilogramas (kg)' },
  { id: 'package', label: 'em pacote' },
  { id: 'jar', label: 'em pote' },
  { id: 'bottle', label: 'em frasco' },
  { id: 'piece', label: 'em peça' },
  { id: 'roll', label: 'em rolo' },
  { id: 'application', label: 'em aplicação' },
  { id: 'dose', label: 'em dosagem' },
  { id: 'sheets', label: 'em folhas' },
  { id: 'bag', label: 'em saco' },
  { id: 'ampoule', label: 'em ampola' },
  { id: 'gallon', label: 'em galão' },
  { id: 'tube', label: 'em bisnaga' },
  { id: 'capsule', label: 'em cápsula' },
  { id: 'blister_pack', label: 'em cartela' },
  { id: 'tablet', label: 'em comprimido' },
  { id: 'milligram', label: 'em miligramas (mg)' },
  { id: 'sachet', label: 'em sachê' },
  { id: 'centimeter', label: 'em centímetros (cm)' },
  { id: 'meter', label: 'em metros (m)' },
];

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
  const confirm = useConfirm();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  // Visibilidade de colunas (gear — T7), persistida em localStorage.
  const cols = useColumnVisibility();
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
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [actionsOpen, setActionsOpen] = useState(false);
  // Sub-abas: catálogo de produtos vs. lotes e validades.
  const [subTab, setSubTab] = useState<ProductSubTab>('produtos');
  const [batchDrawer, setBatchDrawer] = useState<{ open: boolean; batch: ProductBatch | null }>(
    { open: false, batch: null },
  );
  // Belasis: banner de assinatura condicional no topo. Mock por ora — no futuro
  // virá do endpoint de billing/plano.
  const [showSubscriptionBanner, setShowSubscriptionBanner] = useState(false);
  useAutoCreate(() => setCreateOpen(true));

  const products = useProducts({ search: search || undefined, lowStock });
  const categories = useProductCategories();
  const brands = useBrands();
  const deleteProduct = useDeleteProduct();
  const updateProduct = useUpdateProduct();

  const allRows = products.data?.data ?? [];
  const total = products.data?.total ?? 0;

  // Categoria/marca/favoritos/status não são suportados server-side → filtro client-side.
  // Ordenação também é client-side (Belasis expõe "Ordenando por Nome/Preço/Estoque").
  const rows = useMemo(() => {
    const filtered = allRows.filter(
      (p) =>
        (!categoryFilter || p.categoryId === categoryFilter) &&
        (!brandFilter || p.brandId === brandFilter) &&
        (!favoritesOnly || p.favorite) &&
        (statusFilter === 'all' ||
          (statusFilter === 'active' ? p.active : !p.active)),
    );
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'price') return Number(b.salePrice) - Number(a.salePrice);
      if (sortBy === 'stock') return Number(b.stock) - Number(a.stock);
      return a.name.localeCompare(b.name, 'pt-BR');
    });
    return sorted;
  }, [allRows, categoryFilter, brandFilter, favoritesOnly, statusFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Modo de seleção (Belasis): infra padrão (useSelectMode) sobre os ids
  // VISÍVEIS (todas as linhas filtradas — o mobile lista tudo, o desktop pagina).
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const sel = useSelectMode(ids);

  // Header select-all do desktop opera sobre a PÁGINA visível (paged).
  const pagedIds = paged.map((p) => p.id);
  const pageAllSelected =
    pagedIds.length > 0 && pagedIds.every((id) => sel.isSelected(id));
  function togglePage() {
    for (const id of pagedIds) {
      if (pageAllSelected ? sel.isSelected(id) : !sel.isSelected(id))
        sel.toggle(id);
    }
  }

  // Exclui de verdade os selecionados (mutateAsync em Promise.all no hook de
  // delete existente), após confirmação. Depois fecha a sheet e sai do modo.
  async function bulkDeleteSelected() {
    if (sel.count === 0) return;
    const ok = await confirm({
      title: 'Excluir produtos?',
      message: `Remover ${sel.count} produto(s) selecionado(s)? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await Promise.all([...sel.selected].map((id) => deleteProduct.mutateAsync(id)));
    setActionsOpen(false);
    sel.cancel();
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'delete',
      label: 'Excluir selecionados',
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: deleteProduct.isPending,
      onClick: bulkDeleteSelected,
    },
  ];

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
    subTab === 'lotes'
      ? [
          {
            key: 'novo-lote',
            label: 'Novo lote',
            icon: <IconPlus size={22} />,
            onClick: () => setBatchDrawer({ open: true, batch: null }),
          },
        ]
      : sel.selectMode
        ? buildSelectActions({
            onCancel: sel.cancel,
            onSelectAll: sel.selectAll,
            allSelected: sel.allSelected,
            bulkActions,
            onOpenActions: () => setActionsOpen(true),
            count: sel.count,
          })
        : [
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
              key: 'selecionar',
              label: 'Selecionar',
              icon: <IconCircleCheck size={22} />,
              onClick: sel.enter,
              disabled: rows.length === 0,
            },
            {
              key: 'novo',
              label: 'Novo',
              icon: <IconPlus size={22} />,
              onClick: () => setCreateOpen(true),
            },
          ],
    [subTab, sel.selectMode, sel.allSelected, sel.count, rows.length],
  );

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
    const ok = await confirm({
      title: 'Excluir produto?',
      message: `Remover o produto "${p.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await deleteProduct.mutateAsync(p.id);
    // Fecha o drawer se o produto excluído estava sendo editado.
    if (editing?.id === p.id) setEditing(null);
  }

  async function toggleFavorite(p: Product) {
    await updateProduct.mutateAsync({
      id: p.id,
      body: { favorite: !p.favorite },
    });
  }

  const categoryOptions = (categories.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const brandOptions = (brands.data ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="pb-10">
      {/* Cabeçalho: título + Buscar / Filtrar / Ações / Novo (T6 compacto). */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Produtos</h1>
        <div className="hidden flex-wrap items-center gap-1.5 md:flex">
          {/* Busca inline (componente único de toolbar — ver InlineSearch). */}
          <InlineSearch
            open={searchOpen}
            onOpenChange={setSearchOpen}
            value={search}
            onValueChange={(v) => {
              setSearchInput(v);
              setSearch(v.trim());
            }}
            onClose={() => {
              setSearchInput('');
              setSearch('');
              setPage(1);
            }}
            placeholder="Buscar produto"
          />
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`btn-ghost-hover hidden h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors md:inline-flex ${
              filterOpen || activeFilterCount > 0
                ? 'border-gold bg-gold text-primary-foreground'
                : 'border-line bg-card text-ink hover:bg-canvas'
            }`}
          >
            <IconFilter size={16} />
            <span className="hidden sm:inline">Filtrar</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
          {/* Ações em massa (T3): SEMPRE visível no desktop, à esquerda de "Novo".
              Fora do modo seleção → ativa o selectMode (checkboxes nas linhas).
              Em seleção → mostra a contagem e abre a BulkActionsSheet; um X ao
              lado sai do modo. NÃO existe barra "N selecionados" acima da tabela. */}
          {sel.selectMode ? (
            <div className="hidden items-center md:inline-flex">
              <button
                type="button"
                onClick={() =>
                  sel.count > 0 ? setActionsOpen(true) : sel.selectAll()
                }
                className={`inline-flex h-9 items-center gap-1.5 rounded-l-lg border px-3 text-sm font-medium transition-colors ${
                  sel.count > 0
                    ? 'btn-primary-hover border-gold bg-gold text-primary-foreground hover:bg-gold-strong'
                    : 'btn-ghost-hover border-line bg-card text-ink hover:bg-canvas'
                }`}
              >
                <IconLayers size={16} />
                <span>{sel.count > 0 ? `Ações (${sel.count})` : 'Selecionar todos'}</span>
              </button>
              <button
                type="button"
                onClick={sel.cancel}
                aria-label="Sair do modo seleção"
                className="btn-ghost-hover inline-flex h-9 items-center justify-center rounded-r-lg border border-l-0 border-line bg-card px-2 text-muted-ink transition-colors hover:bg-canvas hover:text-ink"
              >
                <IconX size={16} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={sel.enter}
              className="btn-ghost-hover hidden h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas md:inline-flex"
            >
              <IconLayers size={16} />
              <span>Ações</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary-hover hidden h-9 items-center gap-1.5 rounded-lg bg-gold px-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-colors hover:bg-gold-strong md:inline-flex"
          >
            <IconPlus size={16} />
            <span>Novo</span>
          </button>
        </div>
      </header>

      {/* Belasis: banner condicional de assinatura no topo. */}
      {showSubscriptionBanner && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-[color-mix(in_oklab,var(--sp-primary)_6%,transparent)] px-4 py-3">
          <span className="text-sm text-ink">
            Aproveite mais recursos do seu plano.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)]"
            >
              Ver minha assinatura
            </button>
            <button
              type="button"
              aria-label="Fechar aviso"
              onClick={() => setShowSubscriptionBanner(false)}
              className="rounded-md p-1 text-muted-ink hover:bg-canvas hover:text-ink"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <AppTabs
        items={PRODUCT_TABS}
        selectedKey={subTab}
        onSelectionChange={(key) => {
          sel.cancel();
          setSubTab(key);
        }}
        ariaLabel="Áreas de produtos"
        className="mb-4"
      />

      {subTab === 'lotes' && (
        <BatchesSection
          products={allRows}
          drawer={batchDrawer}
          onOpenDrawer={(batch) => setBatchDrawer({ open: true, batch })}
          onCloseDrawer={() => setBatchDrawer({ open: false, batch: null })}
          onNewDesktop={() => setBatchDrawer({ open: true, batch: null })}
        />
      )}

      {subTab === 'produtos' && (
      <>
      {/* Busca — MOBILE apenas (sempre visível). No desktop a busca vive
          inline no header (T2), então este bloco é oculto em md+. */}
      <div className="mb-4 flex items-center gap-2 md:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line bg-card px-4 shadow-[var(--shadow-card)]">
          <IconSearch size={18} className="shrink-0 text-muted-ink" />
          <input
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setSearch(e.target.value.trim());
            }}
            placeholder="Digite para buscar"
            aria-label="Buscar produto"
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-ink"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Painel de filtros lateral (Filtrar) */}
        <FilterAside open={filterOpen} width="lg:w-72">
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
        </FilterAside>

        {/* Conteúdo principal: tabela (desktop) / cards (mobile) */}
        <div className="min-w-0 flex-1">
          {/* ===== Desktop: Card + tabela + paginação ===== */}
          <div className="hidden md:block">
            {products.isLoading ? (
              <TableSkeleton columns={6} variant="desktop" />
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
                <div className="mb-2 flex items-center justify-end">
                  <SortSelect value={sortBy} onChange={setSortBy} />
                </div>
                <div className="rounded-xl border border-line bg-card shadow-[var(--shadow-card)]">
                  <div className="overflow-clip rounded-t-xl">
                  <table className="w-full border-collapse text-sm">
                    {/* T8: thead sticky no topo do scroll do <main>. Fundo sólido
                        (bg-card) + z-20 pra cobrir as linhas ao rolar. */}
                    <thead className="sticky top-0 z-20 bg-card">
                      <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                        <AnimatedSelectionCell active={sel.selectMode} header className="px-4 py-3">
                          <Check
                            checked={pageAllSelected}
                            onChange={togglePage}
                          />
                        </AnimatedSelectionCell>
                        <th className="px-4 py-3 font-semibold">Nome</th>
                        {cols.isVisible('brand') && (
                          <th className="px-4 py-3 font-semibold">Marca</th>
                        )}
                        {cols.isVisible('category') && (
                          <th className="px-4 py-3 font-semibold">Categoria</th>
                        )}
                        {cols.isVisible('stock') && (
                          <th className="px-4 py-3 font-semibold">Estoque</th>
                        )}
                        {cols.isVisible('price') && (
                          <th className="px-4 py-3 text-right font-semibold">
                            Preço de venda
                          </th>
                        )}
                        {cols.isVisible('commission') && (
                          <th className="px-4 py-3 text-right font-semibold">
                            Comissão
                          </th>
                        )}
                        <th className="w-20 px-4 py-3 text-center">
                          {/* T7: gear abre Popover pra mostrar/ocultar colunas. */}
                          <Popover>
                            <Popover.Trigger>
                              <button
                                type="button"
                                aria-label="Configurar colunas"
                                className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-ink"
                              >
                                <IconSettings size={16} />
                                {cols.hiddenCount > 0 && (
                                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold" />
                                )}
                              </button>
                            </Popover.Trigger>
                            <Popover.Content className="w-60">
                              <Popover.Dialog className="flex flex-col gap-1 p-1">
                                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
                                  Colunas visíveis
                                </div>
                                <ul className="flex flex-col">
                                  {TOGGLE_COLS.map((col) => (
                                    <li key={col.key}>
                                      <HeroCheckbox
                                        isSelected={cols.isVisible(col.key)}
                                        onChange={() => cols.toggle(col.key)}
                                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas"
                                      >
                                        <HeroCheckbox.Content className="flex min-w-0 items-center gap-2">
                                          <HeroCheckbox.Control>
                                            <HeroCheckbox.Indicator />
                                          </HeroCheckbox.Control>
                                          <span className="min-w-0 truncate">
                                            {col.label}
                                          </span>
                                        </HeroCheckbox.Content>
                                      </HeroCheckbox>
                                    </li>
                                  ))}
                                </ul>
                              </Popover.Dialog>
                            </Popover.Content>
                          </Popover>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((p) => {
                        const qty = Number(p.stock);
                        const outOfStock = qty <= 0;
                        const low = !outOfStock && isLow(p);
                        const comm = commissionOf(p);
                        return (
                          <tr
                            key={p.id}
                            className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                          >
                            <AnimatedSelectionCell active={sel.selectMode} className="px-4 py-2.5">
                              <Check
                                checked={sel.isSelected(p.id)}
                                onChange={() => sel.toggle(p.id)}
                              />
                            </AnimatedSelectionCell>
                            <td className="px-4 py-2.5">
                              <button
                                type="button"
                                onClick={() => setEditing(p)}
                                className="flex w-full items-center gap-2.5 text-left"
                              >
                                <Avatar product={p} />
                                <span className="min-w-0 truncate font-medium text-primary hover:underline">
                                  {p.name}
                                </span>
                              </button>
                            </td>
                            {cols.isVisible('brand') && (
                              <td className="px-4 py-2.5 text-muted-ink">
                                {p.brand?.name ?? '—'}
                              </td>
                            )}
                            {cols.isVisible('category') && (
                              <td className="px-4 py-2.5 text-muted-ink">
                                {p.category?.name ?? '—'}
                              </td>
                            )}
                            {cols.isVisible('stock') && (
                              <td className="px-4 py-2.5">
                                <button
                                  type="button"
                                  onClick={() => setMoveProduct(p)}
                                  className={[
                                    'inline-flex items-center gap-1.5 transition-colors hover:text-primary',
                                    outOfStock
                                      ? 'font-semibold text-danger'
                                      : low
                                        ? 'font-medium text-danger'
                                        : 'text-ink',
                                  ].join(' ')}
                                  title="Movimentar estoque"
                                >
                                  {stockLabel(qty, (p as ProductExtra).unit)}
                                  <IconPencil size={13} className="opacity-60" />
                                </button>
                              </td>
                            )}
                            {cols.isVisible('price') && (
                              <td className="px-4 py-2.5 text-right font-medium text-ink">
                                {formatMoney(p.salePrice)}
                              </td>
                            )}
                            {cols.isVisible('commission') && (
                              <td className="px-4 py-2.5 text-right text-muted-ink">
                                {comm != null ? commissionLabel(comm) : '—'}
                              </td>
                            )}
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

                  {/* Rodapé desktop: contagem + paginação. T8: sticky no rodapé do
                      scroll do <main> (fundo sólido) enquanto se rola. */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-card px-4 pt-3 pb-6 text-xs text-muted-ink md:sticky md:bottom-0 md:z-20 md:rounded-b-xl">
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
                </div>
              </>
            )}
          </div>

          {/* ===== Mobile: sem Card wrapper, cards compactos + "Ver mais" ===== */}
          <div className="md:hidden">
            {products.isLoading ? (
              <TableSkeleton variant="mobile" />
            ) : products.isError ? (
              <ErrorState onRetry={() => products.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<IconBox size={32} />}
                title="Nenhum produto encontrado"
                description={
                  hasFilters
                    ? 'Tente ajustar os filtros.'
                    : 'Cadastre seu primeiro produto.'
                }
              />
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-normal text-muted-ink/80">
                    {formatNumber(rows.length)} produto(s)
                  </span>
                  <SortSelect value={sortBy} onChange={setSortBy} />
                </div>
                {/* Cards Belasis: 2 linhas — [avatar] Nome / marca·estoque + preço.
                    ★ é um botão irmão (absolute) para toggle inline sem aninhar <button>. */}
                <ul className="flex flex-col gap-2">
                  {paged.map((p) => {
                    const qty = Number(p.stock);
                    const outOfStock = qty <= 0;
                    const low = !outOfStock && isLow(p);
                    const stock = stockLabel(qty, (p as ProductExtra).unit);
                    const subtitle = p.brand?.name
                      ? `${p.brand.name} · ${stock}`
                      : stock;
                    return (
                      <li key={p.id} className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            sel.selectMode ? sel.toggle(p.id) : setEditing(p)
                          }
                          className={[
                            'flex w-full items-center gap-2.5 rounded-xl border bg-card px-3 py-2 text-left shadow-[var(--shadow-card)] transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_4%,transparent)]',
                            sel.selectMode ? 'pr-3' : 'pr-9',
                            sel.selectMode && sel.isSelected(p.id)
                              ? 'border-primary ring-2 ring-primary/40'
                              : 'border-line',
                          ].join(' ')}
                        >
                          {sel.selectMode && (
                            <AnimatedCheckbox checked={sel.isSelected(p.id)} />
                          )}
                          <Avatar product={p} size={40} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 truncate text-[13px] font-semibold text-primary hover:underline">
                                {p.name}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-baseline justify-between gap-2">
                              <span
                                className={[
                                  'min-w-0 truncate text-[11.5px]',
                                  outOfStock
                                    ? 'font-semibold text-danger'
                                    : low
                                      ? 'font-medium text-danger'
                                      : 'text-muted-ink',
                                ].join(' ')}
                              >
                                {subtitle}
                              </span>
                              <span className="shrink-0 text-[13px] font-semibold tabular-nums text-primary">
                                {formatMoney(p.salePrice)}
                              </span>
                            </div>
                          </div>
                        </button>
                        {!sel.selectMode && (
                          <button
                            type="button"
                            aria-label={
                              p.favorite ? 'Remover dos favoritos' : 'Marcar como favorito'
                            }
                            aria-pressed={p.favorite}
                            disabled={updateProduct.isPending}
                            onClick={() => toggleFavorite(p)}
                            className="absolute right-2 top-2 rounded-full p-1.5 text-muted-ink/50 hover:bg-canvas hover:text-gold disabled:opacity-50"
                          >
                            <IconStar
                              size={16}
                              className={p.favorite ? 'fill-gold text-gold' : ''}
                            />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {/* Mobile: "Ver mais" avança para a próxima página. */}
                {pageCount > 1 && safePage < pageCount && (
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      isDisabled={products.isFetching}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      {products.isFetching ? 'Carregando…' : 'Ver mais'}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      </>
      )}

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
        onDelete={editing ? () => handleDelete(editing) : undefined}
        onMoveStock={editing ? () => setMoveProduct(editing) : undefined}
        deleting={deleteProduct.isPending}
      />
      <StockMovementDrawer
        product={moveProduct}
        onClose={() => setMoveProduct(null)}
      />

      {/* Ações em lote do modo de seleção (bottom-sheet, mobile + desktop). */}
      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
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
  const favLabel = product.favorite ? 'Favorito' : 'Marcar favorito';
  return (
    <div className="flex items-center justify-center gap-1 text-muted-ink">
      <IconTip label={favLabel}>
        <button
          type="button"
          aria-label={favLabel}
          className="rounded p-1 hover:bg-canvas"
        >
          <IconStar
            size={16}
            className={product.favorite ? 'fill-gold text-gold' : 'text-muted-ink/40'}
          />
        </button>
      </IconTip>
      <span className="h-4 w-px bg-line" />
      <IconTip label="Editar produto">
        <button
          type="button"
          aria-label="Editar produto"
          onClick={onEdit}
          className="rounded p-1 hover:bg-canvas hover:text-primary"
        >
          <IconPencil size={16} />
        </button>
      </IconTip>
      <span className="h-4 w-px bg-line" />
      <IconTip label="Excluir produto">
        <button
          type="button"
          aria-label="Excluir produto"
          onClick={onDelete}
          disabled={deleting}
          className="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          <IconTrash size={16} />
        </button>
      </IconTip>
    </div>
  );
}

// Checkbox composto (HeroUI v3) usado nos headers/linhas em modo seleção.
function Check({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <HeroCheckbox isSelected={checked} onChange={onChange} className="shrink-0">
      <HeroCheckbox.Content>
        <HeroCheckbox.Control>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
      </HeroCheckbox.Content>
    </HeroCheckbox>
  );
}

// Belasis: "Ordenando por [Nome ▾]" — texto discreto sempre visível acima da lista.
function SortSelect({
  value,
  onChange,
}: {
  value: SortBy;
  onChange: (v: SortBy) => void;
}) {
  return (
    <label className="relative inline-flex items-center gap-1 text-[12px] text-muted-ink">
      <span>Ordenando por</span>
      <span className="relative inline-flex items-center">
        <span className="pointer-events-none pr-3.5 font-medium text-primary">
          {SORT_LABEL[value]}
        </span>
        <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-[10px] text-primary">
          ▾
        </span>
        <select
          aria-label="Ordenar por"
          value={value}
          onChange={(e) => onChange(e.target.value as SortBy)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          <option value="name">Nome</option>
          <option value="price">Preço</option>
          <option value="stock">Estoque</option>
        </select>
      </span>
    </label>
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
    <FilterCheckbox checked={checked} onToggle={onClick} className="px-1 py-1">
      {children}
    </FilterCheckbox>
  );
}

// ---------------------------------------------------------------------
// Drawer de cadastro/edição de produto
// ---------------------------------------------------------------------

export function ProductDrawer({
  mode,
  product,
  isOpen,
  onClose,
  categories,
  brands,
  onDelete,
  onMoveStock,
  deleting,
}: {
  mode: 'create' | 'edit';
  product?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Option[];
  brands: Option[];
  onDelete?: () => void;
  onMoveStock?: () => void;
  deleting?: boolean;
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
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState('');
  const [active, setActive] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [trackStock, setTrackStock] = useState(true);
  const [exitReason, setExitReason] = useState('unit');
  const [cashbackActive, setCashbackActive] = useState(false);
  const [cashbackType, setCashbackType] = useState<'percent' | 'value'>('percent');
  const [cashbackValue, setCashbackValue] = useState('');
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
    setDefaultCommissionPercent(
      extra?.defaultCommissionPercent != null
        ? String(extra.defaultCommissionPercent)
        : '',
    );
    setActive(product?.active ?? true);
    setFavorite(product?.favorite ?? false);
    // trackStock persiste: carrega do produto (novo produto controla estoque por padrão).
    setTrackStock(product ? Boolean(extra?.trackStock) : true);
    setExitReason(extra?.exitReason ?? 'unit');
    // Cashback: usa os campos novos (active/type/value) com fallback para o
    // legado cashbackPercent para não perder configurações existentes.
    const legacyPercent = product ? Number(product.cashbackPercent) : 0;
    setCashbackActive(
      extra?.cashbackActive != null ? Boolean(extra.cashbackActive) : legacyPercent > 0,
    );
    setCashbackType((extra?.cashbackType as 'percent' | 'value') ?? 'percent');
    setCashbackValue(
      extra?.cashbackValue != null
        ? String(extra.cashbackValue)
        : legacyPercent > 0
          ? String(legacyPercent)
          : '',
    );
    setTab('cadastro');
    setError(null);
  }, [isOpen, product]);

  const pending = create.isPending || update.isPending;
  const canSave =
    name.trim().length >= 2 &&
    !!categoryId &&
    salePrice !== '' &&
    Number(salePrice) >= 0 &&
    !pending;

  async function handleSave() {
    setError(null);
    if (!categoryId) {
      setTab('cadastro');
      setError('Selecione uma categoria para o produto.');
      return;
    }
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
      defaultCommissionPercent:
        defaultCommissionPercent !== ''
          ? Number(defaultCommissionPercent)
          : undefined,
      favorite,
      // Persiste o toggle "Controlar estoque" e o registro de saída.
      trackStock,
      exitReason: exitReason || undefined,
      // Cashback configurável por produto (switch + tipo R$/% + valor).
      cashbackActive,
      cashbackType,
      cashbackValue:
        cashbackActive && cashbackValue !== '' ? Number(cashbackValue) : undefined,
      // Mantém o legado cashbackPercent (coluna da listagem) em sincronia.
      cashbackPercent:
        cashbackActive && cashbackType === 'percent' && cashbackValue !== ''
          ? Number(cashbackValue)
          : 0,
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
    <FullDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === 'edit'
          ? `Editando produto${product ? ` — ${product.name}` : ''}`
          : 'Novo produto'
      }
      widthClass="sm:w-[600px]"
      orientation="vertical"
      sidebarWidth="md:w-[180px]"
      /* Belasis pixel: abas register/settings/cashback ativas + client_return/
         linked_services/electronic_invoice desabilitadas (mesma ordem/labels). */
      sections={[
        { key: 'cadastro', label: 'Cadastro' },
        { key: 'config', label: 'Configurações' },
        { key: 'cashback', label: 'Cashback' },
        { key: 'retorno', label: 'Retorno', disabled: true },
        { key: 'linked', label: 'Serviços vinculados', disabled: true },
        { key: 'invoice', label: 'Configurar nota fiscal', disabled: true },
      ]}
      activeSection={tab}
      onSectionChange={setTab}
      footer={
        <>
          {mode === 'edit' && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting || pending}
              className="mr-auto inline-flex items-center gap-1.5 rounded-md border border-danger/40 bg-danger/5 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <IconTrash size={16} />
              {deleting ? 'Excluindo…' : 'Excluir'}
            </button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={!canSave} onClick={handleSave}>
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      {tab === 'cadastro' && (
        <div className="flex flex-col gap-4">
          <ImageUpload
            value={imageUrl}
            onChange={(url) => {
              setImageUrl(url);
              // Editing an existing product: persist the new image right away
              // so the thumbnail sticks even if the user closes the drawer
              // without pressing "Salvar" (otherwise the uploaded file would
              // be orphaned).
              if (mode === 'edit' && product) {
                update.mutate({ id: product.id, body: { imageUrl: url } });
              }
            }}
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
            <Field
              label={
                <>
                  Categoria <span className="text-danger">*</span>
                </>
              }
            >
              <AutocompleteField
                ariaLabel="Categoria"
                value={categoryId}
                onChange={setCategoryId}
                options={categories}
              />
            </Field>
            <Field label="Marca">
              <AutocompleteField
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

          <section className="flex flex-col gap-3 rounded-md border border-line bg-canvas p-3">
            <h3 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">
              Estoque
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={mode === 'edit' ? 'Estoque' : 'Estoque inicial'}>
                <TextField value={stock} onChange={setStock} aria-label="Estoque">
                  <Input type="number" placeholder="0" />
                </TextField>
                {mode === 'edit' && onMoveStock && (
                  <button
                    type="button"
                    onClick={onMoveStock}
                    className="mt-1 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  >
                    <IconLayers size={13} /> Movimentar estoque
                  </button>
                )}
              </Field>
              <Field
                label={
                  <>
                    Registro de saída <span className="text-danger">*</span>
                  </>
                }
              >
                <Select
                  aria-label="Registro de saída"
                  selectedKey={exitReason}
                  onSelectionChange={(k) => setExitReason(k ? String(k) : 'unit')}
                >
                  <Select.Trigger>
                    <Select.Value>
                      {({ selectedText }) => selectedText}
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {EXIT_REASONS.map((r) => (
                        <ListBox.Item key={r.id} id={r.id} textValue={r.label}>
                          {r.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Uma unidade equivale a">
                <TextField
                  value={unitEquivalence}
                  onChange={setUnitEquivalence}
                  aria-label="Uma unidade equivale a"
                >
                  <Input type="number" placeholder="0" />
                </TextField>
              </Field>
              <Field label="Unidade">
                <TextField value={unit} onChange={setUnit} aria-label="Unidade">
                  <Input placeholder="un, ml, g…" />
                </TextField>
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={
                  <span className="inline-flex items-center">
                    Estoque mínimo
                    <HelpTooltip>
                      Quando o estoque atingir esta quantidade, o produto é
                      sinalizado como estoque baixo na listagem.
                    </HelpTooltip>
                  </span>
                }
              >
                <TextField
                  value={minStock}
                  onChange={setMinStock}
                  aria-label="Estoque mínimo"
                >
                  <Input type="number" placeholder="0" />
                </TextField>
              </Field>
            </div>
          </section>

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

          <Field label="Comissão padrão (%)">
            <TextField
              value={defaultCommissionPercent}
              onChange={setDefaultCommissionPercent}
              aria-label="Comissão padrão"
            >
              <Input type="number" min={0} max={100} step="0.01" placeholder="% 0.0" />
            </TextField>
          </Field>

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

          <Field label="Observações">
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              rows={4}
              placeholder="Anotações internas sobre o produto"
              aria-label="Observações"
              className="w-full resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-ink focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        </div>
      )}

      {tab === 'config' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-md border border-line bg-canvas p-3">
            <SwitchRow label="Favorito" checked={favorite} onChange={setFavorite} />
            <span className="text-xs text-muted-ink">
              Produtos favoritos aparecem no topo da listagem.
            </span>
            <SwitchRow
              label="Controlar estoque"
              checked={trackStock}
              onChange={setTrackStock}
            />
            <span className="text-xs text-muted-ink">
              Quando ativo, o estoque deste produto é movimentado nas vendas.
            </span>
            {mode === 'edit' && (
              <>
                <SwitchRow label="Ativo" checked={active} onChange={setActive} />
                <span className="text-xs text-muted-ink">
                  Um item desativado não será listado nas vendas, mas mantém o histórico.
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'cashback' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs text-muted-ink">
            Essa configuração tem prioridade sobre a configuração geral do módulo de
            cashback. O cliente receberá o valor configurado ao comprar este produto.
          </div>
          <SwitchRow
            label="Ativar cashback neste produto"
            checked={cashbackActive}
            onChange={setCashbackActive}
          />
          {cashbackActive && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo">
                <div className="inline-flex rounded-lg border border-line bg-card p-0.5">
                  {(['percent', 'value'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCashbackType(t)}
                      className={`min-w-[3rem] rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        cashbackType === t
                          ? 'bg-primary text-white'
                          : 'text-muted-ink hover:text-ink'
                      }`}
                    >
                      {t === 'percent' ? '%' : 'R$'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field
                label={cashbackType === 'percent' ? 'Cashback (%)' : 'Cashback (R$)'}
              >
                <TextField
                  value={cashbackValue}
                  onChange={setCashbackValue}
                  aria-label="Cashback"
                >
                  <Input
                    type="number"
                    min={0}
                    max={cashbackType === 'percent' ? 100 : undefined}
                    step="0.01"
                    placeholder={cashbackType === 'percent' ? '0' : 'R$ 0,00'}
                  />
                </TextField>
              </Field>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
    </FullDrawer>
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

// Select unificado com busca (Belasis Categoria/Marca são comboboxes filtráveis).
function AutocompleteField({
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
    <Autocomplete
      aria-label={ariaLabel}
      selectedKey={value || null}
      onSelectionChange={(k) => onChange(k ? String(k) : NONE)}
    >
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? 'Selecione' : selectedText
          }
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter
          filter={(textValue, inputValue) =>
            textValue.toLowerCase().includes(inputValue.trim().toLowerCase())
          }
        >
          <SearchField aria-label={`Buscar ${ariaLabel}`} autoFocus className="mb-1">
            <SearchField.Input placeholder="Buscar" />
          </SearchField>
          <ListBox>
            {options.map((o) => (
              <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
                {o.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">{label}</label>
      {children}
    </div>
  );
}


// ---------------------------------------------------------------------
// Sub-aba "Lotes e validades"
// ---------------------------------------------------------------------

function BatchesSection({
  products,
  drawer,
  onOpenDrawer,
  onCloseDrawer,
  onNewDesktop,
}: {
  products: Product[];
  drawer: { open: boolean; batch: ProductBatch | null };
  onOpenDrawer: (batch: ProductBatch) => void;
  onCloseDrawer: () => void;
  onNewDesktop: () => void;
}) {
  const confirm = useConfirm();
  const batches = useProductBatches();
  const deleteBatch = useDeleteProductBatch();

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [products]);

  const productOptions = useMemo(
    () => products.map((p) => ({ id: p.id, name: p.name })),
    [products],
  );

  const rows = batches.data ?? [];

  async function handleDelete(batch: ProductBatch) {
    const ok = await confirm({
      title: 'Excluir lote?',
      message: `Remover o lote "${batch.code}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await deleteBatch.mutateAsync(batch.id);
  }

  return (
    <div>
      {/* Cabeçalho desktop: botão "Novo lote". */}
      <div className="mb-4 hidden items-center justify-end md:flex">
        <Button variant="primary" onClick={onNewDesktop}>
          <IconPlus size={16} /> Novo lote
        </Button>
      </div>

      {batches.isLoading ? (
        <TableSkeleton columns={6} withCheckbox={false} firstColAvatar={false} />
      ) : batches.isError ? (
        <ErrorState onRetry={() => batches.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconLayers size={32} />}
          title="Nenhum lote cadastrado"
          description="Cadastre lotes com código, fabricação, validade e quantidade."
        />
      ) : (
        <>
          {/* ===== Desktop: tabela ===== */}
          <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                  <th className="px-4 py-3 font-semibold">Produto</th>
                  <th className="px-4 py-3 font-semibold">Código do lote</th>
                  <th className="px-4 py-3 font-semibold">Fabricação</th>
                  <th className="px-4 py-3 font-semibold">Validade</th>
                  <th className="px-4 py-3 text-right font-semibold">Quantidade</th>
                  <th className="px-4 py-3 text-center font-semibold">Status</th>
                  <th className="px-4 py-3 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                  >
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => onOpenDrawer(b)}
                        className="font-medium text-ink hover:text-primary hover:underline"
                      >
                        {productMap.get(b.productId) ?? '—'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-muted-ink">{b.code}</td>
                    <td className="px-4 py-2.5 text-muted-ink">
                      {b.manufacturedAt ? formatDate(b.manufacturedAt) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-ink">
                      {b.expiresAt ? formatDate(b.expiresAt) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right text-ink">
                      {formatNumber(Number(b.quantity))}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={[
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium',
                          b.active
                            ? 'bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary'
                            : 'bg-canvas text-muted-ink',
                        ].join(' ')}
                      >
                        {b.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1 text-muted-ink">
                        <IconTip label="Editar lote">
                          <button
                            type="button"
                            aria-label="Editar lote"
                            onClick={() => onOpenDrawer(b)}
                            className="rounded p-1 hover:bg-canvas hover:text-primary"
                          >
                            <IconPencil size={16} />
                          </button>
                        </IconTip>
                        <span className="h-4 w-px bg-line" />
                        <IconTip label="Excluir lote">
                          <button
                            type="button"
                            aria-label="Excluir lote"
                            onClick={() => handleDelete(b)}
                            disabled={deleteBatch.isPending}
                            className="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
                          >
                            <IconTrash size={16} />
                          </button>
                        </IconTip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ===== Mobile: cards ===== */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onOpenDrawer(b)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2 text-left shadow-[var(--shadow-card)] active:bg-[color-mix(in_oklab,var(--sp-primary)_4%,transparent)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[13px] font-semibold text-ink">
                        {productMap.get(b.productId) ?? 'Produto'}
                      </span>
                      <span className="shrink-0 text-[12px] font-medium text-primary">
                        {b.code}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[11.5px] text-muted-ink">
                      <span className="truncate">
                        {b.expiresAt ? `Val.: ${formatDate(b.expiresAt)}` : 'Sem validade'}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatNumber(Number(b.quantity))}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <ProductBatchDrawer
        isOpen={drawer.open}
        batch={drawer.batch}
        products={productOptions}
        onClose={onCloseDrawer}
      />
    </div>
  );
}

function ProductBatchDrawer({
  isOpen,
  batch,
  products,
  onClose,
}: {
  isOpen: boolean;
  batch: ProductBatch | null;
  products: Option[];
  onClose: () => void;
}) {
  const create = useCreateProductBatch();
  const update = useUpdateProductBatch();
  const [productId, setProductId] = useState('');
  const [code, setCode] = useState('');
  const [manufacturedAt, setManufacturedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [quantity, setQuantity] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mode = batch ? 'edit' : 'create';

  useEffect(() => {
    if (!isOpen) return;
    setProductId(batch?.productId ?? '');
    setCode(batch?.code ?? '');
    setManufacturedAt(toDateInput(batch?.manufacturedAt));
    setExpiresAt(toDateInput(batch?.expiresAt));
    setQuantity(batch ? String(batch.quantity) : '');
    setActive(batch?.active ?? true);
    setError(null);
  }, [isOpen, batch]);

  const pending = create.isPending || update.isPending;
  const canSave = Boolean(productId) && code.trim().length >= 1 && !pending;

  async function handleSave() {
    setError(null);
    const body = {
      code: code.trim(),
      manufacturedAt: manufacturedAt || undefined,
      expiresAt: expiresAt || undefined,
      quantity: quantity !== '' ? Number(quantity) : undefined,
      active,
    };
    try {
      if (mode === 'edit' && batch) {
        await update.mutateAsync({ id: batch.id, body });
      } else {
        await create.mutateAsync({ productId, ...body });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar o lote.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar lote' : 'Novo lote'}
      widthClass="sm:w-[600px]"
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
      <div className="flex flex-col gap-4">
        <Field
          label={
            <>
              Produto <span className="text-danger">*</span>
            </>
          }
        >
          {mode === 'edit' ? (
            <div className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-muted-ink">
              {products.find((p) => p.id === productId)?.name ?? '—'}
            </div>
          ) : (
            <AutocompleteField
              ariaLabel="Produto"
              value={productId}
              onChange={setProductId}
              options={products}
            />
          )}
        </Field>

        <Field
          label={
            <>
              Código do lote <span className="text-danger">*</span>
            </>
          }
        >
          <TextField value={code} onChange={setCode} aria-label="Código do lote">
            <Input placeholder="Ex.: L-2026-001" />
          </TextField>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fabricação">
            <DatePicker value={manufacturedAt} onChange={setManufacturedAt} ariaLabel="Fabricação" />
          </Field>
          <Field label="Validade">
            <DatePicker value={expiresAt} onChange={setExpiresAt} ariaLabel="Validade" />
          </Field>
        </div>

        <Field label="Quantidade">
          <TextField value={quantity} onChange={setQuantity} aria-label="Quantidade">
            <Input type="number" placeholder="0" />
          </TextField>
        </Field>

        <div className="rounded-md border border-line bg-canvas p-3">
          <SwitchRow label="Ativo" checked={active} onChange={setActive} />
        </div>

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </Drawer>
  );
}
