import { usePortal } from '../lib/booking';

/**
 * The SALON's brand lockup for the black topbar of the customer flow (booking,
 * agenda, login, account). Shows the salon logo (or a gold initial disc as a
 * fallback) next to the salon name — the public/customer flow is the salon's
 * face, never the SalonPass wordmark. Resolves the portal from the slug itself
 * so callers only pass the slug. While the portal loads it shows a neutral
 * shimmer of the same shape, so the identity fills in without a layout jump.
 */
export function SalonBrand({ slug }: { slug: string }) {
  const portal = usePortal(slug);
  const name = portal.data?.name?.trim();
  const logoUrl = portal.data?.logoUrl ?? null;
  const initial = (name?.[0] ?? 'S').toUpperCase();

  if (portal.isLoading && !portal.data) {
    return (
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/15 sm:h-10 sm:w-10" />
        <span className="h-4 w-28 animate-pulse rounded bg-white/15" />
      </span>
    );
  }

  const displayName = name || 'Salão';

  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={displayName}
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/15 sm:h-10 sm:w-10"
        />
      ) : (
        <span
          aria-hidden
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-brand text-base text-[#1a1a1a] sm:h-10 sm:w-10"
          style={{ backgroundImage: 'linear-gradient(160deg, #f2b33d 0%, #e59a1f 100%)' }}
        >
          {initial}
        </span>
      )}
      <span className="min-w-0 truncate font-brand text-base font-semibold leading-tight text-white sm:text-lg">
        {displayName}
      </span>
    </span>
  );
}
