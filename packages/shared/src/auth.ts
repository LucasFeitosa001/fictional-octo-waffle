// Shared auth constants + types for web (cookies) and mobile (bearer).
//
// Auth is served by Better Auth, mounted on the API under `/api/v1/auth/*`.
// Web uses `better-auth/react` and mobile uses `@better-auth/expo` + `better-auth/react`.
// Both clients take a `baseURL` that points at the auth mount.

/**
 * Better Auth base path, relative to the API origin.
 * Full auth base URL = `${API_ORIGIN}${AUTH_BASE_PATH}`.
 * e.g. http://localhost:3333/api/v1/auth
 */
export const AUTH_BASE_PATH = '/api/v1/auth';

/** Default dev API origin (host:port, no path). */
export const DEFAULT_API_ORIGIN = 'http://localhost:3333';

/** Build the Better Auth client baseURL from an API origin. */
export function authBaseUrl(apiOrigin: string = DEFAULT_API_ORIGIN): string {
  return `${apiOrigin.replace(/\/$/, '')}${AUTH_BASE_PATH}`;
}

/** Better Auth endpoints (relative to the auth base URL). */
export const AUTH_ENDPOINTS = {
  signInEmail: '/sign-in/email',
  signUpEmail: '/sign-up/email',
  signOut: '/sign-out',
  getSession: '/get-session',
} as const;

/**
 * Header that the Better Auth `bearer` plugin sets on responses containing a
 * fresh session token (mobile reads this and stores it, then sends it back as
 * `Authorization: Bearer <token>` on subsequent API + auth requests).
 */
export const AUTH_TOKEN_HEADER = 'set-auth-token';

/** The Better Auth user shape (core fields + Beautypass domain fields). */
export interface BetterAuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  companyId: string | null;
  phone?: string | null;
  provider?: string | null;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BetterAuthSession {
  id: string;
  token: string;
  userId: string;
  expiresAt: string;
}

export interface BetterAuthSessionResponse {
  user: BetterAuthUser;
  session: BetterAuthSession;
}
