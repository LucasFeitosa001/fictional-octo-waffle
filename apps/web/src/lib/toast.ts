import { toast } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';

/**
 * Feedback centralizado via Toast do HeroUI v3.
 *
 * A função `toast` do HeroUI é global (usa uma fila singleton), então pode ser
 * chamada de qualquer lugar — hooks, MutationCache, event handlers — desde que
 * o `<ToastProvider />` esteja montado no root (ver src/main.tsx). Reexportamos
 * daqui para ter um único ponto de entrada em pt-BR.
 *
 *   import { toast } from '@/lib/toast';
 *   toast.success('Cliente salvo');
 *   toast.danger('Não foi possível salvar');
 */
export { toast };

/** Duração padrão dos toasts (ms). ~4s conforme a UX pedida. */
export const TOAST_TIMEOUT = 4000;

/**
 * Extrai uma mensagem humana de um erro de API. `ApiError.message` pode vir como
 * string ou string[] (validação do Nest), então normalizamos ambos.
 */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const bodyMsg = error.body?.message;
    if (Array.isArray(bodyMsg) && bodyMsg.length > 0) return bodyMsg[0];
    if (typeof bodyMsg === 'string' && bodyMsg.trim()) return bodyMsg;
    if (error.message && error.message.trim()) return error.message;
    return 'Não foi possível concluir a operação';
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Ocorreu um erro inesperado';
}

/**
 * Handler global de erro para mutations. Dispara um toast de erro com a mensagem
 * da `ApiClientError`. Ligado no `MutationCache` do QueryClient (src/main.tsx),
 * cobrindo TODAS as mutations de uma vez sem tocar em páginas.
 */
export function toastMutationError(error: unknown): void {
  toast.danger(apiErrorMessage(error), { timeout: TOAST_TIMEOUT });
}

/** Atalho para toasts de sucesso com a duração padrão do app. */
export function toastSuccess(message: string): string {
  return toast.success(message, { timeout: TOAST_TIMEOUT });
}
