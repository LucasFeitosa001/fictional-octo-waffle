import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { useConfirm } from '../../components/ConfirmDialog';
import { DateField } from '../../components/DateRangeFilter';
import { DatePicker } from '../../components/DatePicker';
import { Drawer } from '../../components/Drawer';
import { FilterAside } from '../../components/FilterAside';
import { FilterCheckbox } from '../../components/FilterCheckbox';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { AppTabs } from '../../components/AppTabs';
import {
  IconClock,
  IconDownload,
  IconFilter,
  IconInfo,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconTrash,
} from '../../components/icons';
import { useSetPageActions } from '../../layout/PageActions';
import { formatDate, formatMoney, formatNumber, isoDate } from '../../lib/format';
import {
  useCreatePurchase,
  useDeletePurchase,
  useImportedXmls,
  usePurchase,
  usePurchases,
  useUpdatePurchase,
  type PurchaseRow,
} from '../../lib/queries/compras';
import { useProducts, useSuppliers } from '../../lib/queries/catalogo';
import {
  useFinancialAccounts,
  usePaymentMethods,
} from '../../lib/queries/financeiro';
import { useAutoCreate } from '../../lib/useAutoCreate';

const NONE = '';
const PAGE_SIZE = 20;

/** Fallback para compras legadas sem número: ticket curto derivado do id. */
function ticket(id: string) {
  return `#${id.slice(-6).toUpperCase()}`;
}

/** Número real da compra (Onda 7). Compras legadas caem no ticket do id. */
function purchaseLabel(p: { number?: number | null; id: string }) {
  return p.number != null ? `#${p.number}` : ticket(p.id);
}

// ---------------------------------------------------------------------
// Status da compra (coluna "Status") e status de pagamento (coluna
// "Pagamento") — replicando o Belasis. O status de pagamento não é um
// campo próprio no schema: derivamos da presença de forma de pagamento.
// ---------------------------------------------------------------------

type Tone = 'success' | 'warning' | 'danger' | 'neutral';

const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  lancada: { label: 'Lançada', tone: 'success' },
  rascunho: { label: 'Rascunho', tone: 'warning' },
  cancelada: { label: 'Cancelada', tone: 'danger' },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, tone: 'neutral' as const };
}

// TODO: Purchase não tem coluna de status de pagamento; enquanto isso,
// consideramos "Finalizado" quando há forma de pagamento vinculada.
function paymentMeta(p: { paymentMethodId?: string | null }) {
  return p.paymentMethodId
    ? { label: 'Finalizado', tone: 'success' as const }
    : { label: 'Pendente', tone: 'warning' as const };
}

const TONE_CLASS: Record<Tone, string> = {
  success:
    'bg-[color-mix(in_oklab,var(--sp-success,#2fc25b)_14%,transparent)] text-[color-mix(in_oklab,var(--sp-success,#2fc25b)_80%,var(--sp-ink))]',
  warning:
    'bg-[color-mix(in_oklab,var(--sp-gold,#ffbb28)_18%,transparent)] text-gold-strong',
  danger: 'bg-danger/12 text-danger',
  neutral: 'bg-canvas text-muted-ink',
};

function Tag({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        TONE_CLASS[tone],
      ].join(' ')}
    >
      {children}
    </span>
  );
}

type SortKey = 'ticket' | 'date';
type SortDir = 'asc' | 'desc';
type PurchaseTab = 'compras' | 'xmls';

const PURCHASE_TABS = [
  { id: 'compras', label: 'Compras', icon: <IconReceipt size={16} /> },
  { id: 'xmls', label: 'XMLs importados', icon: <IconDownload size={16} /> },
] satisfies { id: PurchaseTab; label: string; icon: ReactNode }[];

