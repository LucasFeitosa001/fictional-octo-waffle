import { useSyncExternalStore } from 'react';

/**
 * Preferência: mostrar (ou não) o atalho flutuante do CRM que fica ACIMA da
 * BottomNav no mobile (e no canto no desktop). Ligado por padrão. Salvo neste
 * dispositivo (localStorage), no mesmo padrão dos demais switches de
 * personalização (closeStyle/buttonStyle/…). O `DashboardLayout` lê
 * `useCrmShortcutEnabled()` e esconde o botão quando desligado; a tela de
 * Configurações → Personalizar escreve com `setCrmShortcutEnabled()`.
 */
const KEY = 'sp:ui:crm-shortcut';
const DEFAULT = true;

export function getStoredCrmShortcut(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    // Ausente = ligado (default). Só '0'/'false' desliga.
    if (v === null) return DEFAULT;
    return v !== '0' && v !== 'false';
  } catch {
    return DEFAULT;
  }
}

const listeners = new Set<() => void>();

export function setCrmShortcutEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {
    /* localStorage indisponível (modo privado) — segue em memória */
  }
  listeners.forEach((l) => l());
}

export function useCrmShortcutEnabled(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getStoredCrmShortcut,
    () => DEFAULT,
  );
}
