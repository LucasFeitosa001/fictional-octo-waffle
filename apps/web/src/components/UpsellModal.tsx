import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import { IconAlertTriangle, IconX } from './icons';

/**
 * Modal de upsell para funcionalidades não contratadas.
 *
 * Espelha o padrão do Belasis: cabeçalho com abas desabilitadas (para dar
 * contexto do módulo), alerta laranja explicando que a funcionalidade não
 * está contratada, thumbnail de vídeo demonstrativo e CTAs
 * (Fechar / Contratar).
 *
 * Uso típico: bloquear a rota inteira quando um flag de tenant
 * (ex.: tenant.features.nfse) estiver desativado.
 */
export interface UpsellModalProps {
  /** Título grande no topo do card. */
  title: string;
  /** Abas do módulo, renderizadas desabilitadas apenas como contexto visual. */
  tabs?: string[];
  /**
   * Texto do alerta laranja. Default: "Funcionalidade não contratada".
   * Pode ser sobrescrito para módulos com wording específico.
   */
  alertText?: ReactNode;
  /** Texto abaixo do thumbnail — descrição curta do que a integração faz. */
  children?: ReactNode;
  /** Handler do botão Fechar (ghost). Se ausente, o botão fica oculto. */
  onClose?: () => void;
  /** Handler do botão Contratar (primary). */
  onContract?: () => void;
}

/** IconPlay inline — não existe em icons.tsx e é usado só aqui. */
function IconPlay({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

export function UpsellModal({
  title,
  tabs = ['NFS-e', 'NFC-e', 'Configurações'],
  alertText = 'Funcionalidade não contratada',
  children,
  onClose,
  onContract,
}: UpsellModalProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Overlay — clique fora fecha (se houver handler). */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Card do modal */}
      <div className="relative w-full max-w-xl rounded-[10px] border border-[var(--color-soft-border)] bg-warm-white shadow-xl">
        {onClose && (
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-md p-1 text-muted hover:bg-cream hover:text-foreground"
          >
            <IconX size={16} />
          </button>
        )}

        {/* Header: título + abas desabilitadas (contexto do módulo) */}
        <div className="border-b border-[var(--color-soft-border)] px-5 pb-4 pt-5">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {tabs.length > 0 && (
            <div className="mt-3 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
              {tabs.map((t) => (
                <span
                  key={t}
                  aria-disabled
                  className="h-8 shrink-0 cursor-not-allowed rounded-full border border-[var(--color-soft-border)] bg-cream/50 px-4 text-sm font-medium leading-8 text-muted opacity-60"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 px-5 py-5">
          {/* Alerta laranja */}
          <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            <IconAlertTriangle size={18} />
            <span className="font-medium">{alertText}</span>
          </div>

          {/* Thumbnail simulado de vídeo demonstrativo */}
          <div className="flex h-40 items-center justify-center rounded-lg bg-black text-white">
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
                <IconPlay size={32} />
              </div>
              <span className="text-xs text-white/70">
                Vídeo da funcionalidade
              </span>
            </div>
          </div>

          {children && <div className="text-sm text-muted">{children}</div>}
        </div>

        {/* Footer com CTAs */}
        <div className="flex flex-col gap-2 border-t border-[var(--color-soft-border)] px-5 py-4 sm:flex-row sm:justify-end">
          {onClose && (
            <Button
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={onClose}
            >
              Fechar
            </Button>
          )}
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            onClick={onContract}
          >
            Contratar
          </Button>
        </div>
      </div>
    </div>
  );
}
