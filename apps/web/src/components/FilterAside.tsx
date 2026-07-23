import type { ReactNode } from 'react';

/**
 * Painel de filtros lateral para páginas de listagem.
 *
 * - Desktop (breakpoint+): desliza da ESQUERDA da tabela ao abrir e recolhe ao
 *   fechar (largura anima 0 ↔ 16rem, com translate-x + opacity para ficar fluido).
 * - Abaixo do breakpoint: colapsa em altura (aparece acima da lista) — ou some,
 *   se `desktopOnly` (quando a página tem um `<Drawer>` bottom-sheet próprio).
 *
 * Fica SEMPRE montado (não usar `{open && <FilterAside/>}`) — é o que permite
 * animar tanto a entrada quanto a saída. Coloque-o como PRIMEIRO filho de um
 * container `flex flex-col gap-4 <bp>:flex-row`, seguido pela tabela/lista num
 * `<div className="min-w-0 flex-1">`.
 */
export function FilterAside({
  open,
  children,
  width,
  className = '',
  desktopOnly = false,
  breakpoint = 'lg',
}: {
  open: boolean;
  children: ReactNode;
  /** Largura do painel no desktop (default `<bp>:w-64` = 256px). */
  width?: string;
  /** Classes extra no cartão interno. */
  className?: string;
  /**
   * Só renderiza no desktop. Use quando a página mantém um `<Drawer>`
   * bottom-sheet próprio para o filtro no mobile.
   */
  desktopOnly?: boolean;
  /** Breakpoint em que o painel vira lateral (default `lg`). Páginas cujo
   * botão "Filtrar" aparece em `md+` devem passar `md`. */
  breakpoint?: 'md' | 'lg';
}) {
  // Classes por breakpoint precisam ser literais (JIT do Tailwind).
  const bp =
    breakpoint === 'md'
      ? { hide: 'hidden md:block', closed: 'md:max-h-none md:w-0', defW: 'md:w-64' }
      : { hide: 'hidden lg:block', closed: 'lg:max-h-none lg:w-0', defW: 'lg:w-64' };
  const w = width ?? bp.defW;
  return (
    <aside
      aria-hidden={!open}
      className={[
        desktopOnly ? bp.hide : '',
        'shrink-0 self-start origin-left overflow-hidden',
        'transition-[width,max-height,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        open
          ? `max-h-[2000px] w-full translate-x-0 opacity-100 ${w}`
          : `pointer-events-none max-h-0 w-full -translate-x-3 opacity-0 ${bp.closed}`,
      ].join(' ')}
    >
      <div className={`w-full rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)] ${w} ${className}`}>
        {children}
      </div>
    </aside>
  );
}
