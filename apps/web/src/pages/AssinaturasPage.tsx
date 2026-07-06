import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Input, ListBox, Modal, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { IconDownload, IconPlus, IconRepeat } from '../components/icons';
import { formatDate, formatMoney } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { useCustomers, useServices } from '../lib/queries';
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

const STATUS_LABELS: Record<MembershipStatus, string> = {
  active: 'Ativo',
  canceled: 'Cancelado',
  overdue: 'Inadimplente',
};
const STATUS_COLOR: Record<MembershipStatus, 'success' | 'default' | 'danger'> = {
  active: 'success',
  canceled: 'default',
  overdue: 'danger',
};

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

type SubFilter = 'all' | MembershipStatus;
const SUB_FILTERS: { id: SubFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'overdue', label: 'Inadimplentes' },
  { id: 'canceled', label: 'Cancelados' },
];

function SegmentedFilter<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-[var(--color-soft-border)] bg-[#f7f3ea] p-1">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-[#f2b33d] text-[#1a1a1a] shadow-[var(--shadow-gold)]'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function AssinaturasPage() {
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [createSubscriberOpen, setCreateSubscriberOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SubFilter>('all');
  const [search, setSearch] = useState('');

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanModalOpen(true);
  }
  function openEditPlan(p: MembershipPlan) {
    setEditingPlan(p);
    setPlanModalOpen(true);
  }

  const memberships = useCustomerMemberships();
  const plans = useMembershipPlans();
  const updateMembership = useUpdateCustomerMembership();

  const allSubRows = memberships.data ?? [];
  const planRows = plans.data ?? [];

  const subRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allSubRows.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (term && !(m.customer?.name ?? '').toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allSubRows, statusFilter, search]);

  function exportSubsCsv() {
    downloadCsv(
      `assinantes-${new Date().toISOString().slice(0, 10)}`,
      [
        { header: 'Cliente', value: (m: CustomerMembership) => m.customer?.name ?? '' },
        { header: 'Plano', value: (m: CustomerMembership) => m.membershipPlan?.name ?? '' },
        { header: 'Mensalidade', value: (m: CustomerMembership) => m.membershipPlan?.recurringPrice ?? '' },
        { header: 'Próx. vencimento', value: (m: CustomerMembership) => formatDate(m.nextDueDate) },
        { header: 'Status', value: (m: CustomerMembership) => STATUS_LABELS[m.status] },
      ],
      subRows,
    );
  }

  const subColumns: Column<CustomerMembership>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      isRowHeader: true,
      render: (m) => (
        <span className="font-medium text-foreground">{m.customer?.name ?? '—'}</span>
      ),
    },
    { key: 'plan', header: 'Plano', render: (m) => m.membershipPlan?.name ?? '—' },
    {
      key: 'price',
      header: 'Mensalidade',
      render: (m) => formatMoney(m.membershipPlan?.recurringPrice),
    },
    { key: 'due', header: 'Próx. vencimento', render: (m) => formatDate(m.nextDueDate) },
    {
      key: 'status',
      header: 'Status',
      render: (m) => (
        <Chip color={STATUS_COLOR[m.status]} variant="soft" size="sm">
          {STATUS_LABELS[m.status]}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (m) => (
        <div className="flex gap-2">
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
            isDisabled={m.status === 'canceled' || updateMembership.isPending}
            onClick={() =>
              updateMembership.mutate({ id: m.id, body: { status: 'canceled' } })
            }
          >
            Cancelar
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Assinaturas"
        subtitle="Assinantes e planos recorrentes"
        onRefresh={() => {
          memberships.refetch();
          plans.refetch();
        }}
        isRefreshing={memberships.isFetching}
        actions={
          <Button variant="primary" onClick={() => setCreateSubscriberOpen(true)}>
            <IconPlus size={16} /> Novo assinante
          </Button>
        }
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Assinantes</h3>
              <p className="text-xs text-muted">
                {subRows.length} de {allSubRows.length} assinante(s)
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              isDisabled={subRows.length === 0}
              onClick={exportSubsCsv}
            >
              <IconDownload size={14} /> Exportar CSV
            </Button>
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SegmentedFilter
              value={statusFilter}
              options={SUB_FILTERS}
              onChange={setStatusFilter}
            />
            <div className="min-w-[200px] flex-1">
              <TextField value={search} onChange={setSearch} aria-label="Buscar cliente">
                <Input placeholder="Buscar cliente…" />
              </TextField>
            </div>
            {(search || statusFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
              >
                Limpar
              </Button>
            )}
          </div>
          {memberships.isLoading ? (
            <LoadingState />
          ) : memberships.isError ? (
            <ErrorState onRetry={() => memberships.refetch()} />
          ) : subRows.length === 0 ? (
            <EmptyState
              icon={<IconRepeat size={32} />}
              title={allSubRows.length === 0 ? 'Nenhum assinante' : 'Nenhum assinante encontrado'}
              description={
                allSubRows.length === 0
                  ? 'Cadastre um assinante vinculando um cliente a um plano.'
                  : 'Tente ajustar os filtros.'
              }
            />
          ) : (
            <DataTable
              aria-label="Assinantes"
              columns={subColumns}
              rows={subRows}
              getKey={(m) => m.id}
            />
          )}
        </Card.Content>
      </Card>

      <Card className={CARD}>
        <Card.Content className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Modelos de assinatura
              <span className="ml-2 text-xs font-normal text-muted">{planRows.length} plano(s)</span>
            </h3>
            <Button variant="outline" size="sm" onClick={openCreatePlan}>
              <IconPlus size={14} /> Novo plano
            </Button>
          </div>
          {plans.isLoading ? (
            <LoadingState />
          ) : plans.isError ? (
            <ErrorState onRetry={() => plans.refetch()} />
          ) : planRows.length === 0 ? (
            <EmptyState
              icon={<IconRepeat size={32} />}
              title="Nenhum plano de assinatura"
              description="Crie planos com serviços incluídos e preço recorrente."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {planRows.map((p) => (
                <PlanCard key={p.id} plan={p} onEdit={() => openEditPlan(p)} />
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      <PlanModal
        isOpen={planModalOpen}
        editing={editingPlan}
        onClose={() => setPlanModalOpen(false)}
      />
      <CreateSubscriberModal
        isOpen={createSubscriberOpen}
        onClose={() => setCreateSubscriberOpen(false)}
      />
    </div>
  );
}

function PlanCard({ plan, onEdit }: { plan: MembershipPlan; onEdit: () => void }) {
  const del = useDeleteMembershipPlan();

  async function handleRemove() {
    if (!window.confirm(`Remover o plano "${plan.name}"?`)) return;
    try {
      await del.mutateAsync(plan.id);
    } catch (err) {
      window.alert(
        err instanceof ApiClientError ? err.message : 'Não foi possível remover o plano.',
      );
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{plan.name}</span>
        <span className="rounded-full bg-[#f2b33d]/15 px-2.5 py-1 text-xs font-semibold text-[#a67c1e]">
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

function PlanModal({
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
  const services = useServices();
  const [name, setName] = useState('');
  const [recurringPrice, setRecurringPrice] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('1');
  const [serviceId, setServiceId] = useState('');
  const [qty, setQty] = useState('1');
  const [items, setItems] = useState<
    { serviceId: string; quantityPerCycle: number; name: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const serviceList = useMemo(() => services.data?.data ?? [], [services.data]);

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setName(editing.name);
        setRecurringPrice(editing.recurringPrice);
        setIntervalMonths(String(editing.intervalMonths ?? 1));
        setItems(
          editing.services.map((s) => ({
            serviceId: s.serviceId,
            quantityPerCycle: s.quantityPerCycle,
            name: s.service?.name ?? '—',
          })),
        );
      } else {
        setName('');
        setRecurringPrice('');
        setIntervalMonths('1');
        setItems([]);
      }
      setServiceId('');
      setQty('1');
      setError(null);
    }
  }, [isOpen, editing]);

  function addItem() {
    if (!serviceId) return;
    const svc = serviceList.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems((prev) => [
      ...prev.filter((i) => i.serviceId !== serviceId),
      { serviceId, quantityPerCycle: Math.max(1, Number(qty) || 1), name: svc.name },
    ]);
    setServiceId('');
    setQty('1');
  }

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
        quantityPerCycle: i.quantityPerCycle,
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
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container
        placement="center"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{editing ? 'Editar plano' : 'Novo plano de assinatura'}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <Field label="Nome">
              <TextField value={name} onChange={setName} aria-label="Nome">
                <Input placeholder="Ex.: Plano Mensal Premium" />
              </TextField>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mensalidade">
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

            <div className="rounded-lg border border-default-200 p-3">
              <div className="mb-2 text-xs font-medium text-muted">Serviços incluídos</div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[150px] flex-1">
                  <Select
                    aria-label="Serviço"
                    selectedKey={serviceId || null}
                    onSelectionChange={(k) => setServiceId(k ? String(k) : '')}
                  >
                    <Select.Trigger>
                      <Select.Value>
                        {({ isPlaceholder, selectedText }) =>
                          isPlaceholder ? 'Selecione um serviço' : selectedText
                        }
                      </Select.Value>
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {serviceList.map((s) => (
                          <ListBox.Item key={s.id} id={s.id} textValue={s.name}>
                            {s.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className="w-24">
                  <TextField value={qty} onChange={setQty} aria-label="Quantidade por ciclo">
                    <Input type="number" placeholder="Qtd" />
                  </TextField>
                </div>
                <Button variant="outline" onClick={addItem} isDisabled={!serviceId}>
                  Adicionar
                </Button>
              </div>
              {items.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {items.map((i) => (
                    <li key={i.serviceId} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{i.name}</span>
                      <div className="flex items-center gap-2">
                        <Chip variant="soft" color="accent" size="sm">
                          {i.quantityPerCycle}x / ciclo
                        </Chip>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setItems((prev) => prev.filter((x) => x.serviceId !== i.serviceId))
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              isDisabled={!canSave || isPending}
              onClick={handleSave}
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

function CreateSubscriberModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const create = useCreateCustomerMembership();
  const customers = useCustomers('');
  const plans = useMembershipPlans();
  const [customerId, setCustomerId] = useState('');
  const [membershipPlanId, setMembershipPlanId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const customerList = useMemo(() => customers.data?.data ?? [], [customers.data]);
  const planList = useMemo(() => plans.data ?? [], [plans.data]);

  useEffect(() => {
    if (isOpen) {
      setCustomerId('');
      setMembershipPlanId('');
      setError(null);
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
        err instanceof ApiClientError ? err.message : 'Não foi possível cadastrar o assinante.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container
        placement="center"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Novo assinante</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <Field label="Cliente">
              <Select
                aria-label="Cliente"
                selectedKey={customerId || null}
                onSelectionChange={(k) => setCustomerId(k ? String(k) : '')}
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ isPlaceholder, selectedText }) =>
                      isPlaceholder ? 'Selecione o cliente' : selectedText
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
            <Field label="Plano">
              <Select
                aria-label="Plano"
                selectedKey={membershipPlanId || null}
                onSelectionChange={(k) => setMembershipPlanId(k ? String(k) : '')}
              >
                <Select.Trigger>
                  <Select.Value>
                    {({ isPlaceholder, selectedText }) =>
                      isPlaceholder ? 'Selecione o plano' : selectedText
                    }
                  </Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {planList.map((p) => (
                      <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                        {p.name}
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>

            {error && (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              isDisabled={!canSave || create.isPending}
              onClick={handleSave}
            >
              {create.isPending ? 'Salvando…' : 'Cadastrar'}
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
