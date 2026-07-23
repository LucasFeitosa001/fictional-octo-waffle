import { IconChevron } from './icons';

type MobileBackHeaderProps = {
  title: string;
  onBack: () => void;
  breakpoint?: 'md' | 'lg';
};

export function MobileBackHeader({
  title,
  onBack,
  breakpoint = 'md',
}: MobileBackHeaderProps) {
  const desktopHiddenClass = breakpoint === 'lg' ? 'lg:hidden' : 'md:hidden';

  return (
    <div
      className={[
        'sticky top-0 z-40 -mx-3 -mt-4 mb-4 border-b border-line bg-canvas/95 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur',
        desktopHiddenClass,
      ].join(' ')}
    >
      <div className="grid min-h-11 grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label={`Voltar de ${title}`}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-primary transition-colors active:bg-[color-mix(in_oklab,var(--sp-primary)_10%,transparent)]"
        >
          <span className="rotate-90">
            <IconChevron size={18} />
          </span>
          Voltar
        </button>
        <h2 className="truncate px-2 text-center text-sm font-semibold text-ink">{title}</h2>
        <span aria-hidden />
      </div>
    </div>
  );
}
