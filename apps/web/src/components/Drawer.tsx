import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './icons';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky footer (e.g. Cancelar / Salvar). Optional. */
  footer?: ReactNode;
  /** Desktop width override, e.g. "sm:w-[520px]". Defaults to ~440px. */
  widthClass?: string;
}

// Keep the panel mounted long enough for the exit slide to finish.
const EXIT_MS = 300;

/**
 * Reusable side drawer, mobile-first.
 *
 * - Mobile (<sm): a bottom-sheet that slides up, rounded top, capped at 92vh.
 * - Desktop (sm+): slides in from the right, full height, ~440px wide.
 *
 * Rendered in a portal at `z-[70]` so it sits above modals and the bottom nav.
 * Closes on backdrop click and Esc, locks body scroll while open, and exposes a
 * sticky header + scrolling body + optional sticky footer.
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  widthClass = 'sm:w-[440px]',
}: DrawerProps) {
  // `mounted` keeps the drawer in the DOM through the exit animation; `show`
  // drives the slide / fade transition.
  const [mounted, setMounted] = useState(isOpen);
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mount → next frame flip `show` on so the transition plays. On close play the
  // exit transition first, then unmount.
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(raf);
    }
    setShow(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Lock body scroll while the drawer occupies the screen.
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  // Close on Esc.
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (show) panelRef.current?.focus();
  }, [show]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="presentation">
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={[
          'absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out',
          show ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={[
          'absolute flex flex-col bg-[#fffdf8] shadow-[var(--shadow-pop)] outline-none',
          'transition-transform duration-300 ease-out will-change-transform',
          // Mobile: bottom sheet.
          'inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl',
          // Desktop: right-anchored, full-height panel.
          'sm:inset-x-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-full sm:max-h-none sm:rounded-none sm:border-l sm:border-[var(--color-soft-border)]',
          widthClass,
          show
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full',
        ].join(' ')}
      >
        {/* Header (sticky) */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--color-soft-border)] bg-[#fffdf8] px-4 py-3.5">
          <h2 className="min-w-0 truncate text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#6B6F76] transition-colors hover:bg-[#f7f3ea]"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Body (the scroller) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {/* Footer (sticky) */}
        {footer && (
          <div
            className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-soft-border)] bg-[#fffdf8] px-4 py-3"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
