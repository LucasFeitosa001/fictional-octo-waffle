import { createAuthClient } from 'better-auth/react';
import { AUTH_BASE_URL } from './config';

/**
 * Better Auth client for the web (cookie-based session).
 * baseURL points at the auth mount: http://localhost:3333/api/v1/auth
 *
 * sessionOptions:
 *   - refetchOnWindowFocus: false — Better Auth registra um listener em
 *     visibilitychange que dispara /get-session toda vez que o usuário volta
 *     pra aba. No iOS Safari, ao retomar a aba depois de tempo em background
 *     (troca de apps via app switcher), isso combinado com WKWebView discard
 *     dá a impressão de "reload" — voltamos ao splash porque isPending flipa
 *     e a app re-renderiza a cascata de spinners. Manter o cache local vale
 *     mais do que a garantia de sessão fresca (o cookie tem TTL do server).
 *   - refetchInterval: 0 — nunca poll (default). Se a sessão expirou, a
 *     próxima request 401 acorda o fluxo de re-login naturalmente.
 *   - refetchWhenOffline: false — não faz sentido, e default.
 */
export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  sessionOptions: {
    refetchOnWindowFocus: false,
    refetchInterval: 0,
    refetchWhenOffline: false,
  },
});

export const { useSession, signIn, signOut } = authClient;
