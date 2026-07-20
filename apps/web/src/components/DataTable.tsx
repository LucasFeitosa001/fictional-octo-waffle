import type { ReactNode } from 'react';
import { Table } from '@heroui/react';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** cell renderer */
  render: (row: T) => ReactNode;
  className?: string;
  isRowHeader?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  'aria-label': string;
  /** Optional per-row background/tint (Belasis tinta linhas por natureza). */
  rowClassName?: (row: T) => string | undefined;
}

/** A header counts as "empty" (no label) when it renders nothing. */
function isEmptyHeader(header: ReactNode): boolean {
  return header == null || header === '' || header === false;
}

/**
 * Responsive table.
 *  - >= md: HeroUI v3 Table (React Aria collection API).
 *  - <  md: stacked cards — one card per row, since a multi-column table is
 *    unusable on a phone. The row-header column becomes the card title, the
 *    action column (empty header / key "actions") drops to the card footer, and
 *    every other column renders as a label/value line.
 */
export function DataTable<T>({
  columns,
  rows,
  getKey,
  'aria-label': ariaLabel,
  rowClassName,
}: DataTableProps<T>) {
  const titleCol = columns.find((c) => c.isRowHeader) ?? columns[0];
  const actionCols = columns.filter(
    (c) => c.key === 'actions' || isEmptyHeader(c.header),
  );
  const detailCols = columns.filter(
    (c) => c !== titleCol && !actionCols.includes(c),
  );

  return (
    <>
      {/* Desktop / tablet: real table */}
      <div className="hidden md:block">
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={ariaLabel}>
              <Table.Header>
                {columns.map((c) => (
                  <Table.Column key={c.key} id={c.key} isRowHeader={c.isRowHeader}>
                    {c.header}
                  </Table.Column>
                ))}
              </Table.Header>
              <Table.Body>
                {rows.map((row) => (
                  <Table.Row
                    key={getKey(row)}
                    id={getKey(row)}
                    className={rowClassName?.(row)}
                  >
                    {columns.map((c) => (
                      <Table.Cell key={c.key} className={c.className}>
                        {c.render(row)}
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label={ariaLabel}>
        {rows.map((row) => (
          <li
            key={getKey(row)}
            className={`overflow-hidden rounded-2xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)] ${
              rowClassName?.(row) ?? ''
            }`}
          >
            {titleCol && (
              <div className="mb-3 text-[15px] font-semibold leading-snug text-foreground">
                {titleCol.render(row)}
              </div>
            )}
            {detailCols.length > 0 && (
              <dl className="flex flex-col divide-y divide-[var(--color-soft-border)]">
                {detailCols.map((c) => (
                  <div key={c.key} className="flex min-h-10 items-center justify-between gap-4 py-2 text-sm">
                    <dt className="shrink-0 text-xs font-medium text-muted">{c.header}</dt>
                    <dd className="min-w-0 break-words text-right font-medium text-foreground">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actionCols.length > 0 && (
              <div className="mobile-row-actions mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-soft-border)] pt-3">
                {actionCols.map((c) => (
                  <div key={c.key}>{c.render(row)}</div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
