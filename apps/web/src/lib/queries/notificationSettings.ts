import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';

/**
 * Per-company toggles for the AUTOMATIC client-facing WhatsApp/email messages.
 * Default (server-side, when never set): only `followUp` is on — confirmation,
 * cancellation and reminder start OFF so the client isn't spammed on booking.
 */
export interface NotificationAutomationSettings {
  confirmation: boolean;
  cancellation: boolean;
  reminder: boolean;
  followUp: boolean;
}

const NOTIFICATION_SETTINGS_KEY = ['notification-settings'] as const;

/** Loads the company's automatic-notification toggles. */
export function useNotificationSettings() {
  return useQuery({
    queryKey: NOTIFICATION_SETTINGS_KEY,
    queryFn: () =>
      api.get<NotificationAutomationSettings>('/notification-settings'),
  });
}

/**
 * Patches one or more toggles and refreshes the cached settings on success.
 * Shows a success toast so the owner gets feedback that the change stuck.
 */
export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationAutomationSettings>) =>
      api.patch<NotificationAutomationSettings>('/notification-settings', patch),
    onSuccess: (data) => {
      queryClient.setQueryData(NOTIFICATION_SETTINGS_KEY, data);
      // Toggling `followUp` also flips the follow-up config's `enabled` server-side
      // — refresh that cache so the follow-up section reflects the change.
      queryClient.invalidateQueries({ queryKey: FOLLOWUP_SETTINGS_KEY });
      toastSuccess('Preferências de notificação salvas');
    },
  });
}

/**
 * Rich, per-company configuration of the post-service follow-up ("lembrete de
 * retorno"). `enabled` is the same switch as NotificationAutomationSettings.followUp
 * (kept in sync server-side). The message template supports the variables
 * {cliente} {estabelecimento} {servico} {link}.
 */
/** Time units for the delay/recurrence — seconds/minutes exist to test jobs fast. */
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days';

export interface FollowUpSettings {
  enabled: boolean;
  message: string;
  /** Delay as a value + unit (e.g. 24 hours). Server normalizes to delaySeconds. */
  delayValue: number;
  delayUnit: TimeUnit;
  /** Canonical delay in seconds (server-derived) — what the queue actually uses. */
  delaySeconds: number;
  /** DEPRECATED compat mirror kept by the server (delay expressed in hours). */
  delayHours: number;
  recurring: boolean;
  /** Recurrence interval as value + unit (e.g. 30 days). */
  recurringValue: number;
  recurringUnit: TimeUnit;
  /** Canonical recurrence interval in seconds (server-derived). */
  recurringSeconds: number;
  /** DEPRECATED compat mirror (interval in days). */
  recurringDays: number;
  maxRecurrences: number;
  includeBookingLink: boolean;
}

const FOLLOWUP_SETTINGS_KEY = ['notification-settings', 'follow-up'] as const;

/** Loads the company's rich follow-up config. */
export function useFollowUpSettings() {
  return useQuery({
    queryKey: FOLLOWUP_SETTINGS_KEY,
    queryFn: () => api.get<FollowUpSettings>('/notification-settings/follow-up'),
  });
}

/**
 * Patches the follow-up config and refreshes caches on success. Because `enabled`
 * mirrors automation.followUp, we also invalidate the plain settings cache so the
 * switch in "Notificações automáticas" stays consistent.
 */
export function useUpdateFollowUpSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<FollowUpSettings>) =>
      api.patch<FollowUpSettings>('/notification-settings/follow-up', patch),
    onSuccess: (data) => {
      queryClient.setQueryData(FOLLOWUP_SETTINGS_KEY, data);
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_SETTINGS_KEY });
      toastSuccess('Follow-up atualizado');
    },
  });
}
