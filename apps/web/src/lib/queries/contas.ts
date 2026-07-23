import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';

/**
 * FASE RBAC — multi-conta / alternar empresa ativa (client side).
 *
 * Espelha GET /session/companies e POST /session/switch-company. Um usuário pode
 * ser membro de várias empresas (userCompany); a sessão guarda a empresa ATIVA,
 * e trocar recarrega todos os módulos (é troca de tenant).
 */

/**
 * Shape achatado que a UI consome. O backend devolve aninhado
 * ({ company: {...}, role: {...} | null, active }); normalizamos aqui pra
 * facilitar o consumo no <CompanySwitcher>.
 */
export interface MinhaConta {
  companyId: string;
  name: string;
  logoUrl?: string | null;
  roleCode: string | null;
  roleName: string | null;
  active: boolean;
}

/** Linha crua de GET /session/companies (formato aninhado do backend). */
interface CompaniesRow {
  company: { id: string; name: string; logoUrl?: string | null };
  role: { code: string; name: string } | null;
  active: boolean;
}

const CONTAS_KEY = ['session', 'companies'] as const;

/**
 * Carrega as empresas do usuário logado, marcando a ativa. Cacheado com folga —
 * membership muda raramente. `select` achata o formato aninhado do backend.
 */
export function useMinhasContas() {
  return useQuery({
    queryKey: CONTAS_KEY,
    queryFn: () => api.get<{ data: CompaniesRow[] }>('/session/companies'),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
    select: (res): MinhaConta[] =>
      res.data.map((row) => ({
        companyId: row.company.id,
        name: row.company.name,
        logoUrl: row.company.logoUrl ?? null,
        roleCode: row.role?.code ?? null,
        roleName: row.role?.name ?? null,
        active: row.active,
      })),
  });
}

/**
 * Alterna a empresa ativa da sessão (POST /session/switch-company).
 *
 * onSuccess derruba TODO o cache do React Query (queryClient.clear()) porque a
 * troca é de tenant — permissões, features, listas, tudo precisa recarregar do
 * zero. A NAVEGAÇÃO fica a cargo de quem chama: passe `onSwitched` no
 * `mutate({ companyId }, { onSuccess: onSwitched })`, ou use o callback exposto
 * pela UI (o <CompanySwitcher> navega pra /painel).
 */
export function useSwitchCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (companyId: string) =>
      api.post<unknown>('/session/switch-company', { companyId }),
    onSuccess: () => {
      // Troca de tenant → invalida absolutamente tudo. clear() é o mais seguro:
      // remove queries e cache, forçando refetch limpo em todos os módulos.
      queryClient.clear();
      toastSuccess('Empresa ativa alterada');
    },
  });
}
