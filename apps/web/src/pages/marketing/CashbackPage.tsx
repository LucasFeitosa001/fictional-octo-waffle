import { useEffect, useMemo, useState } from 'react';
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
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, LoadingState } from '../../components/States';
import { ActiveChip } from '../../components/StatusChip';
import {
  IconDownload,
  IconGift,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../../components/icons';
import {
  useCashbackRules,
  useCreateCashbackRule,
  useDeleteCashbackRule,
  useUpdateCashbackRule,
  type CashbackRule,
  type ScopeType,
} from '../../lib/queries/marketing';

const SCOPE_LABEL: Record<ScopeType, string> = {
  all: 'Todos',
  service: 'Serviço',
  product: 'Produto',
  category: 'Categoria',
};

type StatusFilter = 'all' | 'active' | 'inactive';

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CashbackPage() {
  const rules = useCashbackRules();
  const del = useDeleteCashbackRule();
  const [editing, setEditing] = useState<CashbackRule | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const allRows = rules.data ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (q && !SCOPE_LABEL[r.scopeType].toLowerCase().includes(q)) return false;
      if (statusFilter === 'active' && !r.active) return false;
      if (statusFilter === 'inactive' && r.active) return false;
      return true;
    });
  }, [allRows, search, statusFilter]);

  function exportCsv() {
    const header = ['Escopo', 'Cashback (%)', 'Validade (dias)', 'Status'];
    const body = rows.map((r) => [
      SCOPE_LABEL[r.scopeType],
      Number(r.percent).toFixed(2),
      r.validityDays > 0 ? String(r.validityDays) : 'Sem expiração',
      r.active ? 'Ativo' : 'Inativo',
    ]);
    downloadCsv('cashback.csv', [header, ...body]);
  }

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
        <Chip variant="soft" color="accent" size="sm">
          {SCOPE_LABEL[r.scopeType]}
        </Chip>
      ),
    },
    {
      key: 'percent',
      header: 'Cashback',
      render: (r) => <span className="font-medium text-foreground">{Number(r.percent).toFixed(2)}%</span>,
    },
    {
      key: 'validity',
      header: 'Validade',
      render: (r) => (r.validityDays > 0 ? `${r.validityDays} dias` : 'Sem expiração'),
    },
    { key: 'active', header: 'Status', render: (r) => <ActiveChip active={r.active} /> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => openEdit(r)}
            aria-label="Editar regra"
            className="grid h-9 w-9 place-items-center rounded-lg text-[#6f6a63] transition-colors hover:bg-[#f2b33d]/15 hover:text-[#a67c1e]"
          >
            <IconPencil size={16} />
          </button>
          <button
            type="button"
            disabled={del.isPending}
            onClick={() => handleRemove(r)}
            aria-label="Remover regra"
            className="grid h-9 w-9 place-items-center rounded-lg text-[#6f6a63] transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
          >
            <IconTrash size={16} />
          </button>
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
          <>
            <Button
              variant="outline"
              onClick={exportCsv}
              isDisabled={rows.length === 0}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Button variant="primary" onClick={openCreate}>
              <IconPlus size={16} /> Nova regra
            </Button>
          </>
        }
      />

      {/* Filter bar */}
      <Card className="mb-4 border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-stretch overflow-hidden rounded-xl border border-[var(--color-soft-border)] bg-white focus-within:border-[#f2b33d] focus-within:ring-2 focus-within:ring-[#f2b33d]/25 sm:max-w-xs sm:flex-1">
            <span className="grid w-10 shrink-0 place-items-center text-[#6f6a63]">
              <IconSearch size={16} />
            </span>
            <TextField
              value={search}
              onChange={setSearch}
              aria-label="Buscar por escopo"
              className="min-w-0 flex-1"
            >
              <Input placeholder="Buscar por escopo…" className="border-0 shadow-none focus:ring-0" />
            </TextField>
          </div>
          <div className="flex gap-1.5">
            {(
              [
                ['all', 'Todas'],
                ['active', 'Ativas'],
                ['inactive', 'Inativas'],
              ] as [StatusFilter, string][]
            ).map(([key, label]) => {
              const isActive = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={[
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-[#f2b33d] text-[#111111] shadow-[var(--shadow-gold)]'
                      : 'text-[#6f6a63] hover:bg-[#f2b33d]/15 hover:text-[#a67c1e]',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </Card.Content>
      </Card>

      <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          {rules.isLoading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconGift size={32} />}
              title={
                allRows.length === 0
                  ? 'Nenhuma regra de cashback'
                  : 'Nenhuma regra encontrada'
              }
              description={
                allRows.length === 0
                  ? 'Crie regras para premiar clientes com cashback.'
                  : 'Ajuste a busca ou os filtros para ver mais resultados.'
              }
              action={
                allRows.length === 0 ? (
                  <Button variant="primary" onClick={openCreate}>
                    <IconPlus size={16} /> Nova regra
                  </Button>
                ) : undefined
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
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E7D6] text-2xl text-accent">
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
