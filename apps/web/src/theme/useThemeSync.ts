import { useEffect, useRef } from 'react';
import { useSession } from '../lib/auth';
import { api } from '../lib/api';
import { applyTheme, isThemeId, type ThemeId } from './theme';
import {
  applyButtonRadius,
  getStoredButtonRadius,
  isButtonRadiusId,
  type ButtonRadiusId,
} from './buttonStyle';
import {
  getStoredSidebarStyle,
  isSidebarStyle,
  setSidebarStyle,
  type SidebarStyleId,
} from './sidebarStyle';
import {
  getStoredCloseStyle,
  isCloseStyle,
  setCloseStyle,
  type CloseStyleId,
} from './closeStyle';
import {
  getStoredCrmShortcut,
  setCrmShortcutEnabled,
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
 * Cloud theme persistence.
 *
 * localStorage remains the FAST pre-paint cache (see applyTheme/initTheme) so a
 * returning device shows the right palette before the first React paint — no
 * flash. The user ACCOUNT is the cross-device source of truth: this hook pulls
 * the account theme once the session is available and, if the account has a
 * valid theme that differs from what's currently applied (e.g. a fresh device
 * with an empty localStorage), applies it silently.
 *
 * "Silently" = no POST back — this is a load, not a user change, so we must not
 * echo it to the server (would be a redundant write and could race a genuine
 * change). Genuine changes go through saveThemeToCloud() from the UI selector.
 *
 * Runs at most once per logged-in user id; a real account switch re-syncs.
 */
export function useThemeSync(): void {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  // Guard so we fetch once per user, not on every Better Auth session refetch.
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    if (syncedFor.current === userId) return;
    syncedFor.current = userId;

    let cancelled = false;
    const revisionAtRequest = localAppearanceRevision;
    api
      .get<AppearancePreferences>('/users/me/appearance')
      .then((res) => {
        if (cancelled || revisionAtRequest !== localAppearanceRevision) return;
        if (
          isThemeId(res?.theme) &&
          res.theme !== document.documentElement.dataset.theme
        ) {
          applyTheme(res.theme);
        }
        if (
          isButtonRadiusId(res?.buttonRadius) &&
          res.buttonRadius !== document.documentElement.dataset.btnRadius
        ) {
          applyButtonRadius(res.buttonRadius);
        }
        if (isSidebarStyle(res?.sidebarStyle)) {
          setSidebarStyle(res.sidebarStyle);
        }
        if (isCloseStyle(res?.closeStyle)) {
          setCloseStyle(res.closeStyle);
        }
        if (typeof res?.crmShortcut === 'boolean') {
          setCrmShortcutEnabled(res.crmShortcut);
        }
      })
      .catch(() => {
        /* offline / unauthenticated → mantém toda a preferência local */
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);
}

/**
 * Persist a theme choice to the user account. Fire-and-forget: the local apply
 * already happened (applyTheme writes localStorage + re-skins the UI), so if the
 * network is down the change still holds locally and simply isn't mirrored to
 * the cloud. Call this only for genuine user-driven changes (the theme selector).
 */
export function saveThemeToCloud(theme: ThemeId): void {
  void saveAppearanceToCloud({ theme }).catch(() => {
    /* offline → still applied + cached locally; cloud copy just lags */
  });
}

/**
 * Persist the button-radius choice to the account. Same fire-and-forget
 * semantics as saveThemeToCloud: the local apply already happened, so a network
 * failure (or a backend that doesn't implement the endpoint yet) just means the
 * cloud copy lags — the choice still holds locally via localStorage.
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
    .then(() => api.post<AppearancePreferences>('/users/me/appearance', patch));
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
