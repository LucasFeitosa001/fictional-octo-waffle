'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Chip, Input, Modal, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { IconPlus, IconTag } from '@/components/icons';
import {
  useBrands,
  useCreateBrand,
  useDeleteBrand,
  useUpdateBrand,
  type Brand,
} from '@/lib/queries/catalogo';

export default function MarcasPage() {
  const brands = useBrands();
  const deleteBrand = useDeleteBrand();
  const [editing, setEditing] = useState<Brand | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rows = brands.data ?? [];

  async function handleDelete(brand: Brand) {
    setMessage(null);
    if (!window.confirm(`Remover a marca "${brand.name}"?`)) return;
    try {
      await deleteBrand.mutateAsync(brand.id);
    } catch (err) {
      setMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível excluir a marca.',
      );
    }
  }

  const columns: Column<Brand>[] = [
    {
      key: 'name',
      header: 'Marca',
      isRowHeader: true,
      render: (b) => <span className="font-medium text-foreground">{b.name}</span>,
    },
    {
      key: 'products',
      header: 'Produtos',
      render: (b) => (
        <Chip variant="soft" color={b.productCount ? 'accent' : 'default'} size="sm">
          {b.productCount ?? 0}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(b)}>
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            isDisabled={deleteBrand.isPending}
            onClick={() => handleDelete(b)}
          >
            Excluir
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Marcas"
        subtitle="Marcas de produto"
        onRefresh={() => brands.refetch()}
        isRefreshing={brands.isFetching}
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Nova marca
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

          {brands.isLoading ? (
            <LoadingState />
          ) : brands.isError ? (
            <ErrorState onRetry={() => brands.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconTag size={32} />}
              title="Nenhuma marca cadastrada"
              description="Cadastre marcas para classificar seus produtos."
            />
          ) : (
            <DataTable
              aria-label="Marcas"
              columns={columns}
              rows={rows}
              getKey={(b) => b.id}
            />
          )}
        </Card.Content>
      </Card>

      <BrandModal
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <BrandModal
        mode="edit"
        brand={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function BrandModal({
  mode,
  brand,
  isOpen,
  onClose,
}: {
  mode: 'create' | 'edit';
  brand?: Brand | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreateBrand();
  const update = useUpdateBrand();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(brand?.name ?? '');
      setError(null);
    }
  }, [isOpen, brand]);

  const pending = create.isPending || update.isPending;
  const canSave = name.trim().length >= 2 && !pending;

  async function handleSave() {
    setError(null);
    try {
      if (mode === 'edit' && brand) {
        await update.mutateAsync({ id: brand.id, body: { name: name.trim() } });
      } else {
        await create.mutateAsync({ name: name.trim() });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar a marca.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="md" placement="center">
          <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading>{mode === 'edit' ? 'Editar marca' : 'Nova marca'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">Nome</label>
                <TextField value={name} onChange={setName} aria-label="Nome">
                  <Input placeholder="Nome da marca" />
                </TextField>
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
