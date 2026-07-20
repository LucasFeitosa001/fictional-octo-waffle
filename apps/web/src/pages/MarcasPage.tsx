import { useEffect, useMemo, useState } from 'react';
import { Button, Input, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../components/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevron,
  IconFilter,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
} from '../components/icons';
import { formatNumber } from '../lib/format';
import {
  useBrands,
  useCreateBrand,
  useDeleteBrand,
  useUpdateBrand,
  type Brand,
} from '../lib/queries/catalogo';

type ProductFilter = 'all' | 'with' | 'without';

const PAGE_SIZE = 20;

function itemsLabel(count: number) {
  if (count <= 0) return 'Nenhum item associado';
  return `Possui ${formatNumber(count)} ${count === 1 ? 'item associado' : 'itens associados'}`;
}

export function MarcasPage() {
  const brands = useBrands();
  const deleteBrand = useDeleteBrand();

  const [editing, setEditing] = useState<Brand | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);

  const allRows = brands.data ?? [];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = allRows.filter((b) => {
      const count = b.productCount ?? 0;
      if (productFilter === 'with' && count === 0) return false;
      if (productFilter === 'without' && count > 0) return false;
      if (term && !b.name.toLowerCase().includes(term)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      return sortAsc ? cmp : -cmp;
    });
  }, [allRows, search, productFilter, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, productFilter, sortAsc]);

  const activeFilterCount = productFilter !== 'all' ? 1 : 0;
  const hasFilters = Boolean(search.trim()) || activeFilterCount > 0;

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setProductFilter('all');
  }

  async function handleDelete(brand: Brand) {
    setMessage(null);
    if (!window.confirm(`Remover a marca "${brand.name}"?`)) return;
    try {
      await deleteBrand.mutateAsync(brand.id);
    } catch (err) {
      setMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível excluir a marca.',
      );
    }
  }

  return (
    <div className="pb-10">
      {/* Cabeçalho: título + Buscar / Filtrar / Novo (igual Belasis) */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Marcas</h1>
        <div className="flex flex-wrap items-center gap-2">
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
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </header>

      {message && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {message}
        </div>
      )}

      {/* Barra de busca (toggle) */}
      {searchOpen && (
        <div className="mb-4 flex max-w-xl items-center gap-2">
          <TextField
            value={searchInput}
            onChange={setSearchInput}
            className="min-w-0 flex-1"
            aria-label="Buscar marca"
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

            <FilterGroup title="Produtos">
              <CheckRow
                checked={productFilter === 'all'}
                onClick={() => setProductFilter('all')}
              >
                Todas
              </CheckRow>
              <CheckRow
                checked={productFilter === 'with'}
                onClick={() => setProductFilter('with')}
              >
                Com produtos
              </CheckRow>
              <CheckRow
                checked={productFilter === 'without'}
                onClick={() => setProductFilter('without')}
              >
                Sem produtos
              </CheckRow>
            </FilterGroup>
          </aside>
        )}

        {/* Conteúdo principal: tabela / cards */}
        <div className="min-w-0 flex-1">
          {brands.isLoading ? (
            <LoadingState />
          ) : brands.isError ? (
            <ErrorState onRetry={() => brands.refetch()} />
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
              <EmptyState
                icon={<IconTag size={32} />}
                title={
                  hasFilters
                    ? 'Nenhuma marca encontrada'
                    : 'Nenhuma marca cadastrada'
                }
                description={
                  hasFilters
                    ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                    : 'Cadastre marcas para classificar seus produtos.'
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={clearAll}>
                      Limpar filtros
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      <IconPlus size={16} /> Nova marca
                    </Button>
                  )
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
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => setSortAsc((v) => !v)}
                          className="inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-primary"
                          title="Ordenar por nome"
                        >
                          Nome
                          {sortAsc ? (
                            <IconArrowUp size={13} className="text-primary" />
                          ) : (
                            <IconArrowDown size={13} className="text-primary" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 font-semibold">Itens</th>
                      <th className="px-4 py-3 text-center font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((b) => {
                      const count = b.productCount ?? 0;
                      return (
                        <tr
                          key={b.id}
                          className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                        >
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setEditing(b)}
                              title={b.name}
                              className="block w-full truncate text-left font-medium text-ink transition-colors hover:text-primary"
                            >
                              {b.name}
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setEditing(b)}
                              className={[
                                'text-left transition-colors hover:text-primary',
                                count > 0 ? 'text-ink' : 'text-muted-ink',
                              ].join(' ')}
                            >
                              {itemsLabel(count)}
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <RowActions
                              onEdit={() => setEditing(b)}
                              onDelete={() => handleDelete(b)}
                              deleting={deleteBrand.isPending}
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
                {paged.map((b) => {
                  const count = b.productCount ?? 0;
                  return (
                    <li
                      key={b.id}
                      className="rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-card)]"
                    >
                      <button
                        type="button"
                        onClick={() => setEditing(b)}
                        className="block w-full text-left"
                      >
                        <span className="block min-w-0 truncate font-medium text-ink">
                          {b.name}
                        </span>
                        <span
                          className={[
                            'mt-0.5 block text-xs',
                            count > 0 ? 'text-muted-ink' : 'text-muted-ink/70',
                          ].join(' ')}
                        >
                          {itemsLabel(count)}
                        </span>
                      </button>
                      <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-line/60 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Editar"
                          onClick={() => setEditing(b)}
                        >
                          <IconPencil size={14} /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Remover"
                          className="text-danger"
                          isDisabled={deleteBrand.isPending}
                          onClick={() => handleDelete(b)}
                        >
                          <IconTrash size={14} />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Rodapé: paginação numerada (igual Belasis) */}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-ink">
                <span className="mr-auto">
                  {hasFilters
                    ? `${formatNumber(rows.length)} de ${formatNumber(allRows.length)} marca(s)`
                    : `${formatNumber(allRows.length)} no total`}
                </span>
                <Pagination
                  page={safePage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawers laterais (Novo / Editar) — deslizam da direita, igual Belasis */}
      <BrandDrawer
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <BrandDrawer
        mode="edit"
        brand={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Subcomponentes de apresentação
// ---------------------------------------------------------------------

function RowActions({
  onEdit,
  onDelete,
  deleting,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1 text-muted-ink">
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

function pageItems(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push('…');
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < total - 1) items.push('…');
  items.push(total);
  return items;
}

function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const arrow =
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-card text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <nav className="flex items-center gap-1" aria-label="Paginação">
      <button
        type="button"
        aria-label="Página anterior"
        className={arrow}
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
      >
        <IconChevron size={15} className="rotate-90" />
      </button>
      {pageItems(page, pageCount).map((it, i) =>
        it === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-muted-ink">
            …
          </span>
        ) : (
          <button
            key={it}
            type="button"
            aria-current={it === page ? 'page' : undefined}
            onClick={() => onChange(it)}
            className={[
              'inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors',
              it === page
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-line bg-card text-ink hover:bg-canvas',
            ].join(' ')}
          >
            {it}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Próxima página"
        className={arrow}
        disabled={page >= pageCount}
        onClick={() => onChange(Math.min(pageCount, page + 1))}
      >
        <IconChevron size={15} className="-rotate-90" />
      </button>
    </nav>
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

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
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
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-line bg-card',
        ].join(' ')}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Drawer lateral de cadastro/edição de marca
// ---------------------------------------------------------------------

function BrandDrawer({
  mode,
  brand,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  brand?: Brand | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateBrand();
  const update = useUpdateBrand();
  const [name, setName] = useState('');
  // "Ativo" existe no drawer do Belasis; a API de marcas ainda não persiste o
  // campo, então mantemos como estado local de apresentação.
  // TODO: enviar `active` quando o backend de /brands suportar.
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(brand?.name ?? '');
      setActive(true);
      setError(null);
    }
  }, [isOpen, brand]);

  const pending = create.isPending || update.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  async function handleSave() {
    setError(null);
    try {
      if (mode === 'edit' && brand) {
        await update.mutateAsync({ id: brand.id, body: { name: name.trim() } });
      } else {
        await create.mutateAsync({ name: name.trim() });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar a marca.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar marca' : 'Nova marca'}
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
        <Field label="Nome" required>
          <TextField value={name} onChange={setName} aria-label="Nome">
            <Input
              placeholder="Nome"
              className="focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </TextField>
        </Field>

        <div className="flex items-center justify-between rounded-md border border-line bg-canvas p-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink">Ativo</span>
            <span className="text-xs text-muted-ink">
              Marcas inativas ficam ocultas nos cadastros.
            </span>
          </div>
          <Switch checked={active} onChange={setActive} label="Ativo" />
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">
        {required && <span className="mr-0.5 text-danger">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-primary' : 'bg-[color-mix(in_oklab,var(--sp-ink)_20%,transparent)]',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );
}
