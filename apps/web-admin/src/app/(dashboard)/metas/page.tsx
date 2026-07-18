'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Chip, Input, ListBox, Modal, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, LoadingState } from '@/components/States';
import { IconPlus, IconTarget } from '@/components/icons';
import { formatMoney, formatNumber } from '@/lib/format';
import {
  useCreateGoal,
  useDeleteGoal,
  useGoals,
  useUpdateGoal,
  type Goal,
  type GoalKind,
} from '@/lib/queries/metas';

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

const monthFieldClass =
  'h-11 w-full rounded-xl border border-white/15 bg-[#1a1a1a] px-3 text-sm text-foreground ' +
  'shadow-sm outline-none transition-colors ' +
  'focus:border-white focus:ring-2 focus:ring-white/30 ' +
  '[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer ' +
  '[&::-webkit-calendar-picker-indicator]:opacity-60 ' +
  'hover:[&::-webkit-calendar-picker-indicator]:opacity-100';

function MonthField({
  label,
  value,
  onChange,
  className,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-1 flex-col gap-1 ${className ?? ''}`}>
      {label && <span className="text-xs font-medium text-muted">{label}</span>}
      <input
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={monthFieldClass}
      />
    </label>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100);
  const color = pct >= 100 ? 'bg-success' : 'bg-white';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const isMoney = KIND_IS_MONEY[goal.kind];
  const fmt = (n: number) => (isMoney ? formatMoney(n) : formatNumber(n));
  const pct = Math.round(Math.min(goal.progress, 1) * 100);
  return (
    <Card className="db-card">
      <Card.Content className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
              <IconTarget size={16} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{KIND_LABEL[goal.kind]}</p>
              <p className="text-xs text-muted">{goal.period}</p>
            </div>
          </div>
          <Chip variant="soft" color={pct >= 100 ? 'success' : 'accent'} size="sm">
            {pct}%
          </Chip>
        </div>
        <ProgressBar value={goal.progress} />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">{fmt(goal.actual)}</span>
          <span className="text-muted">meta {fmt(goal.target)}</span>
        </div>
        <div className="mt-3">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Editar
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

export default function MetasPage() {
  const [period, setPeriod] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const goals = useGoals(period || undefined);
  const del = useDeleteGoal();

  const rows = goals.data ?? [];

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
        onRefresh={() => goals.refetch()}
        isRefreshing={goals.isFetching}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <IconPlus size={16} /> Nova meta
          </Button>
        }
      />

      <Card className="db-card mb-4">
        <Card.Content className="flex flex-wrap items-end gap-3 p-4 text-sm">
          <MonthField label="Período" value={period} onChange={setPeriod} />
          {period && (
            <Button variant="outline" size="sm" onClick={() => setPeriod('')}>
              Limpar
            </Button>
          )}
        </Card.Content>
      </Card>

      {goals.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconTarget size={32} />}
          title="Nenhuma meta cadastrada"
          description="Crie metas de vendas, agendamentos, clientes ou comissão."
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
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading>{editing ? 'Editar meta' : 'Nova meta'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {success ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-foreground">
                    ✓
                  </div>
                  <p className="text-base font-semibold text-foreground">
                    Meta salva com sucesso!
                  </p>
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
