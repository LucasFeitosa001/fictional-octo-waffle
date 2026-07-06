import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@heroui/react';
import { Bell } from '@gravity-ui/icons';
import { formatDateTime } from '../lib/format';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMyNotifications,
  type ClubNotification,
} from '../lib/booking';

/**
 * Header notification bell for the logged-in customer. Shows an unread badge and
 * a dropdown of their appointment notifications (created/confirmed/canceled),
 * polling every 30s. Also mirrors new notifications to a native web Notification
 * when the browser permission has been granted.
 */
export function NotificationBell({
  slug,
  enabled,
  className,
}: {
  slug: string;
  enabled: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // Fixed-position anchor for the dropdown, measured from the bell on open. This
  // keeps the panel on-screen on mobile (anchoring to the viewport's right edge)
  // instead of overflowing off the left when the bell sits far from the edge.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const lastSeenId = useRef<string | null>(null);

  function toggleOpen() {
    setOpen((wasOpen) => {
      if (!wasOpen) {
        const r = btnRef.current?.getBoundingClientRect();
        if (r) {
          const isMobile = window.innerWidth < 768;
          setPos({
            top: r.bottom + 8,
            right: isMobile ? 12 : Math.max(12, window.innerWidth - r.right),
          });
        }
      }
      return !wasOpen;
    });
  }

  const notifications = useMyNotifications(slug, enabled, 30);
  const markRead = useMarkNotificationRead(slug);
  const markAll = useMarkAllNotificationsRead(slug);

  const items = notifications.data?.data ?? [];
  const unread = notifications.data?.unreadCount ?? 0;

  // Mirror brand-new notifications to a native web notification (when granted).
  useEffect(() => {
    if (!items.length) return;
    const newest = items[0];
    if (lastSeenId.current === null) {
      lastSeenId.current = newest.id;
      return;
    }
    if (newest.id !== lastSeenId.current && !newest.readAt) {
      lastSeenId.current = newest.id;
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          new Notification(newest.title, { body: newest.body ?? undefined });
        } catch {
          /* some browsers require a SW registration; ignore failures */
        }
      }
    }
  }, [items]);

  // Close on outside click / Escape / scroll (the panel is fixed, so closing on
  // scroll keeps it from detaching from the bell as the header scrolls away).
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  function handleItemClick(n: ClubNotification) {
    if (!n.readAt) markRead.mutate(n.id);
  }

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
        className="relative grid h-10 w-10 place-items-center rounded-full text-current transition-colors hover:bg-white/15"
      >
        <Bell width={22} height={22} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F08CA5] px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && pos && (
        <div
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-default-200 bg-white text-foreground shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-default-100 px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Notificações</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="text-xs font-medium text-primary hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {notifications.isLoading ? (
              <ul className="divide-y divide-default-100">
                {Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="flex flex-col gap-1.5 px-4 py-3">
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                    <Skeleton className="h-3 w-4/5 rounded-md" />
                    <Skeleton className="h-2.5 w-24 rounded-md" />
                  </li>
                ))}
              </ul>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                Nenhuma notificação por aqui.
              </p>
            ) : (
              <ul className="divide-y divide-default-100">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-default-50 ${
                        n.readAt ? '' : 'bg-primary/5'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {!n.readAt && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                        )}
                        <span className="text-sm font-medium text-foreground">{n.title}</span>
                      </span>
                      {n.body && <span className="text-xs text-muted">{n.body}</span>}
                      <span className="text-[11px] text-muted/80">
                        {formatDateTime(n.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
