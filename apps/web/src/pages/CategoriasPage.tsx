import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../components/Drawer';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ActiveChip } from '../components/StatusChip';
import { FilterCheckbox } from '../components/FilterCheckbox';
import { SegBtn } from '../components/SegBtn';
import {
  IconDownload,
  IconFolder,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from '../components/icons';
import { downloadCsv } from '../lib/csv';
import { useSetPageActions } from '../layout/PageActions';
import { useConfirm } from '../components/ConfirmDialog';
import {
  useCreateProductCategory,
  useDeleteProductCategory,
  useProductCategories,
  useUpdateProductCategory,
  type ProductCategory,
} from '../lib/queries/catalogo';

type StatusFilter = 'all' | 'active' | 'inactive';

export function CategoriasPage() {
  const confirm = useConfirm();
  const categories = useProductCategories();
  const deleteCategory = useDeleteProductCategory();
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const allRows = categories.data ?? [];
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allRows.filter((c) => {
      if (status === 'active' && !c.active) return false;
      if (status === 'inactive' && c.active) return false;
      if (term && !c.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allRows, search, status]);

  const hasFilters = Boolean(search.trim()) || status !== 'all';

  // Mobile: the header buttons live in the BottomNav (like Belasis). They fire
  // the exact same handlers as the desktop buttons hidden below (`hidden md:*`).
  useSetPageActions(
    [
      {
        key: 'nova-categoria',
        label: 'Nova',
        icon: <IconPlus size={22} />,
        onClick: () => setCreateOpen(true),
      },
      {
        key: 'exportar-csv',
        label: 'Exportar',
        icon: <IconDownload size={22} />,
        onClick: () => exportCsv(),
        disabled: rows.length === 0,
      },
    ],
    [rows],
  );

  function exportCsv() {
    downloadCsv<ProductCategory>(
      'categorias',
      [
        { header: 'Categoria', value: (c) => c.name },
        { header: 'Status', value: (c) => (c.active ? 'Ativa' : 'Inativa') },
      ],
      rows,
    );
  }

  async function handleDelete(c: ProductCategory) {
    setMessage(null);
    const ok = await confirm({
      title: 'Excluir categoria?',
      message: `Remover a categoria "${c.name}"? Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCategory.mutateAsync(c.id);
    } catch (err) {
      setMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível excluir a categoria.',
      );
    }
  }

  const columns: Column<ProductCategory>[] = [
    {
      key: 'name',
      header: 'Categoria',
      isRowHeader: true,
      render: (c) => <span className="font-medium text-foreground">{c.name}</span>,
    },
    { key: 'active', header: 'Status', render: (c) => <ActiveChip active={c.active} /> },
    {
      key: 'actions',
      header: '',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Editar ${c.name}`}
            onClick={() => setEditing(c)}
          >
            <IconPencil size={16} /> Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            isDisabled={deleteCategory.isPending}
            aria-label={`Remover ${c.name}`}
            onClick={() => handleDelete(c)}
          >
            <IconTrash size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const subtitle = categories.isLoading
    ? 'Categorias de produto'
    : hasFilters
      ? `${rows.length} de ${allRows.length} categoria(s)`
      : `${allRows.length} categoria(s)`;

  return (
    <div>
      <PageHeader
        title="Categorias"
        subtitle={subtitle}
        actions={
          <>
            <Button
              variant="outline"
              className="hidden md:inline-flex"
              isDisabled={rows.length === 0}
              onClick={exportCsv}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Button
              variant="primary"
              className="hidden md:inline-flex"
              onClick={() => setCreateOpen(true)}
            >
              <IconPlus size={16} /> Nova categoria
            </Button>
          </>
        }
      />

      {message && (
        <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {message}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex max-w-md items-center gap-2">
          <TextField
            value={search}
            onChange={setSearch}
            className="min-w-0 flex-1"
            aria-label="Buscar categoria"
          >
            <Input placeholder="Digite para buscar" />
          </TextField>
          <Button variant="primary" aria-label="Buscar">
            <IconSearch size={16} /> <span className="hidden md:inline">Buscar</span>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegBtn active={status === 'all'} onClick={() => setStatus('all')}>
            Todas
          </SegBtn>
          <SegBtn active={status === 'active'} onClick={() => setStatus('active')}>
            Ativas
          </SegBtn>
          <SegBtn
            active={status === 'inactive'}
            onClick={() => setStatus('inactive')}
          >
            Inativas
          </SegBtn>
        </div>
      </div>

      {/* Desktop: card + tabela */}
      <div className="hidden md:block">
        <Card>
          <Card.Content className="p-4">
            {categories.isLoading ? (
              <LoadingState />
            ) : categories.isError ? (
              <ErrorState onRetry={() => categories.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<IconFolder size={32} />}
                title={
                  hasFilters
                    ? 'Nenhuma categoria encontrada'
                    : 'Nenhuma categoria cadastrada'
                }
                description={
                  hasFilters
                    ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                    : 'Crie categorias para organizar seus produtos.'
                }
                action={
                  hasFilters ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearch('');
                        setStatus('all');
                      }}
                    >
                      Limpar filtros
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={() => setCreateOpen(true)}>
                      <IconPlus size={16} /> Nova categoria
                    </Button>
                  )
                }
              />
            ) : (
              <DataTable
                aria-label="Categorias de produto"
                columns={columns}
                rows={rows}
                getKey={(c) => c.id}
              />
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Mobile: cards compactos 2 linhas */}
      <div className="md:hidden">
        {categories.isLoading ? (
          <LoadingState />
        ) : categories.isError ? (
          <ErrorState onRetry={() => categories.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<IconFolder size={32} />}
            title={
              hasFilters
                ? 'Nenhuma categoria encontrada'
                : 'Nenhuma categoria cadastrada'
            }
            description={
              hasFilters
                ? 'Ajuste a busca ou os filtros para ver mais resultados.'
                : 'Crie categorias para organizar seus produtos.'
            }
            action={
              hasFilters ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setStatus('all');
                  }}
                >
                  Limpar filtros
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <IconPlus size={16} /> Nova categoria
                </Button>
              )
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-[var(--color-soft-border)] bg-warm-white px-3 py-2 shadow-[var(--shadow-card)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {c.name}
                    </span>
                    <ActiveChip active={c.active} />
                  </div>
                </div>
                {/* Botões inline — mesmos ações do desktop (Editar lápis + Excluir lixeira). */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setEditing(c); }}
                  aria-label={`Editar ${c.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-primary"
                >
                  <IconPencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDelete(c); }}
                  disabled={deleteCategory.isPending}
                  aria-label={`Excluir ${c.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-danger transition-colors hover:bg-danger/10 disabled:opacity-40"
                >
                  <IconTrash size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CategoryModal
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <CategoryModal
        mode="edit"
        category={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        onDelete={async (c) => {
          await handleDelete(c);
          setEditing(null);
        }}
        deletePending={deleteCategory.isPending}
      />
    </div>
  );
}

export function CategoryModal({
  mode,
  category,
  isOpen,
  onClose,
  onDelete,
  deletePending,
}: {
  mode: 'create' | 'edit';
  category?: ProductCategory | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (c: ProductCategory) => void | Promise<void>;
  deletePending?: boolean;
}) {
  const create = useCreateProductCategory();
  const update = useUpdateProductCategory();
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(category?.name ?? '');
      setActive(category?.active ?? true);
      setError(null);
    }
  }, [isOpen, category]);

  const pending = create.isPending || update.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  async function handleSave() {
    setError(null);
    try {
      if (mode === 'edit' && category) {
        await update.mutateAsync({ id: category.id, body: { name: name.trim(), active } });
      } else {
        await create.mutateAsync({ name: name.trim(), active });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar a categoria.',
      );
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'edit' ? 'Editar categoria' : 'Nova categoria'}
      widthClass="sm:w-[480px]"
      fullscreen
      footer={
        <>
          {mode === 'edit' && category && onDelete && (
            <Button
              variant="ghost"
              className="h-11 shrink-0 text-danger mr-auto"
              isDisabled={deletePending || pending}
              onClick={() => onDelete(category)}
            >
              <IconTrash size={16} /> Excluir
            </Button>
          )}
          <Button variant="outline" className="h-11 shrink-0" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            className="h-11 shrink-0"
            isDisabled={!canSave}
            onClick={handleSave}
          >
            {pending ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Nome</label>
          <TextField value={name} onChange={setName} aria-label="Nome">
            <Input placeholder="Nome da categoria" />
          </TextField>
        </div>
        <FilterCheckbox checked={active} onChange={setActive} className="w-fit">
          Ativa
        </FilterCheckbox>
        {error && (
          <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        )}
      </div>
    </Drawer>
  );
}
