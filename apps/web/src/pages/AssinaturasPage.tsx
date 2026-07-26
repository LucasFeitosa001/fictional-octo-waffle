import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, Button, Card, Input, ListBox, SearchField, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { DateField } from '../components/DateRangeFilter';
import { Drawer } from '../components/Drawer';
import { FullDrawer } from '../components/FullDrawer';
import { ItemPickerDrawer, type PickedItem } from '../components/ItemPickerDrawer';
import { useConfirm } from '../components/ConfirmDialog';
import { FilterCheckbox } from '../components/FilterCheckbox';
import { AppTabs } from '../components/AppTabs';
import {
  IconCheck,
  IconDownload,
  IconFilter,
  IconLayers,
  IconPlus,
  IconRepeat,
  IconScissors,
  IconSearch,
  IconSettings,
  IconTrash,
  IconUsers,
} from '../components/icons';
import { formatDate, formatMoney } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { useSetPageActions } from '../layout/PageActions';
import { useCustomers } from '../lib/queries';
import {
  useCreateCustomerMembership,
  useCreateMembershipPlan,
  useCustomerMemberships,
  useDeleteMembershipPlan,
  useMembershipPlans,
  useUpdateCustomerMembership,
  useUpdateMembershipPlan,
  type CustomerMembership,
  type MembershipPlan,
  type MembershipStatus,
} from '../lib/queries/assinaturas';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Status metadata — Belasis renders each status as a coloured ant-tag.
// The captured filter lists Pendente/Ativa/Expirada/Desativada/Cancelada; our
// domain carries active/overdue/canceled, so we map to the matching ant colours.
// ---------------------------------------------------------------------------

type TagColor = 'green' | 'orange' | 'red' | 'gray';

const STATUS_META: Record<MembershipStatus, { label: string; color: TagColor }> = {
  active: { label: 'Ativa', color: 'green' },
  overdue: { label: 'Inadimplente', color: 'orange' },
  canceled: { label: 'Cancelada', color: 'red' },
};

const TAG_CLASS: Record<TagColor, string> = {
  green: 'border-[#b7eb8f] bg-[#f6ffed] text-[#389e0d]',
  orange: 'border-[#ffd591] bg-[#fff7e6] text-[#d46b08]',
  red: 'border-[#ffa39e] bg-[#fff1f0] text-[#cf1322]',
  gray: 'border-[var(--color-soft-border)] bg-canvas text-muted-ink',
};

