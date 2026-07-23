import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { toast, TOAST_TIMEOUT } from '../toast';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  /**
   * ID da entidade referenciada. Para `type` começando com `appointment.`,
   * carrega o `appointmentId` — é o que habilita o deep-link do sino → drawer
   * do agendamento em /agenda.
   */
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  data: NotificationItem[];
  total: number;
  unreadCount: number;
}

/** Full list for the bell panel. Polls so new bookings surface without reload. */
export function useNotifications(limit = 30) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => api.get<NotificationsResponse>('/notifications', { limit }),
    refetchInterval: 30_000,
  });
}

/** Lightweight unread badge count, polled frequently. */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ unreadCount: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: true }>(`/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>('/notifications/read-all', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ─── Toasts em tempo (quase) real ───────────────────────────────────────────

const LAST_SEEN_KEY = 'salonpass:notif-last-seen-at';

/**
 * Deep-link a partir do tipo/entidade da notificação — espelha a lógica do
 * `NotificationBell`. Hoje o backend só emite `appointment.*`, cujo `entityId`
 * é o `appointmentId` → abre o drawer do agendamento em /agenda.
 */
function hrefForNotification(n: NotificationItem): string | null {
  if (n.type.startsWith('appointment.')) {
    return n.entityId
      ? `/agenda?appointmentId=${encodeURIComponent(n.entityId)}`
      : '/agenda';
  }
  return null;
}

/**
 * Escolhe o "sabor" do toast pelo tipo da notificação:
 *   - appointment.canceled → danger (vermelho)
 *   - appointment.confirmed → success (verde)
 *   - appointment.created / demais → info (azul)
 */
function toastForNotification(n: NotificationItem): 'success' | 'info' | 'danger' {
  if (n.type === 'appointment.canceled') return 'danger';
  if (n.type === 'appointment.confirmed') return 'success';
  return 'info';
}

/**
 * "Notification watcher": detecta notificações NOVAS (chegadas depois da última
 * vista) e dispara UM toast do HeroUI por notificação, no canto inferior direito
 * (placement global do ToastProvider), sem repetir a cada poll.
 *
 * Estratégia:
 *   - Reaproveita a lista já polada por `useNotifications` (refetchInterval 30s),
 *     evitando uma segunda query.
 *   - Marca água por `createdAt` (timestamp) — mais robusto que assumir ids
 *     ordenáveis. Persiste o maior `createdAt` já "toastado" em localStorage,
 *     então recarregar a aba não re-explode toasts antigos.
 *   - PRIMEIRA montagem: apenas registra o baseline (o `createdAt` mais recente
 *     atual) e NÃO toasta nada retroativo. Só notificações que chegarem DEPOIS
 *     viram toast.
 *
 * Deve ser montado num ponto que só existe logado (ex.: DashboardLayout).
 */
export function useNotificationToasts() {
  const navigate = useNavigate();
  const { data } = useNotifications(30);
  const items = data?.data;

  // Baseline (ms epoch) do último `createdAt` já processado. Inicializa com o
  // que está no localStorage; se ausente, fica null até o primeiro batch chegar
  // (aí adotamos o mais recente como baseline, sem toastar).
  const lastSeenAt = useRef<number | null>(null);
  const initialized = useRef(false);

  // `navigate` guardado em ref pra manter o efeito com deps estável (só `items`).
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (lastSeenAt.current !== null || initialized.current) return;
    const stored = localStorage.getItem(LAST_SEEN_KEY);
    const parsed = stored ? Number(stored) : NaN;
    lastSeenAt.current = Number.isFinite(parsed) ? parsed : null;
  }, []);

  useEffect(() => {
    if (!items || items.length === 0) return;

    // Timestamps válidos, ordenados do mais antigo → mais novo (a lista vem
    // desc; invertemos pra toastar em ordem cronológica).
    const withTs = items
      .map((n) => ({ n, ts: new Date(n.createdAt).getTime() }))
      .filter((x) => Number.isFinite(x.ts))
      .sort((a, b) => a.ts - b.ts);
    if (withTs.length === 0) return;

    const newestTs = withTs[withTs.length - 1].ts;

    // Primeiro batch sem baseline: adota o mais recente como marca d'água e
    // NÃO toasta o histórico (evita explodir a tela no primeiro load).
    if (lastSeenAt.current === null) {
      lastSeenAt.current = newestTs;
      initialized.current = true;
      localStorage.setItem(LAST_SEEN_KEY, String(newestTs));
      return;
    }

    const baseline = lastSeenAt.current;
    const fresh = withTs.filter((x) => x.ts > baseline);
    if (fresh.length === 0) return;

    for (const { n } of fresh) {
      const variant = toastForNotification(n);
      const href = hrefForNotification(n);
      toast[variant](n.title, {
        description: n.body ?? undefined,
        timeout: TOAST_TIMEOUT,
        ...(href
          ? {
              actionProps: {
                children: 'Ver',
                onPress: () => navigateRef.current(href),
              },
            }
          : {}),
      });
    }

    // Avança a marca d'água pro mais novo toastado e persiste.
    lastSeenAt.current = newestTs;
    initialized.current = true;
    localStorage.setItem(LAST_SEEN_KEY, String(newestTs));
  }, [items]);
}
