import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import { IconChevron, IconWallet } from './icons';

/**
 * Botão "Pagar comissões" com as duas opções da referência:
 * **Pagar** (o salão pagou por fora e está registrando) e **Pagar com
 * SalonPay** (o meio de recebimento do próprio produto).
 *
 * Menu em vez de dois botões porque o segundo caminho é o excepcional — e
 * porque é assim que a referência faz.
 */
export function PagarComissoesMenu({
  label,
  disabled,
  onPagar,
  onSalonPay,
}: {
  label: string;
  disabled?: boolean;
  onPagar: () => void;
  onSalonPay: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora / Esc — sem isto o menu fica preso aberto por cima da
  // tabela e a pessoa não consegue voltar.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="primary"
        isDisabled={disabled}
        onPress={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IconWallet size={16} />
        {label}
        <IconChevron size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </Button>

      {/* Animação padrão de dropdown do projeto: 200ms, opacity + translate +
          scale, e pointer-events desligado quando fechado. */}
      <div
        role="menu"
        className={[
          'absolute bottom-full right-0 z-30 mb-2 w-60 origin-bottom-right rounded-xl border border-[var(--color-soft-border)] bg-warm-white p-1 shadow-[var(--shadow-card)]',
          'transition-all duration-200 ease-out',
          open
            ? 'translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-1 scale-95 opacity-0',
        ].join(' ')}
      >
        <MenuItem
          onClick={() => {
            setOpen(false);
            onPagar();
          }}
        >
          Pagar
        </MenuItem>
        <MenuItem
          onClick={() => {
            setOpen(false);
            onSalonPay();
          }}
        >
          Pagar com SalonPay
        </MenuItem>
      </div>
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-cream"
    >
      {children}
    </button>
  );
}
