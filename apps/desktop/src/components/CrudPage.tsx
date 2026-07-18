import { useMemo, useState } from 'react';
import type { Entity, Repository } from '@silvia/core';
import { useCollection } from '../lib/hooks';
import { DataTable, type Column } from './DataTable';
import { FormModal } from './FormModal';
import { ConfirmDialog } from './ConfirmDialog';
import { PageHeader } from './PageHeader';
import { SearchInput } from './SearchInput';
import type { FieldDef, FormValues } from './form';

/**
 * Página de cadastro genérica: listagem com busca, botão "Novo", edição em
 * modal, exclusão com confirmação e (opcional) painel de detalhes por linha.
 */
export function CrudPage<T extends Entity>({
  title,
  description,
  searchPlaceholder = 'Buscar...',
  newLabel = 'Novo',
  repo,
  columns,
  searchText,
  fields,
  toValues,
  fromValues,
  detail,
  rowActions,
  headerExtra,
  formExtra,
  onRowClick,
}: {
  title: string;
  description?: string;
  searchPlaceholder?: string;
  newLabel?: string;
  repo: Repository<T>;
  columns: Column<T>[];
  /** Texto pesquisável de um item (nome, telefone, cidade...). */
  searchText: (item: T) => string;
  fields: FieldDef[];
  toValues: (item: T | null) => FormValues;
  fromValues: (values: FormValues, existing: T | null) => Omit<T, 'id'>;
  /** Painel/drawer de detalhes; recebe o item e o callback de fechar. */
  detail?: (item: T, close: () => void, collection: ReturnType<typeof useCollection<T>>) => React.ReactNode;
  rowActions?: (item: T) => React.ReactNode;
  headerExtra?: React.ReactNode;
  formExtra?: (editing: T | null) => React.ReactNode;
  onRowClick?: (item: T, openDetail: (item: T) => void) => void;
}) {
  const collection = useCollection(repo);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [detailItem, setDetailItem] = useState<T | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return collection.items;
    return collection.items.filter((item) => searchText(item).toLowerCase().includes(q));
  }, [collection.items, search, searchText]);

  // Mantém o detalhe sincronizado com a lista após updates
  const currentDetail = detailItem ? collection.items.find((i) => i.id === detailItem.id) ?? null : null;

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    setFormOpen(true);
  }

  async function handleSubmit(values: FormValues) {
    const data = fromValues(values, editing);
    if (editing) {
      await collection.update(editing.id, data as Partial<Omit<T, 'id'>>);
    } else {
      await collection.create(data);
    }
  }

  return (
    <div>
      <PageHeader title={title} description={description} onNew={openNew} newLabel={newLabel}>
        {headerExtra}
      </PageHeader>
      <div className="mb-4 w-full sm:max-w-md">
        <SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} />
      </div>
      <DataTable
        columns={columns}
        items={filtered}
        loading={collection.loading}
        onEdit={openEdit}
        onDelete={(item) => setDeleting(item)}
        onRowClick={
          detail || onRowClick
            ? (item) => (onRowClick ? onRowClick(item, setDetailItem) : setDetailItem(item))
            : undefined
        }
        rowActions={rowActions}
        emptyTitle={search ? 'Nenhum resultado para a busca' : 'Nenhum registro cadastrado'}
        emptyDescription={search ? 'Tente outro termo.' : `Clique em "${newLabel}" para começar.`}
      />

      <FormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Editar — ${title}` : `${newLabel} — ${title}`}
        fields={fields}
        initialValues={toValues(editing)}
        onSubmit={handleSubmit}
        extra={formExtra?.(editing)}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir registro"
        message={`Tem certeza que deseja excluir? Esta ação não pode ser desfeita (dados locais).`}
        confirmLabel="Excluir"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await collection.remove(deleting.id);
          setDeleting(null);
        }}
      />

      {currentDetail && detail ? detail(currentDetail, () => setDetailItem(null), collection) : null}
    </div>
  );
}
