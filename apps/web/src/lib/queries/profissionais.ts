import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { Professional } from '../types';

export interface ProfessionalBody {
  name: string;
  nickname?: string;
  phone?: string;
  profession?: string;
  avatarUrl?: string | null;
  birthday?: string;
  onlineBookable?: boolean;
  notifyWhatsapp?: boolean;
  active?: boolean;
  // Dados cadastrais adicionais (Onda 7).
  document?: string;
  rg?: string;
  notes?: string;
  position?: string;
  receivesCommission?: boolean;
  generateSchedule?: boolean;
  // Endereço embutido (Onda 7).
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  zip?: string;
}

/** Read shape for the Onda-7 cadastral + address fields the detail endpoint returns. */
export interface ProfessionalExtraFields {
  document?: string | null;
  rg?: string | null;
  notes?: string | null;
  position?: string | null;
  receivesCommission?: boolean;
  generateSchedule?: boolean;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

/** A single weekly working-hours row. weekday: 0=domingo … 6=sábado. */
export interface ProfessionalScheduleRow {
  weekday: number;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

/** A single individual commission rule (Belasis "Configurar comissões"). */
export interface ProfessionalCommissionRuleRow {
  id?: string;
  scopeType: 'service' | 'product' | 'category' | 'all';
  scopeId?: string | null;
  type: 'percent' | 'fixed';
  /** Decimal serialized as string on read; number accepted on write. */
  value: string | number;
}

/** Professional with its included relations (GET /professionals/:id). */
export interface ProfessionalDetail extends Professional, ProfessionalExtraFields {
  schedules?: ProfessionalScheduleRow[];
  services?: { serviceId: string }[];
  commissionRules?: ProfessionalCommissionRuleRow[];
}

/** Replaces the professional's individual commission rules (PUT /professionals/:id/commission-rules). */
export function useSetProfessionalCommissionRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rules }: { id: string; rules: ProfessionalCommissionRuleRow[] }) =>
      api.put<ProfessionalDetail>(`/professionals/${id}/commission-rules`, rules),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['professionals'] });
      qc.invalidateQueries({ queryKey: ['professional', id] });
    },
  });
}

/** Replaces the full set of services a professional performs (PUT /professionals/:id/services). */
export function useSetProfessionalServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, serviceIds }: { id: string; serviceIds: string[] }) =>
      api.put<ProfessionalDetail>(`/professionals/${id}/services`, { serviceIds }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['professionals'] });
      qc.invalidateQueries({ queryKey: ['professional', id] });
    },
  });
}

/** Loads a single professional including its schedules (for the edit modal). */
export function useProfessionalDetail(id: string | null | undefined) {
  return useQuery({
    queryKey: ['professional', id],
    queryFn: () => api.get<ProfessionalDetail>(`/professionals/${id}`),
    enabled: Boolean(id),
  });
}

/** Replaces the full weekly schedule for a professional (PUT /professionals/:id/schedules). */
export function useSetProfessionalSchedules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, schedules }: { id: string; schedules: ProfessionalScheduleRow[] }) =>
      api.put<ProfessionalDetail>(`/professionals/${id}/schedules`, schedules),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['professionals'] });
      qc.invalidateQueries({ queryKey: ['professional', id] });
    },
  });
}

export function useCreateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfessionalBody) => api.post<Professional>('/professionals', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  });
}

export function useUpdateProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<ProfessionalBody> }) =>
      api.patch<Professional>(`/professionals/${id}`, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['professionals'] });
      // Invalidate the detail query too so the open drawer picks up
      // side-effect PATCHes like an inline avatar upload.
      qc.invalidateQueries({ queryKey: ['professional', id] });
    },
  });
}

export function useDeleteProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Professional>(`/professionals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  });
}
