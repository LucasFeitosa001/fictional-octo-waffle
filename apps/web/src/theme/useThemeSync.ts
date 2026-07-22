import { useEffect, useRef } from 'react';
import { useSession } from '../lib/auth';
import { api } from '../lib/api';
import { applyTheme, isThemeId, type ThemeId } from './theme';

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
    api
      .get<{ theme: string }>('/users/me/theme')
      .then((res) => {
        if (cancelled) return;
        const cloud = res?.theme;
        // Only override when the account theme is valid AND differs from what's
        // already on <html> (the current source of truth for the applied value).
        if (isThemeId(cloud) && cloud !== document.documentElement.dataset.theme) {
          applyTheme(cloud); // silent — do NOT saveThemeToCloud here
        }
      })
      .catch(() => {
        /* offline / unauthenticated / 404 → keep the local (localStorage) theme */
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
  api.post('/users/me/theme', { theme }).catch(() => {
    /* offline → still applied + cached locally; cloud copy just lags */
  });
}
