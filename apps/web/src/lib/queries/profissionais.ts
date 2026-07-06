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
}

/** A single weekly working-hours row. weekday: 0=domingo … 6=sábado. */
export interface ProfessionalScheduleRow {
  weekday: number;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

/** Professional with its included relations (GET /professionals/:id). */
export interface ProfessionalDetail extends Professional {
  schedules?: ProfessionalScheduleRow[];
  services?: { serviceId: string }[];
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  });
}

export function useDeleteProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<Professional>(`/professionals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['professionals'] }),
  });
}
