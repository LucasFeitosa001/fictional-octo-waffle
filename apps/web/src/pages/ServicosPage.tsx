import { useEffect, useMemo, useRef, useState } from "react";
import { Autocomplete, Button, Checkbox, Input, ListBox, Popover, SearchField, Select, Spinner, TextField } from "@heroui/react";
import { ApiClientError } from "@beautypass/shared";
import { Drawer } from "../components/Drawer";
import { FilterAside } from "../components/FilterAside";
import { FullDrawer } from "../components/FullDrawer";
import { EmptyState, ErrorState } from "../components/States";
import { TableSkeleton } from "../components/Skeletons";
import { useUploadImage } from "../hooks/useUploadImage";
import { InlineSearch } from "../components/InlineSearch";
import { IconTip } from "../components/IconTip";
import {
  IconChevron,
  IconCircleCheck,
  IconFilter,
  IconLayers,
  IconPencil,
  IconPlus,
  IconScissors,
  IconSearch,
  IconSettings,
  IconStar,
  IconTrash,
  IconX,
} from "../components/icons";
import {
  useCreateService,
  useDeleteService,
  useServices,
  useUpdateService,
  type ServiceBody,
  type ServiceRow,
} from "../lib/queries";
import { useProductCategories } from "../lib/queries/catalogo";
import { formatMoney } from "../lib/format";
import { useAutoCreate } from "../lib/useAutoCreate";
import { useSetPageActions } from "../layout/PageActions";
import { useConfirm } from "../components/ConfirmDialog";
import { AnimatedCheckbox } from "../components/AnimatedCheckbox";
import { SwitchRow } from "../components/SwitchRow";
import { AnimatedSelectionCell } from "../components/AnimatedSelectionCell";
import { FilterCheckbox } from "../components/FilterCheckbox";
import { BulkActionsSheet } from "../components/BulkActionsSheet";
import {
  useSelectMode,
  buildSelectActions,
  type BulkAction,
} from "../hooks/useSelectMode";

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
  defaultCommissionPercent?: string | number | null;
  priceType?: string | null;
  additionalCostType?: string | null;
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
  const raw = extra.defaultCommissionPercent;
  return raw == null || raw === "" ? null : Number(raw);
}

