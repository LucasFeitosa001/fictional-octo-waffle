import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { IconChevron } from './icons';

type ButtonVariant = ComponentProps<typeof Button>['variant'];

interface DropdownButtonProps {
  label: ReactNode;
  icon?: ReactNode;
  /**
   * Panel contents. Pass a function to receive a `close` callback — handy for
   * menu items that should dismiss the panel once chosen.
   */
  children: ReactNode | ((close: () => void) => ReactNode);
  /** Which edge the panel aligns to. Defaults to 'start' (left). */
  align?: 'start' | 'end';
  buttonVariant?: ButtonVariant;
}

/**
 * A button that reveals a floating panel anchored just below it. The panel works
 * both as an actions menu and as a container for arbitrary content (filters).
 *
 * Closes on outside click and Esc. Clicks inside react-aria overlays (e.g. a
 * nested Select popover, which portals out of this subtree) are ignored so they
 * don't dismiss the panel.
 */
export function DropdownButton({
  label,
  icon,
  children,
  align = 'start',
  buttonVariant = 'outline',
}: DropdownButtonProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (wrapperRef.current?.contains(target)) return;
      // Ignore clicks landing inside portaled react-aria overlays.
      if (target.closest('[data-rac],[role="listbox"],[role="option"],[role="dialog"],[role="menu"]')) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <Button
        variant={buttonVariant}
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {icon}
        {label}
        <IconChevron
          size={14}
          className={'transition-transform ' + (open ? 'rotate-180' : '')}
        />
      </Button>

      <div
        role="menu"
        aria-hidden={!open}
        className={[
          'absolute top-full z-50 mt-2 max-w-[calc(100vw-1.5rem)] origin-top overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[var(--shadow-pop)]',
          'transition-all duration-200 ease-out',
          align === 'end' ? 'right-0' : 'left-0',
          open
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0',
        ].join(' ')}
      >
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>
  );
}
