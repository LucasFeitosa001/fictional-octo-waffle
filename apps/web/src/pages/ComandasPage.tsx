import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Checkbox, Input, ListBox, Select, Spinner, TextField } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiClientError, type Customer } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState } from '../components/States';
import { TableSkeleton } from '../components/Skeletons';
import { DateField } from '../components/DateRangeFilter';
import { DatePicker } from '../components/DatePicker';
import { Drawer } from '../components/Drawer';
import { ComandaDrawer } from '../components/ComandaDrawer';
import { HelpTooltip } from '../components/HelpTooltip';
import { IconTip } from '../components/IconTip';
import { InlineSearch } from '../components/InlineSearch';
import { ClientePerfilModal } from './ClientePerfilTabs';
import { useCustomer } from '../lib/queries/clientes';
import { FilterCheckbox } from '../components/FilterCheckbox';
import { useConfirm } from '../components/ConfirmDialog';
import {
  CustomerAvatar,
  CustomerPickerDrawer,
  type PickedCustomer,
} from '../components/CustomerPickerDrawer';
import { ItemPickerDrawer, type PickedItem } from '../components/ItemPickerDrawer';
import { ItemEditDrawer } from '../components/ItemEditDrawer';
import { AnimatedCheckbox } from '../components/AnimatedCheckbox';
import { BulkActionsSheet } from '../components/BulkActionsSheet';
import { FilterAside } from '../components/FilterAside';
import { useSelectMode, buildSelectActions, type BulkAction } from '../hooks/useSelectMode';
import {
  IconBox,
  IconCalendar,
  IconCheck,
  IconChevron,
  IconFilter,
  IconInfo,
  IconPencil,
  IconPlus,
  IconReceipt,
  IconScissors,
  IconTrash,
  IconUser,
  IconWhatsApp,
} from '../components/icons';
import {
  useAddOrderDiscount,
  useAddOrderItem,
  useAddOrderPayment,
  useApplyOrderCashback,
  useApplyOrderCredit,
  useCreateOrder,
  useDeleteOrder,
  useFinishOrder,
  useOrder,
  useOrders,
  useProfessionals,
  useRemoveOrderCashback,
  useRemoveOrderCredit,
  useRemoveOrderItem,
  useReopenOrder,
  useReverseOrderPayment,
} from '../lib/queries';
import { usePaymentMethods } from '../lib/queries/financeiro';
import { api } from '../lib/api';
import { formatDate, formatMoney, formatPhone, isoDate } from '../lib/format';
import type {
  OrderDetail,
  OrderItemDetail,
  OrderPaymentDetail,
  OrderRow,
} from '../lib/types';
import { useAutoCreate } from '../lib/useAutoCreate';
import { useSetPageActions } from '../layout/PageActions';

