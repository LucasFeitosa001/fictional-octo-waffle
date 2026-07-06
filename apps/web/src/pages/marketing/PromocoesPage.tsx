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
import { DateField } from '../../components/DateRangeFilter';
import {
  IconDownload,
  IconMegaphone,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../../components/icons';
import { formatDate, formatMoney } from '../../lib/format';
import {
  useCreatePromotion,
  useDeletePromotion,
  usePromotions,
  useUpdatePromotion,
  type DiscountType,
  type Promotion,
} from '../../lib/queries/marketing';

function discountLabel(p: Promotion) {
  return p.discountType === 'percent'
    ? `${Number(p.discountValue).toFixed(0)}%`
    : formatMoney(p.discountValue);
}

type OnlineFilter = 'all' | 'online' | 'offline';

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

export function PromocoesPage() {
  const promotions = usePromotions();
  const del = useDeletePromotion();
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlineFilter, setOnlineFilter] = useState<OnlineFilter>('all');

  const allRows = promotions.data ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (onlineFilter === 'online' && !p.appliesOnline) return false;
      if (onlineFilter === 'offline' && p.appliesOnline) return false;
      return true;
    });
  }, [allRows, search, onlineFilter]);

  function exportCsv() {
    const header = ['Promoção', 'Desconto', 'Válido de', 'Válido até', 'Limite de uso', 'Online'];
    const body = rows.map((p) => [
      p.name,
      discountLabel(p),
      formatDate(p.validFrom),
      formatDate(p.validTo),
      p.usageLimit ? String(p.usageLimit) : 'Ilimitado',
      p.appliesOnline ? 'Sim' : 'Não',
    ]);
    downloadCsv('promocoes.csv', [header, ...body]);
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(p: Promotion) {
    setEditing(p);
    setModalOpen(true);
  }
  async function handleRemove(p: Promotion) {
    if (!window.confirm(`Excluir a promoção "${p.name}"?`)) return;
    try {
      await del.mutateAsync(p.id);
    } catch {
      window.alert('Não foi possível excluir a promoção.');
    }
  }

  const columns: Column<Promotion>[] = [
    {
      key: 'name',
      header: 'Promoção',
      isRowHeader: true,
      render: (p) => <span className="font-medium text-foreground">{p.name}</span>,
    },
    {
      key: 'discount',
      header: 'Desconto',
      render: (p) => (
        <Chip variant="soft" color="accent" size="sm">
          {discountLabel(p)}
        </Chip>
      ),
    },
    {
      key: 'validity',
      header: 'Validade',
      render: (p) =>
        p.validFrom || p.validTo
          ? `${formatDate(p.validFrom)} → ${formatDate(p.validTo)}`
          : 'Sem prazo',
    },
    {
      key: 'usage',
      header: 'Limite de uso',
      render: (p) => (p.usageLimit ? p.usageLimit : 'Ilimitado'),
    },
    {
      key: 'online',
      header: 'Online',
      render: (p) => (
        <Chip variant="soft" color={p.appliesOnline ? 'success' : 'default'} size="sm">
          {p.appliesOnline ? 'Sim' : 'Não'}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => openEdit(p)}
            aria-label={`Editar ${p.name}`}
            className="grid h-9 w-9 place-items-center rounded-lg text-[#6f6a63] transition-colors hover:bg-[#f2b33d]/15 hover:text-[#a67c1e]"
          >
            <IconPencil size={16} />
          </button>
          <button
            type="button"
            disabled={del.isPending}
            onClick={() => handleRemove(p)}
            aria-label={`Excluir ${p.name}`}
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
        title="Promoções"
        subtitle="Descontos por serviço, produto ou categoria"
        onRefresh={() => promotions.refetch()}
        isRefreshing={promotions.isFetching}
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
              <IconPlus size={16} /> Nova promoção
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
              aria-label="Buscar promoção"
              className="min-w-0 flex-1"
            >
              <Input placeholder="Buscar por nome…" className="border-0 shadow-none focus:ring-0" />
            </TextField>
          </div>
          <div className="flex gap-1.5">
            {(
              [
                ['all', 'Todas'],
                ['online', 'Online'],
                ['offline', 'Presencial'],
              ] as [OnlineFilter, string][]
            ).map(([key, label]) => {
              const isActive = onlineFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOnlineFilter(key)}
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
          {promotions.isLoading ? (
            <LoadingState />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconMegaphone size={32} />}
              title={
                allRows.length === 0
                  ? 'Nenhuma promoção cadastrada'
                  : 'Nenhuma promoção encontrada'
              }
              description={
                allRows.length === 0
                  ? 'Crie promoções com desconto, validade e limite de uso.'
                  : 'Ajuste a busca ou os filtros para ver mais resultados.'
              }
              action={
                allRows.length === 0 ? (
                  <Button variant="primary" onClick={openCreate}>
                    <IconPlus size={16} /> Nova promoção
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <DataTable
              aria-label="Promoções"
              columns={columns}
              rows={rows}
              getKey={(p) => p.id}
            />
          )}
        </Card.Content>
      </Card>

      <PromocaoModal isOpen={modalOpen} onOpenChange={setModalOpen} editing={editing} />
    </div>
  );
}

function PromocaoModal({
  isOpen,
  onOpenChange,
  editing,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Promotion | null;
}) {
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [appliesOnline, setAppliesOnline] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const create = useCreatePromotion();
  const update = useUpdatePromotion();
  const isPending = create.isPending || update.isPending;

  useEffect(() => {
    if (isOpen) {
      setName(editing?.name ?? '');
      setDiscountType(editing?.discountType ?? 'percent');
      setDiscountValue(editing ? String(editing.discountValue) : '');
      setValidFrom(editing?.validFrom ? editing.validFrom.slice(0, 10) : '');
      setValidTo(editing?.validTo ? editing.validTo.slice(0, 10) : '');
      setUsageLimit(editing?.usageLimit != null ? String(editing.usageLimit) : '');
      setAppliesOnline(editing?.appliesOnline ?? false);
      setFormError(null);
      setSuccess(false);
    }
  }, [isOpen, editing]);

  const canConfirm =
    name.trim().length >= 2 && Number(discountValue.replace(',', '.')) > 0 && !isPending;

  async function handleConfirm() {
    setFormError(null);
    const body = {
      name: name.trim(),
      scopeType: 'all' as const,
      discountType,
      discountValue: Number(discountValue.replace(',', '.')),
      validFrom: validFrom || undefined,
      validTo: validTo || undefined,
      usageLimit: usageLimit ? Number(usageLimit) : undefined,
      appliesOnline,
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
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar a promoção.',
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
            <Modal.Heading>{editing ? 'Editar promoção' : 'Nova promoção'}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {success ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F3E7D6] text-2xl text-accent">
                  ✓
                </div>
                <p className="text-base font-semibold text-foreground">
                  Promoção salva com sucesso!
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Nome</label>
                  <TextField value={name} onChange={setName} aria-label="Nome">
                    <Input placeholder="Ex.: Black Friday" />
                  </TextField>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">Tipo de desconto</label>
                    <Select
                      aria-label="Tipo de desconto"
                      selectedKey={discountType}
                      onSelectionChange={(k) => setDiscountType(String(k) as DiscountType)}
                    >
                      <Select.Trigger>
                        <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="percent" textValue="Percentual">
                            Percentual (%)
                          </ListBox.Item>
                          <ListBox.Item id="value" textValue="Valor">
                            Valor (R$)
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted">
                      Desconto {discountType === 'percent' ? '(%)' : '(R$)'}
                    </label>
                    <TextField
                      value={discountValue}
                      onChange={setDiscountValue}
                      aria-label="Desconto"
                    >
                      <Input placeholder="0" inputMode="decimal" />
                    </TextField>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DateField
                    label="Válido de"
                    value={validFrom}
                    max={validTo || undefined}
                    onChange={setValidFrom}
                    className="min-w-0"
                  />
                  <DateField
                    label="Válido até"
                    value={validTo}
                    min={validFrom || undefined}
                    onChange={setValidTo}
                    className="min-w-0"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Limite de uso</label>
                  <TextField value={usageLimit} onChange={setUsageLimit} aria-label="Limite de uso">
                    <Input placeholder="Ilimitado" inputMode="numeric" />
                  </TextField>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={appliesOnline}
                    onChange={(e) => setAppliesOnline(e.target.checked)}
                  />
                  Aplica no agendamento online
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
