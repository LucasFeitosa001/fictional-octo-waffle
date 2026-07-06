// ApiClient instance wired to env base URL (EXPO_PUBLIC_API_URL).
// Bearer token is captured from Better Auth's `set-auth-token` header on
// sign-in (see auth-context.tsx) and persisted via auth-store.
import { createApiClient } from '@beautypass/shared';

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333/api/v1';

let token: string | null = null;

export function setAuthToken(next: string | null) {
  token = next;
  api.setToken(next);
}

export function getAuthToken(): string | null {
  return token;
}

export const api = createApiClient({
  baseUrl,
  getToken: () => token,
});