const PAGE_SIZE = 20;

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

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
    <span
      className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: '#faad14' }}
    >
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
      <IconTip label="Ações">
        <button
          type="button"
          aria-label="Ações"
          onClick={() => setOpen((v) => !v)}
          className="btn-ghost-hover inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-[color-mix(in_oklab,var(--sp-ink)_6%,transparent)] hover:text-foreground"
        >
          <MenuIcon />
        </button>
      </IconTip>
      <div
        role="menu"
        aria-hidden={!open}
        className={[
          'absolute right-0 z-20 mt-1 w-40 origin-top overflow-hidden rounded-lg border border-[var(--color-soft-border)] bg-warm-white py-1 shadow-[var(--shadow-pop)]',
          'transition-all duration-200 ease-out',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0',
        ].join(' ')}
      >
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
  // Desktop: painel de filtros inline (toggle pelo botão do PageHeader).
  const [showFilters, setShowFilters] = useState(false);
  // Mobile: painel de filtros vira bottom-sheet (Drawer), aberto pela BottomNav.
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<OrderRow | null>(null);
  // Clique no NOME do cliente abre o drawer do cliente (não a comanda).
  const [clienteId, setClienteId] = useState<string | null>(null);
  const cliente = useCustomer(clienteId);
  // Bottom-sheet das ações em lote (modo de seleção padronizado, Belasis).
  const [actionsOpen, setActionsOpen] = useState(false);
  useAutoCreate(() => setCreateOpen(true));

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

  // Modo de seleção padronizado (Belasis) sobre os ids VISÍVEIS na página.
  const ids = useMemo(() => pageRows.map((o) => o.id), [pageRows]);
  const sel = useSelectMode(ids);

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
    const idsToDelete = [...sel.selected];
    if (idsToDelete.length === 0) return;
    const ok = await confirm({
      title: `Excluir ${idsToDelete.length} comanda(s) selecionada(s)?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(idsToDelete.map((id) => del.mutateAsync(id)));
      setActionsOpen(false);
      sel.cancel();
    } catch {
      window.alert('Não foi possível excluir todas as comandas selecionadas.');
    }
  }

  // Ação em lote "Excluir" exibida na bottom-sheet "Ações" (modo de seleção).
  const bulkActions: BulkAction[] = [
    {
      key: 'delete',
      label: 'Excluir selecionadas',
      danger: true,
      icon: <IconTrash size={18} />,
      disabled: del.isPending,
      onClick: handleRemoveSelected,
    },
  ];

  // Mobile: BottomNav = [Filtrar, Selecionar, Novo]. Ao entrar no modo de seleção,
  // a barra vira [Cancelar · Selecionar todos · Ações] (buildSelectActions), igual
  // a Transações/Clientes. Busca fica sempre no topo (input), como no belasis.app.
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
          { key: 'filtros', label: 'Filtrar', icon: <IconFilter size={22} />, onClick: () => setMobileFilterOpen(true), active: mobileFilterOpen },
          { key: 'selecionar', label: 'Selecionar', icon: <IconCheck size={22} />, onClick: sel.enter },
          { key: 'novo', label: 'Novo', icon: <IconPlus size={22} />, onClick: () => setCreateOpen(true) },
        ],
    [sel.selectMode, sel.allSelected, sel.count, mobileFilterOpen],
  );

  const th =
    'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-ink';
  const td = 'whitespace-nowrap px-4 py-3 text-sm text-foreground';

  // Conteúdo do painel "Filtrar" — compartilhado entre o inline (desktop) e o
  // bottom-sheet (mobile), pra não duplicar os controles.
  const filterFields = (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="inline-flex items-center text-xs font-semibold text-muted-ink">
          Status
          <HelpTooltip>Marcado exibe apenas comandas excluídas; desmarcado exibe as demais</HelpTooltip>
        </span>
        <FilterCheckbox
          checked={showExcluidas}
          onChange={setShowExcluidas}
          className="w-fit"
        >
          {showExcluidas ? 'Excluídas' : 'Não excluídas'}
        </FilterCheckbox>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="inline-flex items-center text-xs font-semibold text-muted-ink">
          Forma de pagamento
          <HelpTooltip>Filtra pelas formas de pagamento registradas nas comandas</HelpTooltip>
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <FilterCheckbox
            className="w-fit"
            checked={payMethods.size === PAYMENT_METHODS.length}
            isIndeterminate={
              payMethods.size > 0 && payMethods.size < PAYMENT_METHODS.length
            }
            onChange={(next) =>
              setPayMethods(
                next ? new Set(PAYMENT_METHODS.map((m) => m.id)) : new Set(),
              )
            }
          >
            Selecionar tudo
          </FilterCheckbox>
          {PAYMENT_METHODS.map((m) => (
            <FilterCheckbox
              key={m.id}
              className="w-fit"
              checked={payMethods.has(m.id)}
              onChange={(next) =>
                setPayMethods((prev) => {
                  const nextSet = new Set(prev);
                  if (next) nextSet.add(m.id);
                  else nextSet.delete(m.id);
                  return nextSet;
                })
              }
            >
              {m.label}
            </FilterCheckbox>
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
    </>
  );

  return (
    // Toolbar compacta: reduz o mb-5 padrão do PageHeader para mb-3 só aqui,
    // encostando os botões da toolbar no conteúdo (sem folga excessiva no topo).
    <div className="[&>*:first-child]:mb-3">
      <PageHeader
        title="Comandas"
        titleAdornment={
          <HelpTooltip>
            Gerencie as comandas do salão: abertura, itens, pagamentos e fechamento.
          </HelpTooltip>
        }
        actions={
          <>
            {/* Busca inline (componente único de toolbar — ver InlineSearch). */}
            <InlineSearch
              open={showSearch}
              onOpenChange={setShowSearch}
              value={search}
              onValueChange={setSearch}
              placeholder="Buscar comanda"
            />
            <Button
              variant="outline"
              className="hidden md:inline-flex"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
            >
              <IconFilter size={16} /> Filtrar
            </Button>
            {/* Ações em massa (desktop): fixo à esquerda de "Novo". Sem seleção →
                entra no selectMode (revela os checkboxes da lista). Com itens
                marcados → mostra a contagem e abre a bottom-sheet de ações. */}
            <Button
              variant={sel.count > 0 ? 'primary' : 'outline'}
              className="hidden md:inline-flex"
              aria-expanded={actionsOpen}
              onClick={() => {
                if (sel.count > 0) setActionsOpen(true);
                else if (sel.selectMode) sel.cancel();
                else sel.enter();
              }}
            >
              <IconCheck size={16} />{' '}
              {sel.count > 0 ? `Ações (${sel.count})` : 'Ações'}
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

      {/* Mobile: input de busca SEMPRE visível no topo (padrão Belasis). */}
      <div className="mb-3 md:hidden">
        <TextField value={search} onChange={setSearch} aria-label="Buscar comanda">
          <Input placeholder="Digite para buscar" />
        </TextField>
      </div>

      {/* A busca do desktop agora é inline no header (ver actions do PageHeader). */}

      {/* Layout de listagem: painel de filtros desliza da ESQUERDA (FilterAside)
          e a lista fica num flex-1 que encolhe — o filtro NÃO cobre nem empurra a
          tabela por cima. No mobile o filtro é um bottom-sheet (Drawer, abaixo). */}
      <div className="flex flex-col gap-4 md:flex-row">
        <FilterAside open={showFilters} breakpoint="md" desktopOnly width="md:w-[300px]">
          <div className="flex flex-col gap-4">{filterFields}</div>
        </FilterAside>

        {/* Desktop: lista fluida. Sem container de altura fixa — usa o scroll do
            <main>; o cabeçalho de colunas gruda no topo (sticky top-0) e a
            paginação gruda embaixo (sticky bottom-0). Card sem overflow-hidden
            (que quebraria o sticky), então usamos um container próprio. */}
        <div className="hidden min-w-0 flex-1 md:block">
        <div className="rounded-2xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)]">
            {orders.isLoading ? (
              <TableSkeleton columns={7} card={false} variant="desktop" firstColAvatar={false} />
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
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-[var(--color-soft-border)] bg-[color-mix(in_oklab,var(--sp-ink)_3%,white)]">
                      <th className={`${th} w-10`}>
                        <Checkbox
                          isSelected={sel.allSelected}
                          onChange={sel.selectAll}
                          aria-label="Selecionar tudo"
                          className="shrink-0"
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
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
                          <Checkbox
                            isSelected={sel.isSelected(o.id)}
                            onChange={() => sel.toggle(o.id)}
                            aria-label={`Selecionar comanda ${o.number}`}
                            className="shrink-0"
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                            </Checkbox.Content>
                          </Checkbox>
                        </td>
                        <td className={td}>
                          <span className="font-semibold text-primary hover:underline">#{o.number}</span>
                        </td>
                        <td className={`${td} text-muted-ink`}>{formatDate(o.date)}</td>
                        <td className={td}>
                          {o.customer ? (
                            <button
                              type="button"
                              title={o.customer.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                setClienteId(o.customer!.id);
                              }}
                              className="block max-w-[220px] truncate text-left text-primary hover:underline"
                            >
                              {o.customer.name}
                            </button>
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
                            onEdit={() => setViewing(o)}
                            onRemove={() => handleRemove(o)}
                            disableRemove={o.status === 'canceled' || del.isPending}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Paginação grudada no rodapé do scroll (fundo sólido + z). O
                    -mx-4/-mb-4/px-4 compensa o padding do container para o fundo
                    cobrir a largura toda ao rolar. */}
                <div className="sticky bottom-0 z-10 -mx-4 -mb-4 border-t border-[var(--color-soft-border)] bg-white px-4 pt-3 pb-6">
                  <Pagination page={page} total={rows.length} onPage={setPage} />
                </div>
              </>
            )}
        </div>
        </div>
      </div>

      {/* Mobile: sem wrapper Card, cards compactos padrão Belasis. */}
      <div className="md:hidden">
        {orders.isLoading ? (
          <TableSkeleton variant="mobile" />
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
            {/* Linha 1: [checkbox?] #num NOME  ......  R$ valor
                Linha 2: data ...................... [pill status]
                Sem "Excluir" no card; sem "Selecionar" fixo — ambos via BottomNav ⇒ selectMode. */}
            {/* pb extra evita que o FAB de chat cubra a última comanda. */}
            <ul className="flex flex-col gap-2 pb-24">
              {pageRows.map((o) => {
                const isSelected = sel.isSelected(o.id);
                const onCardClick = () => {
                  if (sel.selectMode) sel.toggle(o.id);
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
                      {sel.selectMode && <AnimatedCheckbox checked={isSelected} />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="min-w-0 flex-1 truncate text-[13px] leading-5">
                            <span className="font-semibold text-primary hover:underline">#{o.number}</span>{' '}
                            {o.customer?.name ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setClienteId(o.customer!.id);
                                }}
                                className="font-semibold text-primary hover:underline"
                              >
                                {o.customer.name}
                              </button>
                            ) : (
                              <span className="italic text-muted">Avulso</span>
                            )}
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
      </div>

      <NovoComandaDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <ComandaDrawer order={viewing} onClose={() => setViewing(null)} />

      {/* Perfil do cliente — aberto ao clicar no NOME do cliente numa linha. */}
      <ClientePerfilModal
        customer={cliente.data ?? null}
        isOpen={clienteId !== null && cliente.data != null}
        onClose={() => setClienteId(null)}
      />

      {/* Filtros no mobile: bottom-sheet (sobe de baixo), em vez do painel inline
          do desktop. Reusa os mesmos controles (filterFields). */}
      <Drawer
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Filtrar"
        placement="bottom"
      >
        <div className="flex flex-col gap-4">{filterFields}</div>
      </Drawer>

      {/* Ações em lote (modo seleção) — bottom-sheet acionado por "Ações". */}
      <BulkActionsSheet
        isOpen={actionsOpen}
        onClose={() => setActionsOpen(false)}
        actions={bulkActions}
        count={sel.count}
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

// ---------------------------------------------------------------------------
// Nova comanda (create flow) — cliente rico, data editável, itens staged
// ---------------------------------------------------------------------------

/** One item staged locally before the order (and thus its id) exists. */
interface StagedItem {
  uid: string;
  kind: 'service' | 'product';
  refId: string;
  name: string;
  professionalId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

let stagedUidSeq = 0;
function nextStagedUid(): string {
  stagedUidSeq += 1;
  return `staged_${Date.now()}_${stagedUidSeq}`;
}

function itemTotal(it: { quantity: number; unitPrice: number; discount: number }): number {
  return Math.max(0, it.quantity * it.unitPrice - it.discount);
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
/** "segunda-feira" for the date caption (Belasis view shows the weekday). */
function weekdayLong(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : WEEKDAY_FMT.format(d);
}

const numInputCls =
  'h-11 w-full rounded-lg border border-default-200 bg-white px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary';

export function NovoComandaDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const create = useCreateOrder();
  const professionals = useProfessionals();
  const professionalItems = useMemo(
    () => professionals.data?.data ?? [],
    [professionals.data],
  );
  const professionalName = (id: string) =>
    professionalItems.find((p) => p.id === id)?.name ?? '';

  const [selectedCustomer, setSelectedCustomer] = useState<PickedCustomer | null>(null);
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<StagedItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Full reset whenever the drawer (re)opens.
  useEffect(() => {
    if (isOpen) {
      setSelectedCustomer(null);
      setDate(isoDate(new Date()));
      setNotes('');
      setItems([]);
      setPickerOpen(false);
      setItemPickerOpen(false);
      setEditingUid(null);
      setError(null);
      setSaving(false);
    }
  }, [isOpen]);

  const editingItem = items.find((i) => i.uid === editingUid) ?? null;

  const grossTotal = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const discountTotal = items.reduce((s, it) => s + it.discount, 0);
  const netTotal = Math.max(0, grossTotal - discountTotal);

  function addItem(picked: PickedItem) {
    setItems((prev) => [
      ...prev,
      {
        uid: nextStagedUid(),
        kind: picked.kind,
        refId: picked.refId,
        name: picked.name,
        professionalId: '',
        quantity: 1,
        unitPrice: picked.unitPrice,
        discount: 0,
      },
    ]);
  }

  function removeItem(uid: string) {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  }

  function saveEditedItem(patch: {
    professionalId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }) {
    if (!editingUid) return;
    setItems((prev) =>
      prev.map((i) => (i.uid === editingUid ? { ...i, ...patch } : i)),
    );
    setEditingUid(null);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      // 1) Create the order shell (customerId + date + notes).
      const order = await create.mutateAsync({
        customerId: selectedCustomer?.id || undefined,
        date: new Date(`${date}T12:00:00`).toISOString(),
        notes: notes.trim() || undefined,
      });
      // 2) Chain each staged item onto the new order.
      for (const it of items) {
        await api.post(`/orders/${order.id}/items`, {
          kind: it.kind,
          refId: it.refId,
          professionalId: it.professionalId || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount || undefined,
        });
      }
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      onClose();
    } catch (err) {
      // Keep the drawer open on failure so nothing is lost.
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível criar a comanda.',
      );
    } finally {
      setSaving(false);
    }
  }

  const gridCols = 'grid-cols-[1.6fr_1.2fr_0.5fr_1fr_1fr_1fr_64px]';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Nova comanda"
      // Belasis: content-wrapper renderiza 1650px (near-fullscreen), cap em 95vw.
      widthClass="sm:w-[1180px] lg:w-[1650px] sm:max-w-[95vw]"
      fullscreen
      footer={
        <>
          <Button variant="ghost" className="mr-auto text-muted-ink" onClick={onClose}>
            <IconInfo size={16} /> Ajuda
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={saving} onClick={handleSave}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
          {/* TODO: "Faturar" (2ª onda) deve salvar e abrir o fluxo de pagamento. */}
          <Button variant="primary" isDisabled={saving} onClick={handleSave}>
            <IconCheck size={16} /> Faturar
          </Button>
        </>
      }
    >
      {/* Sub-drawers (portal → z-[90], sobem por cima da comanda). */}
      <CustomerPickerDrawer
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(c) => setSelectedCustomer(c)}
      />
      <ItemPickerDrawer
        isOpen={itemPickerOpen}
        onClose={() => setItemPickerOpen(false)}
        onSelect={addItem}
      />
      <EditItemDrawer
        item={editingItem}
        professionals={professionalItems}
        onCancel={() => setEditingUid(null)}
        onSave={saveEditedItem}
      />

      {/* Belasis: drawer largo (1650px) → coluna principal (form + itens) e
          aside de totais à direita, como na captura new-open. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Cliente: botão → picker (vazio) ou card (preenchido). */}
            <Field label="Cliente" className="col-span-2">
              {selectedCustomer ? (
                <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-white px-3 py-2.5">
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
                    onClick={() => setPickerOpen(true)}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-default-200 bg-white px-3 text-left text-sm text-muted"
                >
                  <span>Selecionar cliente</span>
                  <IconChevron size={16} className="shrink-0 text-muted" />
                </button>
              )}
            </Field>

            <Field label="Data">
              <DatePicker value={date} onChange={setDate} ariaLabel="Data" />
              {weekdayLong(date) && (
                <span className="mt-1 text-xs capitalize text-muted">{weekdayLong(date)}</span>
              )}
            </Field>

            <Field label="Número da comanda" help="Gerado automaticamente ao salvar a comanda">
              {/* Número é gerado automaticamente pelo backend. */}
              <Input value="Automático" disabled aria-label="Número da comanda" />
            </Field>
          </div>

          {/* Itens da comanda — staged localmente; enviados no Salvar. */}
          <div>
            <div className="mb-2 text-sm font-semibold text-foreground">Itens da comanda</div>
            <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
              {/* Cabeçalho (desktop) */}
              <div
                className={`hidden lg:grid ${gridCols} items-center gap-2 border-b border-[var(--color-soft-border)] bg-[color-mix(in_oklab,var(--sp-ink)_3%,transparent)] px-3 py-2 text-[11px] font-semibold text-muted-ink`}
              >
                <span>Descrição</span>
                <span>Profissional</span>
                <span className="text-right">Qtde.</span>
                <span className="text-right">Valor unitário</span>
                <span className="text-right">Desconto</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {items.map((it) => {
                const prof = professionalName(it.professionalId);
                const Icon = it.kind === 'service' ? IconScissors : IconBox;
                return (
                  <div key={it.uid}>
                    {/* Desktop: linha alinhada ao grid do cabeçalho. */}
                    <div
                      className={`hidden lg:grid ${gridCols} items-center gap-2 border-b border-[var(--color-soft-border)] px-3 py-2.5 text-sm`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
                          <Icon size={15} />
                        </span>
                        <span className="truncate font-medium text-foreground">{it.name}</span>
                      </div>
                      <span className="truncate text-muted-ink">{prof || '—'}</span>
                      <span className="text-right tabular-nums">{it.quantity}</span>
                      <span className="text-right tabular-nums">{formatMoney(it.unitPrice)}</span>
                      <span className="text-right tabular-nums">{formatMoney(it.discount)}</span>
                      <span className="text-right font-semibold tabular-nums">
                        {formatMoney(itemTotal(it))}
                      </span>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          aria-label="Editar item"
                          onClick={() => setEditingUid(it.uid)}
                          className="grid h-7 w-7 place-items-center rounded-md text-muted-ink transition-colors hover:bg-[color-mix(in_oklab,var(--sp-ink)_6%,transparent)] hover:text-foreground"
                        >
                          <IconPencil size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label="Remover item"
                          onClick={() => removeItem(it.uid)}
                          className="grid h-7 w-7 place-items-center rounded-md text-muted-ink transition-colors hover:bg-danger/10 hover:text-danger"
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Mobile: card 2 linhas (f_003). */}
                    <div className="flex items-center gap-2 border-b border-[var(--color-soft-border)] px-3 py-2.5 lg:hidden">
                      <button
                        type="button"
                        onClick={() => setEditingUid(it.uid)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
                          <Icon size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-medium text-foreground">
                              {it.name}
                            </span>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                              {formatMoney(itemTotal(it))}
                            </span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                            <IconUser size={12} />
                            <span className="truncate">{prof || 'Sem profissional'}</span>
                          </span>
                        </span>
                        <IconChevron size={16} className="shrink-0 -rotate-90 text-muted" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remover item"
                        onClick={() => removeItem(it.uid)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-ink transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <IconTrash size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setItemPickerOpen(true)}
                className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-primary hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
              >
                <IconPlus size={15} /> Selecionar serviço ou produto
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

        {/* Aside de totais — ao vivo a partir dos itens staged. */}
        <aside className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm lg:sticky lg:top-0">
          <TotalLine label="Desconto" value={formatMoney(discountTotal)} />
          <TotalLine label="Crédito" value={formatMoney(0)} />
          <TotalLine label="Cashback" value={formatMoney(0)} />
          <div className="my-1 border-t border-[var(--color-soft-border)]" />
          <TotalLine label="Total" value={formatMoney(netTotal)} strong />
        </aside>
      </div>
    </Drawer>
  );
}

/**
 * Editar item (f_007/f_010) — mini bottom-sheet sobre a comanda: profissional,
 * preço + quantidade (mesma linha), desconto e total calculado. Aba "Lote" é 2ª
 * onda (backend inexistente), então mostramos só "Dados".
 */
function EditItemDrawer({
  item,
  professionals,
  onCancel,
  onSave,
}: {
  item: StagedItem | null;
  professionals: { id: string; name: string }[];
  onCancel: () => void;
  onSave: (patch: {
    professionalId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }) => void;
}) {
  const [professionalId, setProfessionalId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [discount, setDiscount] = useState('0');

  useEffect(() => {
    if (item) {
      setProfessionalId(item.professionalId);
      setQuantity(String(item.quantity));
      setUnitPrice(String(item.unitPrice));
      setDiscount(String(item.discount));
    }
  }, [item]);

  const qtyN = Math.max(1, Math.floor(Number(quantity) || 1));
  const priceN = Math.max(0, Number(unitPrice) || 0);
  const discN = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, qtyN * priceN - discN);

  return (
    <Drawer
      isOpen={item != null}
      onClose={onCancel}
      title={item?.name ?? 'Editar item'}
      widthClass="sm:w-[480px]"
      fullscreen
      zClass="z-[90]"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() =>
              onSave({ professionalId, quantity: qtyN, unitPrice: priceN, discount: discN })
            }
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Profissional">
          {/* Native select: HeroUI Select popover não abre bem dentro de bottom-sheet. */}
          <select
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            aria-label="Profissional"
            className={numInputCls}
          >
            <option value="">Sem profissional</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Preço (R$)">
            <input
              inputMode="decimal"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              aria-label="Preço"
              className={numInputCls}
            />
          </Field>
          <Field label="Quantidade">
            <input
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label="Quantidade"
              className={numInputCls}
            />
          </Field>
        </div>

        <Field label="Desconto (R$)">
          <input
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            aria-label="Desconto"
            className={numInputCls}
          />
        </Field>

        <div className="flex items-center justify-between border-t border-[var(--color-soft-border)] pt-3">
          <span className="text-sm text-muted-ink">Total</span>
          <span className="text-base font-bold tabular-nums text-foreground">
            {formatMoney(total)}
          </span>
        </div>
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

/** Parse "12,50"/"12.50" → finite number, or 0. */
function parseNum(value: string): number {
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Live line total for an order item (gross − discount). */
function lineTotal(it: OrderItemDetail): number {
  return Math.max(0, Number(it.grossValue) - Number(it.discount));
}

/**
 * Ver/Editar comanda (Belasis f_003) — drawer rico e editável (bottom-sheet no
 * mobile, lateral no desktop). Busca o pedido COMPLETO (useOrder) com
 * itens/descontos/pagamentos e espelha o layout: abas Dados | Notas Fiscais,
 * card do cliente + ações (Conversar / Ver cliente), data por extenso, itens
 * clicáveis (→ editar item), Desconto/Crédito/Cashback, totais ao vivo e
 * sub-drawer de Pagamentos + Faturar. Absorve o antigo "Editar" (o Belasis não
 * separa ver/editar).
 */
export function VerComandaDrawer({
  order,
  onClose,
}: {
  order: OrderRow | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const orderId = order?.id ?? '';
  const detailQ = useOrder(order?.id);
  const detail = detailQ.data;

  const professionals = useProfessionals();
  const professionalItems = useMemo(
    () => professionals.data?.data ?? [],
    [professionals.data],
  );

  const addItem = useAddOrderItem(orderId);
  const removeItem = useRemoveOrderItem(orderId);
  const finish = useFinishOrder(orderId);
  const reopen = useReopenOrder(orderId);
  const applyCredit = useApplyOrderCredit(orderId);
  const removeCredit = useRemoveOrderCredit(orderId);
  const applyCashback = useApplyOrderCashback(orderId);
  const removeCashback = useRemoveOrderCashback(orderId);

  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  // Guardamos apenas o id do item em edição e derivamos o objeto do detail
  // sempre fresco — assim add/remove de auxiliares/consumidos (que refazem o
  // GET da comanda) refletem no drawer de editar item sem re-seed.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [addingDiscount, setAddingDiscount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingItem = detail?.items.find((i) => i.id === editingItemId) ?? null;

  // Reset transient UI whenever a different comanda opens.
  useEffect(() => {
    setItemPickerOpen(false);
    setEditingItemId(null);
    setPaymentsOpen(false);
    setAddingDiscount(false);
    setError(null);
  }, [order?.id]);

  const editable = detail?.status === 'open';

  async function handleAddPicked(picked: PickedItem) {
    setError(null);
    try {
      await addItem.mutateAsync({
        kind: picked.kind,
        refId: picked.refId,
        unitPrice: picked.unitPrice,
        quantity: 1,
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível adicionar o item.');
    }
  }

  async function handleRemoveItem(item: OrderItemDetail) {
    setError(null);
    try {
      await removeItem.mutateAsync(item.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível remover o item.');
    }
  }

  async function handleFinish() {
    setError(null);
    try {
      await finish.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível faturar a comanda.');
      throw err;
    }
  }

  async function handleReopen() {
    setError(null);
    try {
      await reopen.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível reabrir a comanda.');
    }
  }

  const paidTotal = detail
    ? detail.payments
        .filter((p) => p.status !== 'reversed')
        .reduce((acc, p) => acc + Number(p.amount), 0)
    : 0;
  const remaining = detail ? Math.max(Number(detail.netTotal) - paidTotal, 0) : 0;

  return (
    <Drawer
      isOpen={order != null}
      onClose={onClose}
      title={order ? `Visualizando comanda #${order.number}` : 'Comanda'}
      widthClass="sm:w-[560px]"
      footer={
        <>
          <Button variant="outline" className="mr-auto" onClick={onClose}>
            Fechar
          </Button>
          {detail?.status === 'open' && (
            <Button
              variant="primary"
              onClick={() => setPaymentsOpen(true)}
              className="!bg-[#16a34a] !text-white hover:!bg-[#15803d]"
            >
              <IconCheck size={16} /> Pagamentos
            </Button>
          )}
          {detail?.status === 'finished' && (
            <Button variant="primary" isDisabled={reopen.isPending} onClick={handleReopen}>
              {reopen.isPending ? 'Reabrindo…' : 'Reabrir'}
            </Button>
          )}
        </>
      }
    >
      {/* Sub-drawers (z-[90], sobem por cima da comanda). */}
      <ItemPickerDrawer
        isOpen={itemPickerOpen}
        onClose={() => setItemPickerOpen(false)}
        onSelect={handleAddPicked}
      />
      <ItemEditDrawer
        orderId={orderId}
        item={editingItem}
        professionals={professionalItems}
        editable={editable}
        onClose={() => setEditingItemId(null)}
      />
      {detail && (
        <PagamentosDrawer
          isOpen={paymentsOpen}
          order={detail}
          paidTotal={paidTotal}
          remaining={remaining}
          faturando={finish.isPending}
          onClose={() => setPaymentsOpen(false)}
          onFaturar={async () => {
            await handleFinish();
            setPaymentsOpen(false);
          }}
        />
      )}

      {detailQ.isLoading || !detail ? (
        detailQ.isError ? (
          <div className="py-10">
            <ErrorState onRetry={() => detailQ.refetch()} />
          </div>
        ) : (
          <div className="flex items-center gap-2 py-10 text-sm text-muted">
            <Spinner size="sm" /> Carregando comanda…
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {/* Abas Dados | Notas Fiscais (Notas Fiscais → 2ª onda). */}
          <div className="inline-flex gap-1 self-start rounded-lg border border-[var(--color-soft-border)] bg-canvas p-0.5 text-sm">
            <span className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
              Dados
            </span>
            <span
              className="rounded-md px-3 py-1.5 font-medium text-muted opacity-60"
              title="Em breve"
            >
              Notas Fiscais
            </span>
          </div>

          {/* (1) Card do cliente + ações. */}
          <OrderCustomerCard
            detail={detail}
            onConversar={(phone) =>
              window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank', 'noopener')
            }
            onVerCliente={(cid) => {
              onClose();
              navigate(`/clientes/${cid}`);
            }}
          />

          {/* (2) Data por extenso. */}
          <div className="flex items-center gap-2 text-sm text-foreground">
            <IconCalendar size={16} className="text-muted" />
            <span className="capitalize">
              {weekdayLong(detail.date.slice(0, 10))}, {formatDate(detail.date)}
            </span>
          </div>

          {/* Status + Pagamento. */}
          <div className="flex items-center gap-2">
            <StatusTag status={detail.status} />
            <PaymentTag status={detail.status} />
          </div>

          {/* (3) Itens. */}
          <section>
            <div className="mb-2 text-sm font-semibold text-foreground">Itens</div>
            <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
              {detail.items.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted">Nenhum item adicionado.</div>
              )}
              {detail.items.map((it) => {
                const Icon = it.kind === 'service' ? IconScissors : IconBox;
                const name = it.itemName ?? (it.kind === 'service' ? 'Serviço' : 'Produto');
                return (
                  <div
                    key={it.id}
                    className="flex items-center gap-2 border-b border-[var(--color-soft-border)] px-3 py-2.5 last:border-b-0"
                  >
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => setEditingItemId(it.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:cursor-default"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{name}</span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {formatMoney(lineTotal(it))}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <IconUser size={12} />
                          <span className="truncate">
                            {it.professionalName || 'Sem profissional'}
                            {Number(it.quantity) !== 1 && ` · ${Number(it.quantity)}×`}
                          </span>
                        </span>
                      </span>
                      {editable && (
                        <IconChevron size={16} className="shrink-0 -rotate-90 text-muted" />
                      )}
                    </button>
                    {editable && (
                      <button
                        type="button"
                        aria-label="Remover item"
                        onClick={() => handleRemoveItem(it)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-ink transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <IconTrash size={15} />
                      </button>
                    )}
                  </div>
                );
              })}

              {editable && (
                <button
                  type="button"
                  onClick={() => setItemPickerOpen(true)}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-primary hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                >
                  <IconPlus size={15} /> Selecionar serviço ou produto
                </button>
              )}
            </div>
          </section>

          {/* (4) Desconto / Crédito / Cashback. */}
          <section className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm">
            <TotalLine label="Desconto" value={formatMoney(detail.discountTotal)} />
            {editable &&
              (addingDiscount ? (
                <AddDiscountInline orderId={orderId} onDone={() => setAddingDiscount(false)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingDiscount(true)}
                  className="mb-1 inline-flex items-center gap-1 self-start text-xs font-semibold text-primary hover:underline"
                >
                  <IconPlus size={13} /> Adicionar desconto
                </button>
              ))}

            <div className="my-1 border-t border-[var(--color-soft-border)]" />

            {/* Crédito e Cashback — abatem saldo do cliente (ledger). */}
            <LedgerLine
              label="Crédito"
              applied={Number(detail.creditUsed)}
              balance={Number(detail.customerBalance?.creditBalance ?? 0)}
              maxApply={Number(detail.netTotal) + Number(detail.creditUsed)}
              editable={editable}
              apply={applyCredit}
              remove={removeCredit}
            />
            <LedgerLine
              label="Cashback"
              applied={Number(detail.cashbackUsed)}
              balance={Number(detail.customerBalance?.cashbackBalance ?? 0)}
              maxApply={Number(detail.netTotal) + Number(detail.cashbackUsed)}
              editable={editable}
              apply={applyCashback}
              remove={removeCashback}
            />
          </section>

          {/* Totais ao vivo. */}
          <section className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm">
            <TotalLine label="Total bruto" value={formatMoney(detail.grossTotal)} />
            <TotalLine label="Descontos" value={`- ${formatMoney(detail.discountTotal)}`} />
            <div className="my-1 border-t border-[var(--color-soft-border)]" />
            <TotalLine label="Valor líquido" value={formatMoney(detail.netTotal)} strong />
            <TotalLine label="Total pago" value={formatMoney(paidTotal)} />
            <TotalLine label="Restante" value={formatMoney(remaining)} />
          </section>

          {error && <FormError message={error} />}
        </div>
      )}
    </Drawer>
  );
}

/**
 * Card do cliente (f_003): avatar + nome + telefone e duas ações lado a lado —
 * "Conversar" (abre WhatsApp) e "Ver cliente" (vai pro perfil). Avulso → sem ações.
 */
function OrderCustomerCard({
  detail,
  onConversar,
  onVerCliente,
}: {
  detail: OrderDetail;
  onConversar: (phone: string) => void;
  onVerCliente: (customerId: string) => void;
}) {
  const cust = detail.customer as (Customer & { avatarUrl?: string | null }) | null | undefined;

  if (!cust?.id) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2.5">
        <CustomerAvatar name={detail.customerName ?? 'Avulso'} size={44} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {detail.customerName ?? 'Avulso'}
          </div>
          <div className="text-xs italic text-muted">Sem cliente vinculado</div>
        </div>
      </div>
    );
  }

  const phone = cust.phone ?? null;

  return (
    <div className="rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-3">
      <div className="flex items-center gap-3">
        <CustomerAvatar name={cust.name} avatarUrl={cust.avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{cust.name}</div>
          {phone && <div className="truncate text-xs text-muted">{formatPhone(phone)}</div>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!phone}
          onClick={() => phone && onConversar(phone)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-soft-border)] py-2 text-sm font-medium text-foreground transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconWhatsApp size={16} /> Conversar
        </button>
        <button
          type="button"
          onClick={() => onVerCliente(cust.id)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-soft-border)] py-2 text-sm font-medium text-foreground transition-colors hover:bg-cream"
        >
          <IconUser size={16} /> Ver cliente
        </button>
      </div>
    </div>
  );
}

