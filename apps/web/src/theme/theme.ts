import { useSyncExternalStore } from 'react';

/**
 * Color themes. Each id maps to a `[data-theme="<id>"]` palette block in
 * index.css. Swapping the attribute on <html> re-skins the whole product; all
 * brand colors resolve from the --sp-* variables that block defines.
 *
 * To add a salon-specific palette: add a `[data-theme="…"]` block in index.css
 * and one entry here — nothing else needs to change.
 */
export type ThemeId = 'salonpass' | 'belasis';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  description: string;
  /** Preview swatches [sidebar, canvas, primary] for the picker. */
  swatches: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'salonpass',
    label: 'Salonpass',
    description: 'Identidade original: preto, dourado e creme.',
    swatches: ['#111111', '#fdfaf7', '#f2b33d'],
  },
  {
    id: 'belasis',
    label: 'Belasis',
    description: 'Índigo/roxo com fundo claro (estilo Belasis).',
    swatches: ['#ffffff', '#f7f7fb', '#505afb'],
  },
];

const STORAGE_KEY = 'sp-theme';
const DEFAULT_THEME: ThemeId = 'salonpass';

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && THEMES.some((t) => t.id === v);
}

export function getStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(v)) return v;
  } catch {
    /* localStorage unavailable (private mode / SSR) */
  }
  return DEFAULT_THEME;
}

const listeners = new Set<() => void>();

/** Apply a theme to <html>, persist it, and notify subscribers. */
export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  // Keep the browser chrome / PWA status bar in sync with the sidebar color.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEMES.find((t) => t.id === id)?.swatches[0] ?? '#111111');
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

/** Call once on boot to restore the saved theme before the first paint of the app. */
export function initTheme(): void {
  applyTheme(getStoredTheme());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): ThemeId {
  const v = document.documentElement.dataset.theme;
  return isThemeId(v) ? v : DEFAULT_THEME;
}

/** React hook: current theme id + setter. */
export function useTheme(): [ThemeId, (id: ThemeId) => void] {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_THEME);
  return [current, applyTheme];
}
