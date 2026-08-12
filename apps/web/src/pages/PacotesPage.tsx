import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  ListBox,
  Popover,
  Select,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { useConfirm } from '../components/ConfirmDialog';
import { InlineSearch } from '../components/InlineSearch';
import { DatePicker } from '../components/DatePicker';
import { IconTip } from '../components/IconTip';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { AnimatedSelectionCell } from '../components/AnimatedSelectionCell';
import { FilterCheckbox } from '../components/FilterCheckbox';
import { BulkActionsSheet } from '../components/BulkActionsSheet';
import { buildSelectActions, useSelectMode, type BulkAction } from '../hooks/useSelectMode';
import { FilterAside } from '../components/FilterAside';
import { FullDrawer } from '../components/FullDrawer';
import {
  CustomerAvatar,
  CustomerPickerDrawer,
  type PickedCustomer,
} from '../components/CustomerPickerDrawer';
import { ItemPickerDrawer, type PickedItem } from '../components/ItemPickerDrawer';
import { PacoteClienteAside } from '../components/PacoteClienteAside';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { TableSkeleton } from '../components/Skeletons';
import {
  IconBox,
  IconCheck,
  IconChevron,
  IconEye,
  IconFilter,
  IconHelpCircle,
  IconLayers,
  IconPlus,
  IconReceipt,
  IconScissors,
  IconSettings,
  IconTrash,
  IconX,
} from '../components/icons';
import { useSetPageActions } from '../layout/PageActions';
import { formatDate, formatMoney, formatNumber, formatPhone } from '../lib/format';
// `useCustomerPackage` daqui (não o de queries/pacotes): este é tipado como
// CustomerPackageDetail, com itens, saldo e usos — é o que a folha de
// visualização precisa. Ver estudo 50.
import { useCustomerPackage, useProfessionals, useServices } from '../lib/queries';
import { useAutoCreate } from '../lib/useAutoCreate';
import { ClientePerfilModal } from './ClientePerfilTabs';
import { useCustomer } from '../lib/queries/clientes';
import {
  useCustomerPackages,
  useDeleteCustomerPackage,
  usePackageTemplates,
  useSellPackage,
  type CustomerPackage,
  type PackageStatus,
} from '../lib/queries/pacotes';
import type { CustomerPackageDetailItem } from '../lib/types';

const NONE = '';
const PAGE_SIZE = 20;

// ── Colunas ocultáveis (T7) ─────────────────────────────────────────
// Colunas de dados que o usuário pode mostrar/ocultar pelo gear. As
// colunas-âncora ("Ticket" e "Cliente") e a de ações são sempre fixas.
const TOGGLE_COLS = [
  { key: 'date', label: 'Data' },
  { key: 'validade', label: 'Validade' },
  { key: 'status', label: 'Status' },
  { key: 'availability', label: 'Disponibilidade' },
  { key: 'price', label: 'Valor' },
  { key: 'nota', label: 'Nota Fiscal' },
] as const;
type ColKey = (typeof TOGGLE_COLS)[number]['key'];

const COLS_STORAGE_KEY = 'sp-cols-pacotes';

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
 * Visibilidade de colunas persistida em localStorage (chave `sp-cols-pacotes`).
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

// No Belasis, "Status" (consumo das sessões) e "Disponibilidade" (validade) são
// DUAS colunas independentes.
// Status: Finalizado (sessões esgotadas) x Em andamento.
function consumption(p: CustomerPackage): 'finished' | 'ongoing' {
  if (p.status === 'finished' || p.sessionsRemaining <= 0) return 'finished';
  return 'ongoing';
}

// Disponibilidade: Ativo x Vencido (pela validade).
function availability(p: CustomerPackage): 'active' | 'expired' {
  if (p.isExpired || p.status === 'expired') return 'expired';
  return 'active';
}

const STATUS_LABEL: Record<'finished' | 'ongoing', string> = {
  finished: 'Finalizado',
  ongoing: 'Pendente',
};

const AVAIL_LABEL: Record<'active' | 'expired', string> = {
  active: 'Ativo',
  expired: 'Vencido',
};

type AvailFilter = 'all' | PackageStatus;

type SortState = { key: 'ticket' | 'date' | 'validade'; dir: 'asc' | 'desc' };

