import { useSyncExternalStore } from 'react';

/**
 * Estilo do botão FECHAR dos drawers/bottom-sheets (personalizável, salvo neste
 * dispositivo). O `<Drawer>` lê `useCloseStyle()` e renderiza o botão conforme:
 *  - 'label' → retangular, ícone X + texto "Fechar" (padrão histórico)
 *  - 'round' → bolinha (círculo) só com o X
 *  - 'icon'  → apenas o ícone X, sem fundo/borda
 */
export type CloseStyleId = 'label' | 'round' | 'icon';

export const CLOSE_STYLES: { id: CloseStyleId; label: string; description: string }[] = [
  { id: 'label', label: 'Retangular', description: 'Ícone X com o texto “Fechar”.' },
  { id: 'round', label: 'Bolinha', description: 'Um círculo só com o X.' },
  { id: 'icon', label: 'Só ícone', description: 'Apenas o X, sem fundo.' },
];

const KEY = 'sp-close-style';
const DEFAULT: CloseStyleId = 'label';

export function isCloseStyle(v: unknown): v is CloseStyleId {
  return v === 'label' || v === 'round' || v === 'icon';
}

export function getStoredCloseStyle(): CloseStyleId {
  try {
    const v = localStorage.getItem(KEY);
    return isCloseStyle(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

const listeners = new Set<() => void>();

export function setCloseStyle(id: CloseStyleId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* localStorage indisponível (modo privado) — segue em memória */
  }
  listeners.forEach((l) => l());
}

export function useCloseStyle(): CloseStyleId {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getStoredCloseStyle,
    () => DEFAULT,
  );
}
