import { useEffect, useMemo, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { useConfirm } from '../components/ConfirmDialog';
import { FullDrawer } from '../components/FullDrawer';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  IconCheck,
  IconEye,
  IconFilter,
  IconLayers,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconTrash,
} from '../components/icons';
import { useSetPageActions } from '../layout/PageActions';
import { formatDate, formatMoney, formatNumber } from '../lib/format';
import { useCustomers, useServices } from '../lib/queries';
import { useAutoCreate } from '../lib/useAutoCreate';
import { PacotePerfilModal } from './PacotePerfilModal';
import {
  useCustomerPackages,
  useDeleteCustomerPackage,
  usePackageTemplates,
  useSellPackage,
  type CustomerPackage,
  type PackageStatus,
} from '../lib/queries/pacotes';

const NONE = '';
const PAGE_SIZE = 20;

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AvailFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  // Belasis ordena por Data (desc) por padrão; Ticket/Data/Validade são sortáveis.
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  useAutoCreate(() => setCreateOpen(true));

  // Ao sair do modo Selecionar, limpa a seleção (padrão Belasis).
  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  const confirm = useConfirm();
  const sold = useCustomerPackages();
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

  const pageIds = paged.map((p) => p.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function toggleAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    [
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
        onClick: () => setSelectMode((v) => !v),
        active: selectMode,
      },
      {
        key: 'novo',
        label: 'Novo',
        icon: <IconPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
    ],
    [filterOpen, selectMode],
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
      {/* Cabeçalho: título + Buscar / Filtrar / Novo (igual Belasis) */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Pacotes</h1>
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <ToolbarButton active={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
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

      {/* Desktop: barra de busca (toggle) */}
      {searchOpen && (
        <div className="mb-4 hidden max-w-xl items-center gap-2 md:flex">
          <TextField
            value={searchInput}
            onChange={setSearchInput}
            className="min-w-0 flex-1"
            aria-label="Buscar cliente"
          >
            <Input
              placeholder="Busque por um cliente"
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
              <label className="mb-1 block text-[11px] font-medium text-muted-ink">De</label>
              <TextField value={dateFrom} onChange={setDateFrom} aria-label="Data inicial">
                <Input type="date" />
              </TextField>
              <label className="mb-1 mt-2 block text-[11px] font-medium text-muted-ink">Até</label>
              <TextField value={dateTo} onChange={setDateTo} aria-label="Data final">
                <Input type="date" />
              </TextField>
            </FilterGroup>
            {/* TODO Belasis: filtros "Status de pagamento" e "Pagamento" (Bloqueado/Em aberto/
                Atrasado/Pago) e "Excluídos" não existem no modelo de dados atual. */}
          </aside>
        )}

        {/* Conteúdo principal */}
        <div className="min-w-0 flex-1">
          {sold.isLoading ? (
            <LoadingState />
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
              <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <th className="w-10 px-4 py-3">
                        <SelectBox
                          checked={allPageSelected}
                          onClick={toggleAllOnPage}
                          aria-label="Selecionar tudo"
                        />
                      </th>
                      <SortHeader
                        label="Ticket"
                        active={sort.key === 'ticket'}
                        dir={sort.dir}
                        onClick={() => cycleSort('ticket')}
                        className="text-center"
                      />
                      <SortHeader
                        label="Data"
                        active={sort.key === 'date'}
                        dir={sort.dir}
                        onClick={() => cycleSort('date')}
                      />
                      <SortHeader
                        label="Validade"
                        active={sort.key === 'validade'}
                        dir={sort.dir}
                        onClick={() => cycleSort('validade')}
                      />
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Disponibilidade</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor</th>
                      <th className="px-4 py-3 font-semibold">Nota Fiscal</th>
                      <th className="w-12 px-4 py-3" aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((p) => {
                      const av = availability(p);
                      const cs = consumption(p);
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                        >
                          <td className="px-4 py-2.5">
                            <SelectBox
                              checked={selected.has(p.id)}
                              onClick={() => toggleRow(p.id)}
                              aria-label={`Selecionar #${p.number}`}
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setDetailId(p.id)}
                              className="font-semibold text-primary hover:underline"
                            >
                              #{p.number}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-muted-ink">{formatDate(p.createdAt)}</td>
                          <td className="px-4 py-2.5 text-muted-ink">
                            {p.expiresAt ? formatDate(p.expiresAt) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <button
                              type="button"
                              onClick={() => setDetailId(p.id)}
                              className="min-w-0 truncate text-left font-medium text-ink hover:text-primary"
                            >
                              {p.customer?.name ?? '—'}
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge value={cs} />
                          </td>
                          <td className="px-4 py-2.5">
                            <AvailBadge value={av} />
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-ink">
                            {formatMoney(p.price)}
                          </td>
                          <td className="px-4 py-2.5">
                            {/* Belasis: coluna Nota Fiscal (emissão NFCe/NFe/NFSe).
                                A emissão de nota não é suportada pela API atual. // TODO */}
                            <button
                              type="button"
                              disabled
                              aria-label="Nota Fiscal"
                              title="Nota Fiscal (em breve)"
                              className="inline-flex items-center gap-1 rounded p-1 text-muted-ink/70 disabled:cursor-not-allowed"
                            >
                              <IconReceipt size={16} />
                            </button>
                          </td>
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

              {/* ===== Mobile: cards compactos padrão Belasis.
                  Linha 1: [checkbox?] #num CLIENTE  ......  R$ valor
                  Linha 2: data ...................... [pill status]
                  Sem "Detalhes"/"Excluir" no card; ambos via drawer/selectMode. */}
              <ul className="flex flex-col gap-2 md:hidden">
                {paged.map((p) => {
                  const cs = consumption(p);
                  const isSelected = selected.has(p.id);
                  const onCardClick = () => {
                    if (selectMode) toggleRow(p.id);
                    else setDetailId(p.id);
                  };
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={onCardClick}
                        className={[
                          'flex w-full items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left shadow-[var(--shadow-soft)] transition-colors',
                          isSelected
                            ? 'border-[var(--sp-primary)] bg-[color-mix(in_oklab,var(--sp-primary)_5%,white)]'
                            : 'border-[var(--color-soft-border)] active:bg-[color-mix(in_oklab,var(--sp-primary)_4%,white)]',
                        ].join(' ')}
                      >
                        {selectMode && (
                          <span
                            aria-hidden
                            className={[
                              'grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors',
                              isSelected
                                ? 'border-[var(--sp-primary)] bg-[var(--sp-primary)] text-white'
                                : 'border-[var(--color-soft-border)] bg-white',
                            ].join(' ')}
                          >
                            {isSelected && <IconCheck size={13} />}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <div className="min-w-0 flex-1 truncate text-[13px] leading-5">
                              <span className="font-semibold text-primary">#{p.number}</span>{' '}
                              <span className="text-foreground">{p.customer?.name ?? '—'}</span>
                            </div>
                            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                              {formatMoney(p.price)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-ink">{formatDate(p.createdAt)}</span>
                            <StatusBadge value={cs} />
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
        className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
      >
        <IconPlus size={22} />
      </button>

      {/* Drawer lateral de novo pacote (desliza da direita) */}
      <NovoPacoteDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Detalhe / perfil do pacote */}
      <PacotePerfilModal
        packageId={detailId ?? undefined}
        isOpen={detailId !== null}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Subcomponentes de apresentação
// ---------------------------------------------------------------------

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
      <button
        type="button"
        aria-label="Ações"
        title="Ações"
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
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 top-8 z-20 min-w-36 overflow-hidden rounded-lg border border-line bg-card py-1 shadow-[var(--shadow-pop)]"
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
        </>
      )}
    </div>
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
// Drawer lateral: Novo pacote (clone do drawer do Belasis)
// ---------------------------------------------------------------------

function NovoPacoteDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const sell = useSellPackage();
  const customers = useCustomers('');
  const templates = usePackageTemplates();
  const services = useServices();

  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const [cashback, setCashback] = useState('');
  const [observation, setObservation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'cliente' | 'itens' | 'pagamentos' | 'observacoes'>(
    'cliente',
  );

  const customerList = useMemo(() => customers.data?.data ?? [], [customers.data]);
  const templateList = useMemo(() => templates.data ?? [], [templates.data]);
  const serviceMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services.data?.data ?? []) m.set(s.id, s.name);
    return m;
  }, [services.data]);

  const selectedTemplate = templateList.find((t) => t.id === templateId) ?? null;

  useEffect(() => {
    if (isOpen) {
      setCustomerId('');
      setDate('');
      setValidUntil('');
      setTemplateId('');
      setPrice('');
      setDiscount('');
      setCreditNote('');
      setCashback('');
      setObservation('');
      setError(null);
      setSection('cliente');
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedTemplate) setPrice(selectedTemplate.price);
  }, [selectedTemplate]);

  const canSave = customerId !== '' && templateId !== '' && !sell.isPending;

  async function handleSave() {
    setError(null);
    try {
      // Data / Validade / Vendedor / Crédito / Cashback / Observação são exibidos
      // fielmente ao Belasis, mas a API atual só aceita cliente + modelo + valor. // TODO
      await sell.mutateAsync({
        customerId,
        templateId,
        price: price !== '' ? Number(price) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar o pacote.');
    }
  }

  return (
    <FullDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Novo pacote"
      sections={[
        { key: 'cliente', label: 'Cliente / Dados' },
        { key: 'itens', label: 'Itens do pacote' },
        { key: 'pagamentos', label: 'Pagamentos' },
        { key: 'observacoes', label: 'Observações' },
      ]}
      activeSection={section}
      onSectionChange={(k) =>
        setSection(k as 'cliente' | 'itens' | 'pagamentos' | 'observacoes')
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={!canSave} onClick={handleSave}>
            {sell.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {section === 'cliente' && (
          <>
            <Field label="Cliente" required>
              <Select
                aria-label="Cliente"
                selectedKey={customerId || null}
                onSelectionChange={(k) => setCustomerId(k ? String(k) : NONE)}
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ isPlaceholder, selectedText }) =>
                      isPlaceholder ? 'Busque por um cliente' : selectedText
                    }
                  </Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {customerList.map((c) => (
                      <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                        {c.name}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data">
                {/* TODO Belasis: data de emissão não é enviada pela API atual */}
                <TextField value={date} onChange={setDate} aria-label="Data">
                  <Input type="date" />
                </TextField>
              </Field>
              <Field label="Validade">
                {/* TODO Belasis: validade manual não é enviada pela API atual */}
                <TextField value={validUntil} onChange={setValidUntil} aria-label="Validade">
                  <Input type="date" />
                </TextField>
              </Field>
            </div>

            <Field label="Pacote Predefinido">
              <Select
                aria-label="Pacote Predefinido"
                selectedKey={templateId || null}
                onSelectionChange={(k) => setTemplateId(k ? String(k) : NONE)}
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
            </Field>

            <Field label="Vendedor">
              {/* TODO Belasis: seleção de vendedor não suportada pela API de venda atual */}
              <div className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-muted-ink">
                Selecione um vendedor
              </div>
            </Field>
          </>
        )}

        {section === 'itens' && (
          /* Itens do pacote — prévia do modelo selecionado (Belasis: tabela de itens) */
          <div className="rounded-lg border border-line">
            <div className="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">
              Itens do pacote
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-muted-ink">
                    <th className="px-3 py-2 font-semibold">Descrição</th>
                    <th className="px-3 py-2 text-center font-semibold">Qtde.</th>
                    <th className="px-3 py-2 text-right font-semibold">Valor unitário</th>
                    <th className="px-3 py-2 text-right font-semibold">Desconto</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTemplate && selectedTemplate.items.length > 0 ? (
                    selectedTemplate.items.map((it) => (
                      <tr key={it.id} className="border-b border-line/60 last:border-0">
                        <td className="px-3 py-2 text-ink">
                          {it.service?.name ?? serviceMap.get(it.serviceId) ?? 'Serviço'}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-ink">{it.sessions}</td>
                        <td className="px-3 py-2 text-right text-muted-ink">R$ —</td>
                        <td className="px-3 py-2 text-right text-muted-ink">R$ —</td>
                        <td className="px-3 py-2 text-right text-muted-ink">R$ —</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-sm text-muted-ink">
                        {templateId
                          ? 'Selecionar serviço'
                          : 'Selecione um Pacote Predefinido na aba "Cliente / Dados".'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {section === 'pagamentos' && (
          /* Resumo à direita (Belasis: Desconto / Crédito / Cashback / Total).
             Apenas Total (valor do pacote) é enviado pela API atual. */
          <div className="flex justify-end">
            <div className="w-full sm:max-w-sm">
              <SummaryRow label="Desconto">
                <TextField value={discount} onChange={setDiscount} aria-label="Desconto">
                  <Input type="number" placeholder="R$ 0,00" className="text-right" />
                </TextField>
              </SummaryRow>
              <SummaryRow label="Crédito">
                {/* TODO Belasis: crédito não enviado pela API atual */}
                <TextField value={creditNote} onChange={setCreditNote} aria-label="Crédito">
                  <Input type="number" placeholder="R$ 0,00" className="text-right" />
                </TextField>
              </SummaryRow>
              <SummaryRow label="Cashback">
                {/* TODO Belasis: cashback não enviado pela API atual */}
                <TextField value={cashback} onChange={setCashback} aria-label="Cashback">
                  <Input type="number" placeholder="R$ 0,00" className="text-right" />
                </TextField>
              </SummaryRow>
              <SummaryRow label="Total" strong>
                <TextField value={price} onChange={setPrice} aria-label="Total">
                  <Input
                    type="number"
                    placeholder="R$ 0,00"
                    className="text-right font-semibold"
                  />
                </TextField>
              </SummaryRow>
            </div>
          </div>
        )}

        {section === 'observacoes' && (
          <Field label="Observação">
            {/* TODO Belasis: observação não enviada pela API atual */}
            <TextField value={observation} onChange={setObservation} aria-label="Observação">
              <Input placeholder="Escreva aqui" />
            </TextField>
          </Field>
        )}

        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </FullDrawer>
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
