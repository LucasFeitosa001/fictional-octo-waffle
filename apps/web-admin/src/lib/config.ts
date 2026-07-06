import { authBaseUrl, DEFAULT_API_ORIGIN } from '@beautypass/shared';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? DEFAULT_API_ORIGIN;

/** REST data API base, e.g. http://localhost:3333/api/v1 */
export const API_BASE_URL = `${API_ORIGIN.replace(/\/$/, '')}/api/v1`;

/** Better Auth base URL, e.g. http://localhost:3333/api/v1/auth */
export const AUTH_BASE_URL = authBaseUrl(API_ORIGIN);

/**
 * Origin of the customer-facing web-club app. The public booking link lives at
 * `${CLUB_ORIGIN}/b/${slug}` on the club app — NOT this admin app.
 */
export const CLUB_ORIGIN = (
  process.env.NEXT_PUBLIC_CLUB_ORIGIN ?? 'http://localhost:3001'
).replace(/\/$/, '');

export const APP_VERSION = 'v0.1.0';
