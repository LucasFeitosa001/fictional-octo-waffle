// Better Auth client for Expo (bearer-token based, per @beautypass/shared auth
// constants). Mounted at `${API_ORIGIN}/api/v1/auth`.
import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { authBaseUrl, DEFAULT_API_ORIGIN } from '@beautypass/shared';

// EXPO_PUBLIC_API_URL is e.g. http://localhost:3333/api/v1 — strip the /api/v1
// path to get the API origin that authBaseUrl() expects.
function apiOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL ?? `${DEFAULT_API_ORIGIN}/api/v1`;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return DEFAULT_API_ORIGIN;
  }
}

export const authClient = createAuthClient({
  baseURL: authBaseUrl(apiOrigin()),
  plugins: [
    expoClient({
      scheme: 'beautypass',
      storagePrefix: 'beautypass',
      storage: SecureStore,
    }),
  ],
});
