'use client';

import { Dropdown, Button, Label } from '@heroui/react';
import { IconBell } from './icons';
import { formatDateTime } from '../lib/format';
import { useNotifications, useMarkAllNotificationsRead } from '../lib/queries/notifications';

/**
 * Notification bell with a HeroUI v3 Dropdown. Reads real notifications scoped
 * to the company (empty until the backend emits any) and exposes "mark all
 * read". `compact` renders a smaller trigger for the sidebar row.
 */
export function NotificationsBell({ compact = false }: { compact?: boolean }) {
  const { data } = useNotifications();
  const markAll = useMarkAllNotificationsRead();

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;
  const size = compact ? 18 : 20;

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <button
          type="button"
          aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : 'Notificações'}
          className={[
            'relative grid place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white',
            compact ? 'h-9 w-9' : 'h-10 w-10',
          ].join(' ')}
        >
          <IconBell size={size} />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[10px] font-semibold leading-none text-[#0a0a0a]">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-[340px] border border-white/[0.1] bg-[#0c0c0d] p-0 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <span className="eyebrow text-white/55">Notificações</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="text-[11px] font-medium text-white/55 transition-colors hover:text-white disabled:opacity-50"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <IconBell size={22} />
            <p className="text-[13px] text-white/45">Nenhuma notificação por aqui.</p>
          </div>
        ) : (
          <Dropdown.Menu aria-label="Notificações" className="max-h-[360px] overflow-y-auto p-1">
            {items.map((n) => (
              <Dropdown.Item key={n.id} id={n.id} textValue={n.title} className="items-start">
                <span
                  className={[
                    'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                    n.readAt ? 'bg-transparent' : 'bg-white',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <Label>
                  <span className="block text-[13px] font-semibold text-white">{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-[12px] text-white/55">{n.body}</span>}
                  <span className="mt-1 block text-[10.5px] text-white/35">
                    {formatDateTime(n.createdAt)}
                  </span>
                </Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        )}
      </Dropdown.Popover>
    </Dropdown>
  );
}
