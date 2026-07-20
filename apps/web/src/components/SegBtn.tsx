import type { ReactNode } from 'react';

/**
 * Segmented filter chip — gold-tinted + soft gold shadow when active,
 * warm-white outline when idle. Used across the cadastro pages for
 * status / category filters.
 */
export function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'min-h-10 rounded-full bg-gold/15 px-4 py-2 text-sm font-medium text-[#8a6517] shadow-[var(--shadow-gold)]'
          : 'min-h-10 rounded-full border border-[var(--color-soft-border)] bg-warm-white px-4 py-2 text-sm text-muted transition-colors hover:text-foreground'
      }
    >
      {children}
    </button>
  );
}
