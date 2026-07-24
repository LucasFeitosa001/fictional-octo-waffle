import { useEffect, useMemo, useState } from 'react';
import { Button, Input, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../components/Drawer';
import { FilterAside } from '../components/FilterAside';
import { HelpTooltip } from '../components/HelpTooltip';
import { InlineSearch } from '../components/InlineSearch';
import { IconTip } from '../components/IconTip';
import { useConfirm } from '../components/ConfirmDialog';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { AnimatedSelectionCell } from '../components/AnimatedSelectionCell';
import { FilterCheckbox } from '../components/FilterCheckbox';
import { BulkActionsSheet } from '../components/BulkActionsSheet';
import { SwitchRow } from '../components/SwitchRow';
import {
  buildSelectActions,
  useSelectMode,
  type BulkAction,
} from '../hooks/useSelectMode';
import { EmptyState, ErrorState } from '../components/States';
import { TableSkeleton } from '../components/Skeletons';
import {
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconChevron,
  IconFilter,
  IconLayers,
  IconPencil,
  IconPlay,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTag,
  IconTrash,
  IconX,
} from '../components/icons';
import { formatNumber } from '../lib/format';
import { useSetPageActions } from '../layout/PageActions';
import {
  useBrands,
  useCreateBrand,
  useDeleteBrand,
  useUpdateBrand,
  type Brand,
} from '../lib/queries/catalogo';

const PAGE_SIZE = 20;

function itemsLabel(count: number) {
  // Belasis: "Possui um item associado" / "Possui N itens associados".
  if (count <= 0) return 'Nenhum item associado';
  if (count === 1) return 'Possui um item associado';
  return `Possui ${formatNumber(count)} itens associados`;
}

export function MarcasPage() {
  const confirm = useConfirm();
  const brands = useBrands();
  const deleteBrand = useDeleteBrand();

  const [editing, setEditing] = useState<Brand | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // Campo de busca desktop: revelado pelo botão "Buscar" do header. Expande
  // INLINE na própria fileira de botões (largura 0 → ~240px) sem empurrar a
  // tabela. No mobile o comportamento antigo (bloco abaixo do header) é mantido.
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  // Belasis: filtro de Status (Ativos / Inativos) com checkboxes independentes.
  // Usa Brand.active real (o backend expõe o campo em GET /brands).
  const [statusAtivos, setStatusAtivos] = useState(true);
  const [statusInativos, setStatusInativos] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  // Modo de seleção (Belasis): infra padrão (useSelectMode) sobre os ids VISÍVEIS.
  const [actionsOpen, setActionsOpen] = useState(false);

  const allRows = brands.data ?? [];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = allRows.filter((b) => {
      const isActive = b.active;
      if (statusAtivos || statusInativos) {
        if (statusAtivos && !statusInativos && !isActive) return false;
        if (statusInativos && !statusAtivos && isActive) return false;
      }
      if (term && !b.name.toLowerCase().includes(term)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      return sortAsc ? cmp : -cmp;
    });
  }, [allRows, search, statusAtivos, statusInativos, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Modo de seleção (Belasis): infra padrão (useSelectMode) sobre os ids VISÍVEIS
  // (todas as linhas filtradas — o mobile lista tudo, o desktop pagina).
  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const sel = useSelectMode(ids);

  // Header select-all do desktop opera sobre a PÁGINA visível (paged).
  const pagedIds = paged.map((b) => b.id);
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
      title: 'Excluir marcas?',
      message: `Remover ${sel.count} marca(s) selecionada(s)? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await Promise.all([...sel.selected].map((id) => deleteBrand.mutateAsync(id)));
    setActionsOpen(false);
    sel.cancel();
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'delete',
      label: 'Excluir selecionados',
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: deleteBrand.isPending,
      onClick: bulkDeleteSelected,
    },
  ];

  // No mobile a busca fica sempre visível, então a BottomNav do Belasis expõe
  // Filtros / Selecionar / Criar — mesmos handlers do desktop. Em selectMode a
  // barra vira [Cancelar · Selecionar todos · Ações] via buildSelectActions.
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
            key: 'filtros',
            label: 'Filtros',
            icon: <IconFilter size={22} />,
            onClick: () => setFilterOpen((v) => !v),
          },
          {
            key: 'selecionar',
            label: 'Selecionar',
            icon: <IconCheckCircle size={22} />,
            onClick: sel.enter,
            disabled: rows.length === 0,
          },
          {
            key: 'criar',
            label: 'Criar',
            icon: <IconPlus size={22} />,
            onClick: () => setCreateOpen(true),
          },
        ],
    [sel.selectMode, sel.allSelected, sel.count, rows.length],
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusAtivos, statusInativos, sortAsc]);

  // "Ativos ligado / Inativos desligado" é o default; qualquer outra
  // combinação conta como filtro ativo (para o badge do toolbar).
  const statusFilterActive = !(statusAtivos && !statusInativos);
  const activeFilterCount = statusFilterActive ? 1 : 0;
  const hasFilters = Boolean(search.trim()) || activeFilterCount > 0;

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setStatusAtivos(true);
    setStatusInativos(false);
  }

  async function handleDelete(brand: Brand) {
    setMessage(null);
    const ok = await confirm({
      title: 'Excluir marca?',
      message: `Remover a marca "${brand.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
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
      {/* Cabeçalho (T6): título + tutorial/ajuda + fileira compacta (T2/T3). */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">Marcas</h1>
          {/* play-circle: botão de tutorial ao lado do título (Belasis) */}
          <button
            type="button"
            aria-label="Ver tutorial"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white ring-4 ring-amber-500/20 transition-colors hover:bg-amber-600"
          >
            <IconPlay size={12} className="ml-0.5" />
          </button>
          {/* question-circle: ajuda contextual da listagem (Belasis) */}
          <HelpTooltip className="hidden items-center text-muted-ink hover:text-ink md:inline-flex">
            Cadastre marcas para classificar seus produtos e filtrar a listagem.
          </HelpTooltip>
        </div>
        <div className="hidden flex-wrap items-center gap-1.5 md:flex">
          {/* Busca inline (componente único de toolbar — ver InlineSearch). */}
          <InlineSearch
            open={searchOpen}
            onOpenChange={setSearchOpen}
            value={searchInput}
            onValueChange={setSearchInput}
            onSubmit={applySearch}
            onClose={() => {
              setSearchInput('');
              setSearch('');
            }}
            placeholder="Buscar marca"
          />
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`btn-ghost-hover hidden h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors md:inline-flex ${
              filterOpen || activeFilterCount > 0
                ? 'border-primary bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] text-primary'
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
          {/* Ações em massa (T3): SEMPRE visível no desktop, à esquerda de "Novo". */}
          {sel.selectMode ? (
            <div className="hidden items-center md:inline-flex">
              <button
                type="button"
                onClick={() => (sel.count > 0 ? setActionsOpen(true) : sel.selectAll())}
                className={`btn-ghost-hover inline-flex h-9 items-center gap-1.5 rounded-l-lg border px-3 text-sm font-medium transition-colors ${
                  sel.count > 0
                    ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border-line bg-card text-ink hover:bg-canvas'
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
            className="btn-primary-hover hidden h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 md:inline-flex"
          >
            <IconPlus size={16} />
            <span>Novo</span>
          </button>
        </div>
      </header>

      {message && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {message}
        </div>
      )}

      {/* Mobile: busca sempre visível + pílula de ordenação (igual Belasis).
          No desktop a busca continua sendo toggle pela toolbar. */}
      <div className="mb-4 flex flex-col gap-3 md:hidden">
        <div className="relative">
          <IconSearch
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-ink"
          />
          <TextField
            value={searchInput}
            onChange={(v) => {
              setSearchInput(v);
              setSearch(v.trim());
            }}
            aria-label="Buscar marca"
          >
            <Input
              placeholder="Digite para buscar"
              className="pl-9 focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </TextField>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setSortAsc((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ordenando por Nome
            <IconChevron
              size={16}
              className={sortAsc ? 'rotate-180' : ''}
            />
          </button>
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
              checked={statusAtivos}
              onClick={() => setStatusAtivos((v) => !v)}
            >
              Ativos
            </CheckRow>
            <CheckRow
              checked={statusInativos}
              onClick={() => setStatusInativos((v) => !v)}
            >
              Inativos
            </CheckRow>
          </FilterGroup>
        </FilterAside>

        {/* Conteúdo principal: tabela / cards */}
        <div className="min-w-0 flex-1">
          {brands.isLoading ? (
            <TableSkeleton columns={2} />
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
              <div className="hidden overflow-clip rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
                <table className="w-full border-collapse text-sm">
                  {/* T8: thead sticky no topo do scroll do <main>. Fundo sólido
                      (bg-card) + z-20 pra cobrir as linhas ao rolar. */}
                  <thead className="sticky top-0 z-20 bg-card">
                    <tr className="border-b border-line text-left text-sm font-semibold text-ink/75">
                      <AnimatedSelectionCell active={sel.selectMode} header className="py-3 pl-4 pr-2">
                        <CheckBox
                          checked={pageAllSelected}
                          onClick={togglePage}
                          label="Selecionar todas"
                        />
                      </AnimatedSelectionCell>
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => setSortAsc((v) => !v)}
                          className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                          title="Ordenar por nome"
                        >
                          Nome
                          <span className="flex flex-col leading-none">
                            <IconArrowUp
                              size={11}
                              className={sortAsc ? 'text-primary' : 'text-line'}
                            />
                            <IconArrowDown
                              size={11}
                              className={!sortAsc ? 'text-primary' : 'text-line'}
                            />
                          </span>
                        </button>
                      </th>
                      <th className="px-4 py-3 font-semibold">Itens</th>
                      <th className="w-24 px-4 py-3 text-center font-semibold">
                        <IconSettings
                          size={15}
                          className="mx-auto text-muted-ink"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((b) => {
                      const count = b.productCount ?? 0;
                      return (
                        <tr
                          key={b.id}
                          onClick={() =>
                            sel.selectMode ? sel.toggle(b.id) : setEditing(b)
                          }
                          className={[
                            'cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]',
                            sel.selectMode && sel.isSelected(b.id)
                              ? 'bg-[color-mix(in_oklab,var(--sp-primary)_8%,transparent)]'
                              : '',
                          ].join(' ')}
                        >
                          <AnimatedSelectionCell
                            active={sel.selectMode}
                            className="py-2.5 pl-4 pr-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <CheckBox
                              checked={sel.isSelected(b.id)}
                              onClick={() => sel.toggle(b.id)}
                              label={`Selecionar ${b.name}`}
                            />
                          </AnimatedSelectionCell>
                          <td className="px-4 py-2.5">
                            <span
                              title={b.name}
                              className="block w-full truncate text-left font-medium text-primary hover:underline"
                            >
                              {b.name}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={[
                                'text-left',
                                count > 0 ? 'text-primary' : 'text-muted-ink',
                              ].join(' ')}
                            >
                              {itemsLabel(count)}
                            </span>
                          </td>
                          <td
                            className="px-4 py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
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

              {/* ===== Mobile: cards (Belasis: nome + itens, toque abre edição) ===== */}
              <ul className="flex flex-col gap-3 md:hidden">
                {paged.map((b) => {
                  const count = b.productCount ?? 0;
                  return (
                    // Modo de seleção: o CARD INTEIRO alterna a seleção (qualquer
                    // ponto, inclusive o checkbox). Fora dele, abre a edição. Um
                    // único <button> cobrindo o card todo evita "zonas mortas".
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() =>
                          sel.selectMode ? sel.toggle(b.id) : setEditing(b)
                        }
                        aria-pressed={sel.selectMode ? sel.isSelected(b.id) : undefined}
                        className={[
                          'flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-[var(--shadow-card)] transition-colors',
                          sel.selectMode && sel.isSelected(b.id)
                            ? 'border-primary ring-2 ring-primary/40'
                            : 'border-line',
                        ].join(' ')}
                      >
                        {sel.selectMode && (
                          <AnimatedCheckbox checked={sel.isSelected(b.id)} />
                        )}
                        <span className="block min-w-0 flex-1">
                          <span className="block min-w-0 truncate font-medium text-primary hover:underline">
                            {b.name}
                          </span>
                          <span
                            className={[
                              'mt-0.5 block text-sm',
                              count > 0 ? 'text-primary' : 'text-muted-ink',
                            ].join(' ')}
                          >
                            {itemsLabel(count)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Rodapé: paginação numerada (igual Belasis) */}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-ink">
                <span className="mr-auto">
                  {hasFilters
                    ? `${formatNumber(rows.length)} de ${formatNumber(allRows.length)} registro(s)`
                    : `${formatNumber(allRows.length)} registro(s) no total`}
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

      {/* Ações em lote (Belasis): bottom-sheet aberto pelo "Ações" do selectMode. */}
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

// BottomNav "Selecionar": círculo com check (igual Belasis mobile).
function IconCheckCircle({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

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
      <IconTip label="Editar">
        <button
          type="button"
          aria-label="Editar"
          onClick={onEdit}
          className="rounded p-1 hover:bg-canvas hover:text-primary"
        >
          <IconPencil size={16} />
        </button>
      </IconTip>
      <span className="h-4 w-px bg-line" />
      <IconTip label="Excluir">
        <button
          type="button"
          aria-label="Remover"
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
    'btn-ghost-hover inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-card text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40';
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
    <FilterCheckbox checked={checked} onToggle={onClick} className="px-1 py-1">
      {children}
    </FilterCheckbox>
  );
}

function CheckBox({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={[
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-line bg-card hover:border-primary',
      ].join(' ')}
    >
      {checked && <IconCheck size={11} />}
    </button>
  );
}

// ---------------------------------------------------------------------
// Drawer lateral de cadastro/edição de marca
// ---------------------------------------------------------------------

export function BrandDrawer({
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
  // "Ativo" persiste via Brand.active (enviado em create/update).
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(brand?.name ?? '');
      setActive(brand?.active ?? true);
      setError(null);
    }
  }, [isOpen, brand]);

  const pending = create.isPending || update.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  async function handleSave() {
    setError(null);
    try {
      if (mode === 'edit' && brand) {
        await update.mutateAsync({
          id: brand.id,
          body: { name: name.trim(), active },
        });
      } else {
        await create.mutateAsync({ name: name.trim(), active });
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
      widthClass="sm:w-[480px]"
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

        <SwitchRow
          className="rounded-md border border-line bg-canvas p-3"
          label="Ativo"
          description="Marcas inativas ficam ocultas nos cadastros."
          checked={active}
          onChange={setActive}
        />

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

