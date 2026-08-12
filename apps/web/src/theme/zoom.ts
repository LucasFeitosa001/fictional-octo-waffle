import { useSyncExternalStore } from 'react';

/**
 * Zoom de acessibilidade: aproxima/afasta TODO o conteúdo ajustando o
 * `font-size` base do `<html>`. Como o Tailwind mede em `rem`, fontes e
 * espaçamentos escalam juntos — sem `transform: scale()` (que quebraria
 * position:fixed e o scroll). Persistido neste dispositivo (localStorage);
 * especialmente útil em tablet/iPad para aproximar tabelas e formulários.
 */

export const ZOOM_MIN = 0.8; //  80%
export const ZOOM_MAX = 1.4; // 140%
export const ZOOM_STEP = 0.1;
const BASE_PX = 16;
const KEY = 'sp-zoom';
const DEFAULT = 1;

/** Arredonda pra 2 casas e prende no intervalo suportado. */
function clamp(v: number): number {
  const r = Math.round(v * 100) / 100;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, r));
}

export function getStoredZoom(): number {
  try {
    const v = parseFloat(localStorage.getItem(KEY) ?? '');
    return Number.isFinite(v) ? clamp(v) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

const listeners = new Set<() => void>();

function apply(z: number): void {
  document.documentElement.style.fontSize = `${(BASE_PX * z).toFixed(3)}px`;
}

export function setZoom(z: number): void {
  const v = clamp(z);
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    /* localStorage indisponível — segue só em runtime */
  }
  apply(v);
  listeners.forEach((l) => l());
}

/** +1 passo de zoom (aproximar). */
export function zoomIn(): void {
  setZoom(getStoredZoom() + ZOOM_STEP);
}

/** -1 passo de zoom (afastar). */
export function zoomOut(): void {
  setZoom(getStoredZoom() - ZOOM_STEP);
}

/** Volta ao tamanho padrão (100%). */
export function zoomReset(): void {
  setZoom(DEFAULT);
}

/** Aplica no boot, antes do primeiro paint (como initTheme). */
export function initZoom(): void {
  apply(getStoredZoom());
}

/** React hook: nível de zoom atual (1 = 100%). */
export function useZoom(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getStoredZoom,
    () => DEFAULT,
  );
}
