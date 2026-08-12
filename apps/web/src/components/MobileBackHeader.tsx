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
        // sticky top-0 gruda no topo do .db-canvas (o container que realmente
        // rola). -mx-3 sangra pras bordas; o -mt cancela EXATAMENTE o pt do
        // wrapper .mobile-page-content (max(1rem,safe-area-top)), puxando a barra
        // pro topo absoluto do scroller; o pt próprio re-reserva a safe-area
        // DENTRO da barra, deixando o botão "Voltar" logo ABAIXO do notch e 100%
        // tocável. lg:mt-0 acompanha o lg:pt-6 do wrapper. z-40 fica acima do
        // conteúdo pra o toque no Voltar nunca ser interceptado.
        'sticky top-0 z-40 -mx-3 -mt-[max(1rem,var(--sp-safe-top))] mb-4 border-b border-line bg-canvas/95 px-3 pb-2 pt-[max(0.5rem,var(--sp-safe-top))] backdrop-blur lg:mt-0',
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
