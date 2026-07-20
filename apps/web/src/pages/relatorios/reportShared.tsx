import { Link } from 'react-router-dom';
import { IconChevron } from '../../components/icons';

/** Card estilo Salonpass (borda suave + fundo creme). */
export const CARD =
  'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

/** Cores da marca para gráficos. */
export const COLOR_GOLD = '#f2b33d';
export const COLOR_PINK = '#f08ca5';
export const COLOR_GREEN = '#16a34a';
export const COLOR_RED = '#ec4899';
export const PIE_COLORS = [
  '#f2b33d',
  '#f08ca5',
  '#111111',
  '#f0ce84',
  '#d99a7c',
  '#b8893f',
  '#8a6d3b',
];

/** "YYYY-MM-DD" -> "DD/MM" para eixos e labels. */
export function shortDay(d: string): string {
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
}

/** Link "voltar para o hub de Relatórios", mostrado no topo de cada página. */
export function BackToReports() {
  return (
    <Link
      to="/relatorios"
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-gold-strong"
    >
      <IconChevron size={16} className="rotate-90" />
      Voltar para Relatórios
    </Link>
  );
}
