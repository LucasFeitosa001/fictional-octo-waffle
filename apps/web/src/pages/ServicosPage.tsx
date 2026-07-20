import { useEffect, useMemo, useState } from "react";
import { Button, Input, ListBox, Select, TextField } from "@heroui/react";
import { ApiClientError } from "@beautypass/shared";
import { Drawer } from "../components/Drawer";
import { FullDrawer } from "../components/FullDrawer";
import { ImageUpload } from "../components/ImageUpload";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import {
  IconChevron,
  IconCircleCheck,
  IconFilter,
  IconPencil,
  IconPlus,
  IconScissors,
  IconSearch,
  IconSettings,
  IconStar,
  IconTrash,
} from "../components/icons";
import {
  useCreateService,
  useDeleteService,
  useServiceCategories,
  useServices,
  useUpdateService,
  type ServiceBody,
  type ServiceRow,
} from "../lib/queries";
import { formatMoney } from "../lib/format";
import { useAutoCreate } from "../lib/useAutoCreate";
import { useSetPageActions } from "../layout/PageActions";
import { useConfirm } from "../components/ConfirmDialog";

const NONE = "";
const PAGE_SIZE = 20;

// color-mix helper para superfícies temáticas derivadas de --sp-primary (100% themeable).
const primaryTint = (pct: number) =>
  `color-mix(in oklab, var(--sp-primary) ${pct}%, transparent)`;

type StatusFilter = "all" | "active" | "inactive";
type FavFilter = "all" | "starred" | "unstarred";
// Belasis torna ordenáveis: Nome, Valor, Comissão, Duração, Mostra no site.
// Categoria NÃO é ordenável (sem seta no header capturado).
type SortKey = "name" | "price" | "commission" | "duration" | "site";

type ServiceBelasisFields = ServiceRow & {
  additionalCost?: string | number | null;
  commission?: string | number | null;
  commissionPercent?: string | number | null;
};

// Belasis mostra a duração na tabela como HH:MM (ex.: 00:05, 02:30).
function formatHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatMobileDuration(min: number): string {
  return min < 60 ? `${min} min` : `${formatHm(min)} h`;
}

function commissionOf(service: ServiceRow): number | null {
  const extra = service as ServiceBelasisFields;
  const raw = extra.commissionPercent ?? extra.commission;
  return raw == null || raw === "" ? null : Number(raw);
}

