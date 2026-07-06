import { createApiClient } from '@beautypass/shared';
import { API_BASE_URL } from './config';

/**
 * Shared REST client. credentials:'include' so the Better Auth session cookie
 * is sent on every protected request.
 */
export const api = createApiClient({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  // The shared client stores globalThis.fetch and calls it unbound, which throws
  // "Illegal invocation" in the browser. Pass a window-bound fetch.
  fetchImpl: (...args: Parameters<typeof fetch>) => window.fetch(...args),
});
