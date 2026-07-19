import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  Modal,
  Select,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState, LoadingState } from '../../components/States';
import { MonthField } from '../../components/DateRangeFilter';
import { IconPlus, IconTarget } from '../../components/icons';
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

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const color = pct >= 100 ? 'bg-success' : pct >= 50 ? 'bg-[#f2b33d]' : 'bg-[#f2b33d]/50';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f2b33d]/10">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const isMoney = KIND_IS_MONEY[goal.kind];
  const fmt = (n: number) => (isMoney ? formatMoney(n) : formatNumber(n));
  const pct = Math.round(Math.min(goal.progress, 1) * 100);
  const remaining = Math.max(goal.target - goal.actual, 0);
  return (
    <Card className={CARD}>
      <Card.Content className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f2b33d]/15 text-[#a67c1e]">
              <IconTarget size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{KIND_LABEL[goal.kind]}</p>
              <p className="text-xs text-muted">{goal.period}</p>
            </div>
          </div>
          <Chip
            variant="soft"
            color={pct >= 100 ? 'success' : 'accent'}
            size="sm"
          >
            {pct}%
          </Chip>
        </div>
        <ProgressBar value={goal.progress} />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">{fmt(goal.actual)}</span>
          <span className="text-muted">meta {fmt(goal.target)}</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          {pct >= 100 ? 'Meta atingida 🎉' : `Faltam ${fmt(remaining)}`}
        </p>
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Editar
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

type KindFilter = 'all' | GoalKind;
const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'sales', label: 'Vendas' },
  { id: 'appointments', label: 'Agendamentos' },
  { id: 'customers', label: 'Novos clientes' },
  { id: 'commission', label: 'Comissão' },
];

export function MetasPage() {
  const [period, setPeriod] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const goals = useGoals(period || undefined);
  const del = useDeleteGoal();

  const allRows = goals.data ?? [];
  const rows = kindFilter === 'all' ? allRows : allRows.filter((g) => g.kind === kindFilter);

  const summary = {
    total: rows.length,
    achieved: rows.filter((g) => g.progress >= 1).length,
    avg: rows.length
      ? Math.round((rows.reduce((a, g) => a + Math.min(g.progress, 1), 0) / rows.length) * 100)
      : 0,
  };

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(g: Goal) {
    setEditing(g);
    setModalOpen(true);
  }
  async function handleRemove(g: Goal) {
    if (!window.confirm('Excluir esta meta?')) return;
    try {
      await del.mutateAsync(g.id);
    } catch {
      window.alert('Não foi possível excluir a meta.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Metas"
        subtitle="Acompanhe o progresso das metas mensais"
        actions={
          <Button variant="primary" onClick={openCreate}>
            <IconPlus size={16} /> Nova meta
          </Button>
        }
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="flex flex-col gap-4 p-4 text-sm">
          <div className="flex flex-wrap items-end gap-3">
            <MonthField label="Período" value={period} onChange={setPeriod} />
            {period && (
              <Button variant="outline" size="sm" onClick={() => setPeriod('')}>
                Limpar período
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">Tipo:</span>
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--color-soft-border)] bg-[#f7f3ea] p-1">
              {KIND_FILTERS.map((f) => {
                const active = f.id === kindFilter;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setKindFilter(f.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#f2b33d] text-[#1a1a1a] shadow-[var(--shadow-gold)]'
                        : 'text-muted hover:text-foreground'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card.Content>
      </Card>

      {!goals.isLoading && allRows.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className={CARD}>
            <Card.Content className="p-4">
              <p className="text-xs text-muted">Metas exibidas</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{summary.total}</p>
            </Card.Content>
          </Card>
          <Card className={CARD}>
            <Card.Content className="p-4">
              <p className="text-xs text-muted">Metas atingidas</p>
              <p className="mt-1 text-2xl font-bold text-foreground">{summary.achieved}</p>
            </Card.Content>
          </Card>
          <Card className={CARD}>
            <Card.Content className="p-4">
              <p className="text-xs text-muted">Progresso médio</p>
              <p className="mt-1 text-2xl font-bold text-[#a67c1e]">{summary.avg}%</p>
            </Card.Content>
          </Card>
        </div>
      )}

      {goals.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconTarget size={32} />}
          title={allRows.length === 0 ? 'Nenhuma meta cadastrada' : 'Nenhuma meta neste filtro'}
          description={
            allRows.length === 0
              ? 'Crie metas de vendas, agendamentos, clientes ou comissão.'
              : 'Ajuste o tipo de meta ou o período.'
          }
          action={
            <Button variant="primary" onClick={openCreate}>
              <IconPlus size={16} /> Nova meta
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((g) => (
            <div key={g.id} className="relative">
              <GoalCard goal={g} onEdit={() => openEdit(g)} />
              <button
                type="button"
                disabled={del.isPending}
                onClick={() => handleRemove(g)}
                className="absolute right-3 top-3 text-xs text-muted hover:text-danger"
              >
                Excluir
              </button>
            </div>
          ))}
        </div>
      )}

      <NovaMetaModal isOpen={modalOpen} onOpenChange={setModalOpen} editing={editing} />
    </div>
  );
}

function NovaMetaModal({
  isOpen,
  onOpenChange,
  editing,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
    if (isOpen) {
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
    }
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
      setFormError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a meta.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
      <Modal.Container
        placement="center"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{editing ? 'Editar meta' : 'Nova meta'}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {success ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E7D6] text-2xl text-accent">
                  ✓
                </div>
                <p className="text-base font-semibold text-foreground">Meta criada com sucesso!</p>
              </div>
            ) : (
              <>
                <MonthField
                  label="Período (mês)"
                  value={period}
                  onChange={setPeriod}
                  className="min-w-0"
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Tipo de meta</label>
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
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">
                    Alvo {KIND_IS_MONEY[kind] ? '(R$)' : '(quantidade)'}
                  </label>
                  <TextField value={target} onChange={setTarget} aria-label="Alvo">
                    <Input placeholder={KIND_IS_MONEY[kind] ? '0,00' : '0'} inputMode="decimal" />
                  </TextField>
                </div>
                {formError && (
                  <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {formError}
                  </div>
                )}
              </>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {success ? (
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => onOpenChange(false)}
                >
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
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
