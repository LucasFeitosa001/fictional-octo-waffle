import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export type WhatsappStatus = 'disabled' | 'connecting' | 'qr' | 'open' | 'closed';

export interface WhatsappConnection {
  status: WhatsappStatus;
  hasQr: boolean;
}

const WHATSAPP_KEY = ['whatsapp', 'connection'] as const;

/**
 * Connection status of the salon's WhatsApp. Polls while the section is open so
 * the UI flips to "Conectado" on its own once the phone finishes pairing.
 */
export function useWhatsappStatus(enabled = true) {
  return useQuery({
    queryKey: WHATSAPP_KEY,
    queryFn: () => api.get<WhatsappConnection>('/whatsapp/connection/status'),
    enabled,
    refetchInterval: enabled ? 4000 : false,
  });
}

/** Generates the 8-char "link with phone number" code for the given number. */
export function usePairWhatsapp() {
  return useMutation({
    mutationFn: (phone: string) =>
      api.post<{ code: string | null }>('/whatsapp/connection/pair', { phone }),
  });
}

/** Disconnects the WhatsApp session so a fresh number can be linked. */
export function useLogoutWhatsapp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/whatsapp/connection/logout', {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: WHATSAPP_KEY }),
  });
}

const MANAGER_KEY = ['whatsapp', 'manager'] as const;

/**
 * Manager/reception number that receives the booking-confirmation prompt and
 * answers 1/2/3. Distinct from the connected bot number.
 */
export function useWhatsappManager() {
  return useQuery({
    queryKey: MANAGER_KEY,
    queryFn: () => api.get<{ phone: string | null }>('/whatsapp/connection/manager'),
  });
}

/** Saves (or clears, when empty) the manager/reception number. */
export function useSaveWhatsappManager() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (phone: string) =>
      api.post<{ phone: string | null }>('/whatsapp/connection/manager', { phone }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MANAGER_KEY }),
  });
}
