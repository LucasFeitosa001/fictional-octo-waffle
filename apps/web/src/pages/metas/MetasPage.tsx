import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { useConfirm } from '../../components/ConfirmDialog';
import { Drawer } from '../../components/Drawer';
import { DropdownButton } from '../../components/DropdownButton';
import { EmptyState, LoadingState } from '../../components/States';
import { MonthField } from '../../components/DateRangeFilter';
import {
  IconCalendar,
  IconChevron,
  IconFilter,
  IconPencil,
  IconPlus,
  IconTarget,
  IconTrash,
  IconUsers,
} from '../../components/icons';
import { useSetPageActions } from '../../layout/PageActions';
import { formatMoney, formatNumber } from '../../lib/format';
import { useProfessionals } from '../../lib/queries';
import {
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useUpdateGoal,
  type Goal,
  type GoalKind,
} from '../../lib/queries/metas';

const KIND_LABEL: Record<GoalKind, string> = {
  sales: 'Vendas',
  appointments: 'Agendamentos',
  customers: 'Novos clientes',
  commission: 'Comissão',
};

const KIND_IS_MONEY: Record<GoalKind, boolean> = {
  sales: true,
  appointments: false,
  customers: false,
  commission: true,
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'YYYY-MM' → 'Julho, 2026' (rótulo do navegador de mês do Belasis). */
function periodLabel(p: string) {
  const [y, m] = p.split('-').map(Number);
  if (!y || !m) return p;
  return `${MONTHS[m - 1]}, ${y}`;
}

/** Desloca o período em `delta` meses, preservando o formato 'YYYY-MM'. */
function shiftPeriod(p: string, delta: number) {
  let [y, m] = p.split('-').map(Number);
  m += delta;
  if (m < 1) {
    m = 12;
    y -= 1;
  } else if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

const CARD = 'rounded-xl border border-line bg-card shadow-[var(--shadow-card)]';
const PROGRESS_TRACK = 'bg-[var(--sp-data-balance-soft)]';

function fmtValue(kind: GoalKind, n: number) {
  return KIND_IS_MONEY[kind] ? formatMoney(n) : formatNumber(n);
}

function ProgressCell({ goal }: { goal: Goal }) {
  const pct = Math.round(Math.min(Math.max(goal.progress, 0), 1) * 100);
  const done = pct >= 100;
  return (
    <div className="min-w-[180px]">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink">{fmtValue(goal.kind, goal.actual)}</span>
        <span className="text-muted-ink">meta {fmtValue(goal.kind, goal.target)}</span>
      </div>
      <div className={`flex items-center gap-2`}>
        <div className={`h-2 w-full overflow-hidden rounded-full ${PROGRESS_TRACK}`}>
          <div
            className={`h-full rounded-full transition-all ${done ? 'bg-status-success' : 'bg-data-balance'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={[
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            done
              ? 'bg-status-success-soft text-status-success-fg'
              : 'bg-[var(--sp-data-balance-soft)] text-data-balance',
          ].join(' ')}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}

export function MetasPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  // Filtro multi-select de profissionais (ids). Vazio = Todos.
  const [profFilter, setProfFilter] = useState<Set<string>>(new Set());
  // Seleção em lote das metas (ids).
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const goals = useGoals(period || undefined);
  const professionals = useProfessionals(1, 100);
  const del = useDeleteGoal();
  const confirm = useConfirm();

  const profList = professionals.data?.data ?? [];
  const profName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profList) map.set(p.id, p.name);
    return (id?: string | null) => (id ? map.get(id) ?? 'Profissional' : null);
  }, [profList]);

  const allRows = goals.data ?? [];
  // Filtro por profissional: quando há seleção, mostra só metas vinculadas a eles.
  const rows = useMemo(() => {
    if (profFilter.size === 0) return allRows;
    return allRows.filter((g) => g.employeeId && profFilter.has(g.employeeId));
  }, [allRows, profFilter]);

  // Sincroniza a seleção em lote com as linhas visíveis (evita ids fantasmas).
  const visibleIds = useMemo(() => rows.map((g) => g.id), [rows]);
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of visibleIds) if (prev.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(g: Goal) {
    setEditing(g);
    setDrawerOpen(true);
  }
  async function handleRemove(g: Goal) {
    const ok = await confirm({
      title: `Excluir meta de ${KIND_LABEL[g.kind]}?`,
      message: `Meta do período ${periodLabel(g.period)}. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await del.mutateAsync(g.id);
    } catch {
      await confirm({
        title: 'Não foi possível',
        message: 'Não foi possível excluir a meta.',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        danger: false,
      });
    }
  }

  // Exclusão em lote das metas selecionadas.
  async function handleBulkRemove() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Excluir ${ids.length} ${ids.length === 1 ? 'meta' : 'metas'}?`,
      message: 'Essa ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await Promise.all(ids.map((id) => del.mutateAsync(id)));
      setSelected(new Set());
    } catch {
      await confirm({
        title: 'Não foi possível',
        message: 'Não foi possível excluir todas as metas selecionadas.',
        confirmLabel: 'OK',
        cancelLabel: undefined,
        danger: false,
      });
    }
  }

  // Mobile: as ações de Filtros / Novo vivem na BottomNav (mesmos handlers do desktop).
  useSetPageActions(
    [
      {
        key: 'filtros',
        label: 'Filtros',
        icon: <IconFilter size={22} />,
        onClick: () => setFiltersOpen((v) => !v),
      },
      {
        key: 'novo',
        label: 'Novo',
        icon: <IconPlus size={22} />,
        onClick: openCreate,
      },
    ],
    [],
  );

  return (
    <div>
      {/* ===== Cabeçalho: navegador de mês + toolbar ===== */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-ink transition-colors hover:bg-canvas hover:text-primary"
          >
            <IconChevron size={18} className="rotate-90" />
          </button>
          <h1 className="min-w-[9rem] text-center text-lg font-bold text-ink sm:text-xl">
            {periodLabel(period)}
          </h1>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-ink transition-colors hover:bg-canvas hover:text-primary"
          >
            <IconChevron size={18} className="-rotate-90" />
          </button>
        </div>

        <div className="hidden items-center gap-2 md:flex md:w-auto">
          <BulkActions
            count={selected.size}
            onDelete={handleBulkRemove}
            deleting={del.isPending}
          />
          <Button variant="outline" onClick={() => setFiltersOpen((v) => !v)}>
            <IconFilter size={16} /> Filtrar
          </Button>
          <Button variant="primary" onClick={openCreate}>
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </div>

      {/* ===== Filtros: Período + Profissionais ===== */}
      {filtersOpen && (
        <div className={`mb-4 ${CARD}`}>
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-ink">Período</span>
              <MonthField label={undefined} value={period} onChange={setPeriod} className="w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-ink">Profissionais</span>
              <ProfessionalMultiSelect
                options={profList}
                selected={profFilter}
                onChange={setProfFilter}
                loading={professionals.isLoading}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===== Conteúdo ===== */}
      {goals.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <div className={CARD}>
          <div className="px-4 py-10">
            <EmptyState
              icon={<IconTarget size={32} />}
              title="Nenhuma meta encontrada"
              description="Verifique seus filtros e tente novamente."
              action={
                <Button variant="primary" onClick={openCreate}>
                  <IconPlus size={16} /> Clique para criar
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                  <th className="w-10 px-4 py-3">
                    <Checkbox
                      checked={allSelected}
                      onChange={toggleAll}
                      ariaLabel="Selecionar tudo"
                    />
                  </th>
                  <th className="px-4 py-3 font-semibold">Profissional</th>
                  <th className="px-4 py-3 font-semibold">Período</th>
                  <th className="px-4 py-3 font-semibold">Progresso</th>
                  <th className="px-4 py-3 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr
                    key={g.id}
                    className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                  >
                    <td className="px-4 py-2.5">
                      <Checkbox
                        checked={selected.has(g.id)}
                        onChange={() => toggleOne(g.id)}
                        ariaLabel={`Selecionar meta de ${KIND_LABEL[g.kind]}`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        className="flex w-full items-center gap-2.5 text-left"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--sp-data-balance-soft)] text-data-balance">
                          <IconTarget size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {KIND_LABEL[g.kind]}
                          </span>
                          <span className="block text-xs text-muted-ink">
                            {profName(g.employeeId) ?? 'Todos os profissionais'}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-ink">{periodLabel(g.period)}</td>
                    <td className="px-4 py-2.5">
                      <ProgressCell goal={g} />
                    </td>
                    <td className="px-4 py-2.5">
                      <RowActions
                        onEdit={() => openEdit(g)}
                        onDelete={() => handleRemove(g)}
                        deleting={del.isPending}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {rows.map((g) => (
              <div key={g.id} className={`${CARD} p-4`}>
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Checkbox
                      checked={selected.has(g.id)}
                      onChange={() => toggleOne(g.id)}
                      ariaLabel={`Selecionar meta de ${KIND_LABEL[g.kind]}`}
                    />
                    <button
                      type="button"
                      onClick={() => openEdit(g)}
                      className="flex min-w-0 items-center gap-2.5 text-left"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sp-data-balance-soft)] text-data-balance">
                        <IconTarget size={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">
                          {KIND_LABEL[g.kind]}
                        </span>
                        <span className="block text-xs text-muted-ink">
                          {profName(g.employeeId) ?? 'Todos'} · {periodLabel(g.period)}
                        </span>
                      </span>
                    </button>
                  </div>
                  <RowActions
                    onEdit={() => openEdit(g)}
                    onDelete={() => handleRemove(g)}
                    deleting={del.isPending}
                  />
                </div>
                <ProgressCell goal={g} />
              </div>
            ))}
          </div>

          {/* Mobile: barra de ações em lote */}
          {selected.size > 0 && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-card)] md:hidden">
              <span className="text-sm font-medium text-ink">
                {selected.size} selecionada{selected.size === 1 ? '' : 's'}
              </span>
              <Button
                variant="outline"
                onClick={handleBulkRemove}
                isDisabled={del.isPending}
                className="text-danger"
              >
                <IconTrash size={16} /> Excluir
              </Button>
            </div>
          )}
        </>
      )}

      <MetaDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editing={editing}
        professionals={profList}
      />
    </div>
  );
}

/** Checkbox quadrado (mesmo visual das demais listas com seleção em lote). */
function Checkbox({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={onChange}
      className={[
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        checked
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-line bg-card hover:border-primary',
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

/** Dropdown "Ações" (em lote) — habilita quando há metas selecionadas. */
function BulkActions({
  count,
  onDelete,
  deleting,
}: {
  count: number;
  onDelete: () => void;
  deleting: boolean;
}) {
  if (count === 0) return null;
  return (
    <DropdownButton label={`Ações (${count})`} align="start">
      {(close) => (
        <div className="min-w-[200px] py-1">
          <button
            type="button"
            disabled={deleting}
            onClick={() => {
              close();
              onDelete();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
          >
            <IconTrash size={16} />
            Excluir selecionadas
          </button>
        </div>
      )}
    </DropdownButton>
  );
}

/** Multi-select real de profissionais para o filtro (checkboxes + Todos). */
function ProfessionalMultiSelect({
  options,
  selected,
  onChange,
  loading,
}: {
  options: { id: string; name: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && wrapperRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  const label =
    selected.size === 0
      ? 'Todos'
      : selected.size === 1
        ? options.find((o) => selected.has(o.id))?.name ?? '1 selecionado'
        : `${selected.size} selecionados`;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-line bg-card px-3 text-sm text-ink"
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <IconUsers size={16} className="opacity-60" />
          <span className="truncate">{label}</span>
        </span>
        <IconChevron
          size={16}
          className={'shrink-0 opacity-60 transition-transform ' + (open ? 'rotate-180' : '')}
        />
      </button>

      <div
        role="listbox"
        aria-hidden={!open}
        className={[
          'absolute left-0 top-full z-50 mt-2 max-h-64 w-full origin-top overflow-auto rounded-xl border border-line bg-card p-1 shadow-[var(--shadow-pop)]',
          'transition-all duration-200 ease-out',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0',
        ].join(' ')}
      >
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => onChange(new Set())}
            className="mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-muted-ink transition-colors hover:bg-canvas"
          >
            Limpar seleção (Todos)
          </button>
        )}
        {loading ? (
          <div className="px-3 py-2 text-sm text-muted-ink">Carregando…</div>
        ) : options.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-ink">Nenhum profissional</div>
        ) : (
          options.map((o) => {
            const on = selected.has(o.id);
            return (
              <div
                key={o.id}
                role="option"
                aria-selected={on}
                tabIndex={0}
                onClick={() => toggle(o.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(o.id);
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas"
              >
                {/* Row div owns the toggle; the box is a passive indicator (não duplica). */}
                <Checkbox checked={on} onChange={() => {}} ariaLabel={`Selecionar ${o.name}`} />
                <span className="min-w-0 truncate">{o.name}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
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
      <button
        type="button"
        aria-label="Editar"
        title="Editar"
        onClick={onEdit}
        className="rounded p-1 hover:bg-canvas hover:text-primary"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-line" />
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

/** Campo com label reutilizado dentro do drawer. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-ink">{label}</span>
      {children}
    </label>
  );
}

function MetaDrawer({
  isOpen,
  onClose,
  editing,
  professionals,
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: Goal | null;
  professionals: { id: string; name: string }[];
}) {
  const [period, setPeriod] = useState(currentPeriod());
  const [kind, setKind] = useState<GoalKind>('sales');
  const [target, setTarget] = useState('');
  // '' = Todos (meta agregada da empresa).
  const [employeeId, setEmployeeId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const create = useCreateGoal();
  const update = useUpdateGoal();
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setPeriod(editing.period);
      setKind(editing.kind);
      setTarget(String(editing.target));
      setEmployeeId(editing.employeeId ?? '');
    } else {
      setPeriod(currentPeriod());
      setKind('sales');
      setTarget('');
      setEmployeeId('');
    }
    setFormError(null);
    setSuccess(false);
  }, [isOpen, editing]);

  const canConfirm =
    /^\d{4}-\d{2}$/.test(period) && Number(target.replace(',', '.')) > 0 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const base = {
      period,
      kind,
      scopeType: 'all' as const,
      target: Number(target.replace(',', '.')),
    };
    try {
      if (editing) {
        // employeeId: null limpa o vínculo quando "Todos".
        await update.mutateAsync({
          id: editing.id,
          body: { ...base, employeeId: employeeId || null },
        });
      } else {
        await create.mutateAsync({
          ...base,
          ...(employeeId ? { employeeId } : {}),
        });
      }
      setSuccess(true);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar a meta.');
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? 'Editar meta' : 'Nova meta'}
      fullscreen
      footer={
        success ? (
          <Button variant="primary" className="w-full sm:w-auto" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              isDisabled={!canConfirm}
              onClick={handleConfirm}
            >
              {isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </>
        )
      }
    >
      {success ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-success/15 text-2xl text-success">
            ✓
          </div>
          <p className="text-base font-semibold text-ink">
            {editing ? 'Meta atualizada com sucesso!' : 'Meta criada com sucesso!'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Período (mês)">
            <div className="relative">
              <MonthField label={undefined} value={period} onChange={setPeriod} className="w-full" />
              <IconCalendar
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-ink"
              />
            </div>
          </Field>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-ink">Profissional</span>
            <Select
              aria-label="Profissional"
              selectedKey={employeeId || 'all'}
              onSelectionChange={(k) => setEmployeeId(String(k) === 'all' ? '' : String(k))}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="all" textValue="Todos">
                    Todos
                  </ListBox.Item>
                  {professionals.map((p) => (
                    <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                      {p.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-ink">Tipo de meta</span>
            <Select
              aria-label="Tipo de meta"
              selectedKey={kind}
              onSelectionChange={(k) => setKind(String(k) as GoalKind)}
            >
              <Select.Trigger>
                <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="sales" textValue="Vendas">
                    Vendas
                  </ListBox.Item>
                  <ListBox.Item id="appointments" textValue="Agendamentos">
                    Agendamentos
                  </ListBox.Item>
                  <ListBox.Item id="customers" textValue="Novos clientes">
                    Novos clientes
                  </ListBox.Item>
                  <ListBox.Item id="commission" textValue="Comissão">
                    Comissão
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <Field label={`Alvo ${KIND_IS_MONEY[kind] ? '(R$)' : '(quantidade)'}`}>
            <TextField value={target} onChange={setTarget} aria-label="Alvo">
              <Input placeholder={KIND_IS_MONEY[kind] ? '0,00' : '0'} inputMode="decimal" />
            </TextField>
          </Field>

          {formError && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {formError}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
