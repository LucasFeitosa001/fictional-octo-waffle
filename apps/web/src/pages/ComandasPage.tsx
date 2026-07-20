import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { DateField } from '../components/DateRangeFilter';
import { Drawer } from '../components/Drawer';
import { FullDrawer } from '../components/FullDrawer';
import { HelpTooltip } from '../components/HelpTooltip';
import { useConfirm } from '../components/ConfirmDialog';
import {
  IconCheck,
  IconFilter,
  IconInfo,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconTrash,
} from '../components/icons';
import {
  useCreateOrder,
  useCustomers,
  useDeleteOrder,
  useOrders,
  useUpdateOrder,
} from '../lib/queries';
import { formatDate, formatMoney, isoDate } from '../lib/format';
import type { OrderRow } from '../lib/types';
import { useAutoCreate } from '../lib/useAutoCreate';
import { useSetPageActions } from '../layout/PageActions';

const PAGE_SIZE = 20;

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

const STATUS_OPTIONS = [
  { id: 'open', label: 'Aberta' },
  { id: 'finished', label: 'Finalizada' },
  { id: 'canceled', label: 'Cancelada' },
] as const;

type PayFilter = 'all' | 'paid' | 'pending';
const PAY_FILTERS: { id: PayFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'paid', label: 'Finalizado' },
  { id: 'pending', label: 'Pendente' },
];

/**
 * Métodos de pagamento apresentados no filtro (Belasis). A API `/orders` ainda
 * não expõe o método de pagamento na row, portanto o filtro é apresentacional
 * e será plugado quando o backend passar a devolver esse dado — nesse ponto
 * basta consumir `o.paymentMethod` no `rows` filter abaixo.
 */
const PAYMENT_METHODS = [
  { id: 'credit', label: 'Cartão de crédito' },
  { id: 'debit', label: 'Cartão de débito' },
  { id: 'cash', label: 'Dinheiro' },
  { id: 'pix', label: 'Pix' },
] as const;

// ---------------------------------------------------------------------------
// Presentation atoms (Belasis ant-tag look, themeable via --sp-* tokens)
// ---------------------------------------------------------------------------

/**
 * Status tag, matching Belasis (antd) pixel-for-pixel:
 * Finalizado = solid neutral gray (#777, white text); Em aberto = ant-tag-orange;
 * Cancelada = ant-tag-red. These are fixed semantic status colors.
 */
