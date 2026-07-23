import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconChevron, IconX } from './icons';
import { IconTip } from './IconTip';
import { useIsMobile } from '../hooks/useIsMobile';
import { useCloseStyle } from '../theme/closeStyle';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Sticky footer (e.g. Cancelar / Salvar). Optional. */
  footer?: ReactNode;
  /** Desktop width override, e.g. "sm:w-[520px]". Defaults to ~440px. */
  widthClass?: string;
  /** Direction/layout of the panel. Content drawers use right; navbar actions use bottom. */
  placement?: 'right' | 'bottom';
  /**
   * Root stacking z-index class. Defaults to `z-[70]`. Sub-drawers that must
   * open ABOVE another drawer (e.g. the comanda's customer/item pickers) pass a
   * higher one like `z-[90]`.
   */
  zClass?: string;
  /**
   * Desktop: ocupa a tela inteira (para drawers de CRIAR/EDITAR entidade).
   * Ignora `widthClass` no desktop. Não afeta mobile/bottom-sheet.
   */
  fullscreen?: boolean;
  /** Mobile only: replaces the close icon with a contextual back action. */
  mobileBackLabel?: string;
}

// Keep the panel mounted long enough for the horizontal exit slide to finish.
const EXIT_MS = 380;

/**
 * Reusable side drawer, mobile-first.
 *
 * - Mobile (<md): bottom-sheet que sobe (translate-y) — padrão Belasis.
 * - Desktop (md+): desliza da direita (translate-x), ~440px.
 *
 * Se `placement="bottom"` explícito, força bottom-sheet em qualquer breakpoint
 * (usado pelos drawers de Filtrar/Ações da BottomNav).
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  widthClass = 'sm:w-[440px]',
  placement = 'right',
  zClass = 'z-[70]',
  fullscreen = false,
  mobileBackLabel,
}: DrawerProps) {
  const isMobile = useIsMobile();
  const closeStyle = useCloseStyle();
  const effectivePlacement: 'right' | 'bottom' =
    placement === 'bottom' ? 'bottom' : (isMobile ? 'bottom' : 'right');
  // `mounted` keeps the drawer in the DOM through the exit animation; `show`
  // drives the slide / fade transition.
  const [mounted, setMounted] = useState(isOpen);
  const [show, setShow] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Mount and visibility are intentionally handled in separate effects. A newly
  // portalled panel needs to be painted in its off-screen position before we
  // flip `show`; otherwise React can batch both states and skip the entrance
  // animation entirely.
  useEffect(() => {
    if (isOpen) {
      setShow(false);
      setMounted(true);
      return;
    }
    setShow(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mounted) return;
    let secondRaf = 0;
    const firstRaf = requestAnimationFrame(() => {
      secondRaf = requestAnimationFrame(() => setShow(true));
    });
    return () => {
      cancelAnimationFrame(firstRaf);
      cancelAnimationFrame(secondRaf);
    };
  }, [isOpen, mounted]);

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
    <div className={`fixed inset-0 ${zClass}`} role="presentation">
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={[
          'absolute inset-0 cursor-pointer bg-black/40 backdrop-blur-[1px] transition-opacity duration-[380ms] ease-out',
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
          // `sp-drawer-panel`: âncora usada pelo index.css para dar bordas/altura
          // de toque a inputs/selects dentro de qualquer drawer (mobile-first).
          'sp-drawer-panel absolute flex w-full flex-col border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-pop)] outline-none',
          'transform-gpu transition-transform duration-[380ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] will-change-transform',
          effectivePlacement === 'right'
            ? `bottom-0 right-0 top-0 h-dvh ${fullscreen ? 'w-full' : `border-l ${widthClass}`} ${show ? 'translate-x-0' : 'translate-x-full'}`
            : `inset-0 h-dvh border-t ${show ? 'translate-y-0' : 'translate-y-full'}`,
        ].join(' ')}
      >
        {/* Header (sticky) */}
        <div className={[
          'sticky top-0 z-10 border-b border-[var(--color-soft-border)] bg-warm-white px-4 pb-3.5',
          isMobile && mobileBackLabel
            ? 'grid grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center'
            : 'flex items-center justify-between gap-3',
          effectivePlacement === 'right' ? 'pt-[max(0.875rem,env(safe-area-inset-top))]' : 'pt-3.5',
        ].join(' ')}>
          {isMobile && mobileBackLabel ? (
            <>
              <button
                type="button"
                onClick={onClose}
                aria-label={mobileBackLabel}
                className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-primary"
              >
                <span className="rotate-90">
                  <IconChevron size={18} />
                </span>
                {mobileBackLabel}
              </button>
              <h2 className="min-w-0 truncate px-2 text-center text-sm font-semibold text-foreground">
                {title}
              </h2>
              <span aria-hidden />
            </>
          ) : (
            <>
              <h2 className="min-w-0 truncate text-base font-semibold text-foreground">{title}</h2>
              <IconTip label="Fechar" placement="bottom" className="shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className={
                    closeStyle === 'label'
                      ? 'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-medium text-[#5f5a54] shadow-sm transition-colors hover:border-black/20 hover:bg-cream'
                      : closeStyle === 'round'
                        ? 'grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 bg-white text-[#5f5a54] shadow-sm transition-colors hover:border-black/20 hover:bg-cream'
                        : 'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-ink transition-colors hover:bg-black/5 hover:text-foreground'
                  }
                >
                  <IconX size={16} />
                  {closeStyle === 'label' && <span>Fechar</span>}
                </button>
              </IconTip>
            </>
          )}
        </div>

        {/* Body (the scroller) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>

        {/* Footer (sticky) */}
        {footer && (
          <div
            className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--color-soft-border)] bg-warm-white px-4 py-3"
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
