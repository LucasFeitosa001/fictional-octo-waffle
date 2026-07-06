/**
 * Shared constants for the Salonpass (feminino) e2e suite.
 *
 * These run READ-ONLY against the LIVE production club so we never pollute
 * prod data. The target is the real Studio Borboletas tenant.
 */

/** Live customer booking PWA (Vite SPA) for the Studio Borboletas tenant. */
export const CLUB_URL = 'https://studioborboletas.salonpass.com.br';

/** Same-origin API prefix — the club is built with VITE_API_ORIGIN='' so the
 *  SPA hits `/api/v1/...` on its own host (proxied to App Runner). */
export const API_BASE = `${CLUB_URL}/api/v1`;

/** BookingLink slug of the live tenant. */
export const SALON_SLUG = 'studioborboletas';

/** Company name shown on the portal. */
export const SALON_NAME = 'Studio Borboletas';

/** Public booking endpoints (read-only). */
export const portalUrl = (slug = SALON_SLUG) =>
  `${API_BASE}/public/booking/${encodeURIComponent(slug)}`;
export const servicesUrl = (slug = SALON_SLUG) => `${portalUrl(slug)}/services`;
export const professionalsUrl = (serviceId: string, slug = SALON_SLUG) =>
  `${portalUrl(slug)}/professionals?serviceId=${encodeURIComponent(serviceId)}`;
