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
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { IconLayers, IconPencil, IconPlus, IconTrash } from '../../components/icons';
import { formatMoney } from '../../lib/format';
import { useServices } from '../../lib/queries';
import {
  useCreatePackageTemplate,
  useDeletePackageTemplate,
  usePackageTemplates,
  useUpdatePackageTemplate,
  type PackageTemplate,
} from '../../lib/queries/pacotes';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

export function PacotesPredefinidosPage() {
  const templates = usePackageTemplates();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PackageTemplate | null>(null);
  const [search, setSearch] = useState('');

  const allRows = templates.data ?? [];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [allRows, search]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(t: PackageTemplate) {
    setEditing(t);
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Pacotes predefinidos"
        subtitle="Modelos de pacote prontos para vender"
        onRefresh={() => templates.refetch()}
        isRefreshing={templates.isFetching}
        actions={
          <Button variant="primary" onClick={openCreate}>
            <IconPlus size={16} /> Novo modelo
          </Button>
        }
      />

      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <TextField
              value={search}
              onChange={setSearch}
              aria-label="Buscar modelo"
              className="min-w-0 max-w-sm flex-1"
            >
              <Input placeholder="Buscar modelo…" />
            </TextField>
            {search && (
              <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                Limpar
              </Button>
            )}
          </div>
        </Card.Content>
      </Card>

      <Card className={CARD}>
        <Card.Content className="p-4">
          {templates.isLoading ? (
            <LoadingState />
          ) : templates.isError ? (
            <ErrorState onRetry={() => templates.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconLayers size={32} />}
              title={
                allRows.length === 0 ? 'Nenhum pacote predefinido' : 'Nenhum modelo encontrado'
              }
              description={
                allRows.length === 0
                  ? 'Crie modelos com serviços e número de sessões para agilizar a venda de pacotes.'
                  : 'Ajuste a busca para ver mais resultados.'
              }
              action={
                allRows.length === 0 ? (
                  <Button variant="primary" onClick={openCreate}>
                    <IconPlus size={16} /> Novo modelo
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((t) => (
                <TemplateCard key={t.id} template={t} onEdit={() => openEdit(t)} />
              ))}
            </div>
          )}
        </Card.Content>
      </Card>

      <TemplateModal
        isOpen={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
      />
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
    <div className="flex flex-col rounded-xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-foreground">{template.name}</span>
        <span className="rounded-full bg-[#f2b33d]/15 px-2.5 py-1 text-xs font-semibold text-[#a67c1e]">
          {formatMoney(template.price)}
        </span>
      </div>
      <div className="mt-2 text-sm text-muted">
        {totalSessions} sessão(ões) • {template.items.length} serviço(s)
      </div>
      {template.validityDays > 0 && (
        <div className="mt-1 text-xs text-muted">Validade: {template.validityDays} dias</div>
      )}
      {!template.active && (
        <div className="mt-2">
          <Chip variant="soft" color="default" size="sm">
            Inativo
          </Chip>
        </div>
      )}
      <div className="mt-3 flex gap-1.5">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <IconPencil size={14} /> Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-danger"
          isDisabled={del.isPending}
          onClick={handleRemove}
        >
          <IconTrash size={14} /> Remover
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
        <Modal.Container placement="center" className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{editing ? 'Editar modelo' : 'Novo pacote predefinido'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <Field label="Nome">
                <TextField value={name} onChange={setName} aria-label="Nome">
                  <Input placeholder="Ex.: Pacote 10 limpezas" />
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

              <div className="rounded-lg border border-default-200 p-3">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
