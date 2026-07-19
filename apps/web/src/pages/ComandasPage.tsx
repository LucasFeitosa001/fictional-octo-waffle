import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Input,
  ListBox,
  Modal,
  Select,
  Tabs,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { OrderStatusChip } from '../components/StatusChip';
import { DateField } from '../components/DateRangeFilter';
import { IconDownload, IconPlus, IconReceipt } from '../components/icons';
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

const TABS = [
  { id: 'all', label: 'Todas', status: undefined },
  { id: 'open', label: 'Abertas', status: 'open' },
  { id: 'finished', label: 'Finalizadas', status: 'finished' },
  { id: 'canceled', label: 'Canceladas', status: 'canceled' },
] as const;

const STATUS_OPTIONS = [
  { id: 'open', label: 'Aberta' },
  { id: 'finished', label: 'Finalizada' },
  { id: 'canceled', label: 'Cancelada' },
] as const;

export function ComandasPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<string>('all');
  const status = TABS.find((t) => t.id === tab)?.status;
  const orders = useOrders(status);
  const del = useDeleteOrder();
  const allRows = orders.data?.data ?? [];

  const [range, setRange] = useState(monthRange);
  // The /orders endpoint only filters by status server-side, so date and
  // customer are applied client-side over the loaded rows.
  const [customerId, setCustomerId] = useState<string>('all');

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

  const rows = useMemo(
    () =>
      allRows.filter((o) => {
        const day = o.date?.slice(0, 10) ?? '';
        if (range.from && day && day < range.from) return false;
        if (range.to && day && day > range.to) return false;
        if (customerId !== 'all' && o.customer?.id !== customerId) return false;
        return true;
      }),
    [allRows, range.from, range.to, customerId],
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OrderRow | null>(null);
  useAutoCreate(() => setCreateOpen(true));

  function exportCsv() {
    const header = ['Numero', 'Cliente', 'Data', 'Bruto', 'Desconto', 'Liquido', 'Status'];
    const body = rows.map((o) => [
      o.number,
      o.customer?.name ?? 'Avulso',
      formatDate(o.date),
      o.grossTotal,
      o.discountTotal,
      o.netTotal,
      o.status,
    ]);
    const csv = [header, ...body].map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comandas-${isoDate(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRemove(o: OrderRow) {
    if (!window.confirm(`Cancelar a comanda #${o.number}?`)) return;
    try {
      await del.mutateAsync(o.id);
    } catch {
      window.alert('Não foi possível cancelar a comanda.');
    }
  }

  const columns: Column<OrderRow>[] = [
    {
      key: 'number',
      header: 'Nº',
      isRowHeader: true,
      render: (o) => (
        <button
          type="button"
          onClick={() => navigate(`/comandas/${o.id}`)}
          className="font-semibold text-accent hover:underline"
        >
          #{o.number}
        </button>
      ),
    },
    { key: 'customer', header: 'Cliente', render: (o) => o.customer?.name ?? 'Avulso' },
    { key: 'date', header: 'Data', render: (o) => formatDate(o.date) },
    { key: 'gross', header: 'Bruto', render: (o) => formatMoney(o.grossTotal) },
    { key: 'discount', header: 'Desconto', render: (o) => formatMoney(o.discountTotal) },
    {
      key: 'net',
      header: 'Líquido',
      render: (o) => <span className="font-semibold">{formatMoney(o.netTotal)}</span>,
    },
    { key: 'status', header: 'Status', render: (o) => <OrderStatusChip status={o.status} /> },
    {
      key: 'actions',
      header: 'Ações',
      render: (o) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/comandas/${o.id}`)}>
            Detalhes
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(o)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            isDisabled={o.status === 'canceled' || del.isPending}
            onClick={() => handleRemove(o)}
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
        title="Comandas"
        subtitle="Vendas e atendimentos"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportCsv}
              isDisabled={rows.length === 0}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> Nova comanda
            </Button>
          </div>
        }
      />

      <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          <div className="mb-4 -mx-1 overflow-x-auto px-1">
            <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
              <Tabs.List className="w-max">
                {TABS.map((t) => (
                  <Tabs.Tab key={t.id} id={t.id}>
                    {t.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-3">
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
            <div className="flex min-w-52 flex-col gap-1">
              <span className="text-xs font-medium text-muted">Cliente</span>
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
              <div className="mb-2 text-xs text-muted">{rows.length} comanda(s)</div>
              <DataTable
                aria-label="Comandas"
                columns={columns}
                rows={rows}
                getKey={(o) => o.id}
              />
            </>
          )}
        </Card.Content>
      </Card>

      <CreateOrderModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <EditOrderModal order={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function CreateOrderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const create = useCreateOrder();
  const customers = useCustomers('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const customerList = useMemo(() => customers.data?.data ?? [], [customers.data]);

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
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Nova comanda"
      isPending={create.isPending}
      canSave={!create.isPending}
      onSave={handleSave}
    >
      <Field label="Cliente (opcional)">
        <Select
          aria-label="Cliente"
          selectedKey={customerId || null}
          onSelectionChange={(k) => setCustomerId(k ? String(k) : '')}
        >
          <Select.Trigger>
            <Select.Value>
              {({ isPlaceholder, selectedText }) =>
                isPlaceholder ? 'Avulso' : selectedText
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
      <Field label="Observações (opcional)">
        <TextField value={notes} onChange={setNotes} aria-label="Observações">
          <Input placeholder="Ex.: Atendimento agendado" />
        </TextField>
      </Field>
      {error && <FormError message={error} />}
    </ModalShell>
  );
}

function EditOrderModal({ order, onClose }: { order: OrderRow | null; onClose: () => void }) {
  const update = useUpdateOrder();
  const [status, setStatus] = useState<'open' | 'finished' | 'canceled'>('open');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setStatus(order.status);
      setError(null);
    }
  }, [order]);

  async function handleSave() {
    if (!order) return;
    setError(null);
    try {
      await update.mutateAsync({ id: order.id, body: { status } });
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível atualizar a comanda.');
    }
  }

  return (
    <ModalShell
      isOpen={order != null}
      onClose={onClose}
      title={order ? `Editar comanda #${order.number}` : 'Editar comanda'}
      isPending={update.isPending}
      canSave={!update.isPending}
      onSave={handleSave}
    >
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
      {error && <FormError message={error} />}
    </ModalShell>
  );
}

function ModalShell({
  isOpen,
  onClose,
  title,
  isPending,
  canSave,
  onSave,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  isPending: boolean;
  canSave: boolean;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container
        placement="center"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">{children}</Modal.Body>
          <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              isDisabled={!canSave}
              onClick={onSave}
            >
              {isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
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
