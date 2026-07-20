import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError, ORDER_STATUS_LABELS } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { DateField } from '../components/DateRangeFilter';
import { Drawer } from '../components/Drawer';
import { useConfirm } from '../components/ConfirmDialog';
import {
  IconCheck,
  IconDownload,
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

/** Quote a CSV cell, escaping embedded quotes/newlines. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Status filter, mirrors the Belasis "Status" filter section. */
const STATUS_FILTERS = [
  { id: 'all', label: 'Todas', status: undefined },
  { id: 'open', label: 'Em aberto', status: 'open' },
  { id: 'finished', label: 'Finalizadas', status: 'finished' },
  { id: 'canceled', label: 'Excluídas', status: 'canceled' },
] as const;

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
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [statusTab, setStatusTab] = useState<string>('all');
  const status = STATUS_FILTERS.find((t) => t.id === statusTab)?.status;
  const orders = useOrders(status);
  const del = useDeleteOrder();
  const allRows = useMemo(() => orders.data?.data ?? [], [orders.data]);

  const [range, setRange] = useState(monthRange);
  // The /orders endpoint only filters by status server-side, so date, customer,
  // payment and text are applied client-side over the loaded rows.
  const [customerId, setCustomerId] = useState<string>('all');
  const [payFilter, setPayFilter] = useState<PayFilter>('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrderRow | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  // Mobile: the header Buscar/Filtrar/Novo controls move to the BottomNav
  // (Belasis pattern). Each fires the exact same handler as the desktop button.
  useSetPageActions(
    [
      { key: 'buscar', label: 'Buscar', icon: <IconSearch size={22} />, onClick: () => setShowSearch((v) => !v) },
      { key: 'filtros', label: 'Filtrar', icon: <IconFilter size={22} />, onClick: () => setShowFilters((v) => !v) },
      { key: 'novo', label: 'Novo', icon: <IconPlus size={22} />, onClick: () => setCreateOpen(true) },
    ],
    [],
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
      const day = o.date?.slice(0, 10) ?? '';
      if (range.from && day && day < range.from) return false;
      if (range.to && day && day > range.to) return false;
      if (customerId !== 'all' && o.customer?.id !== customerId) return false;
      if (payFilter === 'paid' && o.status !== 'finished') return false;
      if (payFilter === 'pending' && o.status !== 'open') return false;
      if (q) {
        const inNumber = String(o.number).includes(q);
        const inName = (o.customer?.name ?? '').toLowerCase().includes(q);
        if (!inNumber && !inName) return false;
      }
      return true;
    });
  }, [allRows, range.from, range.to, customerId, payFilter, search]);

  // Reset to first page whenever the active filter set changes.
  useEffect(() => {
    setPage(1);
  }, [statusTab, range.from, range.to, customerId, payFilter, search]);

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

  function exportCsv() {
    const header = ['Ticket', 'Data', 'Cliente', 'Status', 'Valor', 'Pagamento'];
    const body = rows.map((o) => [
      o.number,
      formatDate(o.date),
      o.customer?.name ?? 'Avulso',
      ORDER_STATUS_LABELS[o.status],
      o.netTotal,
      o.status === 'finished' ? 'Pago' : o.status === 'open' ? 'Pendente' : '—',
    ]);
    const csv = [header, ...body].map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comandas-${isoDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <Card.Content className="p-4">
          {showSearch && (
            <div className="mb-4 max-w-md">
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
                <span className="text-xs font-semibold text-muted-ink">Status</span>
                <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--color-soft-border)] bg-canvas p-0.5">
                  {STATUS_FILTERS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setStatusTab(t.id)}
                      className={[
                        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        statusTab === t.id
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-ink hover:text-foreground',
                      ].join(' ')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-muted-ink">Período</span>
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
                  <span className="text-xs font-semibold text-muted-ink">Cliente</span>
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
                  <span className="text-xs font-semibold text-muted-ink">
                    Status de pagamento
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

          <div className="mb-3 flex items-center justify-between gap-2">
            {selected.size > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="text-danger"
                isDisabled={del.isPending}
                onClick={handleRemoveSelected}
              >
                <IconTrash size={14} /> Excluir ({selected.size})
              </Button>
            ) : (
              <span />
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              isDisabled={rows.length === 0}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
          </div>

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
                      <th className={th}>Ticket</th>
                      <th className={th}>Data</th>
                      <th className={th}>Cliente</th>
                      <th className={th}>Status</th>
                      <th className={`${th} text-right`}>Valor</th>
                      <th className={th}>Pagamento</th>
                      <th className={th}>Nota Fiscal</th>
                      <th className={`${th} w-12 text-center`} aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((o) => (
                      <tr
                        key={o.id}
                        className="border-b border-[var(--color-soft-border)] transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_4%,transparent)]"
                      >
                        <td className={td}>
                          <input
                            type="checkbox"
                            aria-label={`Selecionar comanda ${o.number}`}
                            className="h-4 w-4 accent-[var(--sp-primary)]"
                            checked={selected.has(o.id)}
                            onChange={() => toggleOne(o.id)}
                          />
                        </td>
                        <td className={td}>
                          <button
                            type="button"
                            onClick={() => navigate(`/comandas/${o.id}`)}
                            className="font-semibold text-primary hover:underline"
                          >
                            #{o.number}
                          </button>
                        </td>
                        <td className={`${td} text-muted-ink`}>{formatDate(o.date)}</td>
                        <td className={td}>
                          {o.customer ? (
                            <button
                              type="button"
                              title={o.customer.name}
                              onClick={() => navigate(`/comandas/${o.id}`)}
                              className="max-w-[220px] truncate text-primary hover:underline"
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
                        <td className={`${td} text-center`}>
                          <RowMenu
                            onView={() => navigate(`/comandas/${o.id}`)}
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

              {/* Mobile: stacked cards (Belasis layout) */}
              <ul className="flex flex-col gap-3 md:hidden">
                {pageRows.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-2xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)]"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleRemove(o)}
                        disabled={o.status === 'canceled' || del.isPending}
                        className="inline-flex items-center gap-1 text-xs font-medium text-danger disabled:opacity-40"
                      >
                        <IconTrash size={13} /> Excluir
                      </button>
                      <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-ink">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--sp-primary)]"
                          checked={selected.has(o.id)}
                          onChange={() => toggleOne(o.id)}
                        />
                        Selecionar
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/comandas/${o.id}`)}
                      className="text-left"
                    >
                      <div className="text-base font-bold text-primary">#{o.number}</div>
                      <div className="mt-0.5 font-medium text-foreground">
                        {o.customer?.name ?? 'Avulso'}
                      </div>
                    </button>
                    <div className="mt-1 text-lg font-bold tabular-nums text-foreground">
                      {formatMoney(o.netTotal)}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-muted-ink">{formatDate(o.date)}</span>
                      <StatusTag status={o.status} />
                    </div>
                  </li>
                ))}
              </ul>

              <Pagination page={page} total={rows.length} onPage={setPage} />
            </>
          )}
        </Card.Content>
      </Card>

      <NovoComandaDrawer isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditarComandaDrawer order={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drawers (right side — Belasis Novo / Editar)
// ---------------------------------------------------------------------------

/** Vertical form field with a label above the control (ant-form-vertical). */
function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      <label className="text-xs font-medium text-muted-ink">{label}</label>
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
      widthClass="sm:w-[640px]"
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
          <Field label="Data">
            {/* TODO: data editável quando o endpoint aceitar a data da comanda. */}
            <Input value={today} disabled aria-label="Data" />
          </Field>
          <Field label="Número da comanda">
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

        {/* Totais (apresentação — TODO: cálculo real com itens/crédito/cashback). */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm">
          <TotalLine label="Desconto" value={formatMoney(0)} />
          <TotalLine label="Crédito" value={formatMoney(0)} />
          <TotalLine label="Cashback" value={formatMoney(0)} />
          <div className="my-1 border-t border-[var(--color-soft-border)]" />
          <TotalLine label="Total" value={formatMoney(0)} strong />
        </div>

        <Field label="Observações">
          <TextField value={notes} onChange={setNotes} aria-label="Observações">
            <Input placeholder="Ex.: Atendimento agendado" />
          </TextField>
        </Field>

        {error && <FormError message={error} />}
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
    <Drawer
      isOpen={order != null}
      onClose={onClose}
      title={order ? `Editar comanda #${order.number}` : 'Editar comanda'}
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
        <Field label="Status">
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
    </Drawer>
  );
}
