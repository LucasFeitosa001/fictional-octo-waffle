import { useEffect } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  bookingPaths,
  type BookingAgenda,
  type BookingAvailability,
  type BookingNotificationsResponse,
  type BookingPortal,
  type BookingProfessional,
  type BookingResult,
  type BookingService,
  type CreateBookingBody,
  type CreateReviewBody,
  type MyAppointment,
  type MyProfile,
  type UpdateMyProfileBody,
} from '@beautypass/shared';
import { api } from './api';

// The booking API contract lives in @beautypass/shared (single source of truth
// across every client). These aliases keep the local, app-friendly names while
// pointing at the shared types.
export type Portal = BookingPortal;
export type Service = BookingService;
export type Professional = BookingProfessional;
export type AvailabilitySlot = BookingAvailability['slots'][number];
export type BookPayload = CreateBookingBody;
export type Agenda = BookingAgenda;
export type { MyAppointment };
export type {
  BookingBusyBlock as BusyBlock,
  BookingAgendaSchedule as AgendaSchedule,
} from '@beautypass/shared';
export type { BookingNotification as ClubNotification } from '@beautypass/shared';

// ---- Booking flow ----------------------------------------------------------

export function usePortal(slug: string) {
  const paths = bookingPaths(slug);
  return useQuery({
    queryKey: ['portal', slug],
    queryFn: () => api.get<Portal>(paths.portal),
    enabled: !!slug,
  });
}

// A valid "#RRGGBB" (case-insensitive), or null.
const HEX_COLOR = /^#([0-9a-fA-F]{6})$/;

/**
 * Themes the whole booking flow with the salon's accent color. Resolves the
 * portal from the slug and writes `--booking-accent` onto <html> so every
 * derived tone (buttons, active chips, highlights) recomputes from it. Falls
 * back to the house pink when the salon hasn't customized it, and restores the
 * default on unmount so a slug switch never leaks the previous salon's color.
 */
export function useBookingAccent(slug: string) {
  const portal = usePortal(slug);
  const accent = portal.data?.accentColor ?? null;
  useEffect(() => {
    const root = document.documentElement;
    if (accent && HEX_COLOR.test(accent)) {
      root.style.setProperty('--booking-accent', accent);
    } else {
      root.style.removeProperty('--booking-accent');
    }
    return () => {
      root.style.removeProperty('--booking-accent');
    };
  }, [accent]);
}

export function useServices(slug: string) {
  const paths = bookingPaths(slug);
  return useQuery({
    queryKey: ['services', slug],
    queryFn: () => api.get<{ data: Service[] }>(paths.services),
    enabled: !!slug,
  });
}

export function useProfessionals(slug: string, serviceId: string | null, serviceIds?: string[]) {
  const paths = bookingPaths(slug);
  const idsKey = serviceIds?.length ? serviceIds.join(',') : serviceId;
  return useQuery({
    queryKey: ['professionals', slug, idsKey],
    queryFn: () =>
      api.get<{ data: Professional[] }>(paths.professionals, {
        serviceId: serviceId ?? '',
        ...(serviceIds && serviceIds.length > 1 ? { serviceIds: serviceIds.join(',') } : {}),
      }),
    enabled: !!slug && !!serviceId,
  });
}

export function useAvailability(
  slug: string,
  serviceId: string | null,
  professionalId: string | null,
  date: string | null,
  serviceIds?: string[],
) {
  const paths = bookingPaths(slug);
  const idsKey = serviceIds?.length ? serviceIds.join(',') : serviceId;
  return useQuery({
    queryKey: ['availability', slug, idsKey, professionalId, date],
    queryFn: () =>
      api.get<BookingAvailability>(paths.availability, {
        serviceId: serviceId ?? '',
        professionalId: professionalId ?? '',
        date: date ?? undefined,
        ...(serviceIds && serviceIds.length > 1 ? { serviceIds: serviceIds.join(',') } : {}),
      }),
    enabled: !!slug && !!serviceId && !!professionalId,
  });
}

// Public availability view: free/busy per professional for a [from, to) week.
// Carries no customer data — safe to show without authentication.
export function useAgenda(slug: string, from: string, to: string) {
  const paths = bookingPaths(slug);
  return useQuery({
    queryKey: ['agenda', slug, from, to],
    queryFn: () => api.get<Agenda>(paths.agenda, { from, to }),
    enabled: !!slug && !!from && !!to,
  });
}

export function useBook(slug: string) {
  const paths = bookingPaths(slug);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BookPayload) =>
      api.post<BookingResult>(paths.appointments, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-appointments', slug] });
      qc.invalidateQueries({ queryKey: ['availability', slug] });
    },
  });
}

// ---- Logged-in customer area ----------------------------------------------

export function useMyAppointments(slug: string, enabled: boolean) {
  const paths = bookingPaths(slug);
  return useQuery({
    queryKey: ['my-appointments', slug],
    queryFn: () => api.get<{ data: MyAppointment[] }>(paths.myAppointments),
    enabled: !!slug && enabled,
  });
}

export function useCancelAppointment(slug: string) {
  const paths = bookingPaths(slug);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ id: string; status: string }>(paths.cancelAppointment(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-appointments', slug] });
    },
  });
}

export type { MyProfile };

export function useMyProfile(slug: string, enabled: boolean) {
  const paths = bookingPaths(slug);
  return useQuery({
    queryKey: ['my-profile', slug],
    queryFn: () => api.get<MyProfile>(paths.myProfile),
    enabled: !!slug && enabled,
  });
}

export function useUpdateProfile(slug: string) {
  const paths = bookingPaths(slug);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMyProfileBody) =>
      api.patch<MyProfile>(paths.myProfile, body),
    onSuccess: (data) => {
      qc.setQueryData(['my-profile', slug], data);
    },
  });
}

export function useReviewAppointment(slug: string) {
  const paths = bookingPaths(slug);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: CreateReviewBody & { id: string }) =>
      api.post<{ id: string; rating: number; reviewed: boolean }>(
        paths.reviewAppointment(id),
        body,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-appointments', slug] });
    },
  });
}

export function useMyNotifications(slug: string, enabled: boolean, pollSeconds = 30) {
  const paths = bookingPaths(slug);
  return useQuery({
    queryKey: ['my-notifications', slug],
    queryFn: () => api.get<BookingNotificationsResponse>(paths.myNotifications),
    enabled: !!slug && enabled,
    refetchInterval: pollSeconds * 1000,
  });
}

export function useMarkNotificationRead(slug: string) {
  const paths = bookingPaths(slug);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: true }>(paths.readNotification(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications', slug] }),
  });
}

export function useMarkAllNotificationsRead(slug: string) {
  const paths = bookingPaths(slug);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>(paths.readAllNotifications),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-notifications', slug] }),
  });
}