function formatPercent(value: number | null): string {
  const normalized = value == null || Number.isNaN(value) ? 0 : value;
  return `% ${normalized.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ServicosPage() {
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [favFilter, setFavFilter] = useState<FavFilter>("all");
  const [categorySet, setCategorySet] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  useAutoCreate(() => setCreateOpen(true));
  const confirm = useConfirm();

  const services = useServices();
  const categories = useServiceCategories();
  const deleteService = useDeleteService();
  const updateService = useUpdateService();

  async function toggleFavorite(s: ServiceRow) {
    await updateService.mutateAsync({
      id: s.id,
      body: { favorite: !s.favorite },
    });
  }

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories.data ?? []) m.set(c.id, c.name);
    return m;
  }, [categories.data]);

  const allRows = services.data?.data ?? [];

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows
      .filter(
        (s) =>
          (!q || s.name.toLowerCase().includes(q)) &&
          (categorySet.size === 0 ||
            (s.categoryId != null && categorySet.has(s.categoryId))) &&
          (statusFilter === "all" ||
            (statusFilter === "active" ? s.active : !s.active)) &&
          (favFilter === "all" ||
            (favFilter === "starred" ? Boolean(s.favorite) : !s.favorite)),
      )
      .sort((a, b) => {
        let compared: number;
        switch (sortKey) {
          case "price":
            compared = Number(a.price) - Number(b.price);
            break;
          case "commission":
            compared = (commissionOf(a) ?? 0) - (commissionOf(b) ?? 0);
            break;
          case "duration":
            compared = a.durationMin - b.durationMin;
            break;
          case "site":
            compared =
              Number(Boolean(a.visible ?? a.onlineBookable)) -
              Number(Boolean(b.visible ?? b.onlineBookable));
            break;
          default:
            compared = a.name.localeCompare(b.name, "pt-BR", {
              sensitivity: "base",
            });
        }
        // Empate estável por nome (mesma quebra que o antd usa por índice).
        if (compared === 0) {
          compared = a.name.localeCompare(b.name, "pt-BR", {
            sensitivity: "base",
          });
        }
        return sortAsc ? compared : -compared;
      });
  }, [allRows, search, categorySet, statusFilter, favFilter, sortAsc, sortKey]);

  function toggleSort(key: SortKey) {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortAsc((asc) => !asc);
        return prevKey;
      }
      setSortAsc(true);
      return key;
    });
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = Boolean(
    search ||
    categorySet.size ||
    statusFilter !== "active" ||
    favFilter !== "all",
  );

  function resetFilters() {
    setSearch("");
    setCategorySet(new Set());
    setStatusFilter("active");
    setFavFilter("all");
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
    const ok = await confirm({
      title: "Excluir serviço?",
      message: `Remover o serviço "${s.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    await deleteService.mutateAsync(s.id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(s.id);
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = rows.filter((s) => selected.has(s.id)).map((s) => s.id);
    if (!ids.length) return;
    const ok = await confirm({
      title: "Excluir serviços?",
      message: `Remover ${ids.length} serviço(s) selecionado(s)? Essa ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
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
  const allChecked =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }
  const selectedCount = rows.filter((row) => selected.has(row.id)).length;

  function toggleSelectAllRows() {
    const rowIds = rows.map((row) => row.id);
    const allRowsChecked =
      rowIds.length > 0 && rowIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allRowsChecked) rowIds.forEach((id) => next.delete(id));
      else rowIds.forEach((id) => next.add(id));
      return next;
    });
  }

  const categoryOptions = useMemo(
    () =>
      (categories.data ?? []).map((category) => ({
        id: category.id,
        name: category.name,
      })),
    [categories.data],
  );

  useSetPageActions(
    [
      {
        key: "filters",
        label: "Filtros",
        icon: <IconFilter size={22} />,
        onClick: () => setMobileFiltersOpen(true),
      },
      {
        key: "select",
        label: "Selecionar",
        icon: <IconCircleCheck size={22} />,
        onClick: toggleSelectAllRows,
        disabled: rows.length === 0,
      },
      {
        key: "create",
        label: "Criar",
        icon: <IconPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
    ],
    [rows, selected],
  );

  const filterControls = (
    <>
      <FilterGroup title="Status">
        <CheckRow
          label="Ativos"
          checked={statusFilter === "active" || statusFilter === "all"}
          onChange={(checked) =>
            setStatusFilter(
              checked
                ? statusFilter === "inactive"
                  ? "all"
                  : "active"
                : "inactive",
            )
          }
        />
        <CheckRow
          label="Inativos"
          checked={statusFilter === "inactive" || statusFilter === "all"}
          onChange={(checked) =>
            setStatusFilter(
              checked
                ? statusFilter === "active"
                  ? "all"
                  : "inactive"
                : "active",
            )
          }
        />
      </FilterGroup>

      <FilterGroup title="Favoritos">
        <CheckRow
          label="Com estrela"
          checked={favFilter === "starred"}
          onChange={(checked) => setFavFilter(checked ? "starred" : "all")}
        />
        <CheckRow
          label="Sem estrela"
          checked={favFilter === "unstarred"}
          onChange={(checked) => setFavFilter(checked ? "unstarred" : "all")}
        />
      </FilterGroup>

      <FilterGroup title="Categorias">
        <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
          <CheckRow
            label="Selecionar tudo"
            checked={
              categoryOptions.length > 0 &&
              categorySet.size === categoryOptions.length
            }
            onChange={(checked) => {
              setCategorySet(
                checked
                  ? new Set(categoryOptions.map((category) => category.id))
                  : new Set(),
              );
              setPage(1);
            }}
          />
          {categoryOptions.map((category) => (
            <CheckRow
              key={category.id}
              label={category.name}
              checked={categorySet.has(category.id)}
              onChange={() => toggleCategory(category.id)}
            />
          ))}
        </div>
      </FilterGroup>

      {hasFilters && (
        <button
          type="button"
          onClick={resetFilters}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          Limpar filtros
        </button>
      )}
    </>
  );

  return (
    <div className="pb-6 lg:pb-0">
      {/* ── Cabeçalho / toolbar (título + Buscar / Filtrar / Novo) ── */}
      <header className="mb-4 hidden flex-wrap items-center justify-between gap-3 lg:flex">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-ink">Serviços</h1>
          <button
            type="button"
            aria-label="Ver tutorial de serviços"
            title="Ver tutorial"
            className="grid h-7 w-7 place-items-center text-muted-ink transition-colors hover:text-primary"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="m10 8 6 4-6 4V8Z" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Ajuda sobre serviços"
            title="Ajuda"
            className="grid h-7 w-7 place-items-center text-muted-ink transition-colors hover:text-primary"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .65-1.5 1.15-1.5 2.5" />
              <path d="M12 17h.01" />
            </svg>
          </button>
        </div>
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
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </header>

      {/* O Belasis mantém título e busca sempre visíveis no catálogo móvel. */}
      <section className="mb-3 lg:hidden">
        <h1 className="mb-3 text-lg font-semibold text-ink">Serviços</h1>
        <label className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink">
            <IconSearch size={18} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar serviço"
            aria-label="Buscar serviço"
            className="h-11 w-full rounded-lg border border-line bg-card pl-10 pr-3 text-sm text-ink outline-none placeholder:text-muted-ink focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </section>

      {/* ── Campo de busca (revelado pelo botão Buscar) ── */}
      {showSearch && (
        <div className="mb-4 hidden lg:block">
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
          <aside className="hidden w-60 shrink-0 rounded-xl border border-line bg-card p-4 shadow-[var(--shadow-card)] lg:block">
            {filterControls}
          </aside>
        )}

        {/* ── Conteúdo (tabela desktop / cards mobile + paginação) ── */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={() => toggleSort("name")}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
              aria-label="Alternar ordenação por nome"
            >
              Ordenando por Nome
              <IconChevron
                size={12}
                className={sortKey === "name" && !sortAsc ? "rotate-180" : ""}
              />
            </button>
          </div>

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
            <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
              <EmptyState
                icon={<IconScissors size={32} />}
                title={
                  hasFilters
                    ? "Nenhum serviço encontrado"
                    : "Nenhum serviço cadastrado"
                }
                description={
                  hasFilters
                    ? "Tente ajustar os filtros."
                    : "Cadastre serviços com preço, duração e categoria para começar."
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop: tabela antd-like */}
              <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] lg:block">
                <table className="w-full table-fixed border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-left text-sm font-semibold text-muted-ink">
                      <th className="w-10 px-3 py-3.5">
                        <Check
                          checked={allChecked}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <SortableTh
                        className="w-[28%]"
                        label="Nome"
                        sortKey="name"
                        activeKey={sortKey}
                        asc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortableTh
                        className="w-[12%]"
                        align="right"
                        label="Valor"
                        sortKey="price"
                        activeKey={sortKey}
                        asc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortableTh
                        className="w-[12%]"
                        align="right"
                        label="Comissão"
                        sortKey="commission"
                        activeKey={sortKey}
                        asc={sortAsc}
                        onSort={toggleSort}
                      />
                      <SortableTh
                        className="w-[10%]"
                        label="Duração"
                        sortKey="duration"
                        activeKey={sortKey}
                        asc={sortAsc}
                        onSort={toggleSort}
                      />
                      <th className="w-[16%] px-3 py-3.5 font-semibold">
                        Categoria
                      </th>
                      <SortableTh
                        className="w-[11%]"
                        align="center"
                        label="Mostra no site"
                        sortKey="site"
                        activeKey={sortKey}
                        asc={sortAsc}
                        onSort={toggleSort}
                      />
                      <th className="w-[114px] px-3 py-3.5 text-right">
                        <span className="inline-grid h-7 w-7 place-items-center text-muted-ink">
                          <IconSettings size={16} />
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-line/70 last:border-0 transition-colors hover:bg-canvas"
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
                            className="flex w-full items-center gap-2 text-left"
                          >
                            <Avatar url={s.imageUrl} />
                            <span className="truncate font-medium text-primary hover:underline">
                              {s.name}
                            </span>
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink">
                          {formatMoney(s.price)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-ink">
                          {formatPercent(commissionOf(s))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-ink">
                          {formatHm(s.durationMin)}
                        </td>
                        <td className="px-3 py-2.5">
                          {s.categoryId ? (
                            <span className="truncate text-muted-ink">
                              {catName.get(s.categoryId) ?? "—"}
                            </span>
                          ) : (
                            <span className="text-muted-ink">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center text-muted-ink">
                          {(s.visible ?? s.onlineBookable) ? "Sim" : "Não"}
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
                <Pagination
                  total={rows.length}
                  page={page}
                  pageCount={pageCount}
                  onPage={setPage}
                />
              </div>

              {/* Mobile: cards */}
              <ul className="flex flex-col gap-2 lg:hidden">
                {rows.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-card)]"
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
                        <span className="truncate font-medium text-foreground">
                          {s.name}
                        </span>
                        <IconStar
                          size={18}
                          className={
                            s.favorite ? "text-gold" : "text-muted-ink"
                          }
                        />
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-sm text-muted-ink">
                        <span>{formatMoney(s.price)}</span>
                        <span>{formatMobileDuration(s.durationMin)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <Drawer
        isOpen={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="Filtros"
        placement="bottom"
        footer={
          <>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                resetFilters();
                setMobileFiltersOpen(false);
              }}
            >
              Limpar
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => setMobileFiltersOpen(false)}
            >
              Aplicar
            </Button>
          </>
        }
      >
        {filterControls}
      </Drawer>

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
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-medium text-muted-ink transition-colors hover:border-primary hover:text-primary"
    >
      {icon} {label}
    </button>
  );
}

// Cabeçalho ordenável estilo antd: rótulo + par de setas (▲▼) com a direção
// ativa destacada em --sp-primary. Belasis usa este controle em cada coluna.
function SortableTh({
  className,
  label,
  sortKey,
  activeKey,
  asc,
  onSort,
  align = "left",
}: {
  className: string;
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  asc: boolean;
  onSort: (key: SortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const active = activeKey === sortKey;
  const justify =
    align === "right"
      ? "justify-end"
      : align === "center"
        ? "justify-center"
        : "justify-start";
  return (
    <th className={`${className} px-3 py-3.5 font-semibold`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Ordenar por ${label}`}
        className={`inline-flex w-full items-center gap-1.5 ${justify} transition-colors hover:text-primary ${
          active ? "text-primary" : ""
        }`}
      >
        {label}
        <SortIcon direction={active ? (asc ? "asc" : "desc") : null} />
      </button>
    </th>
  );
}

