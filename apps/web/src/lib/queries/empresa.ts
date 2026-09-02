import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { BusinessHoursDay } from './agendamento-online';

/** Contact + address details persisted inside Company.addressJson. */
export interface CompanyAddress {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  whatsapp?: string | null;
  cep?: string | null;
  district?: string | null;
  number?: string | null;
  state?: string | null;
  city?: string | null;
  /** Tipo de pessoa: 'PJ' | 'PF'. */
  personType?: string | null;
}

/** The salon company as returned by GET /companies/current. */
export interface Empresa {
  id: string;
  name: string;
  legalName?: string | null;
  cnpj?: string | null;
  logoUrl?: string | null;
  timezone: string;
  currency: string;
  addressJson?: CompanyAddress | null;
  // Horário semanal do salão (mesmo dado editado em Marketing → Agendamento
  // Online). 7 linhas quando preenchido; null/ausente quando nunca configurado.
  businessHoursJson?: BusinessHoursDay[] | null;
  // Liga o atendimento por horário da IA (estudo 169). Ter horário salvo é uma
  // coisa; a IA operar por ele é outra — por isso é flag separada.
  businessHoursActive?: boolean;
  active: boolean;
}

/** Fields the Configurações form is allowed to PATCH. */
export interface UpdateEmpresaBody {
  name?: string;
  legalName?: string | null;
  cnpj?: string | null;
  logoUrl?: string | null;
  timezone?: string;
  currency?: string;
  addressJson?: CompanyAddress;
  // Horário semanal (o backend normaliza para 7 linhas) e o liga/desliga da IA.
  businessHours?: BusinessHoursDay[];
  businessHoursActive?: boolean;
}

const COMPANY_KEY = ['company'] as const;

/** Loads the logged-in salon's company record. */
export function useEmpresa() {
  return useQuery({
    queryKey: COMPANY_KEY,
    queryFn: () => api.get<Empresa>('/companies/current'),
  });
}

/** Updates the company and refreshes the cached record on success. */
export function useUpdateEmpresa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEmpresaBody) =>
      api.patch<Empresa>('/companies/current', body),
    onSuccess: (data) => {
      queryClient.setQueryData(COMPANY_KEY, data);
      void queryClient.invalidateQueries({ queryKey: COMPANY_KEY });
    },
  });
}
