import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// ===================== Business hours =====================
// Weekly opening hours of the salon, persisted on Company.businessHoursJson via
// the marketing module. Always 7 rows (Sunday → Saturday) so the editor renders
// fixed rows; a closed day keeps its start/end as a placeholder.
export interface BusinessHoursDay {
  weekday: number; // 0 = Sunday … 6 = Saturday
  open: boolean;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export interface BusinessHoursResponse {
  days: BusinessHoursDay[];
}

// Sunday-first labels, matching the weekday indices the backend normalizes to.
export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;

const BUSINESS_HOURS_KEY = ['business-hours'] as const;

export function useBusinessHours() {
  return useQuery({
    queryKey: BUSINESS_HOURS_KEY,
    queryFn: () => api.get<BusinessHoursResponse>('/booking-link/business-hours'),
  });
}

export function useUpdateBusinessHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (days: BusinessHoursDay[]) =>
      api.patch<BusinessHoursResponse>('/booking-link/business-hours', { days }),
    onSuccess: (data) => {
      queryClient.setQueryData(BUSINESS_HOURS_KEY, data);
      void queryClient.invalidateQueries({ queryKey: BUSINESS_HOURS_KEY });
    },
  });
}

// ===================== Online-bookable services =====================
// Toggles whether a single service can be booked from the public portal. Reuses
// the existing PATCH /services/:id endpoint (Service.onlineBookable) and refreshes
// the shared services cache so the count elsewhere stays in sync.
export function useToggleServiceOnline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, onlineBookable }: { id: string; onlineBookable: boolean }) =>
      api.patch(`/services/${id}`, { onlineBookable }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });
}
