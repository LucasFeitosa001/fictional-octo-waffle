import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';

/**
 * FASE RBAC — gestão de usuários e papéis da empresa ativa (client side).
 *
 * Espelha os endpoints do backend (todos escopados na empresa ativa da sessão):
 *   GET   /users            -> membros da empresa
 *   POST  /users            -> cria/convida usuário
 *   PATCH /users/:id/role   -> troca o papel do usuário
 *   GET   /roles            -> papéis da empresa (padrão + customizados)
 *
 * Criar/editar exige a permissão 'usuarios:manage' no backend (RequirePermission);
 * a UI espelha isso escondendo as ações com <Can perm="usuarios:manage">.
 */

/** Um usuário (membro) da empresa — shape retornado por GET /users. */
export interface Usuario {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  active: boolean;
  /** Provedor de login (credenciais/google…). Não editável por aqui. */
  provider?: string;
}

/** Um papel da empresa — shape retornado por GET /roles. */
export interface Role {
  id: string;
  /** Código estável (owner|manager|receptionist|finance|professional|…). */
  code: string;
  name: string;
  /** Papéis padrão semeados pelo sistema (não editáveis/removíveis). */
  isSystem: boolean;
}

/** Corpo de POST /users. `password` é exigido pelo backend (mín. 6). */
export interface CreateUsuarioBody {
  name: string;
  email: string;
  password?: string;
  generatePassword?: boolean;
  phone?: string;
  roleId?: string;
}

export interface CreatedUsuario extends Usuario {
  professionalId?: string | null;
  /** Só existe quando o backend gerou a senha; nunca volta em leituras futuras. */
  temporaryPassword?: string;
}

const USUARIOS_KEY = ['users'] as const;
const ROLES_KEY = ['roles'] as const;

/**
 * Lista os membros da empresa ativa. O backend devolve `{ data, page, ... }`;
 * `select` achata para o array que a tabela consome.
 */
export function useUsuarios() {
  return useQuery({
    queryKey: USUARIOS_KEY,
    queryFn: () => api.get<{ data: Usuario[] }>('/users'),
    select: (res) => res.data,
    staleTime: 60_000,
  });
}

/**
 * Lista os papéis da empresa ativa (para o seletor de papel). Cacheado com folga
 * — papéis mudam raramente. Achata o `{ data }` do backend.
 */
export function useRoles() {
  return useQuery({
    queryKey: ROLES_KEY,
    queryFn: () => api.get<{ data: Role[] }>('/roles'),
    select: (res) => res.data,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/** Cria/convida um usuário na empresa ativa (POST /users). */
export function useCreateUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUsuarioBody) =>
      api.post<CreatedUsuario>('/users', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USUARIOS_KEY });
      toastSuccess('Usuário criado');
    },
  });
}

/** Cria login + senha e vincula imediatamente a um Professional existente. */
export function useCreateProfessionalAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      professionalId,
      ...body
    }: {
      professionalId: string;
      email: string;
      password?: string;
      generatePassword?: boolean;
      roleId?: string;
    }) =>
      api.post<CreatedUsuario>(
        `/users/professional/${professionalId}`,
        body,
      ),
    onSuccess: (_saved, variables) => {
      void qc.invalidateQueries({ queryKey: USUARIOS_KEY });
      void qc.invalidateQueries({ queryKey: ['professionals'] });
      void qc.invalidateQueries({
        queryKey: ['professional', variables.professionalId],
      });
      toastSuccess('Acesso criado');
    },
  });
}

/** Troca o papel de um usuário na empresa ativa (PATCH /users/:id/role). */
export function useUpdateUsuarioRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string }) =>
      api.patch<{ userId: string; roleId: string }>(`/users/${id}/role`, { roleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USUARIOS_KEY });
      toastSuccess('Papel atualizado');
    },
  });
}
