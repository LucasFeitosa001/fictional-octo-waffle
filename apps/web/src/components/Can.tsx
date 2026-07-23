import type { ReactNode } from 'react';
import { useCan } from '../lib/queries/permissions';

/**
 * FASE RBAC — gating por PAPEL (client side).
 *
 * <Can perm="financeiro:manage"> renderiza os filhos só quando o papel do
 * usuário na empresa ativa concede a permissão. Senão renderiza `fallback`
 * (por padrão null — some da tela).
 *
 * `perm` aceita string ou string[] — no caso de array a regra é OR (basta UMA
 * permissão bater). Owner (permissões = ['*']) sempre passa.
 *
 * NÃO confunda com <FeatureGate>, que é por PLANO e fail-OPEN. Aqui é por PAPEL
 * e fail-CLOSED: enquanto as permissões carregam OU se a query erra, o conteúdo
 * NÃO aparece. Como decidimos esconder (fallback) durante o loading, a UI não
 * pisca — só materializa quando temos certeza de que o acesso é permitido.
 */
export interface CanProps {
  /** Permissão (ou lista, avaliada como OR) exigida para ver os filhos. */
  perm: string | string[];
  children: ReactNode;
  /** UI mostrada quando falta permissão (ou durante loading). Padrão: null. */
  fallback?: ReactNode;
}

export function Can({ perm, children, fallback = null }: CanProps) {
  const { can } = useCan();
  const perms = Array.isArray(perm) ? perm : [perm];
  const allowed = perms.some((p) => can(p));
  if (allowed) return <>{children}</>;
  return <>{fallback}</>;
}