export function PacotesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // Campo de busca desktop: revelado pelo botão "Buscar" do header. Expande
  // INLINE na própria fileira de botões (largura 0 → ~240px) sem empurrar a
  // tabela. No mobile o comportamento antigo (input sempre visível) é mantido.
  const [searchOpen, setSearchOpen] = useState(false);
  // Visibilidade de colunas (gear — T7), persistida em localStorage.
  const cols = useColumnVisibility();
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AvailFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Clique no NOME do cliente (na linha) abre o drawer do cliente, não o pacote.
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  // Belasis ordena por Data (desc) por padrão; Ticket/Data/Validade são sortáveis.
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  useAutoCreate(() => setCreateOpen(true));

  const confirm = useConfirm();
  const sold = useCustomerPackages();
  const cliente = useCustomer(clienteId);
  const delSold = useDeleteCustomerPackage();

  const allRows = sold.data?.data ?? [];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86_400_000 : null;
    return allRows.filter((p) => {
      if (statusFilter === 'finished' && consumption(p) !== 'finished') return false;
      if (
        (statusFilter === 'active' || statusFilter === 'expired') &&
        availability(p) !== statusFilter
      )
        return false;
      if (term && !(p.customer?.name ?? '').toLowerCase().includes(term)) return false;
      const created = new Date(p.createdAt).getTime();
      if (from != null && created < from) return false;
      if (to != null && created >= to) return false;
      return true;
    });
  }, [allRows, statusFilter, search, dateFrom, dateTo]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    const dir = sort.dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let d = 0;
      if (sort.key === 'ticket') d = a.number - b.number;
      else if (sort.key === 'date')
        d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else
        d =
          new Date(a.expiresAt ?? 0).getTime() - new Date(b.expiresAt ?? 0).getTime();
      return d * dir;
    });
    return arr;
  }, [rows, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = sortedRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Modo de seleção (Belasis): infra padrão (useSelectMode) sobre os ids
  // VISÍVEIS na página atual — tanto a tabela desktop quanto os cards mobile
  // renderizam exatamente `paged`, então "Selecionar todos" marca esses itens.
  const ids = useMemo(() => paged.map((p) => p.id), [paged]);
  const sel = useSelectMode(ids);

  // Exclui de verdade os selecionados (mutateAsync em Promise.all no hook de
  // delete existente), após confirmação. Depois fecha a sheet e sai do modo.
  async function bulkDeleteSelected() {
    if (sel.count === 0) return;
    const ok = await confirm({
      title: 'Excluir pacotes?',
      message: `Remover ${sel.count} pacote(s) selecionado(s)? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await Promise.all([...sel.selected].map((id) => delSold.mutateAsync(id)));
    setActionsOpen(false);
    sel.cancel();
  }

  const bulkActions: BulkAction[] = [
    {
      key: 'delete',
      label: 'Excluir selecionados',
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: delSold.isPending,
      onClick: bulkDeleteSelected,
    },
  ];

  function cycleSort(key: SortState['key']) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFrom, dateTo]);

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const hasFilters = Boolean(search) || activeFilterCount > 0;

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  // Mobile: BottomNav = [Filtros, Selecionar, Novo]. Busca fica sempre no topo (input),
  // como no belasis.app — sem toggle. Selecionar habilita checkbox nos cards.
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
            active: filterOpen,
          },
          {
            key: 'selecionar',
            label: 'Selecionar',
            icon: <IconCheck size={22} />,
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
    [filterOpen, sel.selectMode, sel.allSelected, sel.count, rows.length],
  );

  async function handleDelete(p: CustomerPackage) {
    const ok = await confirm({
      title: `Excluir o pacote #${p.number}?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await delSold.mutateAsync(p.id);
    } catch {
      await confirm({
        title: 'Não foi possível',
        message: 'Não foi possível excluir o pacote.',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        danger: false,
      });
    }
  }

  return (
    <div className="pb-10">
      {/* Cabeçalho (T6): título + fileira compacta de botões (T2/T3). */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Pacotes</h1>
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
            placeholder="Busque por um cliente"
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

      {/* Mobile: input de busca SEMPRE visível no topo (padrão Belasis). */}
      <div className="mb-3 md:hidden">
        <TextField
          value={searchInput}
          onChange={(v) => {
            setSearchInput(v);
            setSearch(v.trim());
          }}
          aria-label="Buscar cliente"
        >
          <Input placeholder="Digite para buscar" />
        </TextField>
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

          <FilterGroup title="Disponibilidade">
            <CheckRow checked={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              Todos
            </CheckRow>
            <CheckRow
              checked={statusFilter === 'active'}
              onClick={() => setStatusFilter('active')}
            >
              Ativo
            </CheckRow>
            <CheckRow
              checked={statusFilter === 'expired'}
              onClick={() => setStatusFilter('expired')}
            >
              Vencido
            </CheckRow>
            <CheckRow
              checked={statusFilter === 'finished'}
              onClick={() => setStatusFilter('finished')}
            >
              Finalizado
            </CheckRow>
          </FilterGroup>

          <FilterGroup title="Período">
            <div className="flex flex-col gap-2">
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                label="De"
                ariaLabel="Data inicial"
              />
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                label="Até"
                ariaLabel="Data final"
              />
            </div>
          </FilterGroup>
          {/* TODO Belasis: filtros "Status de pagamento" e "Pagamento" (Bloqueado/Em aberto/
              Atrasado/Pago) e "Excluídos" não existem no modelo de dados atual. */}
        </FilterAside>

        {/* Conteúdo principal */}
        <div className="min-w-0 flex-1">
          {sold.isLoading ? (
            <TableSkeleton columns={8} firstColAvatar={false} />
          ) : sold.isError ? (
            <ErrorState onRetry={() => sold.refetch()} />
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
              <EmptyState
                icon={<IconLayers size={32} />}
                title={
                  allRows.length === 0 ? 'Nenhum pacote vendido' : 'Nenhum pacote encontrado'
                }
                description={
                  hasFilters
                    ? 'Tente ajustar os filtros.'
                    : 'Venda um pacote a um cliente para acompanhar sessões e validade.'
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={clearAll}>
                      Limpar filtros
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      <IconPlus size={16} /> Novo
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              {/* ===== Desktop: tabela (colunas idênticas ao Belasis) ===== */}
              <div className="hidden overflow-clip rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
                <table className="w-full border-collapse text-sm">
                  {/* T8: thead sticky no topo do scroll do <main>. Fundo sólido
                      (bg-card) + z-20 pra cobrir as linhas ao rolar. */}
                  <thead className="sticky top-0 z-20 bg-card">
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <AnimatedSelectionCell active={sel.selectMode} header className="px-4 py-3">
                        <SelectBox
                          checked={sel.allSelected}
                          onClick={sel.selectAll}
                          aria-label="Selecionar tudo"
                        />
                      </AnimatedSelectionCell>
                      <SortHeader
                        label="Ticket"
                        active={sort.key === 'ticket'}
                        dir={sort.dir}
                        onClick={() => cycleSort('ticket')}
                        className="text-center"
                      />
                      {cols.isVisible('date') && (
                        <SortHeader
                          label="Data"
                          active={sort.key === 'date'}
                          dir={sort.dir}
                          onClick={() => cycleSort('date')}
                        />
                      )}
                      {cols.isVisible('validade') && (
                        <SortHeader
                          label="Validade"
                          active={sort.key === 'validade'}
                          dir={sort.dir}
                          onClick={() => cycleSort('validade')}
                        />
                      )}
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      {cols.isVisible('status') && (
                        <th className="px-4 py-3 font-semibold">Status</th>
                      )}
                      {cols.isVisible('availability') && (
                        <th className="px-4 py-3 font-semibold">Disponibilidade</th>
                      )}
                      {cols.isVisible('price') && (
                        <th className="px-4 py-3 text-right font-semibold">Valor</th>
                      )}
                      {cols.isVisible('nota') && (
                        <th className="px-4 py-3 font-semibold">Nota Fiscal</th>
                      )}
                      <th className="w-20 px-4 py-3 text-center">
                        {/* T7: gear abre Popover pra mostrar/ocultar colunas. */}
                        <Popover>
                          <Popover.Trigger>
                            <button
                              type="button"
                              aria-label="Configurar colunas"
                              className="btn-ghost-hover relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-ink"
                            >
                              <IconSettings size={16} />
                              {cols.hiddenCount > 0 && (
                                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
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
                    {paged.map((p) => {
                      const av = availability(p);
                      const cs = consumption(p);
                      return (
                        /* A LINHA INTEIRA abre o pacote. Antes só o "#N" abria,
                           e quem clicava no nome, no valor ou no espaço vazio
                           concluía que não dava para visualizar — foi a
                           reclamação do dono. Cliques em botões/links de dentro
                           (selecionar, nome do cliente, menu) não sobem: cada um
                           faz stopPropagation ou é filtrado aqui. Ver estudo 50. */
                        <tr
                          key={p.id}
                          onClick={(e) => {
                            const alvo = e.target;
                            if (
                              alvo instanceof Element &&
                              alvo.closest('button, a, input, [role="menu"], [role="button"]')
                            ) {
                              return;
                            }
                            if (sel.selectMode) sel.toggle(p.id);
                            else setDetailId(p.id);
                          }}
                          className="cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                        >
                          <AnimatedSelectionCell active={sel.selectMode} className="px-4 py-2.5">
                            <SelectBox
                              checked={sel.isSelected(p.id)}
                              onClick={() => sel.toggle(p.id)}
                              aria-label={`Selecionar #${p.number}`}
                            />
                          </AnimatedSelectionCell>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setDetailId(p.id)}
                              className="font-semibold text-primary hover:underline"
                            >
                              #{p.number}
                            </button>
                          </td>
                          {cols.isVisible('date') && (
                            <td className="px-4 py-2.5 text-muted-ink">{formatDate(p.createdAt)}</td>
                          )}
                          {cols.isVisible('validade') && (
                            <td className="px-4 py-2.5 text-muted-ink">
                              {p.expiresAt ? formatDate(p.expiresAt) : '—'}
                            </td>
                          )}
                          <td className="px-4 py-2.5">
                            {p.customer ? (
                              <button
                                type="button"
                                onClick={() => setClienteId(p.customer!.id)}
                                className="min-w-0 truncate text-left font-medium text-primary hover:underline"
                              >
                                {p.customer.name}
                              </button>
                            ) : (
                              <span className="text-muted-ink">—</span>
                            )}
                          </td>
                          {cols.isVisible('status') && (
                            <td className="px-4 py-2.5">
                              <StatusBadge value={cs} />
                            </td>
                          )}
                          {cols.isVisible('availability') && (
                            <td className="px-4 py-2.5">
                              <AvailBadge value={av} />
                            </td>
                          )}
                          {cols.isVisible('price') && (
                            <td className="px-4 py-2.5 text-right font-medium text-ink">
                              {formatMoney(p.price)}
                            </td>
                          )}
                          {cols.isVisible('nota') && (
                            <td className="px-4 py-2.5">
                              {/* Belasis: coluna Nota Fiscal (emissão NFCe/NFe/NFSe).
                                  A emissão de nota não é suportada pela API atual. // TODO */}
                              <IconTip label="Nota Fiscal (em breve)">
                                <button
                                  type="button"
                                  disabled
                                  aria-label="Nota Fiscal"
                                  className="inline-flex items-center gap-1 rounded p-1 text-muted-ink/70 disabled:cursor-not-allowed"
                                >
                                  <IconReceipt size={16} />
                                </button>
                              </IconTip>
                            </td>
                          )}
                          <td className="px-4 py-2.5">
                            <RowMenu
                              onDetail={() => setDetailId(p.id)}
                              onDelete={() => handleDelete(p)}
                              deleting={delSold.isPending}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: chip "Ordenando por …" acima da lista (Belasis). */}
              <div className="mb-2 md:hidden">
                <SortChip sort={sort} onChange={setSort} />
              </div>

              {/* ===== Mobile: cards compactos padrão Belasis.
                  Linha 1: [checkbox?] #num CLIENTE  ......  R$ valor
                  Linha 2: Data: dd/mm/yyyy ......... [pill status] [pill validade]
                  Linha 3: Expira em: dd/mm/yyyy | Não expira
                  Sem "Detalhes"/"Excluir" no card; ambos via drawer/selectMode. */}
              <ul className="flex flex-col gap-2 md:hidden">
                {paged.map((p) => {
                  const cs = consumption(p);
                  const av = availability(p);
                  const isSelected = sel.isSelected(p.id);
                  const onCardClick = () => {
                    if (sel.selectMode) sel.toggle(p.id);
                    else setDetailId(p.id);
                  };
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={onCardClick}
                        className={[
                          'flex w-full items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left shadow-[var(--shadow-soft)] transition-colors',
                          sel.selectMode && isSelected
                            ? 'border-[var(--sp-primary)] bg-[color-mix(in_oklab,var(--sp-primary)_5%,white)] ring-1 ring-[var(--sp-primary)]'
                            : 'border-[var(--color-soft-border)] active:bg-[color-mix(in_oklab,var(--sp-primary)_4%,white)]',
                        ].join(' ')}
                      >
                        {sel.selectMode && <AnimatedCheckbox checked={isSelected} />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="min-w-0 flex-1 truncate text-[13px] leading-5">
                              <span className="font-semibold text-primary">#{p.number}</span>{' '}
                              {p.customer ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setClienteId(p.customer!.id);
                                  }}
                                  className="text-primary hover:underline"
                                >
                                  {p.customer.name}
                                </button>
                              ) : (
                                <span className="text-foreground">—</span>
                              )}
                            </div>
                            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                              {formatMoney(p.price)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-ink">
                              Data: {formatDate(p.createdAt)}
                            </span>
                            <div className="flex items-center gap-1">
                              <StatusBadge value={cs} />
                              <AvailBadge value={av} />
                            </div>
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-ink">
                            {p.expiresAt
                              ? `Expira em: ${formatDate(p.expiresAt)}`
                              : 'Não expira'}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Rodapé: total + paginação ("N no total" / "20 / página") */}
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-ink">
                <div className="flex items-center gap-3">
                  <span>{formatNumber(rows.length)} no total</span>
                  {pageCount > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        isDisabled={safePage <= 1}
                        onClick={() => setPage((v) => Math.max(1, v - 1))}
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
                        onClick={() => setPage((v) => Math.min(pageCount, v + 1))}
                      >
                        Próxima
                      </Button>
                    </div>
                  )}
                  <span className="hidden sm:inline">{PAGE_SIZE} / página</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* FAB azul flutuante para "Novo" no mobile (padrão Belasis). */}
      <button
        type="button"
        aria-label="Novo pacote"
        onClick={() => setCreateOpen(true)}
        className="btn-primary-hover fab-above-nav fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
      >
        <IconPlus size={22} />
      </button>

      {/* MESMA folha para os dois casos, como no Belasis: sem id = "Novo
          pacote"; com id = "Visualizando pacote #N". */}
      <PacoteDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <PacoteDrawer
        isOpen={detailId !== null}
        packageId={detailId}
        onClose={() => setDetailId(null)}
      />

      {/* Perfil do cliente — aberto ao clicar no NOME do cliente numa linha. */}
      <ClientePerfilModal
        customer={cliente.data ?? null}
        isOpen={clienteId !== null && cliente.data != null}
        onClose={() => setClienteId(null)}
      />

      {/* Ações em lote do modo de seleção (bottom-sheet, mobile e desktop). */}
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

// Chip mobile "Ordenando por …" (dropdown Ticket/Data/Validade). Belasis.
const SORT_LABEL: Record<SortState['key'], string> = {
  ticket: 'Ticket',
  date: 'Data',
  validade: 'Validade',
};

function SortChip({
  sort,
  onChange,
}: {
  sort: SortState;
  onChange: (s: SortState) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: SortState['key'][] = ['ticket', 'date', 'validade'];
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-ink shadow-[var(--shadow-soft)]"
      >
        Ordenando por {SORT_LABEL[sort.key]}
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
          <path d="M0 0l5 6 5-6z" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
      )}
      <div
        role="menu"
        aria-hidden={!open}
        className={[
          'absolute left-0 top-8 z-20 min-w-36 origin-top overflow-hidden rounded-lg border border-line bg-card py-1 shadow-[var(--shadow-pop)]',
          'transition-all duration-200 ease-out',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0',
        ].join(' ')}
      >
        {options.map((k) => (
          <button
            key={k}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onChange({ key: k, dir: k === 'date' ? 'desc' : 'asc' });
            }}
            className={[
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas',
              sort.key === k ? 'text-primary font-semibold' : 'text-ink',
            ].join(' ')}
          >
            {SORT_LABEL[k]}
          </button>
        ))}
      </div>
    </div>
  );
}

// Coluna "Status" (consumo das sessões) — Belasis: Finalizado (cinza) / Em andamento (azul).
function StatusBadge({ value }: { value: 'finished' | 'ongoing' }) {
  const styles: Record<typeof value, string> = {
    finished:
      'bg-[color-mix(in_oklab,#777777_12%,transparent)] text-[#595959] border-[color-mix(in_oklab,#777777_30%,transparent)]',
    ongoing:
      'bg-[color-mix(in_oklab,#1677ff_12%,transparent)] text-[#1668dc] border-[color-mix(in_oklab,#1677ff_28%,transparent)]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[value]}`}
    >
      {STATUS_LABEL[value]}
    </span>
  );
}

// Coluna "Disponibilidade" (validade) — Belasis: Ativo (verde) / Vencido (vermelho).
function AvailBadge({ value }: { value: 'active' | 'expired' }) {
  const styles: Record<typeof value, string> = {
    active:
      'bg-[color-mix(in_oklab,#2fc25b_14%,transparent)] text-[#1f8f45] border-[color-mix(in_oklab,#2fc25b_30%,transparent)]',
    expired:
      'bg-[color-mix(in_oklab,#ff4d4f_12%,transparent)] text-[#c62b2d] border-[color-mix(in_oklab,#ff4d4f_28%,transparent)]',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[value]}`}
    >
      {AVAIL_LABEL[value]}
    </span>
  );
}

// Checkbox estilo Belasis (redondo, primário quando marcado).
function SelectBox({
  checked,
  onClick,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onClick: () => void;
  'aria-label': string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onClick}
      className={[
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-line bg-card',
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

// Cabeçalho de coluna sortável (carets ▲▼ como o Ant Table do Belasis).
function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortState['dir'];
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-4 py-3 font-semibold ${className ?? ''}`}>
      <button
        type="button"
        onClick={onClick}
        className={[
          'inline-flex items-center gap-1 font-semibold uppercase tracking-wide transition-colors',
          className?.includes('text-center') ? 'justify-center' : '',
          active ? 'text-primary' : 'text-muted-ink hover:text-ink',
        ].join(' ')}
      >
        {label}
        <span className="flex flex-col leading-[6px]">
          <svg width="8" height="6" viewBox="0 0 8 6" aria-hidden="true">
            <path
              d="M4 0l4 6H0z"
              fill="currentColor"
              opacity={active && dir === 'asc' ? 1 : 0.3}
            />
          </svg>
          <svg width="8" height="6" viewBox="0 0 8 6" aria-hidden="true">
            <path
              d="M4 6L0 0h8z"
              fill="currentColor"
              opacity={active && dir === 'desc' ? 1 : 0.3}
            />
          </svg>
        </span>
      </button>
    </th>
  );
}

// Ações da linha = menu (⋮) como no Belasis: Detalhes / Excluir.
function RowMenu({
  onDetail,
  onDelete,
  deleting,
}: {
  onDetail: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex justify-center">
      <IconTip label="Ações">
        <button
          type="button"
          aria-label="Ações"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded p-1 text-muted-ink hover:bg-canvas hover:text-primary"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="8" cy="3" r="1.4" />
            <circle cx="8" cy="8" r="1.4" />
            <circle cx="8" cy="13" r="1.4" />
          </svg>
        </button>
      </IconTip>
      {open && (
        <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
      )}
      <div
        role="menu"
        aria-hidden={!open}
        className={[
          'absolute right-0 top-8 z-20 min-w-36 origin-top overflow-hidden rounded-lg border border-line bg-card py-1 shadow-[var(--shadow-pop)]',
          'transition-all duration-200 ease-out',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0',
        ].join(' ')}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onDetail();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink hover:bg-canvas"
        >
          <IconEye size={16} /> Detalhes
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={deleting}
          onClick={() => {
            setOpen(false);
            onDelete();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          <IconTrash size={16} /> Excluir
        </button>
      </div>
    </div>
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
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">{title}</p>
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

// ---------------------------------------------------------------------
// Drawer lateral: Novo pacote (clone do drawer do Belasis)
// ---------------------------------------------------------------------

// Linha editável de "Itens do pacote" (Belasis): serviço/produto avulso com
// qtde, valor unitário e desconto em R$; o total é calculado ao vivo.
interface PkgItem {
  uid: string;
  kind: 'service' | 'product';
  refId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number; // desconto em R$ por linha
}

let pkgUidSeq = 0;
const nextPkgUid = () => `pkg-${++pkgUidSeq}`;
const pkgItemTotal = (it: PkgItem) => Math.max(0, it.quantity * it.unitPrice - it.discount);
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Pacote — MESMA folha para criar e para visualizar, como no Belasis.
 *
 * `packageId` nulo → "Novo pacote"; com id → "Visualizando pacote #N".
 * As duas capturas do dono mostram o mesmo formulário: Cliente · Data ·
 * Validade / Pacote Predefinido · Vendedor / tabela de itens / totais à direita
 * / Observação. Só o cabeçalho, duas colunas da tabela (Saldo e Utilizados) e o
 * rodapé mudam. Antes eram TRÊS desenhos: este drawer com quatro abas, o
 * `PacotePerfilModal` com cartão de resumo, e nenhum igual à referência.
 * Ver estudo 50.
 */
export function PacoteDrawer({
  isOpen,
  onClose,
  packageId,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Sem id = criar. Com id = visualizar o pacote existente. */
  packageId?: string | null;
}) {
  const ver = Boolean(packageId);
  const detalhe = useCustomerPackage(packageId ?? undefined);
  const sell = useSellPackage();
  const remove = useDeleteCustomerPackage();
  const confirm = useConfirm();
  const templates = usePackageTemplates();
  const services = useServices();
  const professionals = useProfessionals();

  const [selectedCustomer, setSelectedCustomer] = useState<PickedCustomer | null>(null);
  const [date, setDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [items, setItems] = useState<PkgItem[]>([]);
  // Vira `true` assim que o usuário edita as linhas manualmente — nesse caso o
  // pacote deixa de ser "predefinido" e enviamos só o total (price) ao backend.
  const [itemsDirty, setItemsDirty] = useState(false);
  const [discount, setDiscount] = useState('');
  const [observation, setObservation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);

  const templateList = useMemo(() => templates.data ?? [], [templates.data]);
  const professionalList = useMemo(
    () => professionals.data?.data ?? [],
    [professionals.data],
  );
  // id do serviço → nome + preço, usado ao expandir um Pacote Predefinido em linhas.
  const servicePriceMap = useMemo(() => {
    const m = new Map<string, { name: string; price: number }>();
    for (const s of services.data?.data ?? []) {
      m.set(s.id, { name: s.name, price: Number(s.price) || 0 });
    }
    return m;
  }, [services.data]);

  useEffect(() => {
    if (isOpen && !ver) {
      setSelectedCustomer(null);
      setDate(todayIso());
      setValidUntil('');
      setTemplateId('');
      setSellerId('');
      setItems([]);
      setItemsDirty(false);
      setDiscount('');
      setObservation('');
      setError(null);
      setCustomerPickerOpen(false);
      setItemPickerOpen(false);
    }
  }, [isOpen, ver]);

  const pacote = ver ? detalhe.data ?? null : null;

  // Pacote Predefinido = ATALHO: preenche as linhas de itens a partir do modelo.
  // Não é obrigatório — o usuário pode montar itens do zero (Belasis permite).
  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templateList.find((t) => t.id === id);
    if (!tpl) return;
    setItems(
      tpl.items.map((it) => {
        const svc = servicePriceMap.get(it.serviceId);
        return {
          uid: nextPkgUid(),
          kind: 'service' as const,
          refId: it.serviceId,
          name: it.service?.name ?? svc?.name ?? 'Serviço',
          quantity: it.sessions,
          unitPrice: svc?.price ?? 0,
          discount: 0,
        };
      }),
    );
    setItemsDirty(false);
  }

  function addItem(picked: PickedItem) {
    setItems((prev) => [
      ...prev,
      {
        uid: nextPkgUid(),
        kind: picked.kind,
        refId: picked.refId,
        name: picked.name,
        quantity: 1,
        unitPrice: picked.unitPrice,
        discount: 0,
      },
    ]);
    setItemsDirty(true);
  }

  function patchItem(uid: string, patch: Partial<PkgItem>) {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
    setItemsDirty(true);
  }

  function removeItem(uid: string) {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
    setItemsDirty(true);
  }

  const itemsSubtotal = items.reduce((s, it) => s + pkgItemTotal(it), 0);
  const pkgDiscount = discount !== '' ? Number(discount) || 0 : 0;
  const grandTotal = ver
    ? Number(pacote?.price ?? 0)
    : Math.max(0, itemsSubtotal - pkgDiscount);

  const canSave = selectedCustomer !== null && items.length > 0 && !sell.isPending;

  async function handleSave() {
    if (!selectedCustomer) return;
    setError(null);
    try {
      // Backend aceita apenas customerId, templateId (opcional) e price (total).
      // Enviamos templateId SÓ quando as linhas não foram editadas — assim o
      // backend recria os itens do modelo. Ao customizar, o pacote vira avulso
      // (price = total ao vivo) e as linhas custom não têm persistência
      // individual no modelo atual. Vendedor / Data / Validade / Crédito /
      // Cashback / Observação são exibidos fielmente ao Belasis mas ainda não
      // têm coluna na API. // TODO backend
      const sendTemplateId = !itemsDirty && templateId !== '' ? templateId : undefined;
      await sell.mutateAsync({
        customerId: selectedCustomer.id,
        templateId: sendTemplateId,
        price: grandTotal,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar o pacote.');
    }
  }

  async function handleDeletePackage() {
    if (!pacote) return;
    const ok = await confirm({
      title: `Excluir pacote #${pacote.number}?`,
      message: 'O pacote sai da lista do cliente. As sessões já consumidas continuam nas comandas.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    await remove.mutateAsync(pacote.id);
    onClose();
  }

  /**
   * Valor unitário no modo VER.
   *
   * O schema guarda só o TOTAL do pacote (`CustomerPackage.price`) — não há
   * valor por item. Com um único item dá para dividir pelas sessões e chegar ao
   * mesmo número da referência (279,03 ÷ 3 = 93,01 no pacote #9 da Fátima). Com
   * mais de um item qualquer divisão seria chute, então mostra "—" em vez de
   * inventar. Ver estudo 50.
   */
  const unitarioVer = (sessoes: number): string => {
    if (!pacote || (pacote.items?.length ?? 0) !== 1 || sessoes <= 0) return '—';
    return formatMoney(Number(pacote.price ?? 0) / sessoes);
  };

  const itemGrid = 'grid-cols-[minmax(0,1.6fr)_72px_1fr_1fr_1fr_40px]';
  const itemGridVer = 'grid-cols-[minmax(0,1.4fr)_64px_64px_1fr_1fr_1fr_minmax(0,1fr)]';

  const titulo = ver
    ? `Visualizando pacote #${pacote?.number ?? ''}`
    : 'Novo pacote';

  return (
    <FullDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={titulo}
      footer={
        ver ? (
          <>
            {/* "Salvar" e "Ver pagamentos" existem no Belasis e ficam de fora
                aqui: não há PATCH /customer-packages/:id nem pagamento de
                pacote na API — botão que não salva engana mais do que ajuda. */}
            <Button
              variant="outline"
              className="text-danger"
              isDisabled={remove.isPending}
              onClick={handleDeletePackage}
            >
              <IconTrash size={16} /> Excluir
            </Button>
            <Button variant="primary" onClick={onClose}>
              Fechar
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" isDisabled={!canSave} onClick={handleSave}>
              {sell.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        )
      }
    >
      {/* Sub-drawers (portam para z-[90], sobem por cima deste FullDrawer z-[80]). */}
      {!ver && (
        <>
          <CustomerPickerDrawer
            isOpen={customerPickerOpen}
            onClose={() => setCustomerPickerOpen(false)}
            onSelect={setSelectedCustomer}
          />
          <ItemPickerDrawer
            isOpen={itemPickerOpen}
            onClose={() => setItemPickerOpen(false)}
            onSelect={addItem}
          />
        </>
      )}

      {/* Coluna do cliente à esquerda, como no Belasis (f_0153). */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <PacoteClienteAside
          customerId={ver ? pacote?.customerId ?? null : selectedCustomer?.id ?? null}
          nome={ver ? pacote?.customerName ?? null : selectedCustomer?.name ?? null}
          telefone={ver ? null : selectedCustomer?.phone ?? null}
          avatarUrl={ver ? null : selectedCustomer?.avatarUrl ?? null}
          // No modo VER o payload não traz telefone/foto: busca pelo cliente.
          buscarContato={ver}
          onSelecionarCliente={ver ? undefined : () => setCustomerPickerOpen(true)}
        />

        {/* `order-1 lg:order-2`: no mobile o formulário vem primeiro — senão a
            tela abre com um avatar ocupando tudo. */}
        <div className="order-1 flex min-w-0 flex-1 flex-col gap-4 lg:order-2">
          {ver && detalhe.isLoading ? (
            <LoadingState />
          ) : ver && detalhe.isError ? (
            <ErrorState onRetry={() => detalhe.refetch()} />
          ) : (
            <>
              {/* Linha 1 do Belasis: Cliente* · Data · Validade */}
              <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="Cliente" required>
                  {ver ? (
                    <ReadonlyBox>{pacote?.customerName ?? '—'}</ReadonlyBox>
                  ) : selectedCustomer ? (
                    <div className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2.5">
                      <CustomerAvatar
                        name={selectedCustomer.name}
                        avatarUrl={selectedCustomer.avatarUrl}
                      />
                      <div className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="truncate text-sm font-semibold text-foreground">
                          {selectedCustomer.name}
                        </span>
                        {selectedCustomer.phone ? (
                          <span className="truncate text-xs text-muted">
                            {formatPhone(selectedCustomer.phone)}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomerPickerOpen(true)}
                        className="shrink-0 text-xs font-semibold text-primary hover:underline"
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCustomerPickerOpen(true)}
                      className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 text-left text-sm text-muted-ink"
                    >
                      <span>Busque por um cliente</span>
                      <IconChevron size={16} className="shrink-0 text-muted-ink" />
                    </button>
                  )}
                </Field>

                <Field label="Data">
                  {ver ? (
                    // `createdAt` é o que existe: não há coluna de "data da
                    // venda". Nos pacotes importados isso é a data do import.
                    <ReadonlyBox>{formatDate(pacote?.createdAt)}</ReadonlyBox>
                  ) : (
                    <DatePicker value={date} onChange={setDate} ariaLabel="Data" />
                  )}
                </Field>

                <Field
                  label="Validade"
                  hint="Data limite para uso do pacote. Deixe em branco para não expirar."
                >
                  {ver ? (
                    <ReadonlyBox>
                      {pacote?.expiresAt ? formatDate(pacote.expiresAt) : 'Não expira'}
                    </ReadonlyBox>
                  ) : (
                    <DatePicker value={validUntil} onChange={setValidUntil} ariaLabel="Validade" />
                  )}
                </Field>
              </div>

              {/* Linha 2: Pacote Predefinido · Vendedor */}
              <div className="grid gap-3 lg:grid-cols-2">
                <Field label="Pacote Predefinido">
                  {ver ? (
                    <ReadonlyBox>{pacote?.template?.name ?? '—'}</ReadonlyBox>
                  ) : (
                    <>
                      <Select
                        aria-label="Pacote Predefinido"
                        selectedKey={templateId || null}
                        onSelectionChange={(k) => (k ? applyTemplate(String(k)) : setTemplateId(NONE))}
                      >
                        <Select.Trigger>
                          <Select.Value>
                            {({ isPlaceholder, selectedText }) =>
                              isPlaceholder ? 'Selecione um pacote predefinido' : selectedText
                            }
                          </Select.Value>
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {templateList.map((t) => (
                              <ListBox.Item key={t.id} id={t.id} textValue={t.name}>
                                {t.name}
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      <p className="mt-1 text-[11px] text-muted-ink">
                        Opcional — preenche os itens automaticamente. Você pode editá-los depois.
                      </p>
                    </>
                  )}
                </Field>

                <Field label="Vendedor">
                  {ver ? (
                    // Sem coluna de vendedor no schema — desabilitado, como na
                    // referência quando não há valor.
                    <ReadonlyBox>—</ReadonlyBox>
                  ) : (
                    <Select
                      aria-label="Vendedor"
                      selectedKey={sellerId || null}
                      onSelectionChange={(k) => setSellerId(k ? String(k) : NONE)}
                    >
                      <Select.Trigger>
                        <Select.Value>
                          {({ isPlaceholder, selectedText }) =>
                            isPlaceholder ? 'Selecione um vendedor' : selectedText
                          }
                        </Select.Value>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {professionalList.map((p) => (
                            <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                              {p.name}
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}
                </Field>
              </div>

              {/* Itens do pacote */}
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="border-b border-line bg-canvas px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">
                  Itens do pacote
                </div>

                <div
                  className={`hidden md:grid ${ver ? itemGridVer : itemGrid} items-center gap-2 border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-ink`}
                >
                  <span>Descrição</span>
                  {ver && <span className="text-center">Saldo</span>}
                  <span className="text-center">Qtde.</span>
                  <span className="text-right">Valor unitário</span>
                  <span className="text-right">Desconto</span>
                  <span className="text-right">Total</span>
                  {/* pl-4: sem folga, "TOTAL" e "UTILIZADOS" encostavam. */}
                  {ver ? <span className="pl-4">Utilizados</span> : <span />}
                </div>

                {ver ? (
                  (pacote?.items ?? []).length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-ink">
                      Este pacote não tem itens cadastrados.
                    </div>
                  ) : (
                    (pacote?.items ?? []).map((it) => (
                      <PkgItemRowVer
                        key={it.id}
                        item={it}
                        gridCls={itemGridVer}
                        unitario={unitarioVer(it.sessionsTotal)}
                        total={
                          (pacote?.items?.length ?? 0) === 1
                            ? formatMoney(Number(pacote?.price ?? 0))
                            : '—'
                        }
                      />
                    ))
                  )
                ) : items.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-ink">
                    Nenhum item. Use “Selecionar serviço ou produto” abaixo ou escolha um Pacote
                    Predefinido acima.
                  </div>
                ) : (
                  items.map((it) => (
                    <PkgItemRow
                      key={it.uid}
                      item={it}
                      gridCls={itemGrid}
                      onChange={(patch) => patchItem(it.uid, patch)}
                      onRemove={() => removeItem(it.uid)}
                    />
                  ))
                )}

                {!ver && (
                  <button
                    type="button"
                    onClick={() => setItemPickerOpen(true)}
                    className="flex w-full items-center gap-2 border-t border-line px-3 py-3 text-left text-sm font-medium text-primary hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                  >
                    <IconPlus size={15} /> Selecionar serviço ou produto
                  </button>
                )}
              </div>

              {/* Totais à direita: Desconto / Crédito / Cashback / Total */}
              <div className="flex justify-end">
                <div className="w-full sm:max-w-sm">
                  <SummaryRow label="Desconto">
                    {ver ? (
                      <div className="rounded-md border border-line bg-canvas px-2 py-1.5 text-right text-sm tabular-nums text-muted-ink">
                        R$ 0,00
                      </div>
                    ) : (
                      <TextField value={discount} onChange={setDiscount} aria-label="Desconto">
                        <Input type="number" placeholder="R$ 0,00" className="text-right" />
                      </TextField>
                    )}
                  </SummaryRow>
                  {/* Crédito e Cashback: sem coluna na API — desabilitados,
                      como aparecem na captura da referência. */}
                  <SummaryRow label="Crédito">
                    <div className="rounded-md border border-line bg-canvas px-2 py-1.5 text-right text-sm tabular-nums text-muted-ink">
                      R$ 0,00
                    </div>
                  </SummaryRow>
                  <SummaryRow label="Cashback">
                    <div className="rounded-md border border-line bg-canvas px-2 py-1.5 text-right text-sm tabular-nums text-muted-ink">
                      R$ 0,00
                    </div>
                  </SummaryRow>
                  <SummaryRow label="Total" strong>
                    <div className="px-1 text-right text-sm font-semibold tabular-nums text-ink">
                      {formatMoney(grandTotal)}
                    </div>
                  </SummaryRow>
                </div>
              </div>

              <Field label="Observação">
                {/* TODO backend: pacote não tem coluna de observação. */}
                <TextField
                  value={observation}
                  onChange={setObservation}
                  aria-label="Observação"
                  isDisabled={ver}
                >
                  <Input placeholder="Escreva aqui" />
                </TextField>
              </Field>

              {error && (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </FullDrawer>
  );
}

/** Campo somente-leitura com a mesma altura/borda dos inputs (modo "ver"). */
function ReadonlyBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center rounded-lg border border-line bg-canvas px-3 text-sm text-muted-ink">
      {children}
    </div>
  );
}

/**
 * Linha de item no modo VER — inclui "Saldo" e "Utilizados", as duas colunas
 * que só existem ao visualizar (na referência, "Comanda #2951").
 */
function PkgItemRowVer({
  item,
  gridCls,
  unitario,
  total,
}: {
  item: CustomerPackageDetailItem;
  gridCls: string;
  unitario: string;
  total: string;
}) {
  const usos = item.usages ?? [];
  return (
    <div className="border-b border-line/60 last:border-0">
      {/* Desktop */}
      <div className={`hidden md:grid ${gridCls} items-center gap-2 px-3 py-2 text-sm`}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
            <IconScissors size={15} />
          </span>
          <span className="truncate font-medium text-ink">{item.serviceName ?? '—'}</span>
        </div>
        <span className="text-center tabular-nums text-ink">{item.saldo}</span>
        <span className="text-center tabular-nums text-ink">{item.sessionsTotal}</span>
        <span className="text-right tabular-nums text-ink">{unitario}</span>
        <span className="text-right tabular-nums text-muted-ink">R$ 0,00</span>
        <span className="text-right font-semibold tabular-nums text-ink">{total}</span>
        <div className="flex flex-col pl-4 text-xs text-primary">
          {usos.length === 0 ? (
            <span className="text-muted-ink">—</span>
          ) : (
            usos.map((u) => (
              <span key={u.id}>
                {u.orderNumber != null ? `Comanda #${u.orderNumber}` : formatDate(u.usedAt)}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Mobile: cartão empilhado (a tabela não cabe em 390px) */}
      <div className="flex flex-col gap-1 px-3 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
            <IconScissors size={15} />
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink">
            {item.serviceName ?? '—'}
          </span>
          <span className="shrink-0 font-semibold tabular-nums text-ink">{total}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-9 text-xs text-muted-ink">
          <span>Saldo {item.saldo}</span>
          <span>Qtde. {item.sessionsTotal}</span>
          <span>Unit. {unitario}</span>
        </div>
        {usos.length > 0 && (
          <div className="flex flex-wrap gap-x-3 pl-9 text-xs text-primary">
            {usos.map((u) => (
              <span key={u.id}>
                {u.orderNumber != null ? `Comanda #${u.orderNumber}` : formatDate(u.usedAt)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1 text-xs font-medium text-muted-ink">
        {required && <span className="mr-0.5 text-danger">*</span>}
        {label}
        {hint && (
          <span title={hint} className="cursor-help text-muted-ink/70" aria-label={hint}>
            <IconHelpCircle size={13} />
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

// Linha editável de item do pacote (desktop: grid alinhado ao cabeçalho;
// mobile: card com inputs empilhados). Total calculado ao vivo.
function PkgItemRow({
  item,
  gridCls,
  onChange,
  onRemove,
}: {
  item: PkgItem;
  gridCls: string;
  onChange: (patch: Partial<PkgItem>) => void;
  onRemove: () => void;
}) {
  const Icon = item.kind === 'service' ? IconScissors : IconBox;
  const total = pkgItemTotal(item);
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const inputCls =
    'h-8 w-full rounded-md border border-line bg-white px-2 text-sm text-ink outline-none focus:border-primary';

  return (
    <div className="border-b border-line/60 last:border-0">
      {/* Desktop */}
      <div className={`hidden md:grid ${gridCls} items-center gap-2 px-3 py-2 text-sm`}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
            <Icon size={15} />
          </span>
          <span className="truncate font-medium text-ink">{item.name}</span>
        </div>
        <input
          type="number"
          min={0}
          step={1}
          value={item.quantity}
          aria-label="Quantidade"
          onChange={(e) => onChange({ quantity: num(e.target.value) })}
          className={`${inputCls} text-center`}
        />
        <input
          type="number"
          min={0}
          step={0.01}
          value={item.unitPrice}
          aria-label="Valor unitário"
          onChange={(e) => onChange({ unitPrice: num(e.target.value) })}
          className={`${inputCls} text-right`}
        />
        <input
          type="number"
          min={0}
          step={0.01}
          value={item.discount}
          aria-label="Desconto"
          onChange={(e) => onChange({ discount: num(e.target.value) })}
          className={`${inputCls} text-right`}
        />
        <span className="text-right font-semibold tabular-nums text-ink">
          {formatMoney(total)}
        </span>
        <button
          type="button"
          aria-label="Remover item"
          onClick={onRemove}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-ink transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <IconTrash size={15} />
        </button>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-2 px-3 py-2.5 md:hidden">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
            <Icon size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
            {item.name}
          </span>
          <button
            type="button"
            aria-label="Remover item"
            onClick={onRemove}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-ink hover:bg-danger/10 hover:text-danger"
          >
            <IconTrash size={15} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-0.5 text-[11px] text-muted-ink">
            Qtde.
            <input
              type="number"
              min={0}
              step={1}
              value={item.quantity}
              onChange={(e) => onChange({ quantity: num(e.target.value) })}
              className={`${inputCls} h-9`}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted-ink">
            Valor un.
            <input
              type="number"
              min={0}
              step={0.01}
              value={item.unitPrice}
              onChange={(e) => onChange({ unitPrice: num(e.target.value) })}
              className={`${inputCls} h-9`}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted-ink">
            Desconto
            <input
              type="number"
              min={0}
              step={0.01}
              value={item.discount}
              onChange={(e) => onChange({ discount: num(e.target.value) })}
              className={`${inputCls} h-9`}
            />
          </label>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-ink">Total</span>
          <span className="font-semibold tabular-nums text-ink">{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  strong,
  children,
}: {
  label: string;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3 py-1.5',
        strong ? 'mt-1 border-t border-line pt-2.5' : '',
      ].join(' ')}
    >
      <span
        className={[
          'text-sm',
          strong ? 'font-semibold text-ink' : 'text-muted-ink',
        ].join(' ')}
      >
        {label}
      </span>
      <div className="w-36 shrink-0">{children}</div>
    </div>
  );
}
