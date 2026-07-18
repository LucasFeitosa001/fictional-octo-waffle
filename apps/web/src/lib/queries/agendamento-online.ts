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

// ===================== Web profile (perfil público) =====================
// Perfil público do salão (SalonWebProfile), persistido pelo módulo de marketing.
// Guarda descrição, redes sociais, comodidades e preferências de fluxo/tema.
export type ThemePreference = 'light' | 'dark' | 'auto';
export type SchedulingFlow = 'service' | 'professional';

export interface WebProfile {
  description: string;
  website: string;
  facebook: string;
  instagram: string;
  wifi: boolean;
  snackBar: boolean;
  parkingLot: boolean;
  kids: boolean;
  accessibility: boolean;
  themePreference: ThemePreference;
  schedulingFlow: SchedulingFlow;
  requiredLogin: boolean;
}

const WEB_PROFILE_KEY = ['web-profile'] as const;

export function useWebProfile() {
  return useQuery({
    queryKey: WEB_PROFILE_KEY,
    queryFn: () => api.get<WebProfile>('/booking-link/web-profile'),
  });
}

export function useUpdateWebProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<WebProfile>) =>
      api.patch<WebProfile>('/booking-link/web-profile', patch),
    onSuccess: (data) => {
      queryClient.setQueryData(WEB_PROFILE_KEY, data);
      void queryClient.invalidateQueries({ queryKey: WEB_PROFILE_KEY });
    },
  });
}

// ===================== Gallery (galeria de fotos) =====================
// Fotos do perfil público do salão (GalleryPhoto). Cada foto é uma linha com url
// e ordem de exibição; adicionar/remover são operações individuais.
export interface GalleryPhoto {
  id: string;
  companyId: string;
  url: string;
  caption: string | null;
  displayOrder: number;
  createdAt: string;
}

const GALLERY_KEY = ['gallery'] as const;

export function useGallery() {
  return useQuery({
    queryKey: GALLERY_KEY,
    queryFn: () => api.get<GalleryPhoto[]>('/booking-link/gallery'),
  });
}

export function useAddGalleryPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { url: string; caption?: string }) =>
      api.post<GalleryPhoto>('/booking-link/gallery', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GALLERY_KEY }),
  });
}

export function useRemoveGalleryPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/booking-link/gallery/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GALLERY_KEY }),
  });
}
