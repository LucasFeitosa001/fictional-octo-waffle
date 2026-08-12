import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Button, Checkbox, Popover, Table } from '@heroui/react';
import { IconColumns } from './icons';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** cell renderer */
  render: (row: T) => ReactNode;
  className?: string;
  isRowHeader?: boolean;
  /**
   * Rótulo curto usado no menu "Editar colunas" quando `header` não é texto
   * (ex: um ReactNode). Opcional — cai pra `header` se for string.
   */
  label?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  'aria-label': string;
  /**
   * Mobile: tocar em qualquer área não-interativa do card executa esta ação.
   * Botões, links, inputs e controles internos continuam com sua ação própria.
   */
  onRowClick?: (row: T) => void;
  /** Optional per-row background/tint (Belasis tinta linhas por natureza). */
  rowClassName?: (row: T) => string | undefined;
  /**
   * Chave de persistência da visibilidade de colunas no localStorage.
   * Se omitida, é derivada do `aria-label` + keys das colunas (estável por página).
   */
  storageKey?: string;
}

/** A header counts as "empty" (no label) when it renders nothing. */
function isEmptyHeader(header: ReactNode): boolean {
  return header == null || header === '' || header === false;
}

/** Colunas que NÃO podem ser ocultadas: row-header e coluna de ações. */
function isLockedColumn<T>(c: Column<T>): boolean {
  return Boolean(c.isRowHeader) || c.key === 'actions' || isEmptyHeader(c.header);
}

/** Rótulo legível de uma coluna pro menu de visibilidade. */
function columnLabel<T>(c: Column<T>): string {
  if (c.label) return c.label;
  if (typeof c.header === 'string') return c.header;
  return c.key;
}

/** Chave estável de storage: aria-label + keys das colunas (ordem-independente). */
function makeStorageKey(ariaLabel: string, columns: { key: string }[]): string {
  const cols = columns
    .map((c) => c.key)
    .slice()
    .sort()
    .join(',');
  return `dt:cols:${ariaLabel}:${cols}`;
}

function readHidden(storageKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function writeHidden(storageKey: string, hidden: Set<string>): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify([...hidden]));
  } catch {
    /* localStorage indisponível (modo privado/quota) — ignora, sem persistência. */
  }
}

/**
 * Estado de visibilidade de colunas, persistido em localStorage por página.
 * Só considera "ocultáveis" as colunas não-travadas (nem row-header, nem ações).
 */
function useColumnVisibility<T>(storageKey: string) {
  const [hidden, setHidden] = useState<Set<string>>(() => readHidden(storageKey));

  const toggle = useCallback(
    (key: string) => {
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        writeHidden(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const reset = useCallback(() => {
    setHidden(() => {
      const next = new Set<string>();
      writeHidden(storageKey, next);
      return next;
    });
  }, [storageKey]);

  // Uma coluna travada nunca é ocultada, mesmo que uma escolha antiga a marque.
  const isVisible = useCallback(
    (c: Column<T>) => isLockedColumn(c) || !hidden.has(c.key),
    [hidden],
  );

  return { hidden, toggle, reset, isVisible };
}

/**
 * Responsive table.
 *  - >= md: HeroUI v3 Table (React Aria collection API), com cabeçalho sticky
 *    (gruda no topo do scroll do `<main>` ao rolar) e menu "Editar colunas".
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
  onRowClick,
  rowClassName,
  storageKey,
}: DataTableProps<T>) {
  const resolvedKey = storageKey ?? makeStorageKey(ariaLabel, columns);
  const { toggle, reset, isVisible } = useColumnVisibility<T>(resolvedKey);

  const titleCol = columns.find((c) => c.isRowHeader) ?? columns[0];
  const actionCols = columns.filter(
    (c) => c.key === 'actions' || isEmptyHeader(c.header),
  );

  // Colunas que o usuário pode ligar/desligar (não travadas).
  const toggleableCols = useMemo(
    () => columns.filter((c) => !isLockedColumn(c)),
    [columns],
  );
  const hiddenCount = toggleableCols.filter((c) => !isVisible(c)).length;

  // Colunas efetivamente renderizadas (respeitando a visibilidade).
  const visibleColumns = useMemo(
    () => columns.filter((c) => isVisible(c)),
    [columns, isVisible],
  );

  const detailCols = visibleColumns.filter(
    (c) => c !== titleCol && !actionCols.includes(c),
  );

  return (
    <>
      {/* Desktop / tablet: real table */}
      <div className="hidden md:block">
        {toggleableCols.length > 0 && (
          <div className="mb-2 flex items-center justify-end">
            <Popover>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-muted"
                aria-label="Editar colunas visíveis"
              >
                <IconColumns size={16} />
                Colunas
                {hiddenCount > 0 && (
                  <span className="rounded-full bg-[var(--color-soft-border)] px-1.5 text-xs font-semibold text-foreground">
                    {toggleableCols.length - hiddenCount}/{toggleableCols.length}
                  </span>
                )}
              </Button>
              <Popover.Content className="w-64">
                <Popover.Dialog className="flex flex-col gap-1 p-1">
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                      Colunas
                    </span>
                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={reset}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Mostrar tudo
                      </button>
                    )}
                  </div>
                  <ul className="flex flex-col">
                    {toggleableCols.map((c) => (
                      <li key={c.key}>
                        <Checkbox
                          isSelected={isVisible(c)}
                          onChange={() => toggle(c.key)}
                          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-[var(--color-soft-border)]/40"
                        >
                          <Checkbox.Content className="flex min-w-0 items-center gap-2">
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <span className="min-w-0 truncate">{columnLabel(c)}</span>
                          </Checkbox.Content>
                        </Checkbox>
                      </li>
                    ))}
                  </ul>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          </div>
        )}

        <Table>
          <Table.ScrollContainer className="overflow-clip">
            <Table.Content aria-label={ariaLabel}>
              {/* Sticky: gruda no topo do scroll do <main> ao rolar a página.
                  Fundo sólido (bg do card) + z-index pra cobrir as linhas. */}
              <Table.Header className="sticky top-0 z-20 bg-card shadow-[0_1px_0_var(--color-soft-border)]">
                {visibleColumns.map((c) => (
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
                    {visibleColumns.map((c) => (
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
            onClick={(event) => {
              if (!onRowClick) return;
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest('button, a, input, select, textarea, [role="button"], [role="checkbox"]')
              ) {
                return;
              }
              onRowClick(row);
            }}
            className={`overflow-hidden rounded-2xl border border-[var(--color-soft-border)] bg-white p-4 shadow-[var(--shadow-soft)] ${
              onRowClick
                ? 'cursor-pointer transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_5%,white)]'
                : ''
            } ${
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
                    <dt className="shrink-0 text-xs font-medium text-muted">
                      {c.label ?? c.header}
                    </dt>
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
