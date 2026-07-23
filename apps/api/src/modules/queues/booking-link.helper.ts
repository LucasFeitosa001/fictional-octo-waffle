/**
 * Resolves a company's PUBLIC booking URL — the friendly link a client taps to
 * re-book (e.g. https://agenda.salonpass.com.br/{slug}). Mirrors how the admin
 * app builds it (CLUB_ORIGIN + "/" + slug, see apps/web LinkAgendamentoPage) and
 * how the web-club routes "/:slug" to the booking portal.
 *
 * The slug lives on the company's active BookingLink row. If the company has no
 * active link (never set one up), we return null and the caller omits {link}
 * gracefully.
 */
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Public origin of the client-facing booking app. Configurable via env so
 * on-prem / white-label deploys point elsewhere; falls back to the production
 * club domain. Trailing slash stripped so we can always join with "/{slug}".
 */
export function bookingBaseUrl(): string {
  const raw =
    process.env.PUBLIC_BOOKING_URL ??
    process.env.CLUB_ORIGIN ??
    process.env.BOOKING_BASE_URL ??
    'https://agenda.salonpass.com.br';
  return raw.replace(/\/+$/, '');
}

/**
 * Builds the absolute re-booking URL for a company, or null when the company has
 * no active booking link (so {link} can be omitted). Picks the most recently
 * created active link if there is more than one.
 */
export async function resolveBookingLink(
  prisma: PrismaService,
  companyId: string,
): Promise<string | null> {
  const link = await prisma.client.bookingLink.findFirst({
    where: { companyId, active: true },
    orderBy: { createdAt: 'desc' },
    select: { slug: true },
  });
  if (!link?.slug) return null;
  return `${bookingBaseUrl()}/${encodeURIComponent(link.slug)}`;
}
