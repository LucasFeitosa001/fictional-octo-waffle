'use client';

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
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ActiveChip } from '@/components/StatusChip';
import { IconPlus, IconScissors } from '@/components/icons';
import {
  useCreateService,
  useDeleteService,
  useServiceCategories,
  useServices,
  useUpdateService,
  type ServiceRow,
} from '@/lib/queries';
import { formatDuration, formatMoney } from '@/lib/format';

const NONE = '';

export default function ServicosPage() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const services = useServices();
  const categories = useServiceCategories();
  const deleteService = useDeleteService();

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories.data ?? []) m.set(c.id, c.name);
    return m;
  }, [categories.data]);

  const rows = useMemo(() => {
    const all = services.data?.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? all.filter((s) => s.name.toLowerCase().includes(q)) : all;
  }, [services.data, search]);

  async function handleDelete(s: ServiceRow) {
    if (!window.confirm(`Remover o serviço "${s.name}"?`)) return;
    await deleteService.mutateAsync(s.id);
  }

  const categoryOptions = (categories.data ?? []).map((c) => ({ id: c.id, name: c.name }));

  const columns: Column<ServiceRow>[] = [
    {
      key: 'name',
      header: 'Serviço',
      isRowHeader: true,
      render: (s) => (
        <div>
          <span className="font-medium text-foreground">{s.name}</span>
          {s.favorite && <div className="text-xs text-accent">Favorito</div>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categoria',
      render: (s) =>
        s.categoryId ? (
          <Chip variant="soft" color="accent" size="sm">
            {catName.get(s.categoryId) ?? '—'}
          </Chip>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: 'price', header: 'Preço', render: (s) => formatMoney(s.price) },
    { key: 'dur', header: 'Duração', render: (s) => formatDuration(s.durationMin) },
    {
      key: 'online',
      header: 'Online',
      render: (s) => (
        <Chip variant="soft" color={s.onlineBookable ? 'success' : 'default'} size="sm">
          {s.onlineBookable ? 'Sim' : 'Não'}
        </Chip>
      ),
    },
    { key: 'active', header: 'Status', render: (s) => <ActiveChip active={s.active} /> },
    {
      key: 'actions',
      header: '',
      render: (s) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
            Editar
          </Button>
          <Button
            variant="outline"
            size="sm"
            isDisabled={deleteService.isPending}
            onClick={() => handleDelete(s)}
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
        title="Serviços"
        subtitle="Catálogo de serviços do salão"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo serviço
          </Button>
        }
      />

      <Card className="db-card">
        <Card.Content className="p-4">
          <TextField value={search} onChange={setSearch} className="mb-4 max-w-sm">
            <Input placeholder="Buscar serviço…" />
          </TextField>

          {services.isLoading ? (
            <LoadingState />
          ) : services.isError ? (
            <ErrorState onRetry={() => services.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconScissors size={32} />}
              title="Nenhum serviço cadastrado"
              description="Cadastre serviços com preço, duração e categoria para começar."
            />
          ) : (
            <DataTable aria-label="Serviços" columns={columns} rows={rows} getKey={(s) => s.id} />
          )}
        </Card.Content>
      </Card>

      <ServiceModal
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categoryOptions}
      />
      <ServiceModal
        mode="edit"
        service={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        categories={categoryOptions}
      />
    </div>
  );
}

interface Option {
  id: string;
  name: string;
}

function ServiceModal({
  mode,
  service,
  isOpen,
  onClose,
  categories,
}: {
  mode: 'create' | 'edit';
  service?: ServiceRow | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Option[];
}) {
  const create = useCreateService();
  const update = useUpdateService();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [durationMin, setDurationMin] = useState('30');
  const [description, setDescription] = useState('');
  const [cashbackPercent, setCashbackPercent] = useState('');
  const [onlineBookable, setOnlineBookable] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(service?.name ?? '');
    setCategoryId(service?.categoryId ?? '');
    setPrice(service ? String(service.price) : '');
    setDurationMin(service ? String(service.durationMin) : '30');
    setDescription(service?.description ?? '');
    setCashbackPercent(service?.cashbackPercent ? String(service.cashbackPercent) : '');
    setOnlineBookable(service?.onlineBookable ?? true);
    setFavorite(service?.favorite ?? false);
    setVisible(service?.visible ?? true);
    setActive(service?.active ?? true);
    setError(null);
  }, [isOpen, service]);

  const pending = create.isPending || update.isPending;
  const canSave =
    name.trim().length >= 2 &&
    price !== '' &&
    Number(price) >= 0 &&
    Number(durationMin) >= 1 &&
    !pending;

  async function handleSave() {
    setError(null);
    const body = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      price: Number(price),
      durationMin: Number(durationMin),
      description: description.trim() || undefined,
      cashbackPercent: cashbackPercent ? Number(cashbackPercent) : undefined,
      onlineBookable,
      favorite,
      visible,
    };
    try {
      if (mode === 'edit' && service) {
        await update.mutateAsync({ id: service.id, body: { ...body, active } });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível salvar o serviço.');
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading>{mode === 'edit' ? 'Editar serviço' : 'Novo serviço'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <Field label="Nome">
                <TextField value={name} onChange={setName} aria-label="Nome">
                  <Input placeholder="Nome do serviço" />
                </TextField>
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Categoria (opcional)">
                  <Select
                    aria-label="Categoria"
                    selectedKey={categoryId || null}
                    onSelectionChange={(k) => setCategoryId(k ? String(k) : NONE)}
                  >
                    <Select.Trigger>
                      <Select.Value>
                        {({ isPlaceholder, selectedText }) =>
                          isPlaceholder ? 'Selecione' : selectedText
                        }
                      </Select.Value>
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {categories.map((c) => (
                          <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                            {c.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </Field>
                <Field label="Cashback (%)">
                  <TextField value={cashbackPercent} onChange={setCashbackPercent} aria-label="Cashback">
                    <Input type="number" placeholder="0" />
                  </TextField>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Preço">
                  <TextField value={price} onChange={setPrice} aria-label="Preço">
                    <Input type="number" placeholder="0,00" />
                  </TextField>
                </Field>
                <Field label="Duração (min)">
                  <TextField value={durationMin} onChange={setDurationMin} aria-label="Duração">
                    <Input type="number" placeholder="30" />
                  </TextField>
                </Field>
              </div>

              <Field label="Descrição (opcional)">
                <TextField value={description} onChange={setDescription} aria-label="Descrição">
                  <Input placeholder="Detalhes do serviço" />
                </TextField>
              </Field>

              <div className="flex flex-wrap gap-4">
                <Toggle label="Agendamento online" checked={onlineBookable} onChange={setOnlineBookable} />
                <Toggle label="Favorito" checked={favorite} onChange={setFavorite} />
                <Toggle label="Visível" checked={visible} onChange={setVisible} />
                {mode === 'edit' && <Toggle label="Ativo" checked={active} onChange={setActive} />}
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
                isDisabled={!canSave}
                onClick={handleSave}
              >
                {pending ? 'Salvando…' : 'Salvar'}
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