function StatusTag({ status }: { status: OrderRow['status'] }) {
  if (status === 'finished') {
    return (
      <span
        className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: '#777777' }}
      >
        Finalizado
      </span>
    );
  }
  if (status === 'canceled') {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-[#ffa39e] bg-[#fff1f0] px-2 py-0.5 text-xs font-medium text-[#cf1322]">
        Cancelada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-[#ffd591] bg-[#fff7e6] px-2 py-0.5 text-xs font-medium text-[#d46b08]">
      Em aberto
    </span>
  );
}

/**
 * Payment tag derived from status (the list endpoint carries no payment field):
 * finalizada = Pago (antd green tag), aberta = Pendente, cancelada = —.
 */
function PaymentTag({ status }: { status: OrderRow['status'] }) {
  if (status === 'canceled') return <span className="text-xs text-muted">—</span>;
  const paid = status === 'finished';
  return paid ? (
    <span className="inline-flex items-center rounded-[4px] border border-[#b7eb8f] bg-[#f6ffed] px-2 py-0.5 text-xs font-medium text-[#389e0d]">
      Pago
    </span>
  ) : (
    <span className="inline-flex items-center rounded-[4px] border border-[#ffd591] bg-[#fff7e6] px-2 py-0.5 text-xs font-medium text-[#d46b08]">
      Pendente
    </span>
  );
}

/** Nota Fiscal column: three (disabled) fiscal-doc status icons, as in Belasis. */
function NfCell() {
  // TODO: wire NFe/NFC-e/NFS-e emission status when the API exposes it.
  return (
    <div className="flex items-center gap-2 text-muted opacity-50">
      <IconReceipt size={14} />
      <IconReceipt size={14} />
      <IconReceipt size={14} />
    </div>
  );
}

function MenuIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

/** Per-row action dropdown (Belasis hamburger → Ver / Editar / Excluir). */
function RowMenu({
  onView,
  onEdit,
  onRemove,
  disableRemove,
}: {
  onView: () => void;
  onEdit: () => void;
  onRemove: () => void;
  disableRemove: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        aria-label="Ações"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-[color-mix(in_oklab,var(--sp-ink)_6%,transparent)] hover:text-foreground"
      >
        <MenuIcon />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-lg border border-[var(--color-soft-border)] bg-warm-white py-1 shadow-[var(--shadow-pop)]">
          <MenuItem onClick={() => { setOpen(false); onView(); }}>Ver comanda</MenuItem>
          <MenuItem onClick={() => { setOpen(false); onEdit(); }}>Editar</MenuItem>
          <MenuItem
            danger
            disabled={disableRemove}
            onClick={() => { setOpen(false); onRemove(); }}
          >
            Excluir
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'block w-full px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        danger
          ? 'text-danger hover:bg-danger/10'
          : 'text-foreground hover:bg-[color-mix(in_oklab,var(--sp-ink)_5%,transparent)]',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pagination (Belasis "N no total … 20 / página")
// ---------------------------------------------------------------------------

function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  const arr = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  let prev = 0;
  for (const n of arr) {
    if (n - prev > 1) out.push('gap');
    out.push(n);
    prev = n;
  }
  return out;
}

function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-1 text-sm">
      <span className="mr-2 text-muted">{total} no total</span>
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-[var(--color-soft-border)] px-2 text-muted-ink transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        ‹
      </button>
      {pageWindow(page, totalPages).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-muted">
            •••
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onPage(n)}
            aria-current={n === page ? 'page' : undefined}
            className={[
              'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-colors',
              n === page
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-[var(--color-soft-border)] text-foreground hover:border-primary/40 hover:text-primary',
            ].join(' ')}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        className="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-[var(--color-soft-border)] px-2 text-muted-ink transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        ›
      </button>
      <span className="ml-2 text-muted">{PAGE_SIZE} / página</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function ComandasPage() {
  const confirm = useConfirm();
  // Belasis: um único toggle "Excluídas / Não excluídas" (default: Não
  // excluídas). Carregamos tudo do endpoint e filtramos por status no cliente.
  const [showExcluidas, setShowExcluidas] = useState(false);
  const orders = useOrders();
  const del = useDeleteOrder();
  const allRows = useMemo(() => orders.data?.data ?? [], [orders.data]);

  const [range, setRange] = useState(monthRange);
  // The /orders endpoint only filters by status server-side, so date, customer,
  // payment and text are applied client-side over the loaded rows.
  const [customerId, setCustomerId] = useState<string>('all');
  const [payFilter, setPayFilter] = useState<PayFilter>('all');
  const [payMethods, setPayMethods] = useState<Set<string>>(
    () => new Set(PAYMENT_METHODS.map((m) => m.id)),
  );
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrderRow | null>(null);
  const [viewing, setViewing] = useState<OrderRow | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  useAutoCreate(() => setCreateOpen(true));

  // Ao sair do modo Selecionar, limpa a seleção (padrão Belasis).
  useEffect(() => {
    if (!selectMode) setSelected(new Set());
  }, [selectMode]);

  // Mobile: BottomNav = [Filtros, Selecionar, Novo]. Busca fica sempre no topo (input),
  // como no belasis.app — sem toggle. Selecionar habilita checkbox nos cards.
  useSetPageActions(
    [
      { key: 'filtros', label: 'Filtrar', icon: <IconFilter size={22} />, onClick: () => setShowFilters((v) => !v), active: showFilters },
      { key: 'selecionar', label: 'Selecionar', icon: <IconCheck size={22} />, onClick: () => setSelectMode((v) => !v), active: selectMode },
      { key: 'novo', label: 'Novo', icon: <IconPlus size={22} />, onClick: () => setCreateOpen(true) },
    ],
    [selectMode, showFilters],
  );

  const customerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of allRows) {
      if (o.customer?.id) map.set(o.customer.id, o.customer.name);
    }
    return [
      { id: 'all', name: 'Todos os clientes' },
      ...[...map.entries()].map(([id, name]) => ({ id, name })),
    ];
  }, [allRows]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '');
    return allRows.filter((o) => {
      // Belasis toggle "Excluídas / Não excluídas": default esconde canceladas.
      const isCanceled = o.status === 'canceled';
      if (showExcluidas ? !isCanceled : isCanceled) return false;
      const day = o.date?.slice(0, 10) ?? '';
      if (range.from && day && day < range.from) return false;
      if (range.to && day && day > range.to) return false;
      if (customerId !== 'all' && o.customer?.id !== customerId) return false;
      if (payFilter === 'paid' && o.status !== 'finished') return false;
      if (payFilter === 'pending' && o.status !== 'open') return false;
      // Forma de pagamento: nenhuma marcada = filtra tudo. Enquanto o backend
      // não devolver o método na row, tratamos "todas marcadas" como no-op.
      if (payMethods.size === 0) return false;
      if (q) {
        const inNumber = String(o.number).includes(q);
        const inName = (o.customer?.name ?? '').toLowerCase().includes(q);
        if (!inNumber && !inName) return false;
      }
      return true;
    });
  }, [allRows, showExcluidas, range.from, range.to, customerId, payFilter, payMethods, search]);

  // Reset to first page whenever the active filter set changes.
  useEffect(() => {
    setPage(1);
  }, [showExcluidas, range.from, range.to, customerId, payFilter, payMethods, search]);

  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page],
  );

  const allSelectedOnPage =
    pageRows.length > 0 && pageRows.every((o) => selected.has(o.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelectedOnPage) pageRows.forEach((o) => next.delete(o.id));
      else pageRows.forEach((o) => next.add(o.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRemove(o: OrderRow) {
    const ok = await confirm({
      title: `Excluir comanda #${o.number}?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(o.id);
    } catch {
      window.alert('Não foi possível excluir a comanda.');
    }
  }

  async function handleRemoveSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Excluir ${ids.length} comanda(s) selecionada(s)?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => del.mutateAsync(id)));
      setSelected(new Set());
    } catch {
      window.alert('Não foi possível excluir todas as comandas selecionadas.');
    }
  }

  const th =
    'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-ink';
  const td = 'whitespace-nowrap px-4 py-3 text-sm text-foreground';

  return (
    <div>
      <PageHeader
        title="Comandas"
        actions={
          <>
            <Button
              variant="outline"
              className="hidden md:inline-flex"
              onClick={() => setShowSearch((v) => !v)}
              aria-expanded={showSearch}
            >
              <IconSearch size={16} /> Buscar
            </Button>
            <Button
              variant="outline"
              className="hidden md:inline-flex"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <IconFilter size={16} /> Filtrar
            </Button>
            <Button
              variant="primary"
              className="hidden md:inline-flex"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus size={16} /> Novo
            </Button>
          </>
        }
      />

      <Card className="border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
        <Card.Content className="p-3 sm:p-4">
          {/* Mobile: input de busca SEMPRE visível no topo (padrão Belasis). */}
          <div className="mb-3 md:hidden">
            <TextField value={search} onChange={setSearch} aria-label="Buscar comanda">
              <Input placeholder="Digite para buscar" />
            </TextField>
          </div>
          {/* Desktop: continua sendo toggle via botão Buscar. */}
          {showSearch && (
            <div className="mb-4 hidden max-w-md md:block">
              <TextField
                value={search}
                onChange={setSearch}
                aria-label="Buscar comanda"
                autoFocus
              >
                <Input placeholder="Buscar por nº do ticket ou cliente…" />
              </TextField>
            </div>
          )}

          {showFilters && (
            <div className="mb-4 flex flex-col gap-4 rounded-xl border border-[var(--color-soft-border)] bg-white p-4">
              <div className="flex flex-col gap-1.5">
                <span className="inline-flex items-center text-xs font-semibold text-muted-ink">
                  Status
                  <HelpTooltip>Marcado exibe apenas comandas excluídas; desmarcado exibe as demais</HelpTooltip>
                </span>
                <label className="inline-flex w-fit items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--sp-primary)]"
                    checked={showExcluidas}
                    onChange={(e) => setShowExcluidas(e.target.checked)}
                  />
                  {showExcluidas ? 'Excluídas' : 'Não excluídas'}
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="inline-flex items-center text-xs font-semibold text-muted-ink">
                  Forma de pagamento
                  <HelpTooltip>Filtra pelas formas de pagamento registradas nas comandas</HelpTooltip>
                </span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--sp-primary)]"
                      checked={payMethods.size === PAYMENT_METHODS.length}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate =
                            payMethods.size > 0 && payMethods.size < PAYMENT_METHODS.length;
                        }
                      }}
                      onChange={(e) =>
                        setPayMethods(
                          e.target.checked
                            ? new Set(PAYMENT_METHODS.map((m) => m.id))
                            : new Set(),
                        )
                      }
                    />
                    Selecionar tudo
                  </label>
                  {PAYMENT_METHODS.map((m) => (
                    <label key={m.id} className="inline-flex items-center gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--sp-primary)]"
                        checked={payMethods.has(m.id)}
                        onChange={(e) =>
                          setPayMethods((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(m.id);
                            else next.delete(m.id);
                            return next;
                          })
                        }
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center text-xs font-semibold text-muted-ink">
                    Período
                    <HelpTooltip>Intervalo de datas usado para filtrar as comandas</HelpTooltip>
                  </span>
                  <div className="flex flex-wrap items-end gap-2">
                    <DateField
                      label="De"
                      value={range.from}
                      max={range.to}
                      onChange={(v) => setRange((r) => ({ ...r, from: v }))}
                    />
                    <DateField
                      label="Até"
                      value={range.to}
                      min={range.from}
                      onChange={(v) => setRange((r) => ({ ...r, to: v }))}
                    />
                  </div>
                </div>

                <div className="flex min-w-52 flex-col gap-1.5">
                  <span className="inline-flex items-center text-xs font-semibold text-muted-ink">
                    Cliente
                    <HelpTooltip>Mostra somente comandas deste cliente</HelpTooltip>
                  </span>
                  <Select
                    aria-label="Cliente"
                    selectedKey={customerId}
                    onSelectionChange={(k) => setCustomerId(String(k ?? 'all'))}
                  >
                    <Select.Trigger>
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {customerOptions.map((c) => (
                          <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                            {c.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="inline-flex items-center text-xs font-semibold text-muted-ink">
                    Status de pagamento
                    <HelpTooltip>Situação do pagamento: pago ou pendente</HelpTooltip>
                  </span>
                  <div className="inline-flex gap-1 rounded-lg border border-[var(--color-soft-border)] bg-canvas p-0.5">
                    {PAY_FILTERS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPayFilter(p.id)}
                        className={[
                          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                          payFilter === p.id
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-ink hover:text-foreground',
                        ].join(' ')}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {selected.size > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-danger"
                isDisabled={del.isPending}
                onClick={handleRemoveSelected}
              >
                <IconTrash size={14} /> Excluir ({selected.size})
              </Button>
            </div>
          )}

          {orders.isLoading ? (
            <LoadingState />
          ) : orders.isError ? (
            <ErrorState onRetry={() => orders.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconReceipt size={32} />}
              title="Nenhuma comanda"
              description={
                allRows.length > 0
                  ? 'Nenhuma comanda corresponde aos filtros. Ajuste o período ou o cliente.'
                  : 'As comandas aparecerão aqui conforme forem abertas.'
              }
              action={
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <IconPlus size={16} /> Nova comanda
                </Button>
              }
            />
          ) : (
            <>
              {/* Desktop / tablet: ant-table style */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-soft-border)] bg-[color-mix(in_oklab,var(--sp-ink)_3%,transparent)]">
                      <th className={`${th} w-10`}>
                        <input
                          type="checkbox"
                          aria-label="Selecionar tudo"
                          className="h-4 w-4 accent-[var(--sp-primary)]"
                          checked={allSelectedOnPage}
                          onChange={toggleAll}
                        />
                      </th>
                      <th className={th}>
                        Ticket
                        <HelpTooltip>Número sequencial da comanda</HelpTooltip>
                      </th>
                      <th className={th}>
                        Data
                        <HelpTooltip>Data de abertura da comanda</HelpTooltip>
                      </th>
                      <th className={th}>
                        Cliente
                        <HelpTooltip>Cliente vinculado à comanda (Avulso se sem cadastro)</HelpTooltip>
                      </th>
                      <th className={th}>
                        Status
                        <HelpTooltip>Situação atual da comanda</HelpTooltip>
                      </th>
                      <th className={`${th} text-right`}>
                        Valor
                        <HelpTooltip>Valor líquido da comanda após descontos</HelpTooltip>
                      </th>
                      <th className={th}>
                        Pagamento
                        <HelpTooltip>Situação do pagamento desta comanda</HelpTooltip>
                      </th>
                      <th className={th}>
                        Nota Fiscal
                        <HelpTooltip>Emissão de NFe, NFC-e e NFS-e</HelpTooltip>
                      </th>
                      <th className={`${th} w-12 text-center`} aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => setViewing(o)}
                        className="cursor-pointer border-b border-[var(--color-soft-border)] transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_4%,transparent)]"
                      >
                        <td className={td} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar comanda ${o.number}`}
                            className="h-4 w-4 accent-[var(--sp-primary)]"
                            checked={selected.has(o.id)}
                            onChange={() => toggleOne(o.id)}
                          />
                        </td>
                        <td className={td}>
                          <span className="font-semibold text-primary">#{o.number}</span>
                        </td>
                        <td className={`${td} text-muted-ink`}>{formatDate(o.date)}</td>
                        <td className={td}>
                          {o.customer ? (
                            <span
                              title={o.customer.name}
                              className="block max-w-[220px] truncate text-foreground"
                            >
                              {o.customer.name}
                            </span>
                          ) : (
                            <span className="text-muted">Avulso</span>
                          )}
                        </td>
                        <td className={td}>
                          <StatusTag status={o.status} />
                        </td>
                        <td className={`${td} text-right font-semibold tabular-nums`}>
                          {formatMoney(o.netTotal)}
                        </td>
                        <td className={td}>
                          <PaymentTag status={o.status} />
                        </td>
                        <td className={td}>
                          <NfCell />
                        </td>
                        <td className={`${td} text-center`} onClick={(e) => e.stopPropagation()}>
                          <RowMenu
                            onView={() => setViewing(o)}
                            onEdit={() => setEditing(o)}
                            onRemove={() => handleRemove(o)}
                            disableRemove={o.status === 'canceled' || del.isPending}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards compactos padrão Belasis.
                  Linha 1: [checkbox?] #num NOME  ......  R$ valor
                  Linha 2: data ...................... [pill status]
                  Sem "Excluir" no card; sem "Selecionar" fixo — ambos via BottomNav ⇒ selectMode. */}
              <ul className="flex flex-col gap-2 md:hidden">
                {pageRows.map((o) => {
                  const isSelected = selected.has(o.id);
                  const onCardClick = () => {
                    if (selectMode) toggleOne(o.id);
                    else setViewing(o);
                  };
                  return (
                    <li key={o.id}>
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
                              <span className="font-semibold text-primary">#{o.number}</span>{' '}
                              <span className="text-foreground">{o.customer?.name ?? 'Avulso'}</span>
                            </div>
                            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                              {formatMoney(o.netTotal)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] text-muted-ink">{formatDate(o.date)}</span>
                            <StatusTag status={o.status} />
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <Pagination page={page} total={rows.length} onPage={setPage} />
            </>
          )}
        </Card.Content>
      </Card>

      <NovoComandaDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditarComandaDrawer order={editing} onClose={() => setEditing(null)} />
      <VerComandaDrawer
        order={viewing}
        onClose={() => setViewing(null)}
        onEdit={(o) => {
          setViewing(null);
          setEditing(o);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawers (right side — Belasis Novo / Editar)
// ---------------------------------------------------------------------------

/** Vertical form field with a label above the control (ant-form-vertical). */
function Field({
  label,
  help,
  children,
  className,
}: {
  label: string;
  help?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      <label className="inline-flex items-center text-xs font-medium text-muted-ink">
        {label}
        {help && <HelpTooltip>{help}</HelpTooltip>}
      </label>
      {children}
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}

function NovoComandaDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateOrder();
  const customers = useCustomers('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const customerList = useMemo(() => customers.data?.data ?? [], [customers.data]);
  const today = formatDate(new Date().toISOString());

  useEffect(() => {
    if (isOpen) {
      setCustomerId('');
      setNotes('');
      setError(null);
    }
  }, [isOpen]);

  async function handleSave() {
    setError(null);
    try {
      await create.mutateAsync({
        customerId: customerId || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível criar a comanda.');
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Nova comanda"
      // Belasis: content-wrapper renderiza 1650px (near-fullscreen), cap em 95vw.
      widthClass="sm:w-[1180px] lg:w-[1650px] sm:max-w-[95vw]"
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-muted-ink" onClick={onClose}>
            <IconInfo size={16} /> Ajuda
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={create.isPending} onClick={handleSave}>
            {create.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
          {/* TODO: "Faturar" deveria salvar e finalizar/gerar pagamento. */}
          <Button variant="primary" isDisabled={create.isPending} onClick={handleSave}>
            <IconCheck size={16} /> Faturar
          </Button>
        </>
      }
    >
      {/* Belasis: drawer largo (1650px) → coluna principal (form + itens) e
          aside de totais à direita, como na captura new-open. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente" className="col-span-2">
              <Select
                aria-label="Cliente"
                selectedKey={customerId || null}
                onSelectionChange={(k) => setCustomerId(k ? String(k) : '')}
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ isPlaceholder, selectedText }) =>
                      isPlaceholder ? 'Busque pelo cliente' : selectedText
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
            <Field label="Data">
              {/* TODO: data editável quando o endpoint aceitar a data da comanda. */}
              <Input value={today} disabled aria-label="Data" />
            </Field>
            <Field label="Número da comanda" help="Gerado automaticamente ao salvar a comanda">
              {/* TODO: número é gerado automaticamente pelo backend. */}
              <Input value="Automático" disabled aria-label="Número da comanda" />
            </Field>
          </div>

          {/* Itens da comanda — apresentação fiel; wiring de itens ainda não existe
              no endpoint de criação, então mostramos o cabeçalho e um placeholder. */}
          <div>
            <div className="mb-2 text-sm font-semibold text-foreground">
              Itens da comanda
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
              <div className="grid grid-cols-[1.6fr_1.2fr_0.6fr_1fr_1fr_0.9fr] gap-2 border-b border-[var(--color-soft-border)] bg-[color-mix(in_oklab,var(--sp-ink)_3%,transparent)] px-3 py-2 text-[11px] font-semibold text-muted-ink">
                <span>Descrição</span>
                <span>Profissional</span>
                <span className="text-right">Qtde.</span>
                <span className="text-right">Valor unitário</span>
                <span className="text-right">Desconto</span>
                <span className="text-right">Total</span>
              </div>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-primary hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
              >
                <IconPlus size={15} /> Selecionar serviço
              </button>
            </div>
          </div>

          <Field label="Observações">
            <TextField value={notes} onChange={setNotes} aria-label="Observações">
              <Input placeholder="Escreva aqui" />
            </TextField>
          </Field>

          {error && <FormError message={error} />}
        </div>

        {/* Aside de totais (apresentação — TODO: cálculo real com itens/crédito/cashback). */}
        <aside className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm lg:sticky lg:top-0">
          <TotalLine label="Desconto" value={formatMoney(0)} />
          <TotalLine label="Crédito" value={formatMoney(0)} />
          <TotalLine label="Cashback" value={formatMoney(0)} />
          <div className="my-1 border-t border-[var(--color-soft-border)]" />
          <TotalLine label="Total" value={formatMoney(0)} strong />
        </aside>
      </div>
    </Drawer>
  );
}

function TotalLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? 'font-semibold text-foreground' : 'text-muted-ink'}>
        {label}
      </span>
      <span
        className={
          strong
            ? 'text-base font-bold tabular-nums text-foreground'
            : 'tabular-nums text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}

function EditarComandaDrawer({
  order,
  onClose,
}: {
  order: OrderRow | null;
  onClose: () => void;
}) {
  const update = useUpdateOrder();
  const [status, setStatus] = useState<'open' | 'finished' | 'canceled'>('open');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      setNotes('');
      setError(null);
    }
  }, [order]);

  async function handleSave() {
    if (!order) return;
    setError(null);
    try {
      await update.mutateAsync({
        id: order.id,
        body: { status, notes: notes.trim() || undefined },
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível atualizar a comanda.');
    }
  }

  return (
    <FullDrawer
      isOpen={order != null}
      onClose={onClose}
      title={order ? `Editando comanda #${order.number}` : 'Editando comanda'}
      widthClass="md:w-[1024px] lg:w-[1200px] xl:w-[1400px]"
      // Belasis: comanda é FORM ÚNICO scrollable (sem tabs, sem menu vertical)
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={update.isPending} onClick={handleSave}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {order && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente">
              <Input value={order.customer?.name ?? 'Avulso'} disabled aria-label="Cliente" />
            </Field>
            <Field label="Data">
              <Input value={formatDate(order.date)} disabled aria-label="Data" />
            </Field>
            <Field label="Valor">
              <Input value={formatMoney(order.netTotal)} disabled aria-label="Valor" />
            </Field>
            <Field label="Número">
              <Input value={`#${order.number}`} disabled aria-label="Número" />
            </Field>
          </div>
        )}
        <Field label="Status" help="Finalizada registra o faturamento; Cancelada não computa no caixa">
          <Select
            aria-label="Status"
            selectedKey={status}
            onSelectionChange={(k) => setStatus(String(k) as 'open' | 'finished' | 'canceled')}
          >
            <Select.Trigger>
              <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {STATUS_OPTIONS.map((s) => (
                  <ListBox.Item key={s.id} id={s.id} textValue={s.label}>
                    {s.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>
        <Field label="Observações">
          <TextField value={notes} onChange={setNotes} aria-label="Observações">
            <Input placeholder="Observações da comanda" />
          </TextField>
        </Field>
        {error && <FormError message={error} />}
      </div>
    </FullDrawer>
  );
}

/**
 * Drawer de detalhe (Ver comanda). Substitui a antiga navegação
 * `/comandas/:id` — abre lateralmente com os campos disponíveis na row.
 */
function VerComandaDrawer({
  order,
  onClose,
  onEdit,
}: {
  order: OrderRow | null;
  onClose: () => void;
  onEdit: (o: OrderRow) => void;
}) {
  return (
    <Drawer
      isOpen={order != null}
      onClose={onClose}
      title={order ? `Comanda #${order.number}` : 'Detalhe da comanda'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          {order && (
            <Button variant="primary" onClick={() => onEdit(order)}>
              Editar
            </Button>
          )}
        </>
      }
    >
      {order && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente">
              <Input value={order.customer?.name ?? 'Avulso'} disabled aria-label="Cliente" />
            </Field>
            <Field label="Data">
              <Input value={formatDate(order.date)} disabled aria-label="Data" />
            </Field>
            <Field label="Número">
              <Input value={`#${order.number}`} disabled aria-label="Número" />
            </Field>
            <Field label="Valor líquido">
              <Input value={formatMoney(order.netTotal)} disabled aria-label="Valor" />
            </Field>
            <Field label="Total bruto">
              <Input value={formatMoney(order.grossTotal)} disabled aria-label="Total bruto" />
            </Field>
            <Field label="Descontos">
              <Input value={formatMoney(order.discountTotal)} disabled aria-label="Descontos" />
            </Field>
          </div>
          <Field label="Status">
            <div>
              <StatusTag status={order.status} />
            </div>
          </Field>
          <Field label="Pagamento">
            <div>
              <PaymentTag status={order.status} />
            </div>
          </Field>
        </div>
      )}
    </Drawer>
  );
}
