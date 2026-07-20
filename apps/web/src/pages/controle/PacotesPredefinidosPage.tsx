import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button, Input, ListBox, Select, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { useConfirm } from '../../components/ConfirmDialog';
import { Drawer } from '../../components/Drawer';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevron,
  IconDownload,
  IconFilter,
  IconLayers,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../../components/icons';
import { formatMoney, formatNumber } from '../../lib/format';
import { downloadCsv } from '../../lib/csv';
import { useSetPageActions } from '../../layout/PageActions';
import { useServices } from '../../lib/queries';
import {
  useCreatePackageTemplate,
  useDeletePackageTemplate,
  usePackageTemplates,
  useUpdatePackageTemplate,
  type PackageTemplate,
} from '../../lib/queries/pacotes';

// Belasis "PacotesPredefinidos" (/package-templates) — MagicTable:
// toolbar Buscar/Filtrar/Exportar/Novo, filtro de Status, tabela com colunas
// Nome / Total / Ações, linhas expansíveis com os itens do pacote, paginação
// e drawer lateral (direita) para Novo/Editar.

type StatusFilter = 'all' | 'active' | 'inactive';

const PAGE_SIZE = 20;

function itemsLabel(count: number) {
  return `${formatNumber(count)} ${count === 1 ? 'item' : 'itens'}`;
}

