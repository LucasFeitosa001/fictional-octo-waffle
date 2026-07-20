import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../../components/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  IconClock,
  IconDownload,
  IconFilter,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconTrash,
  IconTruck,
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

export function ComprasPage() {
  const [tab, setTab] = useState<'compras' | 'xmls'>('compras');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todas' | string>('todas');
  const [paymentFilter, setPaymentFilter] = useState<
    'todos' | 'pendente' | 'finalizado'
  >('todos');
  const [sortKey, setSortKey] = useState<SortKey>('ticket');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  const purchases = usePurchases(search || undefined);
  const methods = usePaymentMethods();
  const deletePurchase = useDeletePurchase();

  const methodName = useMemo(() => {
    const map = new Map<string, string>();
    (methods.data ?? []).forEach((m) => map.set(m.id, m.name));
    return map;
  }, [methods.data]);

  const allRows = purchases.data?.data ?? [];
  const total = purchases.data?.total ?? 0;

  // Filtro por status/pagamento é client-side (a API só filtra por busca).
  const filtered = useMemo(() => {
    return allRows.filter((p) => {
      if (statusFilter !== 'todas' && p.status !== statusFilter) return false;
      if (paymentFilter !== 'todos') {
        const paid = Boolean(p.paymentMethodId);
        if (paymentFilter === 'finalizado' && !paid) return false;
        if (paymentFilter === 'pendente' && paid) return false;
      }
      return true;
    });
  }, [allRows, statusFilter, paymentFilter]);

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
  }, [search, statusFilter, paymentFilter, sortKey, sortDir]);

  const activeFilterCount =
    (statusFilter !== 'todas' ? 1 : 0) + (paymentFilter !== 'todos' ? 1 : 0);
  const hasFilters = Boolean(search) || activeFilterCount > 0;

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setStatusFilter('todas');
    setPaymentFilter('todos');
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
    if (
      !window.confirm(
        `Excluir a compra ${purchaseLabel(p)}? A entrada de estoque será estornada.`,
      )
    )
      return;
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
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Compras</h1>
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

      {/* Sub-abas: Compras / XMLs Importados */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-line">
        <SubTab active={tab === 'compras'} onClick={() => setTab('compras')}>
          <IconTruck size={15} /> Compras
        </SubTab>
        <SubTab active={tab === 'xmls'} onClick={() => setTab('xmls')}>
          <IconDownload size={15} /> XMLs Importados
        </SubTab>
      </div>

      {tab === 'compras' ? (
        <>
          {/* Barra de busca (toggle) */}
          {searchOpen && (
            <div className="mb-4 flex max-w-xl items-center gap-2">
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

                <FilterGroup title="Status de pagamento">
                  <CheckRow
                    checked={paymentFilter === 'todos'}
                    onClick={() => setPaymentFilter('todos')}
                  >
                    Todos
                  </CheckRow>
                  <CheckRow
                    checked={paymentFilter === 'pendente'}
                    onClick={() => setPaymentFilter('pendente')}
                  >
                    Pendente
                  </CheckRow>
                  <CheckRow
                    checked={paymentFilter === 'finalizado'}
                    onClick={() => setPaymentFilter('finalizado')}
                  >
                    Finalizado
                  </CheckRow>
                </FilterGroup>

                <FilterGroup title="Status">
                  <CheckRow
                    checked={statusFilter === 'todas'}
                    onClick={() => setStatusFilter('todas')}
                  >
                    Todas
                  </CheckRow>
                  <CheckRow
                    checked={statusFilter === 'lancada'}
                    onClick={() => setStatusFilter('lancada')}
                  >
                    Lançadas
                  </CheckRow>
                  <CheckRow
                    checked={statusFilter === 'rascunho'}
                    onClick={() => setStatusFilter('rascunho')}
                  >
                    Rascunho
                  </CheckRow>
                  <CheckRow
                    checked={statusFilter === 'cancelada'}
                    onClick={() => setStatusFilter('cancelada')}
                  >
                    Canceladas
                  </CheckRow>
                </FilterGroup>
              </aside>
            )}

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
                              className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                            >
                              <td className="px-4 py-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setEditId(p.id)}
                                  className="font-semibold text-primary hover:underline"
                                >
                                  {purchaseLabel(p)}
                                </button>
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
                              <td className="px-4 py-2.5">
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
                      {pageCount > 1 && (
                        <>
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
                        </>
                      )}
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
  const [otherExpenses, setOtherExpenses] = useState(''); // TODO: não persistido pela API
  const [discount, setDiscount] = useState('');
  const [otherIncome, setOtherIncome] = useState(''); // TODO: não persistido pela API
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
    setOtherExpenses('');
    setDiscount(
      Number(detailData.discount) ? String(Number(detailData.discount)) : '',
    );
    setOtherIncome('');
    setAccountId(detailData.accountId ?? '');
    setPaymentMethodId(detailData.paymentMethodId ?? '');
    setNotes(detailData.notes ?? '');
    setError(null);
  }, [isOpen, mode, detailData]);

  const productOptions = (products.data?.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    costPrice: p.costPrice,
  }));

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
    // Outras despesas somam / outras receitas subtraem no preview (TODO: não
    // persistidas pela API — só entram no total exibido para paridade visual).
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
      discount: discount !== '' ? Number(discount) : undefined,
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
      title={mode === 'edit' ? 'Editar compra' : 'Nova compra'}
      widthClass="sm:w-[620px]"
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
      {loadingDetail ? (
        <LoadingState />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Número">
              <div className="flex h-9 items-center rounded-md border border-line bg-canvas px-3 text-sm text-muted-ink">
                {number != null ? `#${number}` : 'Automático'}
              </div>
            </Field>
            <Field label="Fornecedor">
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
              <TextField value={date} onChange={setDate} aria-label="Data">
                <Input type="date" />
              </TextField>
            </Field>
          </div>

          {/* Itens */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-ink">Itens</label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                <IconPlus size={14} /> Adicionar item
              </Button>
            </div>

            {items.map((it, index) => (
              <div
                key={index}
                className="rounded-lg border border-line bg-canvas p-3"
              >
                <div className="mb-2">
                  <SelectField
                    ariaLabel="Produto"
                    value={it.productId}
                    onChange={(v) => onPickProduct(index, v)}
                    placeholder="Informe um produto"
                    options={productOptions.map((p) => ({ id: p.id, name: p.name }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MiniField label="Quantidade">
                    <TextField
                      value={it.quantity}
                      onChange={(v) => updateItem(index, { quantity: v })}
                      aria-label="Quantidade"
                    >
                      <Input type="number" min={0} placeholder="0" />
                    </TextField>
                  </MiniField>
                  <MiniField label="Custo">
                    <TextField
                      value={it.unitCost}
                      onChange={(v) => updateItem(index, { unitCost: v })}
                      aria-label="Custo"
                    >
                      <Input type="number" min={0} placeholder="0,00" />
                    </TextField>
                  </MiniField>
                  <MiniField label="Desconto">
                    <TextField
                      value={it.discount}
                      onChange={(v) => updateItem(index, { discount: v })}
                      aria-label="Desconto do item"
                    >
                      <Input type="number" min={0} placeholder="0,00" />
                    </TextField>
                  </MiniField>
                  <MiniField label="Total">
                    <div className="flex h-9 items-center justify-between gap-1 rounded-md border border-line bg-card px-2 text-sm font-medium text-ink">
                      <span className="truncate">{formatMoney(lineTotal(it))}</span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          aria-label="Remover item"
                          className="text-danger"
                          onClick={() =>
                            setItems((prev) => prev.filter((_, i) => i !== index))
                          }
                        >
                          <IconTrash size={14} />
                        </button>
                      )}
                    </div>
                  </MiniField>
                </div>
              </div>
            ))}
          </div>

          {/* Outros valores */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Frete">
              <TextField value={freight} onChange={setFreight} aria-label="Frete">
                <Input type="number" min={0} placeholder="0,00" />
              </TextField>
            </Field>
            <Field label="Outras Despesas">
              <TextField
                value={otherExpenses}
                onChange={setOtherExpenses}
                aria-label="Outras despesas"
              >
                <Input type="number" min={0} placeholder="0,00" />
              </TextField>
            </Field>
            <Field label="Desconto">
              <TextField
                value={discount}
                onChange={setDiscount}
                aria-label="Desconto geral"
              >
                <Input type="number" min={0} placeholder="0,00" />
              </TextField>
            </Field>
            <Field label="Outras Receitas">
              <TextField
                value={otherIncome}
                onChange={setOtherIncome}
                aria-label="Outras receitas"
              >
                <Input type="number" min={0} placeholder="0,00" />
              </TextField>
            </Field>
          </div>

          {/* Pagamento */}
          <div className="grid gap-3 sm:grid-cols-2">
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

          <Field label="Observação">
            <TextField value={notes} onChange={setNotes} aria-label="Observação">
              <Input placeholder="Anotações sobre a compra" />
            </TextField>
          </Field>

          <div className="flex items-center justify-between rounded-lg bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] px-3 py-2">
            <span className="text-sm font-medium text-primary">Total</span>
            <span className="text-lg font-bold text-ink">
              {formatMoney(grandTotal)}
            </span>
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

function SubTab({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        '-mb-px inline-flex items-center gap-1.5 border-b-2 px-1 pb-2.5 pt-1 text-sm font-medium transition-colors',
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-ink hover:text-ink',
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
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">{label}</label>
      {children}
    </div>
  );
}

function MiniField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted-ink">{label}</label>
      {children}
    </div>
  );
}
