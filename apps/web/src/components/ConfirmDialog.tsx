import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconAlertTriangle, IconX } from './icons';

// ─── Modal de confirmação (spec Belasis: overlay fade + card scale 0.96→1) ──
// API: const confirm = useConfirm(); await confirm({title, message, ...}) → boolean
export type ConfirmOpts = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;      // true = botão de confirmar vermelho (excluir), false = azul/primário
};

type Ctx = (opts: ConfirmOpts) => Promise<boolean>;
const ConfirmCtx = createContext<Ctx | null>(null);

export function useConfirm(): Ctx {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('useConfirm precisa do <ConfirmProvider>');
  return c;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const [show, setShow] = useState(false); // controla animate in/out
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const open: Ctx = useCallback((o) => new Promise<boolean>((resolve) => {
    resolveRef.current = resolve;
    setOpts(o);
    // próximo frame — dispara transição de 0→1
    requestAnimationFrame(() => setShow(true));
  }), []);

  const close = useCallback((result: boolean) => {
    setShow(false);
    // deixa a animação de saída completar antes de desmontar
    window.setTimeout(() => {
      setOpts(null);
      resolveRef.current?.(result);
      resolveRef.current = null;
    }, 180);
  }, []);

  // Esc = cancelar
  useEffect(() => {
    if (!opts) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [opts, close]);

  return (
    <ConfirmCtx.Provider value={open}>
      {children}
      {opts ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" role="dialog" aria-modal="true">
          {/* overlay — fade 150ms */}
          <div
            className={`absolute inset-0 bg-black/50 transition-opacity duration-150 ${show ? 'opacity-100' : 'opacity-0'}`}
            onClick={() => close(false)}
          />
          {/* card — scale 0.96→1 + fade 180ms */}
          <div
            className={[
              'relative w-full max-w-sm rounded-[10px] border border-line bg-card p-5 shadow-xl',
              'transition-[opacity,transform] duration-[180ms] ease-out will-change-transform',
              show ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.96]',
            ].join(' ')}
          >
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => close(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-ink hover:bg-canvas hover:text-ink"
            >
              <IconX size={16} />
            </button>
            <div className="mb-3 flex items-start gap-3">
              <span
                className={[
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                  opts.danger ? 'bg-[color-mix(in_oklab,var(--sp-danger,#FF5B5B)_15%,transparent)] text-[var(--sp-danger,#FF5B5B)]'
                              : 'bg-[color-mix(in_oklab,var(--sp-primary)_15%,transparent)] text-primary',
                ].join(' ')}
              >
                <IconAlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ink">{opts.title}</h3>
                {opts.message ? (
                  <div className="mt-1 text-sm text-muted-ink">{opts.message}</div>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
              >
                {opts.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-semibold text-white',
                  opts.danger
                    ? 'bg-[var(--sp-danger,#FF5B5B)] hover:brightness-95'
                    : 'bg-primary hover:brightness-95',
                ].join(' ')}
                autoFocus
              >
                {opts.confirmLabel ?? (opts.danger ? 'Excluir' : 'Confirmar')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmCtx.Provider>
  );
}
