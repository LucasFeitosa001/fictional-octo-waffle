import { Link } from 'react-router-dom';
import { IconChevron } from '../../components/icons';
import { BUSINESS_COLORS } from '../../theme/dataColors';

/** Card estilo Salonpass (borda suave + fundo creme). */
export const CARD =
  'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

export const COLOR_GREEN = BUSINESS_COLORS.income;
export const COLOR_RED = BUSINESS_COLORS.expense;

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
