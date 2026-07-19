'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, Input, ListBox, Modal, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { IconLayers, IconPlus } from '@/components/icons';
import { formatDate, formatMoney } from '@/lib/format';
import { useCustomers, useServices } from '@/lib/queries';
import {
  useCreatePackageTemplate,
  useCustomerPackages,
  useDeleteCustomerPackage,
  useDeletePackageTemplate,
  usePackageTemplates,
  useSellPackage,
  useUpdatePackageTemplate,
  type CustomerPackage,
  type PackageStatus,
  type PackageTemplate,
} from '@/lib/queries/pacotes';

const STATUS_LABELS: Record<PackageStatus, string> = {
  active: 'Ativo',
  expired: 'Vencido',
  finished: 'Finalizado',
};
const STATUS_COLOR: Record<PackageStatus, 'success' | 'danger' | 'default'> = {
  active: 'success',
  expired: 'danger',
  finished: 'default',
};

export default function PacotesPage() {
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PackageTemplate | null>(null);
  const [sellOpen, setSellOpen] = useState(false);

  const sold = useCustomerPackages();
  const templates = usePackageTemplates();
  const delSold = useDeleteCustomerPackage();

  const soldRows = sold.data?.data ?? [];
  const templateRows = templates.data ?? [];

  function openCreateTemplate() {
    setEditingTemplate(null);
    setTemplateModalOpen(true);
  }
  function openEditTemplate(t: PackageTemplate) {
    setEditingTemplate(t);
    setTemplateModalOpen(true);
  }

  async function handleRemoveSold(p: CustomerPackage) {
    if (!window.confirm(`Remover o pacote #${p.number}?`)) return;
    try {
      await delSold.mutateAsync(p.id);
    } catch {
      window.alert('Não foi possível remover o pacote.');
    }
  }

  function effectiveStatus(p: CustomerPackage): PackageStatus {
    if (p.status === 'active' && p.isExpired) return 'expired';
    return p.status;
  }

  const soldColumns: Column<CustomerPackage>[] = [
    {
      key: 'customer',
      header: 'Cliente',
      isRowHeader: true,
      render: (p) => (
        <span className="font-medium text-foreground">{p.customer?.name ?? '—'}</span>
      ),
    },
    { key: 'number', header: 'Nº', render: (p) => `#${p.number}` },
    { key: 'price', header: 'Valor', render: (p) => formatMoney(p.price) },
    { key: 'validity', header: 'Validade', render: (p) => formatDate(p.expiresAt) },
    {
      key: 'sessions',
      header: 'Sessões',
      render: (p) => (
        <span className="text-foreground">
          {p.sessionsUsed}/{p.sessionsTotal}
          <span className="ml-2 text-muted">({p.sessionsRemaining} restantes)</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => {
        const st = effectiveStatus(p);
        return (
          <Chip color={STATUS_COLOR[st]} variant="soft" size="sm">
            {STATUS_LABELS[st]}
          </Chip>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            isDisabled={delSold.isPending}
            onClick={() => handleRemoveSold(p)}
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
        title="Pacotes"
        subtitle="Pacotes vendidos e modelos"
        actions={
          <Button variant="primary" onClick={() => setSellOpen(true)}>
            <IconPlus size={16} /> Vender pacote
          </Button>
        }
      />

      <Card className="db-card mb-4">
        <Card.Content className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Pacotes vendidos</h3>
          {sold.isLoading ? (
            <LoadingState />
          ) : sold.isError ? (
            <ErrorState onRetry={() => sold.refetch()} />
          ) : soldRows.length === 0 ? (
            <EmptyState
              icon={<IconLayers size={32} />}
              title="Nenhum pacote vendido"
              description="Venda um pacote a um cliente para acompanhar sessões e validade."
            />
          ) : (
            <DataTable
              aria-label="Pacotes vendidos"
              columns={soldColumns}
              rows={soldRows}
              getKey={(p) => p.id}
            />
          )}
        </Card.Content>
      </Card>

      <Card className="db-card">
        <Card.Content className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Modelos de pacote</h3>
            <Button variant="outline" size="sm" onClick={openCreateTemplate}>
              <IconPlus size={14} /> Novo modelo
            </Button>
          </div>
          {templates.isLoading ? (
            <LoadingState />
          ) : templates.isError ? (
            <ErrorState onRetry={() => templates.refetch()} />
          ) : templateRows.length === 0 ? (
            <EmptyState
              icon={<IconLayers size={32} />}
              title="Nenhum modelo de pacote"
              description="Crie modelos com serviços e número de sessões."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templateRows.map((t) => (
                <TemplateCard key={t.id} template={t} onEdit={() => openEditTemplate(t)} />
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      <TemplateModal
        isOpen={templateModalOpen}
        editing={editingTemplate}
        onClose={() => setTemplateModalOpen(false)}
      />
      <SellPackageModal isOpen={sellOpen} onClose={() => setSellOpen(false)} />
    </div>
  );
}

function TemplateCard({
  template,
  onEdit,
}: {
  template: PackageTemplate;
  onEdit: () => void;
}) {
  const del = useDeletePackageTemplate();
  const totalSessions = template.items.reduce((acc, i) => acc + i.sessions, 0);

  async function handleRemove() {
    if (!window.confirm(`Remover o modelo "${template.name}"?`)) return;
    try {
      await del.mutateAsync(template.id);
    } catch {
      window.alert('Não foi possível remover o modelo.');
    }
  }

  return (
    <div className="rounded-lg border border-white/10 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{template.name}</span>
        <Chip variant="soft" color="accent" size="sm">
          {formatMoney(template.price)}
        </Chip>
      </div>
      <div className="mt-2 text-sm text-muted">
        {totalSessions} sessão(ões) • {template.items.length} serviço(s)
      </div>
      {template.validityDays > 0 && (
        <div className="mt-1 text-xs text-muted">Validade: {template.validityDays} dias</div>
      )}
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-danger"
          isDisabled={del.isPending}
          onClick={handleRemove}
        >
          Remover
        </Button>
      </div>
    </div>
  );
}

function TemplateModal({
  isOpen,
  editing,
  onClose,
}: {
  isOpen: boolean;
  editing: PackageTemplate | null;
  onClose: () => void;
}) {
  const create = useCreatePackageTemplate();
  const update = useUpdatePackageTemplate();
  const services = useServices();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [validityDays, setValidityDays] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [sessions, setSessions] = useState('1');
  const [items, setItems] = useState<{ serviceId: string; sessions: number; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const serviceList = useMemo(() => services.data?.data ?? [], [services.data]);

  useEffect(() => {
    if (isOpen) {
      if (editing) {
        setName(editing.name);
        setPrice(editing.price);
        setValidityDays(editing.validityDays ? String(editing.validityDays) : '');
        setItems(
          editing.items.map((i) => ({
            serviceId: i.serviceId,
            sessions: i.sessions,
            name: i.service?.name ?? '—',
          })),
        );
      } else {
        setName('');
        setPrice('');
        setValidityDays('');
        setItems([]);
      }
      setServiceId('');
      setSessions('1');
      setError(null);
    }
  }, [isOpen, editing]);

  function addItem() {
    if (!serviceId) return;
    const svc = serviceList.find((s) => s.id === serviceId);
    if (!svc) return;
    setItems((prev) => [
      ...prev.filter((i) => i.serviceId !== serviceId),
      { serviceId, sessions: Math.max(1, Number(sessions) || 1), name: svc.name },
    ]);
    setServiceId('');
    setSessions('1');
  }

  const canSave = name.trim().length >= 2 && Number(price) >= 0 && price !== '' && items.length > 0;

  const isPending = create.isPending || update.isPending;

  async function handleSave() {
    setError(null);
    const body = {
      name: name.trim(),
      price: Number(price),
      validityDays: validityDays ? Number(validityDays) : undefined,
      items: items.map((i) => ({ serviceId: i.serviceId, sessions: i.sessions })),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar o modelo.');
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading>{editing ? 'Editar modelo' : 'Novo modelo de pacote'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <Field label="Nome">
                <TextField value={name} onChange={setName} aria-label="Nome">
                  <Input placeholder="Ex.: Pacote 10 cortes" />
                </TextField>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Preço">
                  <TextField value={price} onChange={setPrice} aria-label="Preço">
                    <Input type="number" placeholder="0,00" />
                  </TextField>
                </Field>
                <Field label="Validade (dias, opcional)">
                  <TextField value={validityDays} onChange={setValidityDays} aria-label="Validade">
                    <Input type="number" placeholder="0" />
                  </TextField>
                </Field>
              </div>

              <div className="rounded-lg border border-white/10 p-3">
                <div className="mb-2 text-xs font-medium text-muted">Serviços do pacote</div>
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
                    <TextField value={sessions} onChange={setSessions} aria-label="Sessões">
                      <Input type="number" placeholder="Sessões" />
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
                            {i.sessions} sessão(ões)
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

function SellPackageModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const sell = useSellPackage();
  const customers = useCustomers('', 1, 100);
  const templates = usePackageTemplates();
  const [customerId, setCustomerId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const customerList = useMemo(() => customers.data?.data ?? [], [customers.data]);
  const templateList = useMemo(() => templates.data ?? [], [templates.data]);

  useEffect(() => {
    if (isOpen) {
      setCustomerId('');
      setTemplateId('');
      setPrice('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const t = templateList.find((x) => x.id === templateId);
    if (t) setPrice(t.price);
  }, [templateId, templateList]);

  const canSave = customerId !== '' && templateId !== '';

  async function handleSave() {
    setError(null);
    try {
      await sell.mutateAsync({
        customerId,
        templateId,
        price: price ? Number(price) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível vender o pacote.');
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading>Vender pacote</Modal.Heading>
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
              <Field label="Modelo de pacote">
                <Select
                  aria-label="Modelo"
                  selectedKey={templateId || null}
                  onSelectionChange={(k) => setTemplateId(k ? String(k) : '')}
                >
                  <Select.Trigger>
                    <Select.Value>
                      {({ isPlaceholder, selectedText }) =>
                        isPlaceholder ? 'Selecione o modelo' : selectedText
                      }
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {templateList.map((t) => (
                        <ListBox.Item key={t.id} id={t.id} textValue={t.name}>
                          {t.name}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </Field>
              <Field label="Valor (opcional)">
                <TextField value={price} onChange={setPrice} aria-label="Valor">
                  <Input type="number" placeholder="0,00" />
                </TextField>
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
                isDisabled={!canSave || sell.isPending}
                onClick={handleSave}
              >
                {sell.isPending ? 'Salvando…' : 'Vender'}
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