export function PacotesPredefinidosPage() {
  const confirm = useConfirm();
  const templates = usePackageTemplates();
  const deleteTemplate = useDeletePackageTemplate();

  const [editing, setEditing] = useState<PackageTemplate | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const allRows = templates.data ?? [];

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = allRows.filter((t) => {
      if (statusFilter === 'active' && !t.active) return false;
      if (statusFilter === 'inactive' && t.active) return false;
      if (term && !t.name.toLowerCase().includes(term)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      return sortAsc ? cmp : -cmp;
    });
  }, [allRows, search, statusFilter, sortAsc]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortAsc]);

  const activeFilterCount = statusFilter !== 'all' ? 1 : 0;
  const hasFilters = Boolean(search.trim()) || activeFilterCount > 0;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function clearAll() {
    setSearchInput('');
    setSearch('');
    setStatusFilter('all');
  }

  function exportCsv() {
    downloadCsv<PackageTemplate>(
      'pacotes-predefinidos',
      [
        { header: 'Nome', value: (t) => t.name },
        { header: 'Itens', value: (t) => t.items.length },
        { header: 'Total', value: (t) => t.price },
        { header: 'Status', value: (t) => (t.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
  }

  async function handleDelete(template: PackageTemplate) {
    setMessage(null);
    const ok = await confirm({
      title: 'Excluir pacote predefinido?',
      message: `Remover o pacote "${template.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
    } catch (err) {
      setMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível remover o pacote.',
      );
    }
  }

  // Mobile: as ações do header vivem na BottomNav (igual Belasis). Cada onClick
  // dispara exatamente o mesmo handler dos botões desktop.
  useSetPageActions(
    [
      {
        key: 'buscar',
        label: 'Buscar',
        icon: <IconSearch size={22} />,
        onClick: () => setSearchOpen((v) => !v),
      },
      {
        key: 'filtros',
        label: 'Filtros',
        icon: <IconFilter size={22} />,
        onClick: () => setFilterOpen((v) => !v),
      },
      {
        key: 'exportar',
        label: 'Exportar',
        icon: <IconDownload size={22} />,
        onClick: exportCsv,
        disabled: rows.length === 0,
      },
      {
        key: 'novo',
        label: 'Novo',
        icon: <IconPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
    ],
    [rows],
  );

  return (
    <div className="pb-10">
      {/* Cabeçalho: título + Buscar / Filtrar / Exportar / Novo (igual Belasis) */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Pacotes Predefinidos</h1>
        {/* Desktop apenas — no mobile essas ações ficam na BottomNav. */}
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <ToolbarButton active={searchOpen} onClick={() => setSearchOpen((v) => !v)}>
            <IconSearch size={16} /> Buscar
          </ToolbarButton>
          <ToolbarButton
            active={filterOpen || activeFilterCount > 0}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <IconFilter size={16} /> Filtrar
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </ToolbarButton>
          <ToolbarButton onClick={exportCsv} disabled={rows.length === 0}>
            <IconDownload size={16} /> Exportar
          </ToolbarButton>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Novo
          </Button>
        </div>
      </header>

      {message && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {message}
        </div>
      )}

      {/* Barra de busca (toggle) */}
      {searchOpen && (
        <div className="mb-4 flex max-w-xl items-center gap-2">
          <TextField
            value={searchInput}
            onChange={setSearchInput}
            className="min-w-0 flex-1"
            aria-label="Buscar modelo"
          >
            <Input
              placeholder="Buscar por nome"
              className="focus:border-primary focus:ring-2 focus:ring-primary/25"
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
            />
          </TextField>
          <Button variant="primary" onClick={applySearch}>
            Buscar
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Painel de filtros lateral (Filtrar) — Status, igual Belasis */}
        {filterOpen && (
          <aside className="w-full shrink-0 rounded-xl border border-line bg-card p-4 shadow-[var(--shadow-card)] lg:w-72">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">Filtros</span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>

            <FilterGroup title="Status">
              <CheckRow checked={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
                Todos
              </CheckRow>
              <CheckRow
                checked={statusFilter === 'active'}
                onClick={() => setStatusFilter('active')}
              >
                Ativos
              </CheckRow>
              <CheckRow
                checked={statusFilter === 'inactive'}
                onClick={() => setStatusFilter('inactive')}
              >
                Desativados
              </CheckRow>
            </FilterGroup>
          </aside>
        )}

        {/* Conteúdo principal: tabela / cards */}
        <div className="min-w-0 flex-1">
          {templates.isLoading ? (
            <LoadingState />
          ) : templates.isError ? (
            <ErrorState onRetry={() => templates.refetch()} />
          ) : rows.length === 0 ? (
            <div className="rounded-xl border border-line bg-card p-6 shadow-[var(--shadow-card)]">
              <EmptyState
                icon={<IconLayers size={32} />}
                title={
                  hasFilters ? 'Nenhum pacote encontrado' : 'Nenhum pacote predefinido'
                }
                description={
                  hasFilters
                    ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                    : 'Crie pacotes com serviços e número de sessões para agilizar a venda.'
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={clearAll}>
                      Limpar filtros
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      <IconPlus size={16} /> Novo pacote
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              {/* ===== Desktop: tabela ===== */}
              <div className="hidden overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)] md:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-muted-ink">
                      <th className="w-10 px-2 py-3" />
                      <th className="px-4 py-3 font-semibold">
                        <button
                          type="button"
                          onClick={() => setSortAsc((v) => !v)}
                          className="inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-primary"
                          title="Ordenar por nome"
                        >
                          Nome
                          {sortAsc ? (
                            <IconArrowUp size={13} className="text-primary" />
                          ) : (
                            <IconArrowDown size={13} className="text-primary" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right font-semibold">Total</th>
                      <th className="px-4 py-3 text-center font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((t) => {
                      const isOpen = expanded.has(t.id);
                      return (
                        <Fragment key={t.id}>
                          <tr
                            className="border-b border-line/60 transition-colors last:border-0 hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                          >
                            <td className="px-2 py-2.5 text-center">
                              <button
                                type="button"
                                aria-label={isOpen ? 'Recolher' : 'Expandir'}
                                onClick={() => toggleExpand(t.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-ink hover:bg-canvas hover:text-primary"
                              >
                                <IconChevron
                                  size={16}
                                  className={[
                                    'transition-transform',
                                    isOpen ? 'rotate-180' : '',
                                  ].join(' ')}
                                />
                              </button>
                            </td>
                            <td className="px-4 py-2.5">
                              <button
                                type="button"
                                onClick={() => setEditing(t)}
                                className="flex w-full items-center gap-2.5 text-left"
                              >
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                                  <IconLayers size={16} />
                                </span>
                                <span className="min-w-0">
                                  <span className="block min-w-0 truncate font-medium text-primary hover:underline">
                                    {t.name}
                                  </span>
                                  <span className="block text-xs text-muted-ink">
                                    {itemsLabel(t.items.length)}
                                    {!t.active && ' • Inativo'}
                                  </span>
                                </span>
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-ink">
                              {formatMoney(t.price)}
                            </td>
                            <td className="px-4 py-2.5">
                              <RowActions
                                onEdit={() => setEditing(t)}
                                onDelete={() => handleDelete(t)}
                                deleting={deleteTemplate.isPending}
                              />
                            </td>
                          </tr>
                          {isOpen && (
                            <tr className="border-b border-line/60 bg-canvas/50">
                              <td />
                              <td colSpan={3} className="px-4 py-3">
                                <PackageItems template={t} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ===== Mobile: cards ===== */}
              <ul className="flex flex-col gap-2 md:hidden">
                {paged.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-line bg-card p-3 shadow-[var(--shadow-card)]"
                  >
                    <button
                      type="button"
                      onClick={() => setEditing(t)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] text-primary">
                        <IconLayers size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block min-w-0 truncate font-medium text-ink">
                          {t.name}
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-ink">
                          <span>
                            {itemsLabel(t.items.length)}
                            {!t.active && ' • Inativo'}
                          </span>
                          <span className="font-semibold text-ink">{formatMoney(t.price)}</span>
                        </span>
                      </div>
                    </button>
                    <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-line/60 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Editar"
                        onClick={() => setEditing(t)}
                      >
                        <IconPencil size={14} /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Remover"
                        className="text-danger"
                        isDisabled={deleteTemplate.isPending}
                        onClick={() => handleDelete(t)}
                      >
                        <IconTrash size={14} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Rodapé: contagem + paginação */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-ink">
                <span>
                  {hasFilters
                    ? `${formatNumber(rows.length)} de ${formatNumber(allRows.length)} pacote(s)`
                    : `${formatNumber(allRows.length)} no total`}
                </span>
                {pageCount > 1 && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="px-1">
                      {safePage} / {pageCount}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      isDisabled={safePage >= pageCount}
                      onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawers laterais (Novo / Editar) — deslizam da direita, igual Belasis */}
      <TemplateDrawer mode="create" isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <TemplateDrawer
        mode="edit"
        template={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------
// Subcomponentes de apresentação
// ---------------------------------------------------------------------

/** Linha expandida: itens do pacote (Serviço/Produto · Quantidade · Preço unit.). */
function PackageItems({ template }: { template: PackageTemplate }) {
  if (template.items.length === 0) {
    return <p className="text-xs text-muted-ink">Nenhum item neste pacote.</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-muted-ink">
            <th className="px-3 py-2 font-semibold">Serviço/Produto</th>
            <th className="w-24 px-3 py-2 text-center font-semibold">Quantidade</th>
            <th className="w-32 px-3 py-2 text-right font-semibold">Preço unitário</th>
          </tr>
        </thead>
        <tbody>
          {template.items.map((item) => (
            <tr key={item.id} className="border-b border-line/60 last:border-0">
              <td className="px-3 py-2 text-ink">{item.service?.name ?? '—'}</td>
              <td className="px-3 py-2 text-center text-ink">{item.sessions}</td>
              {/* TODO: exibir preço unitário quando a API expuser price_cents por item. */}
              <td className="px-3 py-2 text-right text-muted-ink">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
  deleting,
}: {
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-1 text-muted-ink">
      <button
        type="button"
        aria-label="Editar"
        title="Editar"
        onClick={onEdit}
        className="rounded p-1 hover:bg-canvas hover:text-primary"
      >
        <IconPencil size={16} />
      </button>
      <span className="h-4 w-px bg-line" />
      <button
        type="button"
        aria-label="Remover"
        title="Remover"
        onClick={onDelete}
        disabled={deleting}
        className="rounded p-1 text-danger hover:bg-danger/10 disabled:opacity-50"
      >
        <IconTrash size={16} />
      </button>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-primary bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)] text-primary'
          : 'border-line bg-card text-ink hover:bg-canvas',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-ink">{title}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function CheckRow({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded px-1 py-1 text-left text-sm text-ink hover:bg-canvas"
    >
      <span
        className={[
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
          checked ? 'border-primary bg-primary text-primary-foreground' : 'border-line bg-card',
        ].join(' ')}
      >
        {checked && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
      </span>
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Drawer lateral de cadastro/edição do modelo de pacote
// ---------------------------------------------------------------------

function TemplateDrawer({
  mode,
  template,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  template?: PackageTemplate | null;
  isOpen: boolean;
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
    if (!isOpen) return;
    if (mode === 'edit' && template) {
      setName(template.name);
      setPrice(template.price);
      setValidityDays(template.validityDays ? String(template.validityDays) : '');
      setItems(
        template.items.map((i) => ({
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
  }, [isOpen, mode, template]);

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

  const pending = create.isPending || update.isPending;
  const canSave =
    name.trim().length >= 2 && price !== '' && Number(price) >= 0 && items.length > 0 && !pending;

  async function handleSave() {
    setError(null);
    const body = {
      name: name.trim(),
      price: Number(price),
      validityDays: validityDays ? Number(validityDays) : undefined,
      items: items.map((i) => ({ serviceId: i.serviceId, sessions: i.sessions })),
    };
    try {
      if (mode === 'edit' && template) {
        await update.mutateAsync({ id: template.id, body });
      } else {
        await create.mutateAsync(body);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar o pacote.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar pacote predefinido' : 'Novo pacote predefinido'}
      widthClass="sm:w-[520px]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" isDisabled={!canSave} onClick={handleSave}>
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nome" required>
          <TextField value={name} onChange={setName} aria-label="Nome">
            <Input
              placeholder="Ex.: Pacote 10 limpezas"
              className="focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          </TextField>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Preço" required>
            <TextField value={price} onChange={setPrice} aria-label="Preço">
              <Input
                type="number"
                placeholder="0,00"
                className="focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </TextField>
          </Field>
          <Field label="Validade (dias)">
            <TextField value={validityDays} onChange={setValidityDays} aria-label="Validade">
              <Input
                type="number"
                placeholder="0"
                className="focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            </TextField>
          </Field>
        </div>

        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-ink">
            Serviços do pacote
          </div>
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
                <li
                  key={i.serviceId}
                  className="flex items-center justify-between gap-2 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate text-ink">{i.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[color-mix(in_oklab,var(--sp-primary)_12%,transparent)] px-2 py-0.5 text-xs font-medium text-primary">
                      {i.sessions} sessão(ões)
                    </span>
                    <button
                      type="button"
                      aria-label="Remover serviço"
                      onClick={() =>
                        setItems((prev) => prev.filter((x) => x.serviceId !== i.serviceId))
                      }
                      className="rounded p-1 text-danger hover:bg-danger/10"
                    >
                      <IconTrash size={14} />
                    </button>
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
      </div>
    </Drawer>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-ink">
        {required && <span className="mr-0.5 text-danger">*</span>}
        {label}
      </label>
      {children}
    </div>
  );
}