function SortIcon({ direction }: { direction: "asc" | "desc" | null }) {
  const idle = "var(--sp-muted-ink, currentColor)";
  const on = "var(--sp-primary)";
  return (
    <span className="inline-flex flex-col leading-[0]" aria-hidden>
      <svg width="8" height="5" viewBox="0 0 8 5" className="-mb-px">
        <path
          d="M4 0 8 5H0z"
          fill={direction === "asc" ? on : idle}
          opacity={direction === "asc" ? 1 : 0.45}
        />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5">
        <path
          d="M4 5 0 0h8z"
          fill={direction === "desc" ? on : idle}
          opacity={direction === "desc" ? 1 : 0.45}
        />
      </svg>
    </span>
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
      <p className="mb-2 text-sm font-semibold text-ink">{title}</p>
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
      style={{ accentColor: "var(--sp-primary)" }}
    />
  );
}

function Avatar({ url, size = 24 }: { url?: string | null; size?: number }) {
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
        aria-label={favorite ? "Remover dos favoritos" : "Marcar como favorito"}
        onClick={onStar}
        disabled={starDisabled}
        className={`rounded p-1 transition-colors disabled:opacity-50 ${
          favorite ? "text-gold" : "hover:text-gold"
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
  const [jumpPage, setJumpPage] = useState("");
  const pages: number[] = [];
  const from = Math.max(1, Math.min(page - 2, pageCount - 4));
  const to = Math.min(pageCount, from + 4);
  for (let i = from; i <= to; i++) pages.push(i);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-card px-3 py-3 text-sm text-muted-ink">
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
            p === page
              ? "border-primary text-primary"
              : "border-line hover:text-foreground"
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
      <span className="ml-1 rounded-md border border-line bg-card px-2.5 py-1.5">
        {PAGE_SIZE} / página
      </span>
      <label className="ml-1 inline-flex items-center gap-1.5 whitespace-nowrap">
        Vá até
        <input
          type="number"
          min={1}
          max={pageCount}
          value={jumpPage}
          onChange={(event) => setJumpPage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            const requested = Number(jumpPage);
            if (Number.isFinite(requested)) {
              onPage(Math.max(1, Math.min(pageCount, Math.floor(requested))));
              setJumpPage("");
            }
          }}
          aria-label="Página"
          className="h-8 w-12 rounded-md border border-line bg-card px-1.5 text-center text-ink outline-none focus:border-primary"
        />
        Página
      </label>
    </div>
  );
}

/* ───────────────────────── Drawer lateral (Novo / Editar) ───────────────────────── */

interface Option {
  id: string;
  name: string;
}

type DrawerTab =
  | "cadastro"
  | "config"
  | "cashback"
  | "cuidados"
  | "retorno"
  | "comissoes"
  | "personalizar"
  | "produtos"
  | "nota-fiscal";

const drawerTabs: { id: DrawerTab; label: string; available: boolean }[] = [
  { id: "cadastro", label: "Cadastro", available: true },
  { id: "config", label: "Configurações", available: true },
  { id: "cashback", label: "Cashback", available: true },
  { id: "cuidados", label: "Cuidados", available: false },
  { id: "retorno", label: "Retorno", available: false },
  { id: "comissoes", label: "Comissões e Auxiliares", available: false },
  { id: "personalizar", label: "Personalizar", available: false },
  { id: "produtos", label: "Produtos consumidos", available: false },
  { id: "nota-fiscal", label: "Configurar nota fiscal", available: false },
];

const durationOptions = [
  5, 10, 15, 20, 30, 40, 45, 60, 70, 90, 120, 150, 180, 240,
];

function durationOptionLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return `${formatHm(minutes)} h`;
}

function ServiceDrawer({
  mode,
  service,
  isOpen,
  onClose,
  categories,
}: {
  mode: "create" | "edit";
  service?: ServiceRow | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Option[];
}) {
  const create = useCreateService();
  const update = useUpdateService();
  const [tab, setTab] = useState<DrawerTab>("cadastro");
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [additionalCost, setAdditionalCost] = useState("");
  const [commission, setCommission] = useState("");
  const [durationMin, setDurationMin] = useState("15");
  const [description, setDescription] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [cashbackEnabled, setCashbackEnabled] = useState(false);
  const [cashbackPercent, setCashbackPercent] = useState("");
  const [onlineBookable, setOnlineBookable] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab("cadastro");
    setName(service?.name ?? "");
    setCategoryId(service?.categoryId ?? categories[0]?.id ?? "");
    setPrice(service ? String(service.price) : "");
    const addCost = (service as ServiceBelasisFields | null | undefined)
      ?.additionalCost;
    setAdditionalCost(
      addCost != null && Number(addCost) > 0 ? String(addCost) : "",
    );
    const serviceCommission = service ? commissionOf(service) : null;
    setCommission(serviceCommission == null ? "" : String(serviceCommission));
    setDurationMin(service ? String(service.durationMin) : "15");
    setDescription(service?.description ?? "");
    setImageUrls(
      service?.imageUrls?.length
        ? service.imageUrls
        : service?.imageUrl
          ? [service.imageUrl]
          : [],
    );
    const cb = service?.cashbackPercent ? Number(service.cashbackPercent) : 0;
    setCashbackEnabled(cb > 0);
    setCashbackPercent(cb > 0 ? String(cb) : "");
    setOnlineBookable(service?.onlineBookable ?? true);
    setFavorite(service?.favorite ?? false);
    setVisible(service?.visible ?? true);
    setActive(service?.active ?? true);
    setError(null);
  }, [isOpen, service, categories]);

  const pending = create.isPending || update.isPending;
  const selectedDuration = Number(durationMin);
  const availableDurations = durationOptions.includes(selectedDuration)
    ? durationOptions
    : [...durationOptions, selectedDuration]
        .filter((minutes) => Number.isFinite(minutes) && minutes > 0)
        .sort((a, b) => a - b);
  const canSave =
    name.trim().length >= 2 &&
    categoryId !== "" &&
    price !== "" &&
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
      cashbackPercent:
        cashbackEnabled && cashbackPercent ? Number(cashbackPercent) : 0,
      onlineBookable,
      favorite,
      visible,
    };
    try {
      if (mode === "edit" && service) {
        await update.mutateAsync({ id: service.id, body: { ...body, active } });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Não foi possível salvar o serviço.",
      );
    }
  }

  // Belasis: drawer quase fullscreen (1200px) com menu vertical de seções.
  // Seções sem implementação ficam desabilitadas mas visíveis (paridade visual).
  const sections = drawerTabs.map((item) => ({
    key: item.id,
    label: item.label,
    disabled: !item.available,
  }));
  const title =
    mode === "edit"
      ? `Editando serviço${service?.name ? ` — ${service.name}` : ""}`
      : "Novo serviço";

  return (
    <FullDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      sections={sections}
      activeSection={tab}
      onSectionChange={(key) => setTab(key as DrawerTab)}
      footer={
        <>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            isDisabled={!canSave}
            onClick={handleSave}
          >
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      {tab === "cadastro" && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-center py-1">
            <ImageUpload
              value={imageUrls[0] ?? null}
              onChange={(url) =>
                setImageUrls((current) =>
                  url ? [url, ...current.slice(1)] : current.slice(1),
                )
              }
              kind="service"
              shape="square"
              size={120}
              placeholder="Foto"
            />
          </div>

          <Field label="Nome" required>
            <TextField value={name} onChange={setName} aria-label="Nome">
              <Input placeholder="Informe o nome" />
            </TextField>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria" required>
              <Select
                aria-label="Categoria"
                selectedKey={categoryId || null}
                onSelectionChange={(k) =>
                  setCategoryId(k ? String(k) : NONE)
                }
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ isPlaceholder, selectedText }) =>
                      isPlaceholder ? "Selecione" : selectedText
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
            <Field label="Preço de venda">
              <div className="flex min-w-0 items-stretch">
                <span className="inline-flex shrink-0 items-center gap-2 rounded-l-lg border border-r-0 border-line bg-canvas px-3 text-sm text-muted-ink">
                  Preço fixo
                  <IconChevron size={12} />
                </span>
                <TextField
                  value={price}
                  onChange={setPrice}
                  aria-label="Preço de venda"
                  className="min-w-0 flex-1"
                >
                  <Input
                    type="number"
                    min="0"
                    placeholder="R$ 0,00"
                    className="rounded-l-none"
                  />
                </TextField>
              </div>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Custo adicional" info>
              <div className="flex min-w-0 items-stretch">
                <span className="inline-flex items-center gap-2 rounded-l-lg border border-r-0 border-line bg-canvas px-3 text-sm text-muted-ink">
                  R$
                  <IconChevron size={12} />
                </span>
                <TextField
                  value={additionalCost}
                  onChange={setAdditionalCost}
                  aria-label="Custo adicional"
                  className="min-w-0 flex-1"
                >
                  <Input
                    type="number"
                    min="0"
                    placeholder="0,00"
                    className="rounded-l-none"
                  />
                </TextField>
              </div>
            </Field>
            <Field label="Comissão" info>
              <TextField
                value={commission}
                onChange={setCommission}
                aria-label="Comissão"
              >
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="% 0,00"
                />
              </TextField>
            </Field>
            <Field label="Duração">
              <Select
                aria-label="Duração"
                selectedKey={durationMin}
                onSelectionChange={(key) =>
                  key && setDurationMin(String(key))
                }
              >
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {availableDurations.map((minutes) => (
                      <ListBox.Item
                        key={minutes}
                        id={String(minutes)}
                        textValue={durationOptionLabel(minutes)}
                      >
                        {durationOptionLabel(minutes)}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>
          </div>

          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Essa descrição aparecerá para o seu cliente quando ele for agendar online"
              aria-label="Descrição"
              className="w-full resize-y rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-ink focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        </div>
      )}

      {tab === "config" && (
        <div className="flex flex-col gap-3">
          <Toggle
            label="Agendamento online"
            checked={onlineBookable}
            onChange={setOnlineBookable}
          />
          <Toggle
            label="Favorito"
            checked={favorite}
            onChange={setFavorite}
          />
          <Toggle
            label="Visível no catálogo"
            checked={visible}
            onChange={setVisible}
          />
          {mode === "edit" && (
            <Toggle label="Ativo" checked={active} onChange={setActive} />
          )}
        </div>
      )}

      {tab === "cashback" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs text-muted-ink">
            O cashback é próprio do serviço e independente da comissão do
            profissional.
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
    </FullDrawer>
  );
}

function Field({
  label,
  children,
  required = false,
  info = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  info?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">
        {required && <span className="mr-0.5 text-danger">*</span>}
        {label}
        {info && (
          <span
            className="ml-1 inline-grid h-3.5 w-3.5 place-items-center rounded-full border border-muted-ink text-[9px] leading-none text-muted-ink"
            aria-hidden
          >
            i
          </span>
        )}
      </label>
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
