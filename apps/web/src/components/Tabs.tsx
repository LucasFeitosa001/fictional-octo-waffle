import { useEffect, useRef } from 'react';

/**
 * Tabs PADRÃO do app — use este componente em TODA aba nova.
 *
 * Motivo de existir: as abas eram reimplementadas em cada tela (30 arquivos) com
 * um container `flex` sem rolagem. No mobile, com 4+ abas, os itens espremiam,
 * quebravam linha ou vazavam da viewport, e não dava para arrastar. Aqui a barra
 * é um CARROSSEL horizontal: arrasta com o dedo, encaixa na aba (snap) e nunca
 * corta um item pela metade.
 *
 * Duas variantes visuais, iguais às que já existiam no projeto:
 *  - `underline` (padrão): sublinhado na aba ativa, sobre uma linha de base.
 *  - `pill`: pílulas dentro de uma caixa arredondada.
 *
 * O padding lateral do mobile vem do DashboardLayout (px-3); por isso a barra
 * sangra com `-mx-3 px-3` em vez de criar padding próprio.
 */
export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  /** Contador opcional ao lado do rótulo (ex.: quantidade de itens). */
  badge?: React.ReactNode;
}

interface TabsProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: 'underline' | 'pill';
  className?: string;
  'aria-label'?: string;
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  variant = 'underline',
  className,
  'aria-label': ariaLabel,
}: TabsProps<T>) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // A aba ativa nunca pode nascer fora da área visível — acontece quando a
  // seleção vem da URL/estado e ela está no fim do carrossel.
  useEffect(() => {
    const el = activeRef.current;
    const scroller = scrollerRef.current;
    if (!el || !scroller) return;
    const frame = requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  const isPill = variant === 'pill';

  return (
    <div
      ref={scrollerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={[
        // Carrossel: arrasta no mobile, sem barra de rolagem, sem puxar a página.
        'flex flex-nowrap items-center overflow-x-auto overscroll-x-contain scrollbar-none',
        'snap-x snap-mandatory scroll-smooth',
        // Sangra até a borda no mobile (o padding lateral é do DashboardLayout).
        '-mx-3 px-3 sm:mx-0 sm:px-0',
        isPill
          ? 'gap-1 rounded-lg border border-[var(--color-soft-border)] bg-canvas p-0.5 text-sm'
          : 'gap-6 border-b border-line',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            ref={active ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={[
              'shrink-0 snap-start whitespace-nowrap transition-colors',
              isPill
                ? [
                    'rounded-md px-3 py-1.5 font-medium',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-ink hover:text-ink',
                  ].join(' ')
                : [
                    '-mb-px border-b-2 px-1 pb-2.5 pt-1 text-sm font-medium',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-ink hover:text-ink',
                  ].join(' '),
            ].join(' ')}
          >
            {item.label}
            {item.badge != null && (
              <span className="ml-1.5 rounded-full bg-canvas px-1.5 text-[11px] font-semibold text-muted-ink">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
