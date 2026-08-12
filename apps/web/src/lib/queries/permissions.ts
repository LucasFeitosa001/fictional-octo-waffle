import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

/**
 * FASE RBAC — permissões da empresa ativa (client side).
 *
 * Espelha GET /session/permissions no backend. Cada permissão é uma chave
 * "recurso:acao" (ex.: "financeiro:manage"). O owner recebe ['*'] — curinga que
 * libera tudo.
 *
 * IMPORTANTE: diferente de features (por PLANO, fail-OPEN), RBAC é por PAPEL e
 * fail-CLOSED — durante loading/erro `can()` retorna false. Gating de RBAC é
 * sobre o que o usuário PODE fazer; na dúvida, esconder é mais seguro.
 */

/** Shape retornado por GET /session/permissions. */
export interface PermissionsResponse {
  permissions: string[];
}

const PERMISSIONS_KEY = ['session', 'permissions'] as const;

/**
 * Carrega as permissões da empresa ativa. Cacheado com folga — o papel do
 * usuário muda raramente, então um staleTime alto evita refetch a cada
 * navegação. Ao trocar de empresa a sessão é invalidada (ver useSwitchCompany),
 * então o cache é derrubado junto.
 */
export function usePermissions() {
  return useQuery({
    queryKey: PERMISSIONS_KEY,
    queryFn: () => api.get<PermissionsResponse>('/session/permissions'),
    staleTime: 5 * 60_000, // 5 min: papel muda raramente
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

/** Retorno de useCan(): a função `can` + o estado de carregamento da query. */
export interface UseCanResult {
  /** Verdadeiro se a lista contém '*' (owner) ou a própria `key`. */
  can: (key: string) => boolean;
  isLoading: boolean;
}

/**
 * Retorna `can(key)` para checar permissões imperativamente (handlers, guards).
 *
 * Regra:
 *   - lista contém '*'  → true (owner)
 *   - lista contém key  → true
 *   - senão             → false
 *
 * FAIL-CLOSED: enquanto carrega OU em erro, `can()` retorna false. Para gating
 * de AÇÃO isso é o correto (na dúvida, não permite). Para gating de UI, prefira
 * checar `isLoading` e ESCONDER durante o loading em vez de piscar o fallback —
 * é o que <Can> faz.
 */
export function useCan(): UseCanResult {
  const { data, isLoading } = usePermissions();

  function can(key: string): boolean {
    const list = data?.permissions;
    if (!list) return false; // fail-closed: sem dados → nega
    if (list.includes('*')) return true; // owner
    return list.includes(key);
  }

  return { can, isLoading };
}
