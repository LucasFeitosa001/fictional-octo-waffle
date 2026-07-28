import type { ReactNode } from 'react';
import { IconChart, IconCircleCheck, IconHome, IconSettings } from '../../components/icons';

/**
 * As abas do módulo Comissões — FONTE ÚNICA.
 *
 * Existiam duas cópias: uma no resumo e outra na página de Configurações. Ao
 * trocar as abas para as do Belasis só a primeira foi corrigida, e clicar em
 * "Configurações" voltava a mostrar "Resumo · Comissões em aberto · Comissões
 * pagas" — inclusive a aba que tinha sido removida por não existir lá. Duas
 * listas da mesma navegação divergem sozinhas; por isso mora aqui.
 *
 * O id de "Resumidas" é string vazia porque no resumo ele também alimenta o
 * filtro de status (`status=''` = todos).
 */
export type CommissionTabId = 'detalhadas' | '' | 'paid' | 'settings';

export const COMMISSION_TABS: { id: CommissionTabId; label: string; icon: ReactNode }[] = [
  { id: 'detalhadas', label: 'Detalhadas', icon: <IconChart size={15} /> },
  { id: '', label: 'Resumidas', icon: <IconHome size={15} /> },
  { id: 'paid', label: 'Pagas', icon: <IconCircleCheck size={15} /> },
  { id: 'settings', label: 'Configurações', icon: <IconSettings size={15} /> },
];

/** Rota de cada aba. Usada pelas duas telas para não divergirem no destino. */
export function commissionTabPath(id: CommissionTabId | string): string {
  if (id === 'settings') return '/comissoes/config';
  if (id === 'paid') return '/comissoes/pagas';
  if (id === 'detalhadas') return '/comissoes/detalhadas';
  return '/comissoes/resumidas';
}