function formatPercent(value: number | null): string {
  const normalized = value == null || Number.isNaN(value) ? 0 : value;
  return `% ${normalized.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Colunas ocultáveis (T7) ─────────────────────────────────────────
// Colunas de dados que o usuário pode mostrar/ocultar pelo gear. A
// coluna-título ("Nome") e a de ações NÃO entram aqui — são sempre fixas.
const TOGGLE_COLS = [
  { key: "price", label: "Valor" },
  { key: "commission", label: "Comissão" },
  { key: "duration", label: "Duração" },
  { key: "category", label: "Categoria" },
  { key: "site", label: "Mostra no site" },
] as const;
type ColKey = (typeof TOGGLE_COLS)[number]["key"];

const COLS_STORAGE_KEY = "sp-cols-servicos";

function readHiddenCols(): Set<string> {
  try {
    const raw = localStorage.getItem(COLS_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? new Set(arr.filter((x): x is string => typeof x === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Visibilidade de colunas persistida em localStorage (chave `sp-cols-servicos`).
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

export function ServicosPage() {
  const [search, setSearch] = useState("");
  // Campo de busca desktop: revelado pelo botão "Buscar" do header (InlineSearch).
  const [searchOpen, setSearchOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  // Visibilidade de colunas (gear — T7), persistida em localStorage.
  const cols = useColumnVisibility();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [favFilter, setFavFilter] = useState<FavFilter>("all");
  const [categorySet, setCategorySet] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  // Belasis: banner de assinatura condicional no topo. Mock por ora — no
  // futuro virá do endpoint de billing/plano (só aplicável ao tenant).
  const [showSubscriptionBanner, setShowSubscriptionBanner] = useState(false);
  useAutoCreate(() => setCreateOpen(true));
  const confirm = useConfirm();

  const services = useServices();
  const categories = useProductCategories();
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

  // Modo de seleção (Belasis): infra padrão (useSelectMode) sobre os ids
  // VISÍVEIS (todas as linhas filtradas — o mobile lista tudo, o desktop pagina).
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const sel = useSelectMode(ids);

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
    if (sel.isSelected(s.id)) sel.toggle(s.id);
  }

  // Exclui de verdade os selecionados (mutateAsync em Promise.all no hook de
  // delete existente), após confirmação. Depois fecha a sheet e sai do modo.
  async function bulkDeleteSelected() {
    if (sel.count === 0) return;
    const ok = await confirm({
      title: "Excluir serviços?",
      message: `Remover ${sel.count} serviço(s) selecionado(s)? Essa ação não pode ser desfeita.`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    await Promise.all([...sel.selected].map((id) => deleteService.mutateAsync(id)));
    setActionsOpen(false);
    sel.cancel();
  }

  const bulkActions: BulkAction[] = [
    {
      key: "delete",
      label: "Excluir selecionados",
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: deleteService.isPending,
      onClick: bulkDeleteSelected,
    },
  ];

  // Header select-all do desktop opera sobre a PÁGINA visível (pageRows).
  const pageIds = pageRows.map((s) => s.id);
  const allChecked =
    pageIds.length > 0 && pageIds.every((id) => sel.isSelected(id));
  function toggleSelectPage() {
    // Se a página inteira já está marcada, desmarca; senão marca as faltantes.
    for (const id of pageIds) {
      if (allChecked ? sel.isSelected(id) : !sel.isSelected(id)) sel.toggle(id);
    }
  }

  const categoryOptions = useMemo(
    () =>
      (categories.data ?? []).map((category) => ({
        id: category.id,
        name: category.name,
      })),
    [categories.data],
  );

  // Enquanto selectMode estiver ativo, a barra vira [Cancelar · Selecionar
  // todos · Ações] (buildSelectActions); senão, Filtros · Selecionar · Criar.
  useSetPageActions(
    sel.selectMode
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
            key: "filters",
            label: "Filtros",
            icon: <IconFilter size={22} />,
            onClick: () => setMobileFiltersOpen(true),
          },
          {
            key: "select",
            label: "Selecionar",
            icon: <IconCircleCheck size={22} />,
            onClick: sel.enter,
            disabled: rows.length === 0,
          },
          {
            key: "create",
            label: "Criar",
            icon: <IconPlus size={22} />,
            onClick: () => setCreateOpen(true),
          },
        ],
    [sel.selectMode, sel.allSelected, sel.count, rows.length],
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
      <header className="mb-4 hidden flex-wrap items-center justify-between gap-2 lg:flex">
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
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Busca inline (componente único de toolbar — ver InlineSearch). */}
          <InlineSearch
            open={searchOpen}
            onOpenChange={setSearchOpen}
            value={search}
            onValueChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            onClose={() => setPage(1)}
            breakpoint="lg"
            placeholder="Buscar serviço"
          />
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`btn-ghost-hover hidden h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors lg:inline-flex ${
              showFilters
                ? "border-gold bg-gold text-primary-foreground"
                : "border-line bg-card text-ink hover:bg-canvas"
            }`}
          >
            <IconFilter size={16} />
            <span className="hidden sm:inline">Filtrar</span>
          </button>
          {/* Ações em massa (T3): SEMPRE visível no desktop, à esquerda de "Novo".
              Fora do modo seleção → ativa o selectMode (checkboxes nas linhas).
              Em seleção → mostra a contagem e abre a BulkActionsSheet; um X ao
              lado sai do modo. NÃO existe barra "N selecionados" acima da tabela. */}
          {sel.selectMode ? (
            <div className="hidden items-center lg:inline-flex">
              <button
                type="button"
                onClick={() =>
                  sel.count > 0 ? setActionsOpen(true) : sel.selectAll()
                }
                className={`inline-flex h-9 items-center gap-1.5 rounded-l-lg border px-3 text-sm font-medium transition-colors ${
                  sel.count > 0
                    ? "btn-primary-hover border-gold bg-gold text-primary-foreground hover:bg-gold-strong"
                    : "btn-ghost-hover border-line bg-card text-ink hover:bg-canvas"
                }`}
              >
                <IconLayers size={16} />
                <span>{sel.count > 0 ? `Ações (${sel.count})` : "Selecionar todos"}</span>
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
              className="btn-ghost-hover hidden h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm font-medium text-ink transition-colors hover:bg-canvas lg:inline-flex"
            >
              <IconLayers size={16} />
              <span>Ações</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="btn-primary-hover hidden h-9 items-center gap-1.5 rounded-lg bg-gold px-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-gold)] transition-colors hover:bg-gold-strong lg:inline-flex"
          >
            <IconPlus size={16} />
            <span>Novo</span>
          </button>
        </div>
      </header>

      {/* Belasis: banner condicional de assinatura no topo (CTA "Ver minha
          assinatura"). Mock por ora — condicional ao tenant. */}
      {showSubscriptionBanner && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-[color-mix(in_oklab,var(--sp-primary)_6%,transparent)] px-4 py-3">
          <span className="text-sm text-ink">
            Aproveite mais recursos do seu plano.
          </span>
          <div className="flex items-center gap-2">
            <a
              href="/perfil/assinatura"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)]"
            >
              Ver minha assinatura
            </a>
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* ── Rail de filtros (Status / Favoritos / Categorias) ── */}
        <FilterAside open={showFilters} width="lg:w-60" className="hidden lg:block">
          {filterControls}
        </FilterAside>

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

          {services.isLoading ? (
            <TableSkeleton columns={6} />
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
              <div className="hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] lg:block">
                <div className="overflow-clip rounded-t-xl">
                <table className="w-full table-fixed border-collapse text-sm">
                  {/* T8: thead sticky no topo do scroll do <main>. Fundo sólido
                      (bg-card) + z-20 pra cobrir as linhas ao rolar. */}
                  <thead className="sticky top-0 z-20 bg-card">
                    <tr className="border-b border-line text-left text-sm font-semibold text-muted-ink">
                      <AnimatedSelectionCell active={sel.selectMode} header className="px-3 py-3.5">
                        <Check
                          checked={allChecked}
                          onChange={toggleSelectPage}
                        />
                      </AnimatedSelectionCell>
                      <SortableTh
                        className="w-[28%]"
                        label="Nome"
                        sortKey="name"
                        activeKey={sortKey}
                        asc={sortAsc}
                        onSort={toggleSort}
                      />
                      {cols.isVisible("price") && (
                        <SortableTh
                          className="w-[12%]"
                          align="right"
                          label="Valor"
                          sortKey="price"
                          activeKey={sortKey}
                          asc={sortAsc}
                          onSort={toggleSort}
                        />
                      )}
                      {cols.isVisible("commission") && (
                        <SortableTh
                          className="w-[12%]"
                          align="right"
                          label="Comissão"
                          sortKey="commission"
                          activeKey={sortKey}
                          asc={sortAsc}
                          onSort={toggleSort}
                        />
                      )}
                      {cols.isVisible("duration") && (
                        <SortableTh
                          className="w-[10%]"
                          label="Duração"
                          sortKey="duration"
                          activeKey={sortKey}
                          asc={sortAsc}
                          onSort={toggleSort}
                        />
                      )}
                      {cols.isVisible("category") && (
                        <th className="w-[16%] px-3 py-3.5 font-semibold">
                          Categoria
                        </th>
                      )}
                      {cols.isVisible("site") && (
                        <SortableTh
                          className="w-[11%]"
                          align="center"
                          label="Mostra no site"
                          sortKey="site"
                          activeKey={sortKey}
                          asc={sortAsc}
                          onSort={toggleSort}
                        />
                      )}
                      <th className="w-[114px] px-3 py-3.5 text-right">
                        {/* T7: gear abre Popover pra mostrar/ocultar colunas. */}
                        <Popover>
                          <Popover.Trigger>
                            <button
                              type="button"
                              aria-label="Configurar colunas"
                              className="relative inline-grid h-7 w-7 place-items-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-ink"
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
                                    <Checkbox
                                      isSelected={cols.isVisible(col.key)}
                                      onChange={() => cols.toggle(col.key)}
                                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-canvas"
                                    >
                                      <Checkbox.Content className="flex min-w-0 items-center gap-2">
                                        <Checkbox.Control>
                                          <Checkbox.Indicator />
                                        </Checkbox.Control>
                                        <span className="min-w-0 truncate">
                                          {col.label}
                                        </span>
                                      </Checkbox.Content>
                                    </Checkbox>
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
                    {pageRows.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-line/70 last:border-0 transition-colors hover:bg-canvas"
                      >
                        <AnimatedSelectionCell active={sel.selectMode} className="px-3 py-2.5">
                          <Check
                            checked={sel.isSelected(s.id)}
                            onChange={() => sel.toggle(s.id)}
                          />
                        </AnimatedSelectionCell>
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
                        {cols.isVisible("price") && (
                          <td className="whitespace-nowrap px-3 py-2.5 text-right text-ink">
                            {formatMoney(s.price)}
                          </td>
                        )}
                        {cols.isVisible("commission") && (
                          <td className="px-3 py-2.5 text-right text-muted-ink">
                            {formatPercent(commissionOf(s))}
                          </td>
                        )}
                        {cols.isVisible("duration") && (
                          <td className="whitespace-nowrap px-3 py-2.5 text-ink">
                            {formatHm(s.durationMin)}
                          </td>
                        )}
                        {cols.isVisible("category") && (
                          <td className="px-3 py-2.5">
                            {s.categoryId ? (
                              <span className="truncate text-muted-ink">
                                {catName.get(s.categoryId) ?? "—"}
                              </span>
                            ) : (
                              <span className="text-muted-ink">—</span>
                            )}
                          </td>
                        )}
                        {cols.isVisible("site") && (
                          <td className="px-3 py-2.5 text-center text-muted-ink">
                            {(s.visible ?? s.onlineBookable) ? "Sim" : "Não"}
                          </td>
                        )}
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
                <Pagination
                  total={rows.length}
                  page={page}
                  pageCount={pageCount}
                  onPage={setPage}
                />
              </div>

              {/* Mobile: cards. Em selectMode o card inteiro alterna a seleção
                  (mostra AnimatedCheckbox + realce); fora dele, abre a edição. */}
              <ul className="flex flex-col gap-2 lg:hidden">
                {rows.map((s) => {
                  const checked = sel.isSelected(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() =>
                          sel.selectMode ? sel.toggle(s.id) : setEditing(s)
                        }
                        className={`flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left shadow-[var(--shadow-card)] transition-colors ${
                          sel.selectMode && checked
                            ? "border-primary ring-2 ring-primary/40"
                            : "border-line"
                        }`}
                      >
                        {sel.selectMode && <AnimatedCheckbox checked={checked} />}
                        <Avatar url={s.imageUrl} size={44} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-primary hover:underline">
                              {s.name}
                            </span>
                            <IconStar
                              size={18}
                              className={
                                s.favorite ? "text-gold" : "text-muted-ink"
                              }
                            />
                          </span>
                          <span className="mt-0.5 flex items-center justify-between gap-2 text-sm text-muted-ink">
                            <span>{formatMoney(s.price)}</span>
                            <span>{formatMobileDuration(s.durationMin)}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
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

      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
      />
    </div>
  );
}

/* ───────────────────────── UI building blocks ───────────────────────── */

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
    <FilterCheckbox checked={checked} onChange={onChange}>
      {label}
    </FilterCheckbox>
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
    <Checkbox isSelected={checked} onChange={onChange} className="shrink-0">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
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
  const starLabel = favorite ? "Remover dos favoritos" : "Marcar como favorito";
  return (
    <div className="flex items-center justify-end gap-1 text-muted-ink">
      <IconTip label={starLabel}>
        <button
          type="button"
          aria-label={starLabel}
          onClick={onStar}
          disabled={starDisabled}
          className={`rounded p-1 transition-colors disabled:opacity-50 ${
            favorite ? "text-gold" : "hover:text-gold"
          }`}
        >
          <IconStar size={16} />
        </button>
      </IconTip>
      <span className="h-4 w-px bg-line" aria-hidden />
      <IconTip label="Editar serviço">
        <button
          type="button"
          aria-label="Editar serviço"
          onClick={onEdit}
          className="rounded p-1 transition-colors hover:text-gold"
        >
          <IconPencil size={16} />
        </button>
      </IconTip>
      <span className="h-4 w-px bg-line" aria-hidden />
      <IconTip label="Excluir serviço">
        <button
          type="button"
          aria-label="Excluir serviço"
          onClick={onDelete}
          disabled={deleteDisabled}
          className="rounded p-1 text-danger transition-colors hover:opacity-80 disabled:opacity-50"
        >
          <IconTrash size={16} />
        </button>
      </IconTip>
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
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-card px-3 pt-3 pb-6 text-sm text-muted-ink lg:sticky lg:bottom-0 lg:z-20 lg:rounded-b-xl">
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

export function ServiceDrawer({
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
  // Belasis: tipo de preço (fixo|a_partir_de) e tipo de custo adicional (value|percent).
  const [priceType, setPriceType] = useState("fixo");
  const [additionalCostType, setAdditionalCostType] = useState("value");
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
  // Upload de foto do serviço (multipart /api/v1/uploads).
  const photoInputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadImage();

  async function handlePickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const { url } = await uploadImage.mutateAsync({ file, kind: "service" });
      const nextImages = [url, ...imageUrls.slice(1)];
      setImageUrls(nextImages);
      // Editing an existing service: persist the new cover right away so the
      // thumbnail sticks even if the user closes the drawer without pressing
      // "Salvar" (otherwise the uploaded file would be orphaned).
      if (mode === "edit" && service) {
        await update.mutateAsync({
          id: service.id,
          body: { imageUrls: nextImages },
        });
      }
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Não foi possível enviar a foto.",
      );
    }
  }

  async function handleRemovePhoto() {
    const nextImages = imageUrls.slice(1);
    setImageUrls(nextImages);
    if (mode === "edit" && service) {
      setError(null);
      try {
        await update.mutateAsync({
          id: service.id,
          body: { imageUrls: nextImages },
        });
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : "Não foi possível remover a foto.",
        );
      }
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    setTab("cadastro");
    setName(service?.name ?? "");
    setCategoryId(service?.categoryId ?? categories[0]?.id ?? "");
    setPrice(service ? String(service.price) : "");
    const belasis = service as ServiceBelasisFields | null | undefined;
    setPriceType(belasis?.priceType === "a_partir_de" ? "a_partir_de" : "fixo");
    setAdditionalCostType(
      belasis?.additionalCostType === "percent" ? "percent" : "value",
    );
    const addCost = belasis?.additionalCost;
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
    const body: ServiceBody & {
      additionalCost?: number;
      priceType?: string;
      additionalCostType?: string;
    } = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      price: Number(price),
      priceType,
      additionalCostType,
      additionalCost: additionalCost ? Number(additionalCost) : 0,
      durationMin: Number(durationMin),
      description: description.trim() || undefined,
      imageUrls,
      cashbackPercent:
        cashbackEnabled && cashbackPercent ? Number(cashbackPercent) : 0,
      defaultCommissionPercent: commission ? Number(commission) : 0,
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
      widthClass="sm:w-[600px]"
      orientation="vertical"
      sidebarWidth="md:w-[180px]"
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
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadImage.isPending}
              className="relative flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-line bg-canvas text-muted-ink transition-colors hover:border-[var(--sp-primary)] disabled:opacity-70"
              aria-label={imageUrls[0] ? "Alterar foto do serviço" : "Enviar foto do serviço"}
            >
              {imageUrls[0] ? (
                <img
                  src={imageUrls[0]}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-1 text-center text-xs font-semibold leading-tight">
                  Foto
                </span>
              )}
              {uploadImage.isPending && (
                <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                  <Spinner size="sm" />
                </span>
              )}
            </button>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                isDisabled={uploadImage.isPending}
                onClick={() => photoInputRef.current?.click()}
              >
                {uploadImage.isPending
                  ? "Enviando…"
                  : imageUrls[0]
                    ? "Alterar foto"
                    : "Enviar foto"}
              </Button>
              {imageUrls[0] && !uploadImage.isPending && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-danger"
                  isDisabled={update.isPending}
                  onClick={handleRemovePhoto}
                >
                  Remover
                </Button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePickPhoto}
            />
          </div>

          <Field label="Nome" required>
            <TextField value={name} onChange={setName} aria-label="Nome">
              <Input placeholder="Informe o nome" />
            </TextField>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria" required>
              <Autocomplete
                aria-label="Categoria"
                selectedKey={categoryId || null}
                onSelectionChange={(k) =>
                  setCategoryId(k ? String(k) : NONE)
                }
              >
                <Autocomplete.Trigger>
                  <Autocomplete.Value>
                    {({ isPlaceholder, selectedText }) =>
                      isPlaceholder ? "Selecione" : selectedText
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
                    <SearchField aria-label="Buscar Categoria" autoFocus className="mb-1">
                      <SearchField.Input placeholder="Buscar" />
                    </SearchField>
                    <ListBox>
                      {categories.map((c) => (
                        <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                          {c.name}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Autocomplete.Filter>
                </Autocomplete.Popover>
              </Autocomplete>
            </Field>
            <Field label="Preço de venda">
              <div className="flex min-w-0 items-stretch">
                <div className="relative shrink-0">
                  <select
                    aria-label="Tipo de preço"
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value)}
                    className="h-full appearance-none rounded-l-lg border border-r-0 border-line bg-canvas py-2 pl-3 pr-7 text-sm text-muted-ink outline-none focus:border-primary"
                  >
                    <option value="fixo">Preço fixo</option>
                    <option value="a_partir_de">A partir de</option>
                  </select>
                  <IconChevron
                    size={12}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-ink"
                  />
                </div>
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
                <div className="relative shrink-0">
                  <select
                    aria-label="Tipo de custo adicional"
                    value={additionalCostType}
                    onChange={(e) => setAdditionalCostType(e.target.value)}
                    className="h-full appearance-none rounded-l-lg border border-r-0 border-line bg-canvas py-2 pl-3 pr-7 text-sm text-muted-ink outline-none focus:border-primary"
                  >
                    <option value="value">R$</option>
                    <option value="percent">%</option>
                  </select>
                  <IconChevron
                    size={12}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-ink"
                  />
                </div>
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
          <SwitchRow
            label="Agendamento online"
            checked={onlineBookable}
            onChange={setOnlineBookable}
          />
          <SwitchRow
            label="Favorito"
            checked={favorite}
            onChange={setFavorite}
          />
          <SwitchRow
            label="Visível no catálogo"
            checked={visible}
            onChange={setVisible}
          />
          {mode === "edit" && (
            <SwitchRow label="Ativo" checked={active} onChange={setActive} />
          )}
        </div>
      )}

      {tab === "cashback" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-line bg-canvas px-3 py-2 text-xs text-muted-ink">
            O cashback é próprio do serviço e independente da comissão do
            profissional.
          </div>
          <SwitchRow
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
