'use client';

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
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ActiveChip } from '@/components/StatusChip';
import { IconGift, IconPlus } from '@/components/icons';
import {
  useCashbackRules,
  useCreateCashbackRule,
  useDeleteCashbackRule,
  useUpdateCashbackRule,
  type CashbackRule,
  type ScopeType,
} from '@/lib/queries/marketing';

const SCOPE_LABEL: Record<ScopeType, string> = {
  all: 'Todos',
  service: 'Serviço',
  product: 'Produto',
  category: 'Categoria',
};

export default function CashbackPage() {
  const rules = useCashbackRules();
  const del = useDeleteCashbackRule();
  const [editing, setEditing] = useState<CashbackRule | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rows = rules.data ?? [];

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(r: CashbackRule) {
    setEditing(r);
    setModalOpen(true);
  }
  async function handleRemove(r: CashbackRule) {
    if (!window.confirm('Remover esta regra de cashback?')) return;
    try {
      await del.mutateAsync(r.id);
    } catch {
      window.alert('Não foi possível remover a regra.');
    }
  }

  const columns: Column<CashbackRule>[] = [
    {
      key: 'scope',
      header: 'Escopo',
      isRowHeader: true,
      render: (r) => (
        <Chip variant="soft" color="default" size="sm">
          {SCOPE_LABEL[r.scopeType]}
        </Chip>
      ),
    },
    {
      key: 'percent',
      header: 'Cashback',
      render: (r) => (
        <span className="font-medium text-foreground">{Number(r.percent).toFixed(2)}%</span>
      ),
    },
    {
      key: 'validity',
      header: 'Validade',
      render: (r) => (r.validityDays > 0 ? `${r.validityDays} dias` : 'Sem expiração'),
    },
    { key: 'active', header: 'Status', render: (r) => <ActiveChip active={r.active} /> },
    {
      key: 'actions',
      header: 'Ações',
      render: (r) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            isDisabled={del.isPending}
            onClick={() => handleRemove(r)}
          >
            Remover
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Cashback"
        subtitle="Regras de cashback por serviço, produto ou categoria"
        onRefresh={() => rules.refetch()}
        isRefreshing={rules.isFetching}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <IconPlus size={16} /> Nova regra
          </Button>
        }
      />

      <Card className="db-card">
        <Card.Content className="p-4">
          {rules.isLoading ? (
            <LoadingState />
          ) : rules.isError ? (
            <ErrorState onRetry={() => rules.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconGift size={32} />}
              title="Nenhuma regra de cashback"
              description="Crie regras para premiar clientes com cashback."
              action={
                <Button variant="primary" onClick={openCreate}>
                  <IconPlus size={16} /> Nova regra
                </Button>
              }
            />
          ) : (
            <DataTable
              aria-label="Regras de cashback"
              columns={columns}
              rows={rows}
              getKey={(r) => r.id}
            />
          )}
        </Card.Content>
      </Card>

      <CashbackModal isOpen={modalOpen} onOpenChange={setModalOpen} editing={editing} />
    </div>
  );
}

function CashbackModal({
  isOpen,
  onOpenChange,
  editing,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CashbackRule | null;
}) {
  const [scopeType, setScopeType] = useState<ScopeType>('all');
  const [percent, setPercent] = useState('');
  const [validityDays, setValidityDays] = useState('');
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const create = useCreateCashbackRule();
  const update = useUpdateCashbackRule();
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (isOpen) {
      setScopeType(editing?.scopeType ?? 'all');
      setPercent(editing ? String(editing.percent) : '');
      setValidityDays(editing ? String(editing.validityDays) : '');
      setActive(editing?.active ?? true);
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, editing]);

  const canConfirm = Number(percent.replace(',', '.')) > 0 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const body = {
      scopeType,
      percent: Number(percent.replace(',', '.')),
      validityDays: validityDays ? Number(validityDays) : undefined,
      active,
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
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a regra.',
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
              <Modal.Heading>{editing ? 'Editar regra' : 'Nova regra de cashback'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {success ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl text-foreground">
                    ✓
                  </div>
                  <p className="text-base font-semibold text-foreground">Regra salva com sucesso!</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">Escopo</label>
                    <Select
                      aria-label="Escopo"
                      selectedKey={scopeType}
                      onSelectionChange={(k) => setScopeType(String(k) as ScopeType)}
                    >
                      <Select.Trigger>
                        <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="all" textValue="Todos">
                            Todos
                          </ListBox.Item>
                          <ListBox.Item id="service" textValue="Serviço">
                            Serviço
                          </ListBox.Item>
                          <ListBox.Item id="product" textValue="Produto">
                            Produto
                          </ListBox.Item>
                          <ListBox.Item id="category" textValue="Categoria">
                            Categoria
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Cashback (%)</label>
                      <TextField value={percent} onChange={setPercent} aria-label="Cashback">
                        <Input placeholder="0,00" inputMode="decimal" />
                      </TextField>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Validade (dias)</label>
                      <TextField
                        value={validityDays}
                        onChange={setValidityDays}
                        aria-label="Validade"
                      >
                        <Input placeholder="0 = sem expiração" inputMode="numeric" />
                      </TextField>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    Regra ativa
                  </label>
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
