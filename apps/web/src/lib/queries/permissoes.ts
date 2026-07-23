import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';

/**
 * FASE RBAC — permissões GRANULARES por funcionário (editor da página
 * Profissionais). Espelha os endpoints do backend (todos escopados na empresa
 * ativa da sessão):
 *
 *   GET  /permissions/catalog        -> catálogo de categorias/itens granulares
 *   GET  /users/:id/permissions      -> permissões efetivas do funcionário
 *   PUT  /users/:id/permissions      -> salva o set granular (vazio = herda papel)
 *
 * `:id` é o USER id — ou seja, `professional.userId`. Um profissional sem login
 * (userId nulo) NÃO tem permissões: gere o acesso primeiro.
 */

/** Um item granular dentro de uma categoria do catálogo. */
export interface PermissionCatalogItem {
  key: string;
  label: string;
  description?: string;
  /** true = renderizar como toggle/radio secundário (modificador). */
  modifier?: boolean;
  /** Itens com o mesmo `group` são radios mutuamente exclusivos de escopo. */
  group?: string;
}

/** Uma categoria (bloco) do catálogo de permissões. */
export interface PermissionCatalogCategory {
  key: string;
  label: string;
  description: string;
  items: PermissionCatalogItem[];
}

/** Resposta de GET /permissions/catalog. */
export interface PermissionCatalog {
  categories: PermissionCatalogCategory[];
}

/** Resposta de GET /users/:id/permissions. */
export interface UserPermissions {
  permissions: string[];
  roleCode: string | null;
  /** false = herdado do papel (ainda não customizado). */
  customized: boolean;
}

const CATALOG_KEY = ['permissions', 'catalog'] as const;

/**
 * Carrega o catálogo de permissões granulares. Estático por natureza — cacheado
 * com folga (staleTime alto). O backend agrupa os itens por categoria.
 */
export function usePermissionCatalog() {
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: () => api.get<PermissionCatalog>('/permissions/catalog'),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
  });
}

/**
 * Carrega as permissões efetivas de UM funcionário (por userId). Desabilitada
 * quando o profissional ainda não tem login (userId nulo) — nesse caso não há
 * permissões a configurar até gerar o acesso.
 */
export function useUserPermissions(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['users', userId, 'permissions'],
    queryFn: () => api.get<UserPermissions>(`/users/${userId}/permissions`),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

/**
 * Salva o set granular de permissões de um funcionário. Enviar um array vazio
 * faz o funcionário voltar a herdar as permissões do papel (customized:false).
 */
export function useSaveUserPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissions }: { userId: string; permissions: string[] }) =>
      api.put<UserPermissions>(`/users/${userId}/permissions`, { permissions }),
    onSuccess: (_data, { userId }) => {
      qc.invalidateQueries({ queryKey: ['users', userId, 'permissions'] });
      // As permissões da própria sessão podem mudar (se editou a si mesmo).
      qc.invalidateQueries({ queryKey: ['session', 'permissions'] });
      toastSuccess('Permissões salvas');
    },
  });
}
