import { useEffect, useState } from 'react';
import { IconCheck } from './icons';

/**
 * Checkbox VISUAL do modo de seleção. Entra com animação (scale + fade, 180ms)
 * quando o card passa a renderizá-lo ao entrar em selectMode — como monta junto
 * com a transição para o selectMode, a animação de entrada dispara no mount.
 *
 * É só marca visual: NÃO tem onChange. O card inteiro faz o toggle (onClick no
 * card chama `toggle(id)`); este componente apenas reflete `checked`.
 */
export function AnimatedCheckbox({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  // Entrada: começa pequeno/transparente e cresce no primeiro frame após montar.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <span
      aria-hidden
      className={[
        'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-all duration-[180ms] ease-out will-change-transform',
        entered ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        checked
          ? 'border-primary bg-primary text-white'
          : 'border-[var(--color-soft-border)] bg-white',
        className ?? '',
      ].join(' ')}
    >
      <span
        className={[
          'transition-transform duration-150 ease-out',
          checked ? 'scale-100' : 'scale-0',
        ].join(' ')}
      >
        <IconCheck size={14} />
      </span>
    </span>
  );
}
