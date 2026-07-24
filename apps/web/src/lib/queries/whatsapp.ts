import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { API_BASE_URL } from '../config';

export type WhatsappStatus = 'disabled' | 'connecting' | 'qr' | 'open' | 'closed';

export interface WhatsappConnection {
  status: WhatsappStatus;
  hasQr: boolean;
  /** Número efetivamente vinculado ao socket da empresa, quando conectado. */
  phone: string | null;
}

const WHATSAPP_KEY = ['whatsapp', 'connection'] as const;
const WHATSAPP_QR_KEY = ['whatsapp', 'qr'] as const;

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

/**
 * Fetches the pending pairing QR as an object URL for `<img src>`. The endpoint
 * (`/whatsapp/connection/qr.png`) is guarded by the session cookie and returns a
 * raw PNG (or 204 when nothing is pending), so the shared JSON `api` client can't
 * read it — we hit it with a credentialed `fetch` and turn the blob into a URL.
 * Enabled only while a QR is actually pending; kept fresh alongside the status
 * poll so a rotated code updates on its own.
 */
export function useWhatsappQr(enabled: boolean) {
  return useQuery({
    queryKey: WHATSAPP_QR_KEY,
    enabled,
    // The QR image rotates roughly every ~20s server-side; refetch keeps ours warm.
    refetchInterval: enabled ? 15000 : false,
    // A fresh object URL each fetch; RQ garbage-collects the query but not the URL,
    // so the consumer revokes the previous one when a new value arrives.
    gcTime: 0,
    queryFn: async () => {
      const res = await window.fetch(`${API_BASE_URL}/whatsapp/connection/qr.png`, {
        credentials: 'include',
        headers: { Accept: 'image/png' },
      });
      if (res.status === 204 || !res.ok) return null;
      const blob = await res.blob();
      if (!blob.size) return null;
      return URL.createObjectURL(blob);
    },
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