export function ComprasPage() {
  const [tab, setTab] = useState<PurchaseTab>('compras');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  // Status: checkboxes "Excluídas" (status='cancelada') / "Não excluídas".
  const [showExcluded, setShowExcluded] = useState(false);
  const [showNotExcluded, setShowNotExcluded] = useState(true);
  // Período: intervalo de datas (ISO YYYY-MM-DD).
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  // Fornecedor: single-select.
  const [supplierFilter, setSupplierFilter] = useState('');
  // Status de pagamento: RADIO (2 opções, sem "Todos").
  const [paymentFilter, setPaymentFilter] = useState<'finalizado' | 'pendente'>(
    'finalizado',
  );
  const [sortKey, setSortKey] = useState<SortKey>('ticket');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  const confirm = useConfirm();
  const purchases = usePurchases(search || undefined);
  const methods = usePaymentMethods();
  const suppliersQ = useSuppliers();
  const deletePurchase = useDeletePurchase();

  const methodName = useMemo(() => {
    const map = new Map<string, string>();
    (methods.data ?? []).forEach((m) => map.set(m.id, m.name));
    return map;
  }, [methods.data]);

  const allRows = purchases.data?.data ?? [];
  const total = purchases.data?.total ?? 0;

  // Filtros client-side (a API só filtra por busca).
  const filtered = useMemo(() => {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return allRows.filter((p) => {
      // Status: "Excluídas" = cancelada; "Não excluídas" = qualquer outro.
      const isExcluded = p.status === 'cancelada';
      if (isExcluded && !showExcluded) return false;
      if (!isExcluded && !showNotExcluded) return false;

      // Período
      if (fromMs != null || toMs != null) {
        const t = new Date(p.date).getTime();
        if (fromMs != null && t < fromMs) return false;
        if (toMs != null && t > toMs) return false;
      }

      // Fornecedor
      if (supplierFilter && p.supplierId !== supplierFilter) return false;

      // Pagamento (radio: finalizado / pendente)
      const paid = Boolean(p.paymentMethodId);
      if (paymentFilter === 'finalizado' && !paid) return false;
      if (paymentFilter === 'pendente' && paid) return false;

      return true;
    });
  }, [
    allRows,
    showExcluded,
    showNotExcluded,
    dateFrom,
    dateTo,
    supplierFilter,
    paymentFilter,
  ]);

  const rows = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'ticket') {
        return ((a.number ?? 0) - (b.number ?? 0)) * dir;
      }
      return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    showExcluded,
    showNotExcluded,
    dateFrom,
    dateTo,
    supplierFilter,
    paymentFilter,
    sortKey,
    sortDir,
  ]);

  // Contagem de filtros "não default" (default: só não-excluídas + finalizado).
  const activeFilterCount =
    (showExcluded ? 1 : 0) +
    (!showNotExcluded ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (supplierFilter ? 1 : 0) +
    (paymentFilter !== 'finalizado' ? 1 : 0);
  const hasFilters = Boolean(search) || activeFilterCount > 0;

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setShowExcluded(false);
    setShowNotExcluded(true);
    setDateFrom('');
    setDateTo('');
    setSupplierFilter('');
    setPaymentFilter('finalizado');
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  // Mobile: as ações do header (Buscar / Filtrar / Novo) vivem na BottomNav,
  // reutilizando exatamente os mesmos handlers dos botões desktop.
  useSetPageActions(
    [
      {
        key: 'buscar',
        label: 'Buscar',
        icon: <IconSearch size={22} />,
        onClick: () => setSearchOpen((v) => !v),
      },
      {
        key: 'filtros',
        label: 'Filtrar',
        icon: <IconFilter size={22} />,
        onClick: () => setFilterOpen((v) => !v),
      },
      {
        key: 'novo',
        label: 'Novo',
        icon: <IconPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
    ],
    [],
  );

  async function handleDelete(p: PurchaseRow) {
    const ok = await confirm({
      title: `Excluir a compra ${purchaseLabel(p)}?`,
      message: 'A entrada de estoque será estornada. Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deletePurchase.mutateAsync(p.id);
    } catch (err) {
      window.alert(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível excluir a compra.',
      );
    }
  }

  return (
    <div className="pb-10">
      {/* Cabeçalho: título + Buscar / Filtrar / Novo (igual Belasis) */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-1.5 text-xl font-semibold text-ink sm:text-2xl">
          Compras
          <span className="text-primary" aria-hidden="true" title="Ajuda">
            <IconInfo size={18} />
          </span>
        </h1>
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

      <AppTabs
        items={PURCHASE_TABS}
        selectedKey={tab}
        onSelectionChange={setTab}
        ariaLabel="Áreas de compras"
        className="mb-4"
      />

      {tab === 'compras' ? (
        <>
          {/* Barra de busca (revelada com animação). Fica SEMPRE montada;
              largura/opacity animam 0 ↔ pleno (padrão FilterAside). */}
          <div
            className={[
              'flex max-w-xl items-center gap-2 origin-left overflow-hidden',
              'transition-[width,opacity,transform,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              searchOpen
                ? 'mb-4 w-full translate-x-0 opacity-100'
                : 'pointer-events-none mb-0 w-0 -translate-x-3 opacity-0',
            ].join(' ')}
          >
            <TextField
              value={searchInput}
              onChange={setSearchInput}
              className="min-w-0 flex-1"
              aria-label="Buscar compra"
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
                  <CheckboxRow
                    checked={showExcluded}
                    onClick={() => setShowExcluded((v) => !v)}
                  >
                    Excluídas
                  </CheckboxRow>
                  <CheckboxRow
                    checked={showNotExcluded}
                    onClick={() => setShowNotExcluded((v) => !v)}
                  >
                    Não excluídas
                  </CheckboxRow>
                </FilterGroup>

                <FilterGroup title="Período">
                  <div className="flex flex-col gap-2">
                    <DateField
                      label="De"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={setDateFrom}
                    />
                    <DateField
                      label="Até"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={setDateTo}
                    />
                  </div>
                </FilterGroup>

                <FilterGroup title="Fornecedor">
                  <SelectField
                    ariaLabel="Fornecedor"
                    value={supplierFilter}
                    onChange={setSupplierFilter}
                    placeholder="Todos os fornecedores"
                    options={[
                      { id: '', name: 'Todos os fornecedores' },
                      ...(suppliersQ.data?.data ?? []).map((s) => ({
                        id: s.id,
                        name: s.name,
                      })),
                    ]}
                  />
                </FilterGroup>

                <FilterGroup title="Status de pagamento">
                  <CheckRow
                    checked={paymentFilter === 'finalizado'}
                    onClick={() => setPaymentFilter('finalizado')}
                  >
                    Finalizado
                  </CheckRow>
                  <CheckRow
                    checked={paymentFilter === 'pendente'}
                    onClick={() => setPaymentFilter('pendente')}
                  >
                    Pendente
                  </CheckRow>
                </FilterGroup>
            </FilterAside>

            {/* Conteúdo principal: tabela / cards */}
            <div className="min-w-0 flex-1">
              {purchases.isLoading ? (
                <LoadingState />
              ) : purchases.isError ? (
                <ErrorState onRetry={() => purchases.refetch()} />
              ) : rows.length === 0 ? (
                <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
                  <EmptyState
                    icon={<IconReceipt size={32} />}
                    title="Nenhum item encontrado"
                    description={
                      hasFilters
                        ? 'Verifique seus filtros e tente novamente.'
                        : 'Registre a primeira compra para dar entrada no estoque.'
                    }
                    action={
                      !hasFilters && (
                        <Button variant="primary" onClick={() => setCreateOpen(true)}>
                          <IconPlus size={16} /> Novo
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
                          <SortableTh
                            label="Ticket"
                            active={sortKey === 'ticket'}
                            dir={sortDir}
                            onClick={() => toggleSort('ticket')}
                            className="text-center"
                          />
                          <SortableTh
                            label="Data"
                            active={sortKey === 'date'}
                            dir={sortDir}
                            onClick={() => toggleSort('date')}
                          />
                          <th className="px-4 py-3 font-semibold">Fornecedor</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="px-4 py-3 text-right font-semibold">Valor</th>
                          <th className="px-4 py-3 font-semibold">Pagamento</th>
                          <th className="px-4 py-3 font-semibold">
                            Forma de pagamento
                          </th>
                          <th className="px-4 py-3 text-center font-semibold">
                            <span className="inline-flex text-muted-ink" aria-label="Configurar colunas">
                              <IconSettings size={15} />
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((p) => {
                          const st = statusMeta(p.status);
                          const pay = paymentMeta(p);
                          return (
                            <tr
                              key={p.id}
                              onClick={() => setEditId(p.id)}
                              className="cursor-pointer border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                            >
                              <td className="px-4 py-2.5 text-center">
                                <span className="font-semibold text-primary">
                                  {purchaseLabel(p)}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-muted-ink">
                                {formatDate(p.date)}
                              </td>
                              <td className="px-4 py-2.5">
                                {p.supplier?.name ?? (
                                  <span className="text-muted-ink">Sem fornecedor</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                <Tag tone={st.tone}>{st.label}</Tag>
                              </td>
                              <td className="px-4 py-2.5 text-right font-medium text-ink">
                                {formatMoney(p.total)}
                              </td>
                              <td className="px-4 py-2.5">
                                <Tag tone={pay.tone}>{pay.label}</Tag>
                              </td>
                              <td className="px-4 py-2.5 text-muted-ink">
                                {(p.paymentMethodId &&
                                  methodName.get(p.paymentMethodId)) ||
                                  '—'}
                              </td>
                              <td
                                className="px-4 py-2.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <RowActions
                                  onDelete={() => handleDelete(p)}
                                  deleting={deletePurchase.isPending}
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
                      const st = statusMeta(p.status);
                      const pay = paymentMeta(p);
                      return (
                        <li
                          key={p.id}
                          className="rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-card)]"
                        >
                          <button
                            type="button"
                            onClick={() => setEditId(p.id)}
                            className="flex w-full items-start gap-3 text-left"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                              <IconReceipt size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-ink">
                                  {purchaseLabel(p)}
                                </span>
                                <span className="font-semibold text-primary">
                                  {formatMoney(p.total)}
                                </span>
                              </div>
                              <div className="mt-0.5 truncate text-sm text-muted-ink">
                                {p.supplier?.name ?? 'Sem fornecedor'} ·{' '}
                                {formatDate(p.date)}
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <Tag tone={st.tone}>{st.label}</Tag>
                                <Tag tone={pay.tone}>{pay.label}</Tag>
                              </div>
                            </div>
                          </button>
                          <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-line/60 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label="Excluir"
                              className="text-danger"
                              isDisabled={deletePurchase.isPending}
                              onClick={() => handleDelete(p)}
                            >
                              <IconTrash size={14} /> Excluir
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Rodapé: contagem + paginação */}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-ink">
                    <span>{formatNumber(total)} no total</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Página anterior"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-card text-muted-ink transition-colors hover:bg-canvas disabled:opacity-40"
                      >
                        ‹
                      </button>
                      <span className="min-w-6 px-1 text-center font-medium text-ink">
                        {safePage}
                      </span>
                      <button
                        type="button"
                        aria-label="Próxima página"
                        disabled={safePage >= pageCount}
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-line bg-card text-muted-ink transition-colors hover:bg-canvas disabled:opacity-40"
                      >
                        ›
                      </button>
                      <span className="rounded-md border border-line bg-card px-2 py-1">
                        {PAGE_SIZE} / página
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      ) : (
        <XmlsTab />
      )}

      {/* Drawers laterais (Nova compra / Editar compra) */}
      <PurchaseDrawer
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <PurchaseDrawer
        mode="edit"
        editId={editId}
        isOpen={Boolean(editId)}
        onClose={() => setEditId(null)}
      />
    </div>
  );
}

// =====================================================================
// Aba XMLs Importados — estado honesto (parser de NF-e ainda indisponível)
// =====================================================================

const XML_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Pendente', tone: 'warning' },
  processed: { label: 'Processado', tone: 'success' },
  error: { label: 'Com erro', tone: 'danger' },
};

function xmlStatusMeta(status: string) {
  return XML_STATUS_META[status] ?? { label: status, tone: 'neutral' as const };
}

function XmlsTab() {
  const xmls = useImportedXmls();
  const rows = xmls.data?.data ?? [];

  function handleImport() {
    window.alert(
      'A importação automática de NF-e (XML) ainda não está disponível. ' +
        'Por enquanto, registre a compra manualmente na aba Compras.',
    );
  }

  return (
    <div className="rounded-xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">XMLs importados</h3>
          <p className="text-xs text-muted-ink">
            Notas fiscais (NF-e) recebidas para gerar compras.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleImport}>
          <IconDownload size={14} /> Importar XML
        </Button>
      </div>

      {xmls.isLoading ? (
        <LoadingState />
      ) : xmls.isError ? (
        <ErrorState onRetry={() => xmls.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconClock size={32} />}
          title="Nenhum XML importado"
          description="Ainda não há notas fiscais (XML) importadas. A importação automática de NF-e ainda não está disponível — registre as compras manualmente na aba Compras."
        />
      ) : (
        <div className="rounded-lg border border-line">
          <ul className="divide-y divide-line">
            {rows.map((x) => {
              const meta = xmlStatusMeta(x.status);
              return (
                <li
                  key={x.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">
                      {x.accessKey ?? 'NF-e sem chave de acesso'}
                    </div>
                    <div className="text-xs text-muted-ink">
                      {formatDate(x.createdAt)}
                    </div>
                  </div>
                  <Tag tone={meta.tone}>{meta.label}</Tag>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// Drawer de Nova compra / Editar compra (lateral, igual Belasis)
// =====================================================================

interface DraftItem {
  productId: string;
  quantity: string;
  unitCost: string;
  discount: string;
}

function emptyItem(): DraftItem {
  return { productId: '', quantity: '1', unitCost: '', discount: '' };
}

function PurchaseDrawer({
  mode,
  editId,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  editId?: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreatePurchase();
  const update = useUpdatePurchase();
  const suppliers = useSuppliers();
  const products = useProducts();
  const accounts = useFinancialAccounts();
  const methods = usePaymentMethods();
  const detail = usePurchase(mode === 'edit' ? editId ?? undefined : undefined);

  const [number, setNumber] = useState<number | null>(null);
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(isoDate(new Date()));
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [freight, setFreight] = useState('');
  const [otherExpenses, setOtherExpenses] = useState('');
  const [discount, setDiscount] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [accountId, setAccountId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset ao abrir em modo create.
  useEffect(() => {
    if (!isOpen || mode !== 'create') return;
    setNumber(null);
    setSupplierId('');
    setDate(isoDate(new Date()));
    setItems([emptyItem()]);
    setFreight('');
    setOtherExpenses('');
    setDiscount('');
    setOtherIncome('');
    setAccountId('');
    setPaymentMethodId('');
    setNotes('');
    setError(null);
  }, [isOpen, mode]);

  // Popula ao carregar o detalhe em modo edit.
  const detailData = detail.data;
  useEffect(() => {
    if (!isOpen || mode !== 'edit' || !detailData) return;
    setNumber(detailData.number ?? null);
    setSupplierId(detailData.supplierId ?? '');
    setDate(isoDate(new Date(detailData.date)));
    setItems(
      detailData.items.length
        ? detailData.items.map((it) => ({
            productId: it.productId,
            quantity: String(Number(it.quantity)),
            unitCost: String(Number(it.unitCost)),
            discount: Number(it.discount) ? String(Number(it.discount)) : '',
          }))
        : [emptyItem()],
    );
    setFreight(Number(detailData.freight) ? String(Number(detailData.freight)) : '');
    setOtherExpenses(
      Number(detailData.otherExpenses)
        ? String(Number(detailData.otherExpenses))
        : '',
    );
    setDiscount(
      Number(detailData.discount) ? String(Number(detailData.discount)) : '',
    );
    setOtherIncome(
      Number(detailData.otherIncome) ? String(Number(detailData.otherIncome)) : '',
    );
    setAccountId(detailData.accountId ?? '');
    setPaymentMethodId(detailData.paymentMethodId ?? '');
    setNotes(detailData.notes ?? '');
    setError(null);
  }, [isOpen, mode, detailData]);

  const productOptions = (products.data?.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    costPrice: p.costPrice,
    salePrice: p.salePrice,
  }));

  function salePriceOf(productId: string) {
    const prod = productOptions.find((p) => p.id === productId);
    return formatMoney(prod ? prod.salePrice : 0);
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function onPickProduct(index: number, productId: string) {
    const prod = productOptions.find((p) => p.id === productId);
    updateItem(index, {
      productId,
      unitCost:
        prod && Number(prod.costPrice) > 0
          ? String(prod.costPrice)
          : items[index].unitCost,
    });
  }

  function lineTotal(it: DraftItem) {
    const q = Number(it.quantity) || 0;
    const c = Number(it.unitCost) || 0;
    const d = Number(it.discount) || 0;
    return Math.max(0, q * c - d);
  }

  const grandTotal = useMemo(() => {
    const itemsSum = items.reduce((acc, it) => acc + lineTotal(it), 0);
    // Outras despesas somam e outras receitas subtraem do total persistido.
    return Math.max(
      0,
      itemsSum +
        (Number(freight) || 0) +
        (Number(otherExpenses) || 0) -
        (Number(discount) || 0) -
        (Number(otherIncome) || 0),
    );
  }, [items, freight, otherExpenses, discount, otherIncome]);

  const validItems = items.filter(
    (it) => it.productId && Number(it.quantity) > 0 && it.unitCost !== '',
  );
  const pending = create.isPending || update.isPending;
  const canSave = validItems.length > 0 && !pending;
  const loadingDetail = mode === 'edit' && detail.isLoading;

  async function handleSave() {
    setError(null);
    if (validItems.length === 0) {
      setError('Adicione ao menos um item com produto, quantidade e custo.');
      return;
    }
    const body = {
      supplierId: supplierId || undefined,
      date: new Date(`${date}T00:00:00`).toISOString(),
      items: validItems.map((it) => ({
        productId: it.productId,
        quantity: Number(it.quantity),
        unitCost: Number(it.unitCost),
        discount: it.discount !== '' ? Number(it.discount) : undefined,
      })),
      freight: freight !== '' ? Number(freight) : undefined,
      otherExpenses:
        otherExpenses !== '' ? Number(otherExpenses) : undefined,
      discount: discount !== '' ? Number(discount) : undefined,
      otherIncome: otherIncome !== '' ? Number(otherIncome) : undefined,
      accountId: accountId || undefined,
      paymentMethodId: paymentMethodId || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      if (mode === 'edit' && editId) {
        await update.mutateAsync({ id: editId, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar a compra.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar Compra' : 'Nova Compra'}
      widthClass="sm:w-[640px]"
      fullscreen
      footer={
        <>
          <button
            type="button"
            title="Ajuda"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium text-muted-ink transition-colors hover:bg-canvas"
          >
            <IconInfo size={15} /> Ajuda
          </button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={!canSave} onClick={handleSave}>
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: '#40C463' }}
          >
            Faturar
          </button>
        </>
      }
    >
      {loadingDetail ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Cabeçalho: Número / Fornecedor* / Data */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_minmax(0,220px)]">
            <Field label="Número">
              <input
                readOnly
                aria-label="Número da nota"
                value={number != null ? `#${number}` : ''}
                placeholder="Nº Nota"
                className="h-9 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-muted-ink outline-none placeholder:text-muted-ink/60"
              />
            </Field>
            <Field label="Fornecedor" required>
              <SelectField
                ariaLabel="Fornecedor"
                value={supplierId}
                onChange={setSupplierId}
                placeholder="Informe um fornecedor"
                options={(suppliers.data?.data ?? []).map((s) => ({
                  id: s.id,
                  name: s.name,
                }))}
              />
            </Field>
            <Field label="Data">
              <DatePicker value={date} onChange={setDate} ariaLabel="Data" />
            </Field>
          </div>

          {/* Itens */}
          <section className="flex flex-col gap-3">
            <SectionTitle
              title="Itens"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setItems((prev) => [...prev, emptyItem()])}
                >
                  <IconPlus size={14} /> Adicionar item
                </Button>
              }
            />

            {items.map((it, index) => (
              <div
                key={index}
                className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1.6fr)_84px_150px_120px_120px_120px_120px_40px]"
              >
                <ItemCell label="Produto" required={index === 0}>
                  <SelectField
                    ariaLabel="Produto"
                    value={it.productId}
                    onChange={(v) => onPickProduct(index, v)}
                    placeholder="Informe um produto"
                    options={productOptions.map((p) => ({ id: p.id, name: p.name }))}
                  />
                </ItemCell>
                <ItemCell label="Quantidade">
                  <TextField
                    value={it.quantity}
                    onChange={(v) => updateItem(index, { quantity: v })}
                    aria-label="Quantidade"
                  >
                    <Input type="number" min={0} placeholder="0" />
                  </TextField>
                </ItemCell>
                <ItemCell label="Entrada no estoque">
                  <div className="flex h-9 items-center justify-between rounded-xl border border-line bg-canvas px-3 text-sm text-muted-ink">
                    <span className="truncate">{it.quantity || '0'}</span>
                    <span className="text-muted-ink/60">unidade</span>
                  </div>
                </ItemCell>
                <ItemCell label="Lote">
                  <div className="flex h-9 items-center justify-between rounded-xl border border-line bg-canvas px-3 text-sm text-muted-ink/60">
                    <span>Lote</span>
                    <span aria-hidden="true">▾</span>
                  </div>
                </ItemCell>
                <ItemCell label="Custo">
                  <TextField
                    value={it.unitCost}
                    onChange={(v) => updateItem(index, { unitCost: v })}
                    aria-label="Custo"
                  >
                    <Input type="number" min={0} placeholder="0,00" />
                  </TextField>
                </ItemCell>
                <ItemCell label="Venda">
                  <div className="flex h-9 items-center rounded-xl border border-line bg-canvas px-3 text-sm text-muted-ink">
                    <span className="truncate">{salePriceOf(it.productId)}</span>
                  </div>
                </ItemCell>
                <ItemCell label="Total">
                  <div className="flex h-9 items-center rounded-xl border border-line bg-canvas px-3 text-sm font-medium text-ink">
                    <span className="truncate">{formatMoney(lineTotal(it))}</span>
                  </div>
                </ItemCell>
                <ItemCell label="">
                  <button
                    type="button"
                    aria-label="Remover item"
                    title="Remover item"
                    disabled={items.length <= 1}
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== index))
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-canvas text-danger transition-colors hover:bg-danger/10 disabled:text-muted-ink/40 disabled:hover:bg-canvas"
                  >
                    <IconTrash size={15} />
                  </button>
                </ItemCell>
              </div>
            ))}
          </section>

          {/* Outros valores */}
          <section className="flex flex-col gap-3">
            <SectionTitle title="Outros valores" />
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Frete">
                <AffixInput
                  sign="add"
                  value={freight}
                  onChange={setFreight}
                  ariaLabel="Frete"
                />
              </Field>
              <Field label="Outras Despesas">
                <AffixInput
                  sign="add"
                  value={otherExpenses}
                  onChange={setOtherExpenses}
                  ariaLabel="Outras despesas"
                />
              </Field>
              <Field label="Desconto">
                <AffixInput
                  sign="sub"
                  value={discount}
                  onChange={setDiscount}
                  ariaLabel="Desconto geral"
                />
              </Field>
              <Field label="Outras Receitas">
                <AffixInput
                  sign="sub"
                  value={otherIncome}
                  onChange={setOtherIncome}
                  ariaLabel="Outras receitas"
                />
              </Field>
            </div>
            <div className="flex justify-end">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-ink">Total :</span>
                <div className="flex h-9 w-[220px] items-center rounded-xl border border-line bg-canvas px-3 text-sm font-semibold text-ink">
                  {formatMoney(grandTotal)}
                </div>
              </div>
            </div>
          </section>

          {/* Observação */}
          <Field label="Observação">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label="Observação"
              placeholder="Observação"
              rows={3}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted-ink/60 focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </Field>

          {/* Pagamento (mantido — SPEC lista forma de pagamento p/ Compras) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Conta de pagamento (opcional)">
              <SelectField
                ariaLabel="Conta de pagamento"
                value={accountId}
                onChange={setAccountId}
                placeholder="Selecione a conta"
                options={(accounts.data ?? []).map((a) => ({
                  id: a.id,
                  name: a.name,
                }))}
              />
            </Field>
            <Field label="Forma de pagamento (opcional)">
              <SelectField
                ariaLabel="Forma de pagamento"
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                placeholder="Selecione a forma"
                options={(methods.data ?? []).map((m) => ({ id: m.id, name: m.name }))}
              />
            </Field>
          </div>

          <p className="text-xs text-muted-ink">
            Ao salvar, cada item dá entrada no estoque do produto correspondente.
          </p>

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// =====================================================================
// Subcomponentes de apresentação
// =====================================================================

interface Option {
  id: string;
  name: string;
}

function Caret({ dir }: { dir: SortDir }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="currentColor"
      className={dir === 'asc' ? 'rotate-180' : ''}
      aria-hidden="true"
    >
      <path d="M6 8L2 4h8z" />
    </svg>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className = '',
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={['px-4 py-3 font-semibold', className].join(' ')}>
      <button
        type="button"
        onClick={onClick}
        className={[
          'inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-ink',
          active ? 'text-ink' : '',
        ].join(' ')}
      >
        {label}
        <span className={active ? 'text-primary' : 'text-muted-ink/40'}>
          <Caret dir={active ? dir : 'desc'} />
        </span>
      </button>
    </th>
  );
}

function RowActions({
  onDelete,
  deleting,
}: {
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1 text-muted-ink">
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

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: ReactNode;
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

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
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
  children: ReactNode;
}) {
  return (
    <FilterCheckbox checked={checked} onToggle={onClick} className="px-1 py-1">
      {children}
    </FilterCheckbox>
  );
}

/** Checkbox de filtro (multi-seleção). Distinto do CheckRow (radio). */
function CheckboxRow({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <FilterCheckbox checked={checked} onToggle={onClick} className="px-1 py-1">
      {children}
    </FilterCheckbox>
  );
}

function SelectField({
  ariaLabel,
  value,
  onChange,
  options,
  placeholder = 'Selecione',
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
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
            isPlaceholder ? placeholder : selectedText
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-muted-ink">
        {required && <span className="mr-0.5 text-danger">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

/** Célula de item na grade da compra: label pequeno + campo. */
function ItemCell({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {label ? (
        <label className="truncate text-[13px] font-medium text-muted-ink">
          {required && <span className="mr-0.5 text-danger">*</span>}
          {label}
        </label>
      ) : (
        <span className="hidden h-[19px] sm:block" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}

/** Título de seção do drawer (Itens / Outros valores) com filete inferior. */
function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line pb-1.5">
      <span className="text-[15px] font-semibold text-ink">{title}</span>
      {action}
    </div>
  );
}

/** Input monetário com prefixo colorido (+ despesa / − receita), igual Belasis. */
function AffixInput({
  sign,
  value,
  onChange,
  ariaLabel,
}: {
  sign: 'add' | 'sub';
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
}) {
  const add = sign === 'add';
  return (
    <div className="flex h-9 items-stretch overflow-hidden rounded-xl border border-line bg-white">
      <span
        aria-hidden="true"
        className={[
          'flex w-9 shrink-0 items-center justify-center text-sm font-semibold',
          add ? 'bg-danger/10 text-danger' : 'bg-[#2fc25b]/12 text-[#2f9d54]',
        ].join(' ')}
      >
        {add ? '+' : '−'}
      </span>
      <input
        type="number"
        min={0}
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="R$ 0,00"
        className="min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-ink outline-none placeholder:text-muted-ink/60"
      />
    </div>
  );
}
