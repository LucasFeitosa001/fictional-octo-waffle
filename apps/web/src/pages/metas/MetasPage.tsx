import { useEffect, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../../components/Drawer';
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
const PROGRESS_TRACK = 'bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)]';

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
            className={`h-full rounded-full transition-all ${done ? 'bg-success' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={[
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            done
              ? 'bg-success/15 text-success'
              : 'bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] text-primary',
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
  const goals = useGoals(period || undefined);
  const del = useDeleteGoal();

  const rows = goals.data ?? [];

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(g: Goal) {
    setEditing(g);
    setDrawerOpen(true);
  }
  async function handleRemove(g: Goal) {
    if (!window.confirm('Excluir esta meta?')) return;
    try {
      await del.mutateAsync(g.id);
    } catch {
      window.alert('Não foi possível excluir a meta.');
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

        <div className="hidden gap-2 md:flex md:w-auto">
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
              {/* TODO: ligar à lista de profissionais; metas atuais são scopeType 'all'. */}
              <div className="flex h-10 items-center justify-between rounded-lg border border-line bg-card px-3 text-sm text-muted-ink">
                <span className="inline-flex items-center gap-2">
                  <IconUsers size={16} className="opacity-60" />
                  Todos
                </span>
                <IconChevron size={16} className="opacity-60" />
              </div>
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
                      <button
                        type="button"
                        onClick={() => openEdit(g)}
                        className="flex w-full items-center gap-2.5 text-left"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                          <IconTarget size={16} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {KIND_LABEL[g.kind]}
                          </span>
                          <span className="block text-xs text-muted-ink">Todos os profissionais</span>
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
                  <button
                    type="button"
                    onClick={() => openEdit(g)}
                    className="flex min-w-0 items-center gap-2.5 text-left"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                      <IconTarget size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">
                        {KIND_LABEL[g.kind]}
                      </span>
                      <span className="block text-xs text-muted-ink">{periodLabel(g.period)}</span>
                    </span>
                  </button>
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
        </>
      )}

      <MetaDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} editing={editing} />
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
}: {
  isOpen: boolean;
  onClose: () => void;
  editing: Goal | null;
}) {
  const [period, setPeriod] = useState(currentPeriod());
  const [kind, setKind] = useState<GoalKind>('sales');
  const [target, setTarget] = useState('');
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
    } else {
      setPeriod(currentPeriod());
      setKind('sales');
      setTarget('');
    }
    setFormError(null);
    setSuccess(false);
  }, [isOpen, editing]);

  const canConfirm =
    /^\d{4}-\d{2}$/.test(period) && Number(target.replace(',', '.')) > 0 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const body = {
      period,
      kind,
      scopeType: 'all' as const,
      target: Number(target.replace(',', '.')),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body });
      } else {
        await create.mutateAsync(body);
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

          <Field label="Profissional">
            {/* TODO: ligar à lista de profissionais; metas atuais são scopeType 'all'. */}
            <div className="flex h-10 items-center justify-between rounded-lg border border-line bg-card px-3 text-sm text-muted-ink">
              <span className="inline-flex items-center gap-2">
                <IconUsers size={16} className="opacity-60" />
                Todos
              </span>
              <IconChevron size={16} className="opacity-60" />
            </div>
          </Field>

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
