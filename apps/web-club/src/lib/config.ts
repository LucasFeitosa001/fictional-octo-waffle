import { authBaseUrl, DEFAULT_API_ORIGIN } from '@beautypass/shared';

const CONFIGURED_ORIGIN =
  (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim();

// An absent or empty VITE_API_ORIGIN means "same origin as the current host":
// every tenant subdomain ({slug}.salonpass.com.br) then calls its own /api (no
// CORS). Better Auth requires an absolute baseURL, so use window.location.origin.
const API_ORIGIN =
  CONFIGURED_ORIGIN ||
  (typeof window !== 'undefined' ? window.location.origin : DEFAULT_API_ORIGIN);

/** REST data API base, e.g. http://localhost:3333/api/v1 */
export const API_BASE_URL = `${API_ORIGIN.replace(/\/$/, '')}/api/v1`;

/** Better Auth base URL, e.g. http://localhost:3333/api/v1/auth */
export const AUTH_BASE_URL = authBaseUrl(API_ORIGIN);

function resolveAdminOrigin(): string {
  const configured = (import.meta.env.VITE_ADMIN_ORIGIN as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'agenda.salonpass.com.br') {
      return 'https://app.salonpass.com.br';
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:5173`;
    }
  }
  return 'https://app.salonpass.com.br';
}

/** Painel administrativo que hospeda o aceite público de convites profissionais. */
export const ADMIN_ORIGIN = resolveAdminOrigin();

/**
 * The salon being booked. The club app is per-salon (addressed by its
 * BookingLink slug). A default can be baked in via VITE_BOOKING_SLUG; otherwise
 * the slug comes from the URL path (/:slug).
 */
export const DEFAULT_BOOKING_SLUG =
  (import.meta.env.VITE_BOOKING_SLUG as string | undefined)?.trim() || '';

/**
 * PRO salons get a dedicated subdomain `{slug}.salonpass.com.br` that lands
 * straight on their booking portal. When the current host is a single-label
 * tenant subdomain of salonpass.com.br (excluding reserved hosts like `agenda`),
 * the subdomain itself is the BookingLink slug; otherwise we fall back to
 * path-based `/:slug` routing.
 */
const ROOT_DOMAIN = 'salonpass.com.br';
const RESERVED_SUBDOMAINS = new Set(['agenda', 'app', 'www', 'admin', 'api']);

export function getSubdomainSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  const suffix = `.${ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;
  const sub = host.slice(0, -suffix.length);
  if (!sub || sub.includes('.') || RESERVED_SUBDOMAINS.has(sub)) return null;
  return sub;
}

export const APP_VERSION = 'v0.1.0';
