/**
 * Minimal client-side CSV export. Builds a CSV string from rows + headers and
 * triggers a Blob download. No backend involved — operates on already-loaded,
 * already-filtered rows.
 */

type CsvValue = string | number | boolean | null | undefined;

function escapeCell(value: CsvValue): string {
  const str = value == null ? '' : String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv<T>(
  filename: string,
  columns: { header: string; value: (row: T) => CsvValue }[],
  rows: T[],
): void {
  const head = columns.map((c) => escapeCell(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.value(row))).join(','))
    .join('\n');
  // Prepend BOM so Excel reads UTF-8 (accents) correctly.
  const csv = `\uFEFF${head}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
