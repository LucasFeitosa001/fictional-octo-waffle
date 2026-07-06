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
          ? 'rounded-full bg-[#f2b33d]/15 px-3 py-1.5 text-sm font-medium text-[#a67c1e] shadow-[var(--shadow-gold)]'
          : 'rounded-full border border-[var(--color-soft-border)] bg-[#fffdf8] px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground'
      }
    >
      {children}
    </button>
  );
}
