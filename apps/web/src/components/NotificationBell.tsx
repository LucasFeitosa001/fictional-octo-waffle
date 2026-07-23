import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  IconBell,
  IconGift,
  IconHelpCircle,
  IconSettings,
  IconShare,
} from './icons';
import { formatDateTime } from '../lib/format';
import { Drawer } from './Drawer';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type NotificationItem,
} from '../lib/queries/notificacoes';

function requestNotifPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBrowserNotif(title: string, body?: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body ?? undefined,
        icon: '/brand/salonpass-mark.png',
        tag: 'salonpass-notif',
      });
    } catch { /* iOS Safari doesn't support Notification constructor */ }
  }
}

// Deriva um destino navegável a partir do tipo da notificação. O backend hoje
// só emite `appointment.*`, mas mapeamos aqui pra evoluir sem quebrar.
// Para `appointment.*`, passamos o appointmentId (via entityId) no query param
// pra que a AgendaPage abra o drawer do agendamento (deep-link estilo Belasis).
function hrefForNotification(n: NotificationItem): string | null {
  if (n.type.startsWith('appointment.')) {
    return n.entityId
      ? `/agenda?appointmentId=${encodeURIComponent(n.entityId)}`
      : '/agenda';
  }
  return null;
}

export function NotificationBell({
  className,
  variant = 'plain',
}: {
  className?: string;
  variant?: 'plain' | 'ringed';
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // `pos` is only used by the desktop popover; mobile relies on <Drawer>.
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  // `show` drives the desktop enter/exit animation. Toggling it a frame after
  // the portal mounts lets React paint the closed state first, so the CSS
  // transition actually runs on the way in (not just on the way out).
  const [show, setShow] = useState(false);
  const prevUnread = useRef<number | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const notifications = useNotifications(30);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = notifications.data?.data ?? [];
  const unread = notifications.data?.unreadCount ?? 0;
  const ringed = variant === 'ringed';

  useEffect(() => {
    if (prevUnread.current === null) {
      prevUnread.current = unread;
      return;
    }
    if (unread > prevUnread.current) {
      const newest = items.find((n) => !n.readAt);
      if (newest) showBrowserNotif(newest.title, newest.body ?? undefined);
    }
    prevUnread.current = unread;
  }, [unread, items]);

  // ─── Desktop popover positioning ──────────────────────────────────────────
  // Compute a fixed position relative to the bell, clamped into the viewport.
  useLayoutEffect(() => {
    if (!open || isMobile) return;
    function compute() {
      const b = btnRef.current;
      if (!b) return;
      const r = b.getBoundingClientRect();
      const margin = 8;
      const width = Math.min(352, window.innerWidth - margin * 2);
      let left = r.right - width; // try right-aligning to the bell
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      const top = r.bottom + 8;
      const maxHeight = window.innerHeight - top - margin;
      setPos({ top, left, width, maxHeight });
    }
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, isMobile]);

  // Desktop enter/exit animation: two RAFs after mounting flip `show` so the
  // CSS transition sees a real value change (fecha bug do "estala").
  useEffect(() => {
    if (isMobile) return;
    if (open && pos) {
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShow(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setShow(false);
    return;
  }, [open, pos, isMobile]);

  // Fully unmount the popover (and clear pos) once the exit transition ends,
  // otherwise the next open would skip its enter animation.
  useEffect(() => {
    if (isMobile) return;
    if (open || !pos) return;
    const t = setTimeout(() => setPos(null), 220);
    return () => clearTimeout(t);
  }, [open, pos, isMobile]);

  // Close on outside click / Escape (desktop popover).
  useEffect(() => {
    if (!open || isMobile) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, isMobile]);

  function go(to: string) {
    setOpen(false);
    navigate(to);
  }

  function handleItemClick(n: NotificationItem) {
    if (!n.readAt) markRead.mutate(n.id);
    const href = hrefForNotification(n);
    if (href) {
      setOpen(false);
      navigate(href);
    }
  }

  function handleMarkAll() {
    if (unread === 0 || markAll.isPending) return;
    // Sem tipos → marca TODAS da empresa (o sino não filtra por categoria).
    markAll.mutate(undefined);
  }

  const badge = useMemo(() => {
    if (unread <= 0) return null;
    return (
      <span
        className={
          ringed
            ? 'absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-warm-white'
            : 'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white'
        }
      >
        {unread > 9 ? '9+' : unread}
      </span>
    );
  }, [unread, ringed]);

  // Conteúdo compartilhado entre popover desktop e drawer mobile.
  const panelContent = (
    <>
      {/* Bloco fixo topo: Aniversariantes de hoje */}
      <button
        type="button"
        onClick={() => go('/relatorios/aniversariantes')}
        className="flex w-full items-center gap-3 border-b border-default-100 bg-pink/5 px-4 py-3 text-left transition-colors hover:bg-pink/10"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pink/15 text-pink">
          <IconGift size={18} />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold text-foreground">
            Aniversariantes de hoje
          </span>
          <span className="text-xs text-muted">
            Clique aqui para abrir a lista
          </span>
        </span>
      </button>

      {/* Lista de notificações */}
      {notifications.isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-muted">Carregando…</p>
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

      {/* Rodapé: VER TODAS */}
      <div className="border-t border-default-100 px-4 py-2 text-center">
        <button
          type="button"
          onClick={() => go('/notificacoes')}
          className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          Ver todas
        </button>
      </div>

      {/* 3 tiles: Configurações, Ajuda, Indique e ganhe */}
      <div className="grid grid-cols-3 gap-1 border-t border-default-100 bg-default-50/60 p-2">
        <button
          type="button"
          onClick={() => go('/configuracoes')}
          className="flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-foreground transition-colors hover:bg-white"
        >
          <IconSettings size={20} />
          <span className="text-[11px] font-medium">Configurações</span>
        </button>
        <button
          type="button"
          onClick={() => go('/ajuda')}
          className="flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-foreground transition-colors hover:bg-white"
        >
          <IconHelpCircle size={20} />
          <span className="text-[11px] font-medium">Ajuda</span>
        </button>
        <button
          type="button"
          onClick={() => go('/indique')}
          className="flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-foreground transition-colors hover:bg-white"
        >
          <IconShare size={20} />
          <span className="text-[11px] font-medium">Indique e ganhe</span>
        </button>
      </div>
    </>
  );

  const headerButton = (
    <button
      type="button"
      onClick={handleMarkAll}
      disabled={unread === 0 || markAll.isPending}
      className="text-xs font-medium text-primary transition-opacity hover:underline disabled:cursor-not-allowed disabled:opacity-40"
    >
      {markAll.isPending ? 'Marcando…' : 'Marcar todas como lidas'}
    </button>
  );

  return (
    <div className={`relative ${className ?? ''}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { requestNotifPermission(); setOpen((v) => !v); }}
        aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : 'Notificações'}
        className={
          ringed
            ? 'relative grid h-10 w-10 place-items-center rounded-full border border-[var(--color-soft-border)] bg-warm-white text-foreground transition-colors hover:border-gold hover:bg-cream'
            : 'relative rounded-lg p-2 text-current hover:bg-black/5'
        }
      >
        <IconBell size={ringed ? 19 : 22} />
        {badge}
      </button>

      {/* MOBILE: bottom-sheet fullscreen via Drawer (nunca é cortado por
          overflow do sidebar). */}
      {isMobile ? (
        <Drawer
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Notificações"
          placement="bottom"
          footer={unread > 0 ? headerButton : undefined}
        >
          <div className="-mx-4 -my-4 flex flex-col">{panelContent}</div>
        </Drawer>
      ) : (
        pos &&
        createPortal(
          <div
            ref={panelRef}
            aria-hidden={!show}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
            className={[
              'z-[100] flex flex-col overflow-hidden rounded-xl border border-default-200 bg-white shadow-xl',
              'origin-top transition-all duration-200 ease-out',
              show
                ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
                : 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0',
            ].join(' ')}
          >
            <div className="flex items-center justify-between border-b border-default-100 px-4 py-3">
              <span className="text-sm font-semibold text-foreground">Notificações</span>
              {unread > 0 && headerButton}
            </div>

            <div className="flex flex-col overflow-y-auto" style={{ maxHeight: pos.maxHeight }}>
              {panelContent}
            </div>
          </div>,
          document.body,
        )
      )}
    </div>
  );
}
