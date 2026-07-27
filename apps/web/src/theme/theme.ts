import { useSyncExternalStore } from 'react';

/**
 * Color themes. Each id maps to a `[data-theme="<id>"]` palette block in
 * index.css. Swapping the attribute on <html> re-skins the whole product; all
 * brand colors resolve from the --sp-* variables that block defines.
 *
 * To add a salon-specific palette: add a `[data-theme="…"]` block in index.css
 * and one entry here — nothing else needs to change.
 */
export type ThemeId =
  | 'salonpass'
  | 'belasis'
  | 'esmeralda'
  | 'blush'
  | 'violeta'
  | 'grafite'
  | 'coral';

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
    label: 'Azul',
    description: 'Azul índigo (#545AF5) com fundo claro.',
    swatches: ['#545af5', '#f7f7fb', '#545AF5'],
  },
  {
    id: 'esmeralda',
    label: 'Esmeralda',
    description: 'Verde esmeralda fresco com fundo claro.',
    swatches: ['#0b7c5c', '#f5faf8', '#0f9d6f'],
  },
  {
    id: 'blush',
    label: 'Blush',
    description: 'Rosa/magenta suave e feminino.',
    swatches: ['#b83a72', '#fdf6f9', '#e5478b'],
  },
  {
    id: 'violeta',
    label: 'Violeta',
    description: 'Roxo vibrante e elegante.',
    swatches: ['#6b28c9', '#f9f6fd', '#8b3ff0'],
  },
  {
    id: 'grafite',
    label: 'Grafite',
    description: 'Slate escuro sóbrio e minimalista.',
    swatches: ['#2b3444', '#f6f7f9', '#475569'],
  },
  {
    id: 'coral',
    label: 'Coral',
    description: 'Laranja coral quente e acolhedor.',
    swatches: ['#c2410c', '#fdf8f5', '#f2711c'],
  },
];

const STORAGE_KEY = 'sp-theme';
export const DEFAULT_THEME: ThemeId = 'belasis';

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

/**
 * Substitui (não só edita) TODAS as metas com `name` pelo `content` novo.
 * Trocar o elemento — em vez de `setAttribute('content', ...)` — força o
 * Safari iOS a re-ler o valor: o iOS lê theme-color no load e ignora mutações
 * de atributo em runtime, então a barra do navegador não mudava de cor ao
 * trocar de tema. Remover + reinserir dispara a re-avaliação. Garante também
 * um ÚNICO elemento por name (múltiplos theme-color confundem o browser).
 */
function replaceMeta(name: string, content: string): void {
  const head = document.head;
  document.querySelectorAll(`meta[name="${name}"]`).forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.setAttribute('name', name);
  meta.setAttribute('content', content);
  head.appendChild(meta);
}

/** Apply a theme to <html>, persist it, and notify subscribers. */
export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  // Mobile browser chrome (Chrome/Safari address bar area + PWA status bar) usa
  // a cor PRIMARY do tema — salonpass = gold, belasis = roxo.
  const primary = THEMES.find((t) => t.id === id)?.swatches[2] ?? '#f2b33d';
  replaceMeta('theme-color', primary);
  // Status-bar iOS: escurece se cor primary é escura, senão default. Detecta luma.
  const luma = ((): number => {
    const hex = primary.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  })();
  const statusStyle = luma < 0.6 ? 'black-translucent' : 'default';
  replaceMeta('apple-mobile-web-app-status-bar-style', statusStyle);
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
