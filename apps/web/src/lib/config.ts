import { authBaseUrl, DEFAULT_API_ORIGIN } from '@beautypass/shared';

const CONFIGURED_ORIGIN =
  (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();

// An absent or empty VITE_API_ORIGIN means "same origin as the current host".
// Better Auth's createAuthClient rejects a relative baseURL ("Invalid base URL"),
// so we resolve it to the absolute window.location.origin at runtime.
const API_ORIGIN =
  CONFIGURED_ORIGIN ||
  (typeof window !== 'undefined' ? window.location.origin : DEFAULT_API_ORIGIN);

/** REST data API base, e.g. http://localhost:3333/api/v1 */
export const API_BASE_URL = `${API_ORIGIN.replace(/\/$/, '')}/api/v1`;

/** Better Auth base URL, e.g. http://localhost:3333/api/v1/auth */
export const AUTH_BASE_URL = authBaseUrl(API_ORIGIN);

function resolveClubOrigin(): string {
  const env = (import.meta.env.VITE_CLUB_ORIGIN as string | undefined);
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.hostname === 'app.salonpass.com.br') {
    return 'https://agenda.salonpass.com.br';
  }
  return 'http://localhost:5174';
}

export const CLUB_ORIGIN = resolveClubOrigin();

// Fonte única = package.json (injetada pelo Vite `define` como __APP_VERSION__).
// Bumpar o package.json atualiza a versão em TODOS os lugares (login, sidebar,
// configurações → informações do sistema).
export const APP_VERSION = `v${__APP_VERSION__}`;