function Tag({ color, children }: { color: TagColor; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-[4px] border px-2 py-0.5 text-xs font-medium ${TAG_CLASS[color]}`}
    >
      {children}
    </span>
  );
}

function StatusTag({ status }: { status: MembershipStatus }) {
  const meta = STATUS_META[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

/** Belasis "Código" column: a short sequential-looking code. */
function subCode(m: CustomerMembership): string {
  // TODO: usar o código sequencial real da assinatura quando o backend expor.
  return `#${m.id.slice(0, 6).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Header tabs (Assinaturas | Modelos de assinatura | Configurações)
// ---------------------------------------------------------------------------

type MainTab = 'subscribers' | 'plans' | 'settings';
const MAIN_TABS: { id: MainTab; label: string; icon: React.ReactNode }[] = [
  { id: 'subscribers', label: 'Assinantes', icon: <IconUsers size={16} /> },
  { id: 'plans', label: 'Modelos de assinatura', icon: <IconLayers size={16} /> },
  { id: 'settings', label: 'Configurações', icon: <IconSettings size={16} /> },
];

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
// Filters panel — Vencimento · Status
// ---------------------------------------------------------------------------

const STATUS_FILTER_ORDER: MembershipStatus[] = ['active', 'overdue', 'canceled'];
function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <FilterCheckbox checked={checked} onChange={onChange} className="py-1">
      {children}
    </FilterCheckbox>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function AssinaturasPage() {
  const [tab, setTab] = useState<MainTab>('subscribers');

  // Plan drawer (Modelos de assinatura)
  const [planDrawerOpen, setPlanDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  // Subscription drawers
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<CustomerMembership | null>(null);

  // Toolbar / filters
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [statusSet, setStatusSet] = useState<Set<MembershipStatus>>(new Set());
  const [page, setPage] = useState(1);

  // Modelos tab: search + filter
  const [showPlanSearch, setShowPlanSearch] = useState(false);
  const [showPlanFilters, setShowPlanFilters] = useState(false);
  const [planSearch, setPlanSearch] = useState('');
  const [planOnlyWithServices, setPlanOnlyWithServices] = useState(false);

  const memberships = useCustomerMemberships();
  const plans = useMembershipPlans();
  const updateMembership = useUpdateCustomerMembership();

  const allSubRows = useMemo(() => memberships.data ?? [], [memberships.data]);
  const allPlanRows = plans.data ?? [];
  const planRows = useMemo(() => {
    const term = planSearch.trim().toLowerCase();
    return allPlanRows.filter((p) => {
      if (planOnlyWithServices && p.services.length === 0) return false;
      if (term && !p.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allPlanRows, planSearch, planOnlyWithServices]);

  const subRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allSubRows.filter((m) => {
      if (statusSet.size && !statusSet.has(m.status)) return false;
      const due = m.nextDueDate?.slice(0, 10) ?? '';
      if (range.from && due && due < range.from) return false;
      if (range.to && due && due > range.to) return false;
      if (term) {
        const inName = (m.customer?.name ?? '').toLowerCase().includes(term);
        const inPlan = (m.membershipPlan?.name ?? '').toLowerCase().includes(term);
        const inCode = subCode(m).toLowerCase().includes(term);
        if (!inName && !inPlan && !inCode) return false;
      }
      return true;
    });
  }, [allSubRows, statusSet, range.from, range.to, search]);

  useEffect(() => {
    setPage(1);
  }, [tab, search, range.from, range.to, statusSet]);

  const pageRows = useMemo(
    () => subRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [subRows, page],
  );

  // Mobile: as ações contextuais (Buscar/Filtrar/Novo) vivem na BottomNav —
  // os mesmos handlers dos botões do header desktop. Trocam conforme a aba.
  useSetPageActions(
    tab === 'subscribers'
      ? [
          { key: 'buscar', label: 'Buscar', icon: <IconSearch size={22} />, onClick: () => setShowSearch((v) => !v), active: showSearch },
          { key: 'filtros', label: 'Filtrar', icon: <IconFilter size={22} />, onClick: () => setShowFilters((v) => !v), active: showFilters },
          { key: 'novo', label: 'Novo', icon: <IconPlus size={22} />, onClick: () => setCreateSubOpen(true) },
        ]
      : tab === 'plans'
        ? [
            { key: 'buscar', label: 'Buscar', icon: <IconSearch size={22} />, onClick: () => setShowPlanSearch((v) => !v), active: showPlanSearch },
            { key: 'filtros', label: 'Filtrar', icon: <IconFilter size={22} />, onClick: () => setShowPlanFilters((v) => !v), active: showPlanFilters },
            {
              key: 'novo-modelo',
              label: 'Novo',
              icon: <IconPlus size={22} />,
              onClick: () => {
                setEditingPlan(null);
                setPlanDrawerOpen(true);
              },
            },
          ]
        : [],
    [tab, showSearch, showFilters, showPlanSearch, showPlanFilters],
  );

  function toggleStatus(s: MembershipStatus, on: boolean) {
    setStatusSet((prev) => {
      const next = new Set(prev);
      if (on) next.add(s);
      else next.delete(s);
      return next;
    });
  }
  function openCreatePlan() {
    setEditingPlan(null);
    setPlanDrawerOpen(true);
  }
  function openEditPlan(p: MembershipPlan) {
    setEditingPlan(p);
    setPlanDrawerOpen(true);
  }

  function exportSubsCsv() {
    downloadCsv(
      `assinantes-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Código', value: (m: CustomerMembership) => subCode(m) },
        { header: 'Modelo', value: (m: CustomerMembership) => m.membershipPlan?.name ?? '' },
        { header: 'Cliente', value: (m: CustomerMembership) => m.customer?.name ?? '' },
        { header: 'Vencimento', value: (m: CustomerMembership) => formatDate(m.nextDueDate) },
        { header: 'Status', value: (m: CustomerMembership) => STATUS_META[m.status].label },
        { header: 'Total', value: (m: CustomerMembership) => m.membershipPlan?.recurringPrice ?? '' },
      ],
      subRows,
    );
  }

  const th = 'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-muted-ink';
  const td = 'whitespace-nowrap px-4 py-3 text-sm text-foreground';

  const headerActions =
    tab === 'subscribers' ? (
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
        <Button variant="primary" className="hidden md:inline-flex" onClick={() => setCreateSubOpen(true)}>
          <IconPlus size={16} /> Novo
        </Button>
      </>
    ) : tab === 'plans' ? (
      <Button variant="primary" className="hidden md:inline-flex" onClick={openCreatePlan}>
        <IconPlus size={16} /> Novo modelo
      </Button>
    ) : undefined;

  return (
    <div>
      <PageHeader title="Vendas por Assinatura" actions={headerActions} />

      <AppTabs
        items={MAIN_TABS}
        selectedKey={tab}
        onSelectionChange={setTab}
        ariaLabel="Áreas de vendas por assinatura"
        className="mb-4"
      />

      {tab === 'subscribers' && (
        <Card className="!border-0 !bg-transparent !shadow-none md:!border md:!border-[var(--color-soft-border)] md:!bg-warm-white md:!shadow-[var(--shadow-card)]">
          <Card.Content className="p-0 md:p-4">
            {/* Mobile: input de busca SEMPRE visível no topo (padrão Belasis). */}
            <div className="mb-3 md:hidden">
              <TextField value={search} onChange={setSearch} aria-label="Buscar assinatura">
                <Input placeholder="Digite para buscar" />
              </TextField>
            </div>
            {/* Desktop: continua toggle via botão Buscar. */}
            {showSearch && (
              <div className="mb-4 hidden max-w-md md:block">
                <TextField value={search} onChange={setSearch} aria-label="Buscar assinatura" autoFocus>
                  <Input placeholder="Buscar por cliente, modelo ou código…" />
                </TextField>
              </div>
            )}

            {showFilters && (
              <div className="mb-4 grid gap-4 rounded-xl border border-[var(--color-soft-border)] bg-white p-4 sm:grid-cols-2">
                {/* Vencimento */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-muted-ink">Vencimento</span>
                  <DateField
                    label="Data inicial"
                    value={range.from}
                    max={range.to || undefined}
                    onChange={(v) => setRange((r) => ({ ...r, from: v }))}
                  />
                  <DateField
                    label="Data final"
                    value={range.to}
                    min={range.from || undefined}
                    onChange={(v) => setRange((r) => ({ ...r, to: v }))}
                  />
                </div>

                {/* Status */}
                <div className="flex flex-col gap-1">
                  <span className="mb-1 text-xs font-semibold text-muted-ink">Status</span>
                  <CheckRow
                    checked={statusSet.size === STATUS_FILTER_ORDER.length}
                    onChange={(on) =>
                      setStatusSet(on ? new Set(STATUS_FILTER_ORDER) : new Set())
                    }
                  >
                    <span className="text-muted-ink">Selecionar tudo</span>
                  </CheckRow>
                  {STATUS_FILTER_ORDER.map((s) => (
                    <CheckRow
                      key={s}
                      checked={statusSet.has(s)}
                      onChange={(on) => toggleStatus(s, on)}
                    >
                      <StatusTag status={s} />
                    </CheckRow>
                  ))}
                </div>

              </div>
            )}

            {subRows.length > 0 && (
              <div className="mb-3 flex items-center justify-end">
                <Button variant="outline" size="sm" onClick={exportSubsCsv}>
                  <IconDownload size={16} /> Exportar CSV
                </Button>
              </div>
            )}

            {memberships.isLoading ? (
              <LoadingState />
            ) : memberships.isError ? (
              <ErrorState onRetry={() => memberships.refetch()} />
            ) : subRows.length === 0 ? (
              <>
                <EmptyState
                  icon={<IconRepeat size={32} />}
                  title="Nenhum registro"
                  description={
                    allSubRows.length === 0
                      ? 'Crie uma assinatura vinculando um cliente a um modelo.'
                      : 'Verifique seus filtros e tente novamente.'
                  }
                  action={
                    <Button variant="primary" onClick={() => setCreateSubOpen(true)}>
                      <IconPlus size={16} /> Nova assinatura
                    </Button>
                  }
                />
                <div className="mt-2 text-center text-xs text-muted">
                  {subRows.length} registros no total
                </div>
              </>
            ) : (
              <>
                {/* Desktop / tablet: ant-table style */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--color-soft-border)] bg-[color-mix(in_oklab,var(--sp-ink)_3%,transparent)]">
                        <th className={`${th} text-center`}>Código</th>
                        <th className={th}>Modelo</th>
                        <th className={th}>Cliente</th>
                        <th className={th}>Vencimento</th>
                        <th className={th}>Status</th>
                        <th className={th}>Renovação</th>
                        <th className={`${th} text-right`}>Total</th>
                        <th className={`${th} w-12 text-center`} aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b border-[var(--color-soft-border)] transition-colors hover:bg-[color-mix(in_oklab,var(--sp-primary)_4%,transparent)]"
                        >
                          <td className={`${td} text-center font-medium text-muted-ink`}>
                            {subCode(m)}
                          </td>
                          <td className={td}>{m.membershipPlan?.name ?? '—'}</td>
                          <td className={td}>
                            <span className="font-medium text-foreground">
                              {m.customer?.name ?? '—'}
                            </span>
                          </td>
                          <td className={`${td} text-muted-ink`}>{formatDate(m.nextDueDate)}</td>
                          <td className={td}>
                            <StatusTag status={m.status} />
                          </td>
                          <td className={`${td} text-muted-ink`}>
                            Manual
                          </td>
                          <td className={`${td} text-right font-semibold tabular-nums`}>
                            {formatMoney(m.membershipPlan?.recurringPrice)}
                          </td>
                          <td className={`${td} text-center`}>
                            <RowActions
                              membership={m}
                              onEdit={() => setEditingSub(m)}
                              onRenew={() =>
                                updateMembership.mutate({ id: m.id, body: { status: 'active' } })
                              }
                              onCancel={() =>
                                updateMembership.mutate({ id: m.id, body: { status: 'canceled' } })
                              }
                              pending={updateMembership.isPending}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: stacked cards */}
                <ul className="flex flex-col gap-3 md:hidden">
                  {pageRows.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-2xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)]"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-ink">{subCode(m)}</span>
                        <StatusTag status={m.status} />
                      </div>
                      <div className="text-base font-semibold text-foreground">
                        {m.customer?.name ?? '—'}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-ink">
                        {m.membershipPlan?.name ?? '—'}
                      </div>
                      <div className="mt-1 text-lg font-bold tabular-nums text-foreground">
                        {formatMoney(m.membershipPlan?.recurringPrice)}
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-ink">
                          Vence em {formatDate(m.nextDueDate)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[var(--color-soft-border)] pt-3">
                        <Button variant="outline" size="sm" onClick={() => setEditingSub(m)}>
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          isDisabled={m.status === 'active' || updateMembership.isPending}
                          onClick={() =>
                            updateMembership.mutate({ id: m.id, body: { status: 'active' } })
                          }
                        >
                          Renovar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger"
                          isDisabled={m.status === 'canceled' || updateMembership.isPending}
                          onClick={() =>
                            updateMembership.mutate({ id: m.id, body: { status: 'canceled' } })
                          }
                        >
                          Cancelar
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>

                <Pagination page={page} total={subRows.length} onPage={setPage} />
              </>
            )}
          </Card.Content>
        </Card>
      )}

      {tab === 'plans' && (
        <Card className="!border-0 !bg-transparent !shadow-none md:!border md:!border-[var(--color-soft-border)] md:!bg-warm-white md:!shadow-[var(--shadow-card)]">
          <Card.Content className="p-0 md:p-4">
            {/* Mobile: search sempre visível no topo (padrão Belasis). */}
            <div className="mb-3 md:hidden">
              <TextField value={planSearch} onChange={setPlanSearch} aria-label="Buscar modelo">
                <Input placeholder="Digite para buscar" />
              </TextField>
            </div>
            {/* Desktop: toggle via botão Buscar. */}
            {showPlanSearch && (
              <div className="mb-4 hidden max-w-md md:block">
                <TextField value={planSearch} onChange={setPlanSearch} aria-label="Buscar modelo" autoFocus>
                  <Input placeholder="Buscar por nome do modelo…" />
                </TextField>
              </div>
            )}

            {showPlanFilters && (
              <div className="mb-4 rounded-xl border border-[var(--color-soft-border)] bg-white p-4">
                <span className="mb-2 block text-xs font-semibold text-muted-ink">Filtros</span>
                <CheckRow checked={planOnlyWithServices} onChange={setPlanOnlyWithServices}>
                  <span className="text-foreground">Somente modelos com serviços incluídos</span>
                </CheckRow>
              </div>
            )}

            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                <span className="md:hidden">Modelos</span>
                <span className="hidden md:inline">Modelos de assinatura</span>
                <span className="ml-2 text-xs font-normal text-muted">
                  {planRows.length} modelo(s)
                </span>
              </h3>
              <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={openCreatePlan}>
                <IconPlus size={14} /> Novo modelo
              </Button>
            </div>
            {plans.isLoading ? (
              <LoadingState />
            ) : plans.isError ? (
              <ErrorState onRetry={() => plans.refetch()} />
            ) : planRows.length === 0 ? (
              <>
                <EmptyState
                  icon={<IconRepeat size={32} />}
                  title="Nenhum registro"
                  description="Crie modelos com serviços incluídos e preço recorrente."
                  action={
                    <div className="flex flex-col items-center gap-2">
                      <Button variant="primary" onClick={openCreatePlan}>
                        <IconPlus size={16} /> Novo modelo
                      </Button>
                      <p className="text-xs text-muted">
                        ou{' '}
                        <button
                          type="button"
                          onClick={openCreatePlan}
                          className="text-primary underline hover:opacity-80"
                        >
                          clique aqui
                        </button>{' '}
                        para criar o primeiro
                      </p>
                    </div>
                  }
                />
                <div className="mt-2 text-center text-xs text-muted">
                  {planRows.length} registros no total
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {planRows.map((p) => (
                  <PlanCard key={p.id} plan={p} onEdit={() => openEditPlan(p)} />
                ))}
              </div>
            )}
          </Card.Content>
        </Card>
      )}

      {tab === 'settings' && <SettingsTab subscribers={allSubRows} plans={planRows} />}

      {/* FAB azul flutuante para "Novo" no mobile (padrão Belasis). */}
      {tab === 'subscribers' && (
        <button
          type="button"
          aria-label="Nova assinatura"
          onClick={() => setCreateSubOpen(true)}
          className="fab-above-nav fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
        >
          <IconPlus size={22} />
        </button>
      )}
      {tab === 'plans' && (
        <button
          type="button"
          aria-label="Novo modelo"
          onClick={openCreatePlan}
          className="fab-above-nav fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 md:hidden"
        >
          <IconPlus size={22} />
        </button>
      )}

      <PlanDrawer
        isOpen={planDrawerOpen}
        editing={editingPlan}
        onClose={() => setPlanDrawerOpen(false)}
      />
      <NovaAssinaturaDrawer isOpen={createSubOpen} onClose={() => setCreateSubOpen(false)} />
      <EditarAssinaturaDrawer membership={editingSub} onClose={() => setEditingSub(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-row actions (Editar / Renovar / Cancelar)
// ---------------------------------------------------------------------------

function RowActions({
  membership,
  onEdit,
  onRenew,
  onCancel,
  pending,
}: {
  membership: CustomerMembership;
  onEdit: () => void;
  onRenew: () => void;
  onCancel: () => void;
  pending: boolean;
}) {
  return (
    <div className="flex justify-center gap-1.5">
      <Button variant="outline" size="sm" onClick={onEdit}>
        Editar
      </Button>
      <Button
        variant="outline"
        size="sm"
        isDisabled={membership.status === 'active' || pending}
        onClick={onRenew}
      >
        Renovar
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-danger"
        isDisabled={membership.status === 'canceled' || pending}
        onClick={onCancel}
      >
        Cancelar
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan card (Modelos de assinatura)
// ---------------------------------------------------------------------------

function PlanCard({ plan, onEdit }: { plan: MembershipPlan; onEdit: () => void }) {
  const del = useDeleteMembershipPlan();
  const confirm = useConfirm();

  async function handleRemove() {
    const ok = await confirm({
      title: `Remover o plano "${plan.name}"?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(plan.id);
    } catch (err) {
      await confirm({
        title: 'Não foi possível remover o plano',
        message: err instanceof ApiClientError ? err.message : 'Não foi possível remover o plano.',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        danger: false,
      });
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{plan.name}</span>
        <span
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-primary"
          style={{ backgroundColor: 'color-mix(in oklab, var(--sp-primary) 12%, transparent)' }}
        >
          {formatMoney(plan.recurringPrice)}
        </span>
      </div>
      <div className="mt-2 text-sm text-muted">
        A cada {plan.intervalMonths} mês(es) • {plan.services.length} serviço(s) incluído(s)
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" isDisabled={del.isPending} onClick={handleRemove}>
          Remover
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form atoms
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
  className,
  required,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      <label className="text-xs font-medium text-muted-ink">
        {required && <span className="text-danger">*</span>} {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Autocomplete unificado (desktop) — espelha o campo "Busque por um cliente" do
 * Belasis: gatilho com placeholder, popover com busca e ListBox filtrável.
 */
function AutocompleteField({
  ariaLabel,
  placeholder,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <Autocomplete
      aria-label={ariaLabel}
      selectedKey={value || null}
      onSelectionChange={(k) => onChange(k ? String(k) : '')}
    >
      <Autocomplete.Trigger>
        <Autocomplete.Value>
          {({ isPlaceholder, selectedText }) => (isPlaceholder ? placeholder : selectedText)}
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter
          filter={(textValue, inputValue) =>
            textValue.toLowerCase().includes(inputValue.trim().toLowerCase())
          }
        >
          <SearchField aria-label={`Buscar ${ariaLabel}`} autoFocus className="mb-1">
            <SearchField.Input placeholder="Buscar" />
          </SearchField>
          <ListBox>
            {options.map((o) => (
              <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
                {o.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </div>
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
      <span className={strong ? 'font-semibold text-foreground' : 'text-muted-ink'}>{label}</span>
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

// ---------------------------------------------------------------------------
// Drawer: Nova assinatura (Belasis "Novo")
// ---------------------------------------------------------------------------

type NovaSection = 'cliente' | 'data' | 'itens' | 'recorrencia';

function NovaAssinaturaDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const create = useCreateCustomerMembership();
  const customers = useCustomers('');
  const plans = useMembershipPlans();
  const [customerId, setCustomerId] = useState('');
  const [membershipPlanId, setMembershipPlanId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<NovaSection>('cliente');

  const customerList = useMemo(() => customers.data?.data ?? [], [customers.data]);
  const planList = useMemo(() => plans.data ?? [], [plans.data]);
  const selectedPlan = planList.find((p) => p.id === membershipPlanId) ?? null;
  const today = formatDate(new Date().toISOString());

  useEffect(() => {
    if (isOpen) {
      setCustomerId('');
      setMembershipPlanId('');
      setError(null);
      setSection('cliente');
    }
  }, [isOpen]);

  const canSave = customerId !== '' && membershipPlanId !== '';

  async function handleSave() {
    setError(null);
    try {
      await create.mutateAsync({ customerId, membershipPlanId });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível cadastrar a assinatura.',
      );
    }
  }

  const total = formatMoney(selectedPlan?.recurringPrice ?? 0);

  return (
    <FullDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Nova assinatura"
      mobileBackLabel="Voltar"
      sections={[
        { key: 'cliente', label: 'Cliente' },
        { key: 'data', label: 'Data' },
        { key: 'itens', label: 'Itens da assinatura' },
        { key: 'recorrencia', label: 'Recorrência' },
      ]}
      activeSection={section}
      onSectionChange={(k) => setSection(k as NovaSection)}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={!canSave || create.isPending} onClick={handleSave}>
            <IconCheck size={16} /> {create.isPending ? 'Criando…' : 'Criar assinatura'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {section === 'cliente' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Cliente" required>
              <AutocompleteField
                ariaLabel="Cliente"
                placeholder="Busque por um cliente"
                value={customerId}
                onChange={setCustomerId}
                options={customerList.map((c) => ({ id: c.id, name: c.name }))}
              />
            </Field>
            <Field label="Modelo de assinatura" required>
              <AutocompleteField
                ariaLabel="Modelo de assinatura"
                placeholder="Selecione um modelo de assinatura"
                value={membershipPlanId}
                onChange={setMembershipPlanId}
                options={planList.map((p) => ({ id: p.id, name: p.name }))}
              />
            </Field>
          </div>
        )}

        {section === 'data' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Data">
              {/* TODO: data editável quando o endpoint aceitar a data da assinatura. */}
              <Input value={today} disabled aria-label="Data" />
            </Field>
          </div>
        )}

        {section === 'itens' && (
          <>
            {/* Itens de assinatura */}
            <div>
              <div className="mb-2 text-sm font-semibold text-foreground">Itens de assinatura</div>
              <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
                <div className="grid grid-cols-[1.6fr_0.6fr_1fr_0.9fr_0.9fr] gap-2 border-b border-[var(--color-soft-border)] bg-[color-mix(in_oklab,var(--sp-ink)_3%,transparent)] px-3 py-2 text-[11px] font-semibold text-muted-ink">
                  <span>Descrição</span>
                  <span className="text-right">Qtde.</span>
                  <span className="text-right">Valor unitário</span>
                  <span className="text-right">Desconto</span>
                  <span className="text-right">Total</span>
                </div>
                {selectedPlan && selectedPlan.services.length > 0 ? (
                  <ul>
                    {selectedPlan.services.map((s) => (
                      <li
                        key={s.serviceId}
                        className="grid grid-cols-[1.6fr_0.6fr_1fr_0.9fr_0.9fr] items-center gap-2 border-b border-[var(--color-soft-border)] px-3 py-2 text-sm last:border-b-0"
                      >
                        <span className="truncate text-foreground">{s.service?.name ?? '—'}</span>
                        <span className="text-right tabular-nums text-muted-ink">
                          {s.quantityPerCycle}
                        </span>
                        <span className="text-right tabular-nums text-muted-ink">—</span>
                        <span className="text-right tabular-nums text-muted-ink">
                          {formatMoney(0)}
                        </span>
                        <span className="text-right tabular-nums text-foreground">—</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-ink">
                    <IconScissors size={15} />
                    {/* TODO: adicionar itens avulsos quando o endpoint suportar. */}
                    Selecione um modelo para carregar os serviços incluídos.
                  </div>
                )}
              </div>
            </div>

            {/* Totais (apresentação — valor recorrente do modelo). */}
            <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm">
              <TotalLine label="Desconto" value={formatMoney(0)} />
              <div className="my-1 border-t border-[var(--color-soft-border)]" />
              <TotalLine label="Total" value={total} strong />
            </div>
          </>
        )}

        {section === 'recorrencia' && (
          <div className="flex flex-col gap-3">
            {selectedPlan ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Intervalo">
                  <Input
                    value={`A cada ${selectedPlan.intervalMonths ?? 1} mês(es)`}
                    disabled
                    aria-label="Intervalo"
                  />
                </Field>
                <Field label="Mensalidade">
                  <Input
                    value={formatMoney(selectedPlan.recurringPrice)}
                    disabled
                    aria-label="Mensalidade"
                  />
                </Field>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--color-soft-border)] bg-canvas p-4 text-sm text-muted-ink">
                {/* TODO: permitir override de recorrência quando o endpoint aceitar. */}
                Selecione um modelo de assinatura para ver a recorrência.
              </div>
            )}
          </div>
        )}

        {error && <FormError message={error} />}
      </div>
    </FullDrawer>
  );
}

// ---------------------------------------------------------------------------
// Drawer: Editar assinatura
// ---------------------------------------------------------------------------

const EDIT_STATUS_OPTIONS: { id: MembershipStatus; label: string }[] = [
  { id: 'active', label: 'Ativa' },
  { id: 'overdue', label: 'Inadimplente' },
  { id: 'canceled', label: 'Cancelada' },
];

function EditarAssinaturaDrawer({
  membership,
  onClose,
}: {
  membership: CustomerMembership | null;
  onClose: () => void;
}) {
  const update = useUpdateCustomerMembership();
  const [status, setStatus] = useState<MembershipStatus>('active');
  const [nextDueDate, setNextDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (membership) {
      setStatus(membership.status);
      setNextDueDate(membership.nextDueDate?.slice(0, 10) ?? '');
      setError(null);
    }
  }, [membership]);

  async function handleSave() {
    if (!membership) return;
    setError(null);
    try {
      await update.mutateAsync({
        id: membership.id,
        body: { status, nextDueDate: nextDueDate || undefined },
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível atualizar a assinatura.',
      );
    }
  }

  return (
    <Drawer
      isOpen={membership != null}
      onClose={onClose}
      title={membership ? `Editar assinatura ${subCode(membership)}` : 'Editar assinatura'}
      mobileBackLabel="Voltar"
      widthClass="sm:w-[520px]"
      fullscreen
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
        {membership && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente">
              <Input value={membership.customer?.name ?? '—'} disabled aria-label="Cliente" />
            </Field>
            <Field label="Modelo de assinatura">
              <Input value={membership.membershipPlan?.name ?? '—'} disabled aria-label="Modelo" />
            </Field>
            <Field label="Total">
              <Input
                value={formatMoney(membership.membershipPlan?.recurringPrice)}
                disabled
                aria-label="Total"
              />
            </Field>
            <Field label="Código">
              <Input value={subCode(membership)} disabled aria-label="Código" />
            </Field>
          </div>
        )}
        <Field label="Vencimento">
          <DateField value={nextDueDate} onChange={setNextDueDate} />
        </Field>
        <Field label="Status">
          <Select
            aria-label="Status"
            selectedKey={status}
            onSelectionChange={(k) => setStatus(String(k) as MembershipStatus)}
          >
            <Select.Trigger>
              <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {EDIT_STATUS_OPTIONS.map((s) => (
                  <ListBox.Item key={s.id} id={s.id} textValue={s.label}>
                    {s.label}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Field>
        {error && <FormError message={error} />}
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Drawer: Novo / Editar modelo de assinatura
// ---------------------------------------------------------------------------

// Linha editável do grid de itens do modelo (Belasis): serviço com qtde, valor
// unitário e desconto em R$ por linha; o total é calculado ao vivo.
interface PlanItem {
  uid: string;
  serviceId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number; // desconto em R$ por linha
}

let planItemSeq = 0;
const nextPlanItemUid = () => `plan-item-${++planItemSeq}`;
const planItemTotal = (it: PlanItem) => Math.max(0, it.quantity * it.unitPrice - it.discount);
const PLAN_ITEM_GRID = 'grid-cols-[minmax(0,1.6fr)_72px_1fr_1fr_1fr_40px]';

function PlanDrawer({
  isOpen,
  editing,
  onClose,
}: {
  isOpen: boolean;
  editing: MembershipPlan | null;
  onClose: () => void;
}) {
  const create = useCreateMembershipPlan();
  const update = useUpdateMembershipPlan();
  const [name, setName] = useState('');
  const [recurringPrice, setRecurringPrice] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('1');
  const [items, setItems] = useState<PlanItem[]>([]);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setName(editing.name);
        setRecurringPrice(editing.recurringPrice);
        setIntervalMonths(String(editing.intervalMonths ?? 1));
        setItems(
          editing.services.map((s) => ({
            uid: nextPlanItemUid(),
            serviceId: s.serviceId,
            name: s.service?.name ?? '—',
            quantity: s.quantity != null ? Number(s.quantity) : s.quantityPerCycle,
            unitPrice: s.unitPrice != null ? Number(s.unitPrice) : 0,
            discount: s.discount != null ? Number(s.discount) : 0,
          })),
        );
      } else {
        setName('');
        setRecurringPrice('');
        setIntervalMonths('1');
        setItems([]);
      }
      setItemPickerOpen(false);
      setError(null);
    }
  }, [isOpen, editing]);

  function addItem(picked: PickedItem) {
    if (picked.kind !== 'service') return; // modelos aceitam apenas serviços
    setItems((prev) => {
      if (prev.some((i) => i.serviceId === picked.refId)) return prev; // sem duplicar serviço
      return [
        ...prev,
        {
          uid: nextPlanItemUid(),
          serviceId: picked.refId,
          name: picked.name,
          quantity: 1,
          unitPrice: picked.unitPrice,
          discount: 0,
        },
      ];
    });
  }

  function patchItem(uid: string, patch: Partial<PlanItem>) {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  function removeItem(uid: string) {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  }

  const grandTotal = items.reduce((sum, it) => sum + planItemTotal(it), 0);

  const canSave =
    name.trim().length >= 2 &&
    recurringPrice !== '' &&
    Number(recurringPrice) >= 0 &&
    items.length > 0;

  const isPending = create.isPending || update.isPending;

  async function handleSave() {
    setError(null);
    const body = {
      name: name.trim(),
      recurringPrice: Number(recurringPrice),
      intervalMonths: intervalMonths ? Number(intervalMonths) : undefined,
      services: items.map((i) => ({
        serviceId: i.serviceId,
        // `quantityPerCycle` (Int) mantém o consumidor legado; `quantity`
        // (Decimal) guarda a quantidade exibida no grid.
        quantityPerCycle: Math.max(1, Math.round(i.quantity) || 1),
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
      })),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar o plano.');
    }
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={editing ? 'Editar modelo de assinatura' : 'Novo modelo de assinatura'}
        mobileBackLabel="Voltar"
        widthClass="sm:w-[620px]"
        fullscreen
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" isDisabled={!canSave || isPending} onClick={handleSave}>
              {isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Nome" required>
            <TextField value={name} onChange={setName} aria-label="Nome">
              <Input placeholder="Ex.: Plano Mensal Premium" />
            </TextField>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mensalidade" required>
              <TextField value={recurringPrice} onChange={setRecurringPrice} aria-label="Mensalidade">
                <Input type="number" placeholder="0,00" />
              </TextField>
            </Field>
            <Field label="Intervalo (meses)">
              <TextField value={intervalMonths} onChange={setIntervalMonths} aria-label="Intervalo">
                <Input type="number" placeholder="1" />
              </TextField>
            </Field>
          </div>

          {/* Itens do modelo — grid editável (serviço · qtde · valor un. · desconto). */}
          <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
            <div className="border-b border-[var(--color-soft-border)] bg-canvas px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">
              Itens do modelo
            </div>

            {/* Cabeçalho (desktop) */}
            <div
              className={`hidden md:grid ${PLAN_ITEM_GRID} items-center gap-2 border-b border-[var(--color-soft-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-ink`}
            >
              <span>Descrição</span>
              <span className="text-center">Qtde.</span>
              <span className="text-right">Valor unitário</span>
              <span className="text-right">Desconto</span>
              <span className="text-right">Total</span>
              <span />
            </div>

            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-ink">
                Nenhum serviço incluído. Use “Selecionar serviço” abaixo.
              </div>
            ) : (
              items.map((it) => (
                <PlanItemRow
                  key={it.uid}
                  item={it}
                  gridCls={PLAN_ITEM_GRID}
                  onChange={(patch) => patchItem(it.uid, patch)}
                  onRemove={() => removeItem(it.uid)}
                />
              ))
            )}

            <button
              type="button"
              onClick={() => setItemPickerOpen(true)}
              className="flex w-full items-center gap-2 border-t border-[var(--color-soft-border)] px-3 py-3 text-left text-sm font-medium text-primary hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
            >
              <IconPlus size={15} /> Selecionar serviço
            </button>
          </div>

          {/* Total geral (soma das linhas). */}
          <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm">
            <TotalLine label="Total geral" value={formatMoney(grandTotal)} strong />
          </div>

          {error && <FormError message={error} />}
        </div>
      </Drawer>

      <ItemPickerDrawer
        isOpen={itemPickerOpen}
        onClose={() => setItemPickerOpen(false)}
        onSelect={addItem}
        servicesOnly
        mobileBackLabel="Voltar"
      />
    </>
  );
}

// Linha editável de item do modelo (desktop: grid alinhado ao cabeçalho;
// mobile: card com inputs empilhados). Total calculado ao vivo.
function PlanItemRow({
  item,
  gridCls,
  onChange,
  onRemove,
}: {
  item: PlanItem;
  gridCls: string;
  onChange: (patch: Partial<PlanItem>) => void;
  onRemove: () => void;
}) {
  const total = planItemTotal(item);
  const num = (v: string) => (v === '' ? 0 : Number(v));
  const inputCls =
    'h-8 w-full rounded-md border border-[var(--color-soft-border)] bg-white px-2 text-sm text-foreground outline-none focus:border-primary';

  return (
    <div className="border-b border-[var(--color-soft-border)]/60 last:border-0">
      {/* Desktop */}
      <div className={`hidden md:grid ${gridCls} items-center gap-2 px-3 py-2 text-sm`}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
            <IconScissors size={15} />
          </span>
          <span className="truncate font-medium text-foreground">{item.name}</span>
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
        <span className="text-right font-semibold tabular-nums text-foreground">
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
            <IconScissors size={16} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
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
          <span className="font-semibold tabular-nums text-foreground">{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

function SettingsTab({
  subscribers,
  plans,
}: {
  subscribers: CustomerMembership[];
  plans: MembershipPlan[];
}) {
  const activeSubs = subscribers.filter((s) => s.status === 'active');
  const overdueSubs = subscribers.filter((s) => s.status === 'overdue');
  const recurringRevenue = activeSubs.reduce(
    (sum, s) => sum + Number(s.membershipPlan?.recurringPrice ?? 0),
    0,
  );

  const stats: { label: string; value: string }[] = [
    { label: 'Modelos cadastrados', value: String(plans.length) },
    { label: 'Assinaturas ativas', value: String(activeSubs.length) },
    { label: 'Assinaturas inadimplentes', value: String(overdueSubs.length) },
    { label: 'Receita recorrente ativa', value: formatMoney(recurringRevenue) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card className="border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">Visão geral</h3>
          <p className="mb-4 text-xs text-muted">
            Números calculados a partir das assinaturas e modelos cadastrados.
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-[var(--color-soft-border)] bg-white p-3 shadow-[var(--shadow-soft)]"
              >
                <div className="text-lg font-semibold text-foreground">{s.value}</div>
                <div className="mt-0.5 text-xs text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </Card.Content>
      </Card>

      <Card className="border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            Página pública de assinaturas
          </h3>
          <p className="text-xs text-muted">
            O link público para venda de assinaturas online ainda não está disponível no Salonpass.
          </p>
          <div className="mt-4">
            <EmptyState
              icon={<IconRepeat size={32} />}
              title="Venda online em breve"
              description="Quando disponível, você poderá publicar um link para clientes assinarem seus modelos diretamente."
            />
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}
