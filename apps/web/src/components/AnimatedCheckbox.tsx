import { useEffect, useState } from 'react';
import { Checkbox } from '@heroui/react';

/**
 * Checkbox VISUAL do modo de seleção das TABELAS/LISTAS. Entra com animação
 * (scale + fade, 180ms) quando o card passa a renderizá-lo ao entrar em
 * selectMode — como monta junto com a transição para o selectMode, a animação
 * de entrada dispara no mount.
 *
 * É só marca visual: NÃO tem onChange. O card inteiro faz o toggle (onClick no
 * card chama `toggle(id)`); este componente apenas reflete `checked`. Por isso
 * o `Checkbox` do HeroUI v3 é renderizado como `isReadOnly` + `pointer-events-none`,
 * pra o clique atravessar até o card sem o próprio checkbox interceptar/togglar.
 *
 * Construído sobre o `Checkbox` do HeroUI v3 (compound: Root + Content + Control
 * + Indicator), mesmo padrão do `FilterCheckbox`. O `Checkbox.Indicator` sem
 * children já renderiza o checkmark SVG do HeroUI.
 *
 * API PÚBLICA mantida idêntica à versão anterior (`checked` + `className`) pra
 * nenhum call site precisar mudar.
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
        'inline-grid shrink-0 place-items-center transition-all duration-[180ms] ease-out will-change-transform',
        entered ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        className ?? '',
      ].join(' ')}
    >
      <Checkbox
        isSelected={checked}
        isReadOnly
        aria-hidden
        className="pointer-events-none"
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>
    </span>
  );
}
