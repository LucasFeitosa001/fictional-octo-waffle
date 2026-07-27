import { useSyncExternalStore } from 'react';

/**
 * Estilo da barra lateral (desktop), personalizável e salvo neste dispositivo.
 *  - 'solid'    → encostada no canto, com borda (padrão atual).
 *  - 'floating' → navbar flutuante: margem ao redor, cantos arredondados e sombra.
 *
 * O DashboardLayout aplica a margem no wrapper e a Sidebar aplica a classe
 * `.db-sidebar-floating` no seu container quando o estilo é 'floating'.
 */
export type SidebarStyleId = 'solid' | 'floating';

export const SIDEBAR_STYLES: { id: SidebarStyleId; label: string; description: string }[] = [
  { id: 'solid', label: 'Sólida', description: 'Encostada no canto, com borda (padrão).' },
  { id: 'floating', label: 'Flutuante', description: 'Destacada com margem, cantos e sombra.' },
];

const KEY = 'sp-sidebar-style';
const DEFAULT: SidebarStyleId = 'solid';
/** Padrão exportado para o reset por-empresa (useThemeSync). */
export const DEFAULT_SIDEBAR_STYLE: SidebarStyleId = DEFAULT;

export function isSidebarStyle(v: unknown): v is SidebarStyleId {
  return v === 'solid' || v === 'floating';
}

export function getStoredSidebarStyle(): SidebarStyleId {
  try {
    const v = localStorage.getItem(KEY);
    return isSidebarStyle(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

const listeners = new Set<() => void>();

export function setSidebarStyle(id: SidebarStyleId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* localStorage indisponível — segue em memória */
  }
  listeners.forEach((l) => l());
}

export function useSidebarStyle(): SidebarStyleId {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getStoredSidebarStyle,
    () => DEFAULT,
  );
}
