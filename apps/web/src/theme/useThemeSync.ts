import { useEffect, useRef } from 'react';
import { useSession } from '../lib/auth';
import { useMinhasContas } from '../lib/queries/contas';
import { api } from '../lib/api';
import { applyTheme, isThemeId, DEFAULT_THEME, type ThemeId } from './theme';
import {
  applyButtonRadius,
  getStoredButtonRadius,
  isButtonRadiusId,
  DEFAULT_RADIUS,
  type ButtonRadiusId,
} from './buttonStyle';
import {
  getStoredSidebarStyle,
  isSidebarStyle,
  setSidebarStyle,
  DEFAULT_SIDEBAR_STYLE,
  type SidebarStyleId,
} from './sidebarStyle';
import {
  getStoredCloseStyle,
  isCloseStyle,
  setCloseStyle,
  DEFAULT_CLOSE_STYLE,
  type CloseStyleId,
} from './closeStyle';
import {
  getStoredCrmShortcut,
  setCrmShortcutEnabled,
  DEFAULT_CRM_SHORTCUT,
} from './crmShortcut';
import { getStoredTheme } from './theme';

export interface AppearancePreferences {
  theme?: ThemeId | null;
  buttonRadius?: ButtonRadiusId;
  sidebarStyle?: SidebarStyleId;
  closeStyle?: CloseStyleId;
  crmShortcut?: boolean;
}

// Evita duas fontes de verdade concorrentes:
// 1. uma leitura iniciada no mount não pode sobrescrever uma escolha feita
//    enquanto a requisição estava em voo;
// 2. gravações rápidas (tema + sidebar + botão) chegam à API na mesma ordem em
//    que o usuário clicou, sem uma resposta lenta restaurar o valor anterior.
let localAppearanceRevision = 0;
let saveQueue: Promise<unknown> = Promise.resolve();

/**
 * Cloud theme persistence — escopo EMPRESA (compartilhado por todos os logins).
 *
 * localStorage remains the FAST pre-paint cache (see applyTheme/initTheme) so a
 * returning device shows the right palette before the first React paint — no
 * flash. The COMPANY is the source of truth, SHARED across every staff login and
 * device: this hook pulls the active company's appearance once it's available
 * and, if it carries a valid setting that differs from what's currently applied
 * (e.g. a fresh device with empty localStorage, or another staff member who set
 * the company theme), applies it silently.
 *
 * "Silently" = no POST back — this is a load, not a user change, so we must not
 * echo it to the server (would be a redundant write and could race a genuine
 * change). Genuine changes go through saveThemeToCloud() from the UI selector
 * and are only allowed for admins (config:manage) — the server enforces it.
 *
 * Keyed on the ACTIVE COMPANY id (not the user): switching tenant re-syncs to
 * the new company's appearance. CompanySwitcher navigates client-side without a
 * full reload, so keying on the user alone would leave the previous company's
 * theme stuck.
 */
export function useThemeSync(): void {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { data: contas } = useMinhasContas();
  const activeCompanyId = contas?.find((c) => c.active)?.companyId ?? null;
  // Guard so we fetch once per active company, not on every session refetch.
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !activeCompanyId) return;
    if (syncedFor.current === activeCompanyId) return;
    syncedFor.current = activeCompanyId;

    let cancelled = false;
    const revisionAtRequest = localAppearanceRevision;
    api
      .get<AppearancePreferences>('/companies/current/appearance')
      .then((res) => {
        if (cancelled || revisionAtRequest !== localAppearanceRevision) return;
        // A EMPRESA é autoritativa: para cada preferência, aplica o valor da
        // empresa OU volta ao PADRÃO quando ela não tem nada salvo. Sem esse
        // reset, trocar para uma empresa sem personalização herdaria o tema da
        // empresa anterior (o cache localStorage é do navegador, não do tenant)
        // — daria a impressão de que "mexer numa empresa mexe em todas".
        const theme = isThemeId(res?.theme) ? res.theme : DEFAULT_THEME;
        if (theme !== document.documentElement.dataset.theme) {
          applyTheme(theme);
        }
        const radius = isButtonRadiusId(res?.buttonRadius)
          ? res.buttonRadius
          : DEFAULT_RADIUS;
        if (radius !== document.documentElement.dataset.btnRadius) {
          applyButtonRadius(radius);
        }
        setSidebarStyle(
          isSidebarStyle(res?.sidebarStyle) ? res.sidebarStyle : DEFAULT_SIDEBAR_STYLE,
        );
        setCloseStyle(
          isCloseStyle(res?.closeStyle) ? res.closeStyle : DEFAULT_CLOSE_STYLE,
        );
        setCrmShortcutEnabled(
          typeof res?.crmShortcut === 'boolean' ? res.crmShortcut : DEFAULT_CRM_SHORTCUT,
        );
      })
      .catch(() => {
        /* offline / unauthenticated → mantém toda a preferência local
           (não reseta: sem resposta da empresa, o cache local é o melhor palpite) */
      });

    return () => {
      cancelled = true;
    };
  }, [userId, activeCompanyId]);
}

/**
 * Persist a theme choice to the COMPANY (shared with every staff login).
 * Fire-and-forget: the local apply already happened (applyTheme writes
 * localStorage + re-skins the UI), so if the network is down — or the caller
 * lacks config:manage and the server answers 403 — the change still holds
 * locally and simply isn't published to the company. Call this only for genuine
 * admin-driven changes (the theme selector, gated in the UI).
 */
export function saveThemeToCloud(theme: ThemeId): void {
  void saveAppearanceToCloud({ theme }).catch(() => {
    /* offline → still applied + cached locally; cloud copy just lags */
  });
}

/**
 * Persist the button-radius choice to the COMPANY. Same fire-and-forget
 * semantics as saveThemeToCloud: the local apply already happened, so a network
 * failure (or a 403 for a non-admin) just means the company copy lags — the
 * choice still holds locally via localStorage.
 */
export function saveButtonRadiusToCloud(buttonRadius: ButtonRadiusId): void {
  void saveAppearanceToCloud({ buttonRadius }).catch(() => {
    /* offline / 404 → still applied + cached locally; cloud copy just lags */
  });
}

/** Salva um fragmento das preferências mantendo a ordem dos cliques. */
export function saveAppearanceToCloud(
  patch: AppearancePreferences,
): Promise<AppearancePreferences> {
  localAppearanceRevision += 1;
  const request = saveQueue
    .catch(() => undefined)
    .then(() => api.post<AppearancePreferences>('/companies/current/appearance', patch));
  saveQueue = request.catch(() => undefined);
  return request;
}

/** Snapshot completo usado pelo botão explícito "Salvar personalização". */
export function saveCurrentAppearanceToCloud(): Promise<AppearancePreferences> {
  return saveAppearanceToCloud({
    theme: getStoredTheme(),
    buttonRadius: getStoredButtonRadius(),
    sidebarStyle: getStoredSidebarStyle(),
    closeStyle: getStoredCloseStyle(),
    crmShortcut: getStoredCrmShortcut(),
  });
}
