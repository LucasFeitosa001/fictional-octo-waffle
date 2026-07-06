import { Skeleton } from '@heroui/react';

/**
 * Shared loading skeletons for the club. They mirror the real content's shape and
 * size (HeroUI <Skeleton>, shimmer animation) so a load reads as the page filling
 * in — never a giant centered spinner. Each block is sized to match its component.
 */

// Mirrors a ServiceCard: photo column + title/desc/meta/price block.
export function ServiceCardSkeleton() {
  return (
    <div className="flex overflow-hidden rounded-2xl border border-[var(--color-soft-border)] bg-white shadow-[var(--shadow-card)]">
      <Skeleton className="w-32 shrink-0 self-stretch rounded-none sm:w-40" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-5 w-2/3 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-4/5 rounded-md" />
        <div className="mt-1 flex items-center justify-between gap-3">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ServiceListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, i) => (
        <ServiceCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Mirrors a ChoiceRow (professional pick).
export function ChoiceRowSkeleton() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[var(--color-soft-border)] bg-[#FFF1EE] px-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <Skeleton className="h-3 w-1/3 rounded-md" />
      </div>
      <Skeleton className="ml-3 h-5 w-5 shrink-0 rounded-full" />
    </div>
  );
}

export function ChoiceListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <ChoiceRowSkeleton key={i} />
      ))}
    </div>
  );
}

// Mirrors the time-slot grid.
export function SlotGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-10 rounded-xl" />
      ))}
    </div>
  );
}

// Mirrors an AppointmentRow in the account page.
export function AppointmentRowSkeleton() {
  return (
    <div className="rounded-xl border border-default-200 bg-white px-3 py-3">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-2/3 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
    </div>
  );
}

export function AppointmentListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <AppointmentRowSkeleton key={i} />
      ))}
    </div>
  );
}

// Week availability grid placeholder (7 day columns of slots).
export function AgendaGridSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-soft-border)] bg-white p-3">
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, col) => (
          <div key={col} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full rounded-md" />
            {Array.from({ length: 6 }, (_, row) => (
              <Skeleton key={row} className="h-7 w-full rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
