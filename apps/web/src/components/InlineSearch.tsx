import { useEffect, useRef } from 'react';
import { Button } from '@heroui/react';
import { IconSearch, IconX } from './icons';

interface InlineSearchProps {
  /** Aberto = mostra o input; fechado = mostra o botão "Buscar". Controlado. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Termo de busca (controlado). */
  value: string;
  onValueChange: (value: string) => void;
  /** Placeholder + aria-label do input. */
  placeholder?: string;
  /** Rótulo do botão fechado. */
  label?: string;
  /** Breakpoint em que a busca inline aparece (desktop). Default 'md'. */
  breakpoint?: 'md' | 'lg';
  /** Largura do slot quando aberto/fechado (classe Tailwind). */
  openWidth?: string;
  closedWidth?: string;
  /** Chamado ao fechar, depois de limpar o termo — ex.: resetar paginação. */
  onClose?: () => void;
  /**
   * Opcional: chamado ao pressionar Enter. Use quando a busca é aplicada
   * explicitamente (ex.: query no servidor) em vez de reativa a cada tecla.
   */
  onSubmit?: () => void;
}

/**
 * Busca inline da toolbar (padrão único de todas as listagens).
 *
 * O input e o botão "Buscar" dividem o MESMO slot, empilhados. Ao abrir, o slot
 * expande (closedWidth → openWidth) e faz cross-fade do botão para o input; ao
 * fechar, o slot encolhe de volta e o botão reaparece no mesmo lugar — uma
 * transição fluida de LARGURA (o input "vira" o botão), não um simples fade, e
 * sem empurrar a tabela pra baixo. Fecha com Esc, com o X, ou ao perder o foco
 * com o campo vazio; foca o input automaticamente ao abrir.
 */
export function InlineSearch({
  open,
  onOpenChange,
  value,
  onValueChange,
  placeholder = 'Buscar',
  label = 'Buscar',
  breakpoint = 'md',
  openWidth = 'w-[240px]',
  closedWidth = 'w-[100px]',
  onClose,
  onSubmit,
}: InlineSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    onValueChange('');
    onOpenChange(false);
    onClose?.();
  };

  const wrapperShow = breakpoint === 'lg' ? 'hidden lg:block' : 'hidden md:block';

  return (
    <div
      className={[
        'relative h-9',
        wrapperShow,
        'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        open ? openWidth : closedWidth,
      ].join(' ')}
    >
      {/* Input — por cima quando aberto */}
      <div
        className={[
          'absolute inset-0 flex items-center overflow-hidden rounded-lg border bg-card transition-opacity duration-200',
          open ? 'border-primary opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      >
        <IconSearch
          size={16}
          className="pointer-events-none absolute left-3 text-muted-ink"
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'Enter' && onSubmit) onSubmit();
          }}
          onBlur={() => {
            if (!value.trim()) close();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-full w-full bg-transparent pl-9 pr-9 text-sm text-foreground outline-none placeholder:text-muted-ink"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={close}
          aria-label="Fechar busca"
          className="absolute right-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-ink transition-colors hover:bg-canvas hover:text-foreground"
        >
          <IconX size={14} />
        </button>
      </div>
      {/* Botão "Buscar" — por baixo; visível quando fechado */}
      <Button
        variant="outline"
        className={[
          'absolute inset-0 w-full transition-opacity duration-200',
          open ? 'pointer-events-none opacity-0' : 'opacity-100',
        ].join(' ')}
        onClick={() => onOpenChange(true)}
        aria-expanded={open}
      >
        <IconSearch size={16} /> {label}
      </Button>
    </div>
  );
}
