import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  Modal,
  Select,
  Tabs,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../components/PageHeader';
import { ImageGalleryUpload } from '../components/ImageUpload';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ActiveChip } from '../components/StatusChip';
import {
  IconDownload,
  IconGift,
  IconPencil,
  IconPlus,
  IconScissors,
  IconStar,
  IconTrash,
} from '../components/icons';
import {
  useCreateService,
  useDeleteService,
  useServiceCategories,
  useServices,
  useUpdateService,
  type ServiceBody,
  type ServiceRow,
} from '../lib/queries';
import { formatDuration, formatMoney } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { useAutoCreate } from '../lib/useAutoCreate';

const NONE = '';

type StatusFilter = 'all' | 'active' | 'inactive';

export function ServicosPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  useAutoCreate(() => setCreateOpen(true));
  const services = useServices();
  const categories = useServiceCategories();
  const deleteService = useDeleteService();
  const updateService = useUpdateService();

  async function toggleFavorite(s: ServiceRow) {
    await updateService.mutateAsync({
      id: s.id,
      body: { favorite: !s.favorite },
    });
  }

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories.data ?? []) m.set(c.id, c.name);
    return m;
  }, [categories.data]);

  const allRows = services.data?.data ?? [];
  const total = allRows.length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q)) &&
        (!categoryFilter || s.categoryId === categoryFilter) &&
        (statusFilter === 'all' ||
          (statusFilter === 'active' ? s.active : !s.active)),
    );
  }, [allRows, search, categoryFilter, statusFilter]);

  const hasFilters = Boolean(search || categoryFilter || statusFilter !== 'all');

  async function handleDelete(s: ServiceRow) {
    if (!window.confirm(`Remover o serviço "${s.name}"?`)) return;
    await deleteService.mutateAsync(s.id);
  }

  function exportCsv() {
    downloadCsv<ServiceRow>(
      'servicos',
      [
        { header: 'Serviço', value: (s) => s.name },
        { header: 'Categoria', value: (s) => (s.categoryId ? catName.get(s.categoryId) : '') },
        { header: 'Preço', value: (s) => Number(s.price).toFixed(2) },
        { header: 'Duração (min)', value: (s) => s.durationMin },
        { header: 'Agendamento online', value: (s) => (s.onlineBookable ? 'Sim' : 'Não') },
        { header: 'Favorito', value: (s) => (s.favorite ? 'Sim' : 'Não') },
        { header: 'Status', value: (s) => (s.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
  }

  const categoryOptions = (categories.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const columns: Column<ServiceRow>[] = [
    {
      key: 'name',
      header: 'Serviço',
      isRowHeader: true,
      render: (s) => (
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={s.favorite ? 'Remover dos favoritos' : 'Marcar como favorito'}
            aria-pressed={s.favorite}
            onClick={() => toggleFavorite(s)}
            disabled={updateService.isPending}
            className={`shrink-0 rounded-md p-1 transition-colors disabled:opacity-50 ${
              s.favorite
                ? 'text-[#f2b33d]'
                : 'text-[var(--color-soft-border)] hover:text-[#f2b33d]'
            }`}
            title={s.favorite ? 'Favorito' : 'Marcar como favorito'}
          >
            <IconStar size={18} />
          </button>
          {s.imageUrl ? (
            <img
              src={s.imageUrl}
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-[var(--color-soft-border)]"
            />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#f7f3ea] text-muted ring-1 ring-[var(--color-soft-border)]">
              <IconScissors size={16} />
            </span>
          )}
          <div>
            <span className="font-medium text-foreground">{s.name}</span>
            {Number(s.cashbackPercent) > 0 && (
              <div className="flex items-center gap-1 text-xs text-accent">
                <IconGift size={12} /> Cashback {Number(s.cashbackPercent)}%
              </div>
            )}
          </div>
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
        <div className="flex justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            aria-label="Editar"
            onClick={() => setEditing(s)}
          >
            <IconPencil size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Remover"
            className="text-danger"
            isDisabled={deleteService.isPending}
            onClick={() => handleDelete(s)}
          >
            <IconTrash size={14} />
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
        onRefresh={() => services.refetch()}
        isRefreshing={services.isFetching}
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportCsv}
              isDisabled={rows.length === 0}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> Novo serviço
            </Button>
          </>
        }
      />

      <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <TextField
              value={search}
              onChange={setSearch}
              className="min-w-0 max-w-sm flex-1"
              aria-label="Buscar serviço"
            >
              <Input
                placeholder="Buscar serviço…"
                className="focus:border-[#f2b33d] focus:ring-2 focus:ring-[#f2b33d]/25"
              />
            </TextField>
            <Select
              aria-label="Filtrar por categoria"
              selectedKey={categoryFilter || null}
              onSelectionChange={(k) => setCategoryFilter(k ? String(k) : NONE)}
              className="min-w-[10rem]"
            >
              <Select.Trigger
                className={
                  categoryFilter
                    ? 'border-[#f2b33d] bg-[#f2b33d]/15 text-[#a67c1e]'
                    : undefined
                }
              >
                <Select.Value>
                  {({ isPlaceholder, selectedText }) =>
                    isPlaceholder ? 'Categoria' : selectedText
                  }
                </Select.Value>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {categoryOptions.map((c) => (
                    <ListBox.Item key={c.id} id={c.id} textValue={c.name}>
                      {c.name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Segmented
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { id: 'all', label: 'Todos' },
                { id: 'active', label: 'Ativos' },
                { id: 'inactive', label: 'Inativos' },
              ]}
            />
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('');
                  setStatusFilter('all');
                }}
              >
                Limpar
              </Button>
            )}
          </div>

          {services.isLoading ? (
            <LoadingState />
          ) : services.isError ? (
            <ErrorState onRetry={() => services.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconScissors size={32} />}
              title={
                hasFilters
                  ? 'Nenhum serviço encontrado'
                  : 'Nenhum serviço cadastrado'
              }
              description={
                hasFilters
                  ? 'Tente ajustar os filtros.'
                  : 'Cadastre serviços com preço, duração e categoria para começar.'
              }
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">
                {rows.length} de {total} serviço(s)
              </p>
              <DataTable
                aria-label="Serviços"
                columns={columns}
                rows={rows}
                getKey={(s) => s.id}
              />
            </>
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
  const [tab, setTab] = useState('cadastro');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [additionalCost, setAdditionalCost] = useState('');
  const [durationMin, setDurationMin] = useState('30');
  const [description, setDescription] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [cashbackEnabled, setCashbackEnabled] = useState(false);
  const [cashbackPercent, setCashbackPercent] = useState('');
  const [onlineBookable, setOnlineBookable] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [visible, setVisible] = useState(true);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTab('cadastro');
    setName(service?.name ?? '');
    setCategoryId(service?.categoryId ?? '');
    setPrice(service ? String(service.price) : '');
    // additionalCost is a serialized Decimal not present on the shared Service type.
    const addCost = (service as { additionalCost?: string | number } | null | undefined)
      ?.additionalCost;
    setAdditionalCost(addCost != null && Number(addCost) > 0 ? String(addCost) : '');
    setDurationMin(service ? String(service.durationMin) : '30');
    setDescription(service?.description ?? '');
    setImageUrls(
      service?.imageUrls?.length
        ? service.imageUrls
        : service?.imageUrl
          ? [service.imageUrl]
          : [],
    );
    const cb = service?.cashbackPercent ? Number(service.cashbackPercent) : 0;
    setCashbackEnabled(cb > 0);
    setCashbackPercent(cb > 0 ? String(cb) : '');
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
    // additionalCost lives on the Service schema but not on the shared ServiceBody type;
    // widen locally so we can persist it without editing shared types.
    const body: ServiceBody & { additionalCost?: number } = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      price: Number(price),
      additionalCost: additionalCost ? Number(additionalCost) : 0,
      durationMin: Number(durationMin),
      description: description.trim() || undefined,
      imageUrls,
      // Cashback próprio do serviço (separado da comissão). Zera quando desativado.
      cashbackPercent: cashbackEnabled && cashbackPercent ? Number(cashbackPercent) : 0,
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
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar o serviço.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container size="lg" placement="center">
        <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <Modal.Header>
            <Modal.Heading>
              {mode === 'edit' ? 'Editar serviço' : 'Novo serviço'}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
              <Tabs.List className="w-full overflow-x-auto">
                <Tabs.Tab id="cadastro">Cadastro</Tabs.Tab>
                <Tabs.Tab id="config">Configurações</Tabs.Tab>
                <Tabs.Tab id="cashback">Cashback</Tabs.Tab>
              </Tabs.List>

              {/* ---- Cadastro ---- */}
              <Tabs.Panel id="cadastro" className="flex flex-col gap-4 pt-4">
                <Field label="Fotos do serviço (opcional)">
                  <ImageGalleryUpload
                    value={imageUrls}
                    onChange={setImageUrls}
                    kind="service"
                    max={12}
                  />
                </Field>

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
                  <Field label="Tipo de preço">
                    <div className="flex h-full items-center">
                      <Chip variant="soft" color="default" size="sm">
                        Fixo
                      </Chip>
                    </div>
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Preço de venda (R$)">
                    <TextField value={price} onChange={setPrice} aria-label="Preço de venda">
                      <Input type="number" placeholder="0,00" />
                    </TextField>
                  </Field>
                  <Field label="Custo adicional (R$)">
                    <TextField
                      value={additionalCost}
                      onChange={setAdditionalCost}
                      aria-label="Custo adicional"
                    >
                      <Input type="number" placeholder="0,00" />
                    </TextField>
                  </Field>
                </div>

                <Field label="Duração (min)">
                  <TextField value={durationMin} onChange={setDurationMin} aria-label="Duração">
                    <Input type="number" placeholder="30" />
                  </TextField>
                </Field>

                <Field label="Descrição (opcional)">
                  <TextField
                    value={description}
                    onChange={setDescription}
                    aria-label="Descrição"
                  >
                    <Input placeholder="Detalhes do serviço" />
                  </TextField>
                  <p className="text-xs text-muted">
                    Esta descrição aparece no agendamento online.
                  </p>
                </Field>
              </Tabs.Panel>

              {/* ---- Configurações ---- */}
              <Tabs.Panel id="config" className="flex flex-col gap-3 pt-4">
                <Toggle
                  label="Agendamento online"
                  checked={onlineBookable}
                  onChange={setOnlineBookable}
                />
                <Toggle label="Favorito" checked={favorite} onChange={setFavorite} />
                <Toggle label="Visível no catálogo" checked={visible} onChange={setVisible} />
                {mode === 'edit' && (
                  <Toggle label="Ativo" checked={active} onChange={setActive} />
                )}
              </Tabs.Panel>

              {/* ---- Cashback ---- */}
              <Tabs.Panel id="cashback" className="flex flex-col gap-4 pt-4">
                <div className="rounded-md border border-[var(--color-soft-border)] bg-[#fffdf8] px-3 py-2 text-xs text-muted">
                  O cashback é próprio do serviço e independente da comissão do
                  profissional.
                </div>
                <Toggle
                  label="Ativar cashback neste serviço"
                  checked={cashbackEnabled}
                  onChange={setCashbackEnabled}
                />
                {cashbackEnabled && (
                  <Field label="Cashback (%)">
                    <TextField
                      value={cashbackPercent}
                      onChange={setCashbackPercent}
                      aria-label="Cashback"
                    >
                      <Input type="number" placeholder="0" />
                    </TextField>
                  </Field>
                )}
              </Tabs.Panel>
            </Tabs>

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

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--color-soft-border)] bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === o.id
              ? 'bg-[#f2b33d] text-[#3a2a06] shadow-[var(--shadow-gold)]'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
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
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
