import { useSyncExternalStore } from 'react';

/**
 * Estilo de arredondamento dos BOTÕES (personalizável, salvo como o tema).
 *
 * Cada id mapeia para um bloco `[data-btn-radius="<id>"]` em index.css que
 * resolve o token global `--sp-btn-radius`. Trocar o atributo em <html> muda o
 * raio de todos os botões (HeroUI `.button` + `.btn`) sem tocar nos call-sites.
 *
 * Persistência espelha o tema: localStorage (cache pré-paint) + conta/API
 * (fonte da verdade cross-device, via useThemeSync).
 */
export type ButtonRadiusId = 'rounded' | 'medium' | 'square';

export interface ButtonRadiusMeta {
  id: ButtonRadiusId;
  label: string;
  description: string;
  /** Valor CSS de --sp-btn-radius, usado no preview do seletor. */
  radius: string;
}

export const BUTTON_RADII: ButtonRadiusMeta[] = [
  {
    id: 'rounded',
    label: 'Arredondado',
    description: 'Botões em cápsula (pill).',
    radius: '9999px',
  },
  {
    id: 'medium',
    label: 'Médio',
    description: 'Cantos suaves (padrão).',
    radius: '10px',
  },
  {
    id: 'square',
    label: 'Reto',
    description: 'Cantos quase retos.',
    radius: '4px',
  },
];

const STORAGE_KEY = 'sp-btn-radius';
export const DEFAULT_RADIUS: ButtonRadiusId = 'medium';

export function isButtonRadiusId(v: unknown): v is ButtonRadiusId {
  return typeof v === 'string' && BUTTON_RADII.some((r) => r.id === v);
}

export function getStoredButtonRadius(): ButtonRadiusId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isButtonRadiusId(v)) return v;
  } catch {
    /* localStorage unavailable (private mode / SSR) */
  }
  return DEFAULT_RADIUS;
}

const listeners = new Set<() => void>();

/** Aplica o estilo de botão em <html>, persiste no localStorage e notifica. */
export function applyButtonRadius(id: ButtonRadiusId): void {
  document.documentElement.dataset.btnRadius = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Chame uma vez no boot para restaurar a escolha antes do primeiro paint. */
export function initButtonRadius(): void {
  applyButtonRadius(getStoredButtonRadius());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ButtonRadiusId {
  const v = document.documentElement.dataset.btnRadius;
  return isButtonRadiusId(v) ? v : DEFAULT_RADIUS;
}

/** React hook: estilo de botão atual + setter. */
export function useButtonRadius(): [ButtonRadiusId, (id: ButtonRadiusId) => void] {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_RADIUS);
  return [current, applyButtonRadius];
}