/** Desconto inline (POST /orders/:id/discounts) — valor R$ ou %. */
function AddDiscountInline({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const add = useAddOrderDiscount(orderId);
  const [type, setType] = useState<'value' | 'percent'>('value');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    const v = parseNum(value);
    if (v <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      await add.mutateAsync({ type, value: v });
      setValue('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível aplicar o desconto.');
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-[var(--color-soft-border)] pt-2">
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'value' | 'percent')}
          aria-label="Tipo de desconto"
          className="h-10 rounded-lg border border-default-200 bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="value">R$</option>
          <option value="percent">%</option>
        </select>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === 'percent' ? '0' : '0,00'}
          aria-label="Valor do desconto"
          className="h-10 flex-1 rounded-lg border border-default-200 bg-white px-3 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" isDisabled={add.isPending} onClick={handleAdd}>
          {add.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Linha de Crédito / Cashback (ledger CustomerCredit/CustomerCashback). Mostra o
 * valor já abatido na comanda e, quando editável, permite aplicar até o menor
 * entre o saldo do cliente e o líquido da comanda (POST /orders/:id/credit|cashback)
 * ou remover o que já foi aplicado (DELETE). Sem endpoint novo — usa os hooks
 * existentes de apply/remove.
 */
function LedgerLine({
  label,
  applied,
  balance,
  maxApply,
  editable,
  apply,
  remove,
}: {
  label: string;
  applied: number;
  balance: number;
  maxApply: number;
  editable: boolean;
  apply: ReturnType<typeof useApplyOrderCredit>;
  remove: ReturnType<typeof useRemoveOrderCredit>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Teto real: não dá pra abater mais que o saldo do cliente nem que o valor
  // devido na comanda (líquido restante + o que já está aplicado nesta linha).
  const cap = Math.max(0, Math.min(balance, maxApply));

  async function handleApply() {
    setError(null);
    const v = parseNum(value);
    if (v <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    if (v > cap + 0.001) {
      setError(`Máximo ${formatMoney(cap)}.`);
      return;
    }
    try {
      await apply.mutateAsync(v);
      setValue('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Não foi possível aplicar ${label.toLowerCase()}.`);
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await remove.mutateAsync();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Não foi possível remover ${label.toLowerCase()}.`);
    }
  }

  const canApply = editable && cap > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted-ink">
          {label}
          {editable && balance > 0 && (
            <span className="text-xs text-muted">(saldo {formatMoney(balance)})</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-foreground">{formatMoney(applied)}</span>
          {editable &&
            (applied > 0 ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={remove.isPending}
                className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
              >
                {remove.isPending ? '…' : 'Remover'}
              </button>
            ) : canApply && !open ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <IconPlus size={12} /> Aplicar
              </button>
            ) : null)}
        </span>
      </div>

      {editable && open && applied === 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-soft-border)] bg-white p-2">
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              aria-label={`Valor de ${label.toLowerCase()}`}
              className="h-9 flex-1 rounded-lg border border-default-200 bg-white px-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setValue(String(cap).replace('.', ','))}
              className="shrink-0 whitespace-nowrap rounded-lg border border-default-200 px-2 py-2 text-xs font-medium text-foreground hover:bg-cream"
            >
              Usar {formatMoney(cap)}
            </button>
          </div>
          {error && <span className="text-xs text-danger">{error}</span>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                setValue('');
                setError(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" isDisabled={apply.isPending} onClick={handleApply}>
              {apply.isPending ? 'Aplicando…' : 'Aplicar'}
            </Button>
          </div>
        </div>
      )}
      {editable && error && !open && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

/**
 * Pagamentos (f_055) — sub-drawer sobre a comanda: valor, forma (Dinheiro /
 * Cartão / Outros, ou método cadastrado), lista de pagamentos com estorno,
 * Resumo (Descontos / Total / Total pago / Restante), troco e Faturar (verde).
 */
function PagamentosDrawer({
  isOpen,
  order,
  paidTotal,
  remaining,
  faturando,
  onClose,
  onFaturar,
}: {
  isOpen: boolean;
  order: OrderDetail;
  paidTotal: number;
  remaining: number;
  faturando: boolean;
  onClose: () => void;
  onFaturar: () => void;
}) {
  const add = useAddOrderPayment(order.id);
  const reverse = useReverseOrderPayment(order.id);
  const methods = usePaymentMethods();
  const methodList = useMemo(() => methods.data ?? [], [methods.data]);

  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [quickMethod, setQuickMethod] = useState('Dinheiro');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(remaining > 0 ? remaining.toFixed(2) : '');
      setMethodId('');
      setQuickMethod('Dinheiro');
      setError(null);
    }
  }, [isOpen, remaining]);

  const typed = parseNum(amount);
  const troco = Math.max(0, typed - remaining);
  const quicks = ['Dinheiro', 'Cartão', 'Outros'];
  const selectedQuickMethod = useMemo(() => {
    if (quickMethod !== 'Dinheiro') return null;
    return (
      methodList.find(
        (method) =>
          method.name
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase() === 'dinheiro',
      ) ?? null
    );
  }, [methodList, quickMethod]);

  function paymentBody(value: number) {
    const resolvedMethodId = methodId || selectedQuickMethod?.id;
    return {
      paymentMethodId: resolvedMethodId || undefined,
      amount: Math.min(value, remaining),
      description: resolvedMethodId ? undefined : quickMethod,
    };
  }

  async function handleAdd() {
    setError(null);
    const value = parseNum(amount);
    if (remaining <= 0.009) {
      setError('O valor da comanda já está integralmente pago.');
      return;
    }
    if (value <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      await add.mutateAsync(paymentBody(value));
      setAmount('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível registrar o pagamento.');
    }
  }

  async function handleFaturar() {
    setError(null);
    try {
      if (remaining > 0.009) {
        const value = parseNum(amount);
        if (value + 0.009 < remaining) {
          setError(`Falta registrar ${formatMoney(remaining - Math.max(value, 0))}.`);
          return;
        }
        if (value <= 0) {
          setError('Informe o valor e a forma de pagamento antes de faturar.');
          return;
        }
        await add.mutateAsync(paymentBody(value));
      }
      await onFaturar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível faturar a comanda.');
    }
  }

  async function handleReverse(p: OrderPaymentDetail) {
    setError(null);
    try {
      await reverse.mutateAsync(p.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível estornar o pagamento.');
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Pagamentos"
      widthClass="sm:w-[480px]"
      fullscreen
      zClass="z-[90]"
      footer={
        <>
          <Button variant="outline" className="mr-auto" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="primary"
            isDisabled={faturando || add.isPending}
            onClick={handleFaturar}
            className="!bg-[#16a34a] !text-white hover:!bg-[#15803d]"
          >
            <IconCheck size={16} />{' '}
            {faturando || add.isPending ? 'Faturando…' : 'Faturar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Valor (R$)">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Valor do pagamento"
            className={numInputCls}
          />
        </Field>

        {/* Formas rápidas Dinheiro / Cartão / Outros. */}
        <div className="grid grid-cols-3 gap-2">
          {quicks.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setQuickMethod(q);
                setMethodId('');
              }}
              className={[
                'rounded-lg border py-2 text-sm font-medium transition-colors',
                !methodId && quickMethod === q
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-[var(--color-soft-border)] text-foreground hover:bg-cream',
              ].join(' ')}
            >
              {q}
            </button>
          ))}
        </div>

        {methodList.length > 0 && (
          <Field label="Método cadastrado (opcional)">
            <select
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
              aria-label="Método de pagamento"
              className={numInputCls}
            >
              <option value="">Usar forma rápida</option>
              {methodList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Button variant="outline" isDisabled={add.isPending} onClick={handleAdd}>
          <IconPlus size={16} /> {add.isPending ? 'Registrando…' : 'Adicionar pagamento'}
        </Button>

        {/* Lista de pagamentos. */}
        {order.payments.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
            {order.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 border-b border-[var(--color-soft-border)] px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {p.paymentMethodName ?? p.description ?? 'Pagamento'}
                  </div>
                  {p.status === 'reversed' && (
                    <div className="text-xs text-muted">Estornado</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={[
                      'text-sm font-semibold tabular-nums',
                      p.status === 'reversed' ? 'text-muted line-through' : 'text-foreground',
                    ].join(' ')}
                  >
                    {formatMoney(p.amount)}
                  </span>
                  {p.status !== 'reversed' && (
                    <button
                      type="button"
                      onClick={() => handleReverse(p)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Estornar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resumo. */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm">
          <TotalLine label="Descontos" value={`- ${formatMoney(order.discountTotal)}`} />
          <TotalLine label="Total" value={formatMoney(order.netTotal)} strong />
          <TotalLine label="Total pago" value={formatMoney(paidTotal)} />
          <TotalLine label="Restante" value={formatMoney(remaining)} />
          <div className="my-1 border-t border-[var(--color-soft-border)]" />
          <TotalLine label="Troco" value={formatMoney(troco)} strong />
        </div>

        {error && <FormError message={error} />}
      </div>
    </Drawer>
  );
}
