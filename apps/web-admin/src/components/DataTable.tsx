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
}

/**
 * Thin wrapper over HeroUI v3 Table (React Aria collection API).
 */
export function DataTable<T>({
  columns,
  rows,
  getKey,
  'aria-label': ariaLabel,
}: DataTableProps<T>) {
  return (
    <>
      <div className="mobile-data-list" role="list" aria-label={ariaLabel}>
        {rows.map((row) => (
          <article className="mobile-data-card" role="listitem" key={getKey(row)}>
            {columns.map((column, index) => (
              <div
                key={column.key}
                className={`mobile-data-field ${index === 0 ? 'mobile-data-primary' : ''}`}
              >
                {index > 0 && <div className="mobile-data-label">{column.header}</div>}
                <div className="mobile-data-value">{column.render(row)}</div>
              </div>
            ))}
          </article>
        ))}
      </div>

      <div className="desktop-data-table">
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
                  <Table.Row key={getKey(row)} id={getKey(row)}>
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
    </>
  );
}
