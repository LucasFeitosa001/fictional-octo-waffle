import { Bell, UserCircle2 } from 'lucide-react';
import { formatDate, todayISO } from '@silvia/core';

export function Topbar({ title }: { title: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-ink-100 bg-white px-8">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        <p className="text-xs text-ink-300">Hoje é {formatDate(todayISO())}</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          title="Notificações"
          className="relative rounded-xl p-2 text-ink-500 transition hover:bg-paper hover:text-ink-900"
        >
          <Bell className="size-5" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-500" />
        </button>
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <UserCircle2 className="size-8 text-accent-500" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink-900">Silvia</p>
            <p className="text-xs text-ink-300">Administradora</p>
          </div>
        </div>
      </div>
    </header>
  );
}
