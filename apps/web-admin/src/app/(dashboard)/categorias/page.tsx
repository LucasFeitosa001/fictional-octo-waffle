'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Input, Modal, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ActiveChip } from '@/components/StatusChip';
import { IconFolder, IconPlus } from '@/components/icons';
import {
  useCreateProductCategory,
  useDeleteProductCategory,
  useProductCategories,
  useUpdateProductCategory,
  type ProductCategory,
} from '@/lib/queries/catalogo';

export default function CategoriasPage() {
  const categories = useProductCategories();
  const deleteCategory = useDeleteProductCategory();
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rows = categories.data ?? [];

  async function handleDelete(c: ProductCategory) {
    setMessage(null);
    if (!window.confirm(`Remover a categoria "${c.name}"?`)) return;
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
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(c)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            isDisabled={deleteCategory.isPending}
            onClick={() => handleDelete(c)}
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
        title="Categorias"
        subtitle="Categorias de produto"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Nova categoria
          </Button>
        }
      />

      <Card className="db-card">
        <Card.Content className="p-4">
          {message && (
            <div className="mb-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {message}
            </div>
          )}

          {categories.isLoading ? (
            <LoadingState />
          ) : categories.isError ? (
            <ErrorState onRetry={() => categories.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconFolder size={32} />}
              title="Nenhuma categoria cadastrada"
              description="Crie categorias para organizar seus produtos."
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
      />
    </div>
  );
}

function CategoryModal({
  mode,
  category,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  category?: ProductCategory | null;
  isOpen: boolean;
  onClose: () => void;
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
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="md" placement="center">
          <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading>
                {mode === 'edit' ? 'Editar categoria' : 'Nova categoria'}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">Nome</label>
                <TextField value={name} onChange={setName} aria-label="Nome">
                  <Input placeholder="Nome da categoria" />
                </TextField>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                Ativa
              </label>
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
