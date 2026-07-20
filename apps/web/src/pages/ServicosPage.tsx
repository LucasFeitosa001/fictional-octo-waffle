import { useEffect, useMemo, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../components/Drawer';
import { ImageGalleryUpload } from '../components/ImageUpload';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconChevron,
  IconDownload,
  IconFilter,
  IconGift,
  IconPencil,
  IconPlus,
  IconScissors,
  IconSearch,
  IconStar,
  IconTrash,
} from '../components/icons';
import {
  useCreateService,
  useDeleteService,
  useServiceCategories,
  useServices,
  useUpdateService,
  type ServiceBody,
  type ServiceRow,
} from '../lib/queries';
import { formatDuration, formatMoney } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { useAutoCreate } from '../lib/useAutoCreate';

const NONE = '';
const PAGE_SIZE = 20;

// color-mix helper para superfícies temáticas derivadas de --sp-primary (100% themeable).
const primaryTint = (pct: number) =>
  `color-mix(in oklab, var(--sp-primary) ${pct}%, transparent)`;

type StatusFilter = 'all' | 'active' | 'inactive';
type FavFilter = 'all' | 'starred' | 'unstarred';

// Belasis mostra a duração na tabela como HH:MM (ex.: 00:05, 02:30).
function formatHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function ServicosPage() {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [favFilter, setFavFilter] = useState<FavFilter>('all');
  const [categorySet, setCategorySet] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  const services = useServices();
  const categories = useServiceCategories();
  const deleteService = useDeleteService();
  const updateService = useUpdateService();

  async function toggleFavorite(s: ServiceRow) {
    await updateService.mutateAsync({ id: s.id, body: { favorite: !s.favorite } });
  }

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories.data ?? []) m.set(c.id, c.name);
    return m;
  }, [categories.data]);

  const allRows = services.data?.data ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q)) &&
        (categorySet.size === 0 || (s.categoryId != null && categorySet.has(s.categoryId))) &&
        (statusFilter === 'all' || (statusFilter === 'active' ? s.active : !s.active)) &&
        (favFilter === 'all' ||
          (favFilter === 'starred' ? Boolean(s.favorite) : !s.favorite)),
    );
  }, [allRows, search, categorySet, statusFilter, favFilter]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = Boolean(
    search || categorySet.size || statusFilter !== 'all' || favFilter !== 'all',
  );

  function resetFilters() {
    setSearch('');
    setCategorySet(new Set());
    setStatusFilter('all');
    setFavFilter('all');
    setPage(1);
  }

  function toggleCategory(id: string) {
    setPage(1);
    setCategorySet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDelete(s: ServiceRow) {
    if (!window.confirm(`Remover o serviço "${s.name}"?`)) return;
    await deleteService.mutateAsync(s.id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(s.id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = pageRows.filter((s) => selected.has(s.id)).map((s) => s.id);
    if (!ids.length) return;
    if (!window.confirm(`Remover ${ids.length} serviço(s) selecionado(s)?`)) return;
    for (const id of ids) await deleteService.mutateAsync(id);
    setSelected(new Set());
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const pageIds = pageRows.map((s) => s.id);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }
  const selectedCount = pageIds.filter((id) => selected.has(id)).length;

  function exportCsv() {
    downloadCsv<ServiceRow>(
      'servicos',
      [
        { header: 'Serviço', value: (s) => s.name },
        { header: 'Categoria', value: (s) => (s.categoryId ? catName.get(s.categoryId) : '') },
        { header: 'Preço', value: (s) => Number(s.price).toFixed(2) },
        { header: 'Duração (min)', value: (s) => s.durationMin },
        { header: 'Mostra no site', value: (s) => (s.onlineBookable ? 'Sim' : 'Não') },
        { header: 'Favorito', value: (s) => (s.favorite ? 'Sim' : 'Não') },
        { header: 'Status', value: (s) => (s.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
  }

  const categoryOptions = (categories.data ?? []).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="pb-6">
      {/* ── Cabeçalho / toolbar (título + Buscar / Filtrar / Novo) ── */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-foreground">Serviços</h2>
        <div className="flex flex-wrap items-center gap-2">
          <ToolbarButton
            active={showSearch}
            onClick={() => setShowSearch((v) => !v)}
            icon={<IconSearch size={16} />}
            label="Buscar"
          />
          <ToolbarButton
            active={showFilters}
            onClick={() => setShowFilters((v) => !v)}
            icon={<IconFilter size={16} />}
            label="Filtrar"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            isDisabled={rows.length === 0}
          >
            <IconDownload size={16} /> Exportar
          </Button>
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </header>

      {/* ── Campo de busca (revelado pelo botão Buscar) ── */}
      {showSearch && (
        <div className="mb-4">
          <TextField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            className="w-full max-w-sm"
            aria-label="Buscar serviço"
          >
            <Input
              placeholder="Buscar serviço…"
              className="focus:border-gold focus:ring-2 focus:ring-gold/25"
            />
          </TextField>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ── Rail de filtros (Status / Favoritos / Categorias) ── */}
        {showFilters && (
          <aside className="w-full shrink-0 rounded-2xl border border-line bg-card p-4 lg:w-60">
            <FilterGroup title="Status">
              <CheckRow
                label="Ativos"
                checked={statusFilter === 'active' || statusFilter === 'all'}
                onChange={(c) =>
                  setStatusFilter(c ? (statusFilter === 'inactive' ? 'all' : 'active') : 'inactive')
                }
              />
              <CheckRow
                label="Inativos"
                checked={statusFilter === 'inactive' || statusFilter === 'all'}
                onChange={(c) =>
                  setStatusFilter(c ? (statusFilter === 'active' ? 'all' : 'inactive') : 'active')
                }
              />
            </FilterGroup>

            <FilterGroup title="Favoritos">
              <CheckRow
                label="Com estrela"
                checked={favFilter === 'starred'}
                onChange={(c) => setFavFilter(c ? 'starred' : 'all')}
              />
              <CheckRow
                label="Sem estrela"
                checked={favFilter === 'unstarred'}
                onChange={(c) => setFavFilter(c ? 'unstarred' : 'all')}
              />
            </FilterGroup>

            <FilterGroup title="Categorias">
              <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
                {categoryOptions.map((c) => (
                  <CheckRow
                    key={c.id}
                    label={c.name}
                    checked={categorySet.has(c.id)}
                    onChange={() => toggleCategory(c.id)}
                  />
                ))}
              </div>
            </FilterGroup>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="mt-3 text-xs font-medium text-gold hover:underline"
              >
                Limpar filtros
              </button>
            )}
          </aside>
        )}

        {/* ── Conteúdo (tabela desktop / cards mobile + paginação) ── */}
        <div className="min-w-0 flex-1">
          {selectedCount > 0 && (
            <div
              className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm text-foreground"
              style={{ background: primaryTint(8) }}
            >
              <span>{selectedCount} selecionado(s)</span>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={deleteService.isPending}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-danger hover:underline disabled:opacity-50"
              >
                <IconTrash size={14} /> Excluir
              </button>
            </div>
          )}

          {services.isLoading ? (
            <LoadingState />
          ) : services.isError ? (
            <ErrorState onRetry={() => services.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconScissors size={32} />}
              title={hasFilters ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
              description={
                hasFilters
                  ? 'Tente ajustar os filtros.'
                  : 'Cadastre serviços com preço, duração e categoria para começar.'
              }
            />
          ) : (
            <>
              {/* Desktop: tabela antd-like */}
              <div className="hidden overflow-hidden rounded-2xl border border-line bg-card sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <th className="w-10 px-3 py-3">
                        <Check checked={allChecked} onChange={toggleSelectAll} />
                      </th>
                      <th className="px-3 py-3 font-semibold">Nome</th>
                      <th className="px-3 py-3 font-semibold">Valor</th>
                      <th className="px-3 py-3 font-semibold">Comissão</th>
                      <th className="px-3 py-3 font-semibold">Duração</th>
                      <th className="px-3 py-3 font-semibold">Categoria</th>
                      <th className="px-3 py-3 font-semibold">Mostra no site</th>
                      <th className="w-28 px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-line last:border-0 transition-colors hover:bg-canvas"
                      >
                        <td className="px-3 py-2.5">
                          <Check
                            checked={selected.has(s.id)}
                            onChange={() => toggleSelected(s.id)}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setEditing(s)}
                            className="flex items-center gap-2.5 text-left"
                          >
                            <Avatar url={s.imageUrl} />
                            <span className="truncate font-medium text-foreground hover:text-gold">
                              {s.name}
                              {Number(s.cashbackPercent) > 0 && (
                                <span className="ml-1 inline-flex items-center gap-0.5 align-middle text-xs text-accent">
                                  <IconGift size={11} /> {Number(s.cashbackPercent)}%
                                </span>
                              )}
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-foreground">
                          {formatMoney(s.price)}
                        </td>
                        {/* TODO: comissão por serviço ainda não existe no modelo de dados. */}
                        <td className="px-3 py-2.5 text-muted-ink">—</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-foreground">
                          {formatHm(s.durationMin)}
                        </td>
                        <td className="px-3 py-2.5">
                          {s.categoryId ? (
                            <span className="truncate text-muted-ink">
                              {catName.get(s.categoryId) ?? '—'}
                            </span>
                          ) : (
                            <span className="text-muted-ink">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-ink">
                          {s.onlineBookable ? 'Sim' : 'Não'}
                        </td>
                        <td className="px-3 py-2.5">
                          <RowActions
                            favorite={Boolean(s.favorite)}
                            onStar={() => toggleFavorite(s)}
                            starDisabled={updateService.isPending}
                            onEdit={() => setEditing(s)}
                            onDelete={() => handleDelete(s)}
                            deleteDisabled={deleteService.isPending}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <ul className="flex flex-col gap-2 sm:hidden">
                {pageRows.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
                  >
                    <Check
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelected(s.id)}
                    />
                    <Avatar url={s.imageUrl} size={44} />
                    <button
                      type="button"
                      onClick={() => setEditing(s)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-foreground">{s.name}</span>
                        <IconStar
                          size={18}
                          className={s.favorite ? 'text-gold' : 'text-muted-ink'}
                        />
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-sm text-muted-ink">
                        <span>{formatMoney(s.price)}</span>
                        <span>{formatDuration(s.durationMin)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Paginação */}
              <Pagination
                total={rows.length}
                page={page}
                pageCount={pageCount}
                onPage={setPage}
              />
            </>
          )}
        </div>
      </div>

      <ServiceDrawer
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categoryOptions}
      />
      <ServiceDrawer
        mode="edit"
        service={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        categories={categoryOptions}
      />
    </div>
  );
}

/* ───────────────────────── UI building blocks ───────────────────────── */

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-gold text-gold'
          : 'border-line text-muted-ink hover:text-foreground'
      }`}
      style={active ? { background: primaryTint(10) } : undefined}
    >
      {icon} {label}
    </button>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <Check checked={checked} onChange={onChange} />
      <span className="truncate">{label}</span>
    </label>
  );
}

function Check({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 shrink-0 cursor-pointer rounded border-line"
      style={{ accentColor: 'var(--sp-primary)' }}
    />
  );
}

function Avatar({ url, size = 32 }: { url?: string | null; size?: number }) {
  const box = { width: size, height: size };
  return url ? (
    <img
      src={url}
      alt=""
      style={box}
      className="shrink-0 rounded-lg object-cover ring-1 ring-line"
    />
  ) : (
    <span
      style={box}
      className="grid shrink-0 place-items-center rounded-lg bg-canvas text-muted-ink ring-1 ring-line"
    >
      <IconScissors size={Math.round(size * 0.5)} />
    </span>
  );
}

function RowActions({
  favorite,
  onStar,
  starDisabled,
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  favorite: boolean;
  onStar: () => void;
  starDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1 text-muted-ink">
      <button
        type="button"
        aria-label={favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
        onClick={onStar}
        disabled={starDisabled}
        className={`rounded p-1 transition-colors disabled:opacity-50 ${
          favorite ? 'text-gold' : 'hover:text-gold'
        }`}
      >
        <IconStar size={16} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden />
      <button
        type="button"
        aria-label="Editar"
        onClick={onEdit}
        className="rounded p-1 transition-colors hover:text-gold"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden />
      <button
        type="button"
        aria-label="Remover"
        onClick={onDelete}
        disabled={deleteDisabled}
        className="rounded p-1 text-danger transition-colors hover:opacity-80 disabled:opacity-50"
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}

function Pagination({
  total,
  page,
  pageCount,
  onPage,
}: {
  total: number;
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  const pages: number[] = [];
  const from = Math.max(1, Math.min(page - 2, pageCount - 4));
  const to = Math.min(pageCount, from + 4);
  for (let i = from; i <= to; i++) pages.push(i);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 text-sm text-muted-ink">
      <span className="mr-auto">{total} no total</span>
      <button
        type="button"
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Página anterior"
        className="grid h-8 w-8 place-items-center rounded-lg border border-line disabled:opacity-40"
      >
        <IconChevron size={16} className="rotate-90" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPage(p)}
          className={`h-8 min-w-8 rounded-lg border px-2 font-medium transition-colors ${
            p === page ? 'border-gold text-gold' : 'border-line hover:text-foreground'
          }`}
          style={p === page ? { background: primaryTint(10) } : undefined}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPage(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        aria-label="Próxima página"
        className="grid h-8 w-8 place-items-center rounded-lg border border-line disabled:opacity-40"
      >
        <IconChevron size={16} className="-rotate-90" />
      </button>
      <span className="ml-1">{PAGE_SIZE} / página</span>
    </div>
  );
}

/* ───────────────────────── Drawer lateral (Novo / Editar) ───────────────────────── */

interface Option {
  id: string;
  name: string;
}

type DrawerTab = 'cadastro' | 'config' | 'cashback';

function ServiceDrawer({
  mode,
  service,
  isOpen,
  onClose,
  categories,
}: {
  mode: 'create' | 'edit';
  service?: ServiceRow | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Option[];
}) {
  const create = useCreateService();
  const update = useUpdateService();
  const [tab, setTab] = useState<DrawerTab>('cadastro');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [additionalCost, setAdditionalCost] = useState('');
  const [durationMin, setDurationMin] = useState('30');
  const [description, setDescription] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [cashbackEnabled, setCashbackEnabled] = useState(false);
  const [cashbackPercent, setCashbackPercent] = useState('');
  const [onlineBookable, setOnlineBookable] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab('cadastro');
    setName(service?.name ?? '');
    setCategoryId(service?.categoryId ?? '');
    setPrice(service ? String(service.price) : '');
    const addCost = (service as { additionalCost?: string | number } | null | undefined)
      ?.additionalCost;
    setAdditionalCost(addCost != null && Number(addCost) > 0 ? String(addCost) : '');
    setDurationMin(service ? String(service.durationMin) : '30');
    setDescription(service?.description ?? '');
    setImageUrls(
      service?.imageUrls?.length
        ? service.imageUrls
        : service?.imageUrl
          ? [service.imageUrl]
          : [],
    );
    const cb = service?.cashbackPercent ? Number(service.cashbackPercent) : 0;
    setCashbackEnabled(cb > 0);
    setCashbackPercent(cb > 0 ? String(cb) : '');
    setOnlineBookable(service?.onlineBookable ?? true);
    setFavorite(service?.favorite ?? false);
    setVisible(service?.visible ?? true);
    setActive(service?.active ?? true);
    setError(null);
  }, [isOpen, service]);

  const pending = create.isPending || update.isPending;
  const canSave =
    name.trim().length >= 2 &&
    price !== '' &&
    Number(price) >= 0 &&
    Number(durationMin) >= 1 &&
    !pending;

  async function handleSave() {
    setError(null);
    const body: ServiceBody & { additionalCost?: number } = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      price: Number(price),
      additionalCost: additionalCost ? Number(additionalCost) : 0,
      durationMin: Number(durationMin),
      description: description.trim() || undefined,
      imageUrls,
      cashbackPercent: cashbackEnabled && cashbackPercent ? Number(cashbackPercent) : 0,
      onlineBookable,
      favorite,
      visible,
    };
    try {
      if (mode === 'edit' && service) {
        await update.mutateAsync({ id: service.id, body: { ...body, active } });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar o serviço.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar serviço' : 'Novo serviço'}
      widthClass="sm:w-[520px]"
      footer={
        <>
          <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            isDisabled={!canSave}
            onClick={handleSave}
          >
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      {/* Abas do drawer (Belasis) */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
        {(
          [
            { id: 'cadastro', label: 'Cadastro' },
            { id: 'config', label: 'Configurações' },
            { id: 'cashback', label: 'Cashback' },
          ] as { id: DrawerTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-gold text-gold'
                : 'border-transparent text-muted-ink hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cadastro' && (
        <div className="flex flex-col gap-4">
          <Field label="Fotos do serviço (opcional)">
            <ImageGalleryUpload value={imageUrls} onChange={setImageUrls} kind="service" max={12} />
          </Field>

          <Field label="Nome">
            <TextField value={name} onChange={setName} aria-label="Nome">
              <Input placeholder="Nome do serviço" />
            </TextField>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria (opcional)">
              <Select
                aria-label="Categoria"
                selectedKey={categoryId || null}
                onSelectionChange={(k) => setCategoryId(k ? String(k) : NONE)}
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
                    {categories.map((c) => (
                      <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                        {c.name}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>
            <Field label="Tipo de preço">
              <div className="flex h-full items-center">
                <span className="rounded-full bg-canvas px-3 py-1 text-xs font-medium text-muted-ink ring-1 ring-line">
                  Preço fixo
                </span>
              </div>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Preço de venda (R$)">
              <TextField value={price} onChange={setPrice} aria-label="Preço de venda">
                <Input type="number" placeholder="0,00" />
              </TextField>
            </Field>
            <Field label="Custo adicional (R$)">
              <TextField
                value={additionalCost}
                onChange={setAdditionalCost}
                aria-label="Custo adicional"
              >
                <Input type="number" placeholder="0,00" />
              </TextField>
            </Field>
          </div>

          <Field label="Duração (min)">
            <TextField value={durationMin} onChange={setDurationMin} aria-label="Duração">
              <Input type="number" placeholder="30" />
            </TextField>
          </Field>

          <Field label="Descrição (opcional)">
            <TextField value={description} onChange={setDescription} aria-label="Descrição">
              <Input placeholder="Detalhes do serviço" />
            </TextField>
            <p className="text-xs text-muted-ink">Esta descrição aparece no agendamento online.</p>
          </Field>
        </div>
      )}

      {tab === 'config' && (
        <div className="flex flex-col gap-3">
          <Toggle label="Agendamento online" checked={onlineBookable} onChange={setOnlineBookable} />
          <Toggle label="Favorito" checked={favorite} onChange={setFavorite} />
          <Toggle label="Visível no catálogo" checked={visible} onChange={setVisible} />
          {mode === 'edit' && <Toggle label="Ativo" checked={active} onChange={setActive} />}
        </div>
      )}

      {tab === 'cashback' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs text-muted-ink">
            O cashback é próprio do serviço e independente da comissão do profissional.
          </div>
          <Toggle
            label="Ativar cashback neste serviço"
            checked={cashbackEnabled}
            onChange={setCashbackEnabled}
          />
          {cashbackEnabled && (
            <Field label="Cashback (%)">
              <TextField
                value={cashbackPercent}
                onChange={setCashbackPercent}
                aria-label="Cashback"
              >
                <Input type="number" placeholder="0" />
              </TextField>
            </Field>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
    </Drawer>
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
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Check checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
