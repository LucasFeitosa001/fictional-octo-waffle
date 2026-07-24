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

/**
 * Per-salon appearance for the public booking page. Returned by the portal
 * endpoint (Setting `booking.appearance` on the API side), always present with
 * sensible defaults so the client never has to handle its absence.
 *   - `hideNavbar`  → hide the black top bar on the booking page.
 *   - `primaryColor`/`accentColor`/`backgroundColor` → "#RRGGBB" or null; null
 *      means "use the house default".
 */
export interface BookingAppearance {
  hideNavbar: boolean;
  primaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
}

// The portal payload plus the appearance block. Declared locally (the shared
// BookingPortal type doesn't yet carry `appearance`) so the app is typed even
// though the field is optional on older API builds.
export type Portal = BookingPortal & { appearance?: BookingAppearance };

// Defaults applied when the salon hasn't customized (or an older API omits the
// block): navbar visible, no color overrides (house theme).
export const DEFAULT_APPEARANCE: BookingAppearance = {
  hideNavbar: false,
  primaryColor: null,
  accentColor: null,
  backgroundColor: null,
};
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

function validHex(value: string | null | undefined): string | null {
  return value && HEX_COLOR.test(value) ? value : null;
}

/**
 * Resolves the salon's appearance for the booking page from the portal payload,
 * always returning a fully-populated object (falls back to DEFAULT_APPEARANCE).
 * The primary color prefers `appearance.primaryColor`, then the legacy
 * `accentColor`, then the house default.
 */
export function useBookingAppearance(slug: string): BookingAppearance {
  const portal = usePortal(slug);
  const a = portal.data?.appearance;
  const primary =
    validHex(a?.primaryColor) ?? validHex(portal.data?.accentColor) ?? null;
  return {
    hideNavbar: a?.hideNavbar ?? DEFAULT_APPEARANCE.hideNavbar,
    primaryColor: primary,
    accentColor: validHex(a?.accentColor),
    backgroundColor: validHex(a?.backgroundColor),
  };
}

/**
 * Themes the whole booking flow with the salon's appearance. Writes the salon's
 * colors as CSS variables onto <html>:
 *   - `--booking-accent`     ← primary color (buttons, active chips, highlights;
 *                               every derived tone recomputes from it).
 *   - `--booking-accent-2`   ← accent color (optional secondary highlight).
 *   - `--club-bg`            ← page background wash.
 * Falls back to the house defaults when the salon hasn't customized a value, and
 * restores the defaults on unmount so a slug switch never leaks the previous
 * salon's colors.
 */
export function useBookingAccent(slug: string) {
  const { primaryColor, accentColor, backgroundColor } = useBookingAppearance(slug);
  useEffect(() => {
    const root = document.documentElement;
    const setOrClear = (name: string, value: string | null) => {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    };
    setOrClear('--booking-accent', primaryColor);
    setOrClear('--booking-accent-2', accentColor);
    setOrClear('--club-bg', backgroundColor);
    return () => {
      root.style.removeProperty('--booking-accent');
      root.style.removeProperty('--booking-accent-2');
      root.style.removeProperty('--club-bg');
    };
  }, [primaryColor, accentColor, backgroundColor]);
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
