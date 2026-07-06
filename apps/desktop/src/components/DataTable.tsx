import { Pencil, Trash2 } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  /** Classe extra da célula (ex.: text-right, hidden xl:table-cell). */
  className?: string;
}

export function DataTable<T extends { id: string }>({
  columns,
  items,
  loading = false,
  onEdit,
  onDelete,
  onRowClick,
  rowActions,
  emptyTitle = 'Nada por aqui',
  emptyDescription,
}: {
  columns: Column<T>[];
  items: T[];
  loading?: boolean;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onRowClick?: (item: T) => void;
  /** Ações extras por linha, renderizadas antes de editar/excluir. */
  rowActions?: (item: T) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-6">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-100/50" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const hasActions = Boolean(onEdit || onDelete || rowActions);

  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-paper/70">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500 ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
            {hasActions ? <th className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-500">Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              className={`border-b border-ink-100/70 last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-brand-50/40' : 'hover:bg-paper/60'}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 align-middle text-ink-700 ${col.className ?? ''}`}>
                  {col.render(item)}
                </td>
              ))}
              {hasActions ? (
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {rowActions?.(item)}
                    {onEdit ? (
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        title="Editar"
                        className="rounded-lg p-2 text-ink-500 transition hover:bg-accent-50 hover:text-accent-700"
                      >
                        <Pencil className="size-4" />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        title="Excluir"
                        className="rounded-lg p-2 text-ink-500 transition hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
