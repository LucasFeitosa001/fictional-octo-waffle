import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Cake,
  ChevronDown,
  LifeBuoy,
  Package,
  ReceiptText,
  RefreshCcw,
  Settings,
  UserCircle2,
} from 'lucide-react';
import { formatBRL, formatDate, monthOfISO, todayISO } from '@silvia/core';
import { repos } from '../lib/repos';

interface Notification {
  id: string;
  tone: 'danger' | 'warning' | 'info' | 'brand';
  icon: typeof Bell;
  text: string;
  to: string;
}

const toneClasses: Record<Notification['tone'], string> = {
  danger: 'bg-rose-50 text-rose-600',
  warning: 'bg-amber-50 text-amber-600',
  info: 'bg-sky-50 text-sky-600',
  brand: 'bg-brand-50 text-brand-600',
};

/** Notificações derivadas dos dados locais: contas vencidas, estoque crítico,
 *  comandas abertas e aniversariantes do mês. Recarrega sempre que o painel
 *  abre — o Topbar fica montado o tempo todo e os dados mudam nas páginas. */
function useNotifications(refreshKey: boolean): Notification[] {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [financial, products, commands, clients] = await Promise.all([
        repos.financialAccounts.list(),
        repos.products.list(),
        repos.commands.list(),
        repos.clients.list(),
      ]);
      if (cancelled) return;

      const mesAtual = Number(todayISO().split('-')[1]);
      const items: Notification[] = [];

      for (const f of financial.filter((f) => f.status === 'vencido')) {
        items.push({
          id: `fin-${f.id}`,
          tone: 'danger',
          icon: AlertTriangle,
          text: `Conta vencida: ${f.description} (${formatBRL(f.amount)}) — venceu em ${formatDate(f.dueDate)}.`,
          to: '/financeiro',
        });
      }
      for (const p of products.filter((p) => p.trackStock && p.active && p.stock <= p.reorderLevel)) {
        items.push({
          id: `stk-${p.id}`,
          tone: 'warning',
          icon: Package,
          text: `Estoque crítico: ${p.name} — ${p.stock} un (reposição em ${p.reorderLevel}).`,
          to: '/estoque',
        });
      }
      for (const c of commands.filter((c) => c.status === 'aberta')) {
        items.push({
          id: `cmd-${c.id}`,
          tone: 'info',
          icon: ReceiptText,
          text: `Comanda #${c.number} aberta com ${c.items.length} item(ns).`,
          to: '/caixa',
        });
      }
      const aniversariantes = clients.filter((c) => c.active && monthOfISO(c.birthDate) === mesAtual);
      if (aniversariantes.length > 0) {
        items.push({
          id: 'birthdays',
          tone: 'brand',
          icon: Cake,
          text: `${aniversariantes.length} cliente(s) fazem aniversário este mês.`,
          to: '/consultas',
        });
      }

      setNotifications(items);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return notifications;
}

/** Fecha o dropdown ao clicar fora dele ou pressionar Escape. */
function useDismiss(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  return ref;
}

function NotificationsMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const notifications = useNotifications(open);
  const ref = useDismiss(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Notificações"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl p-2 text-ink-500 transition hover:bg-paper hover:text-ink-900"
      >
        <Bell className="size-5" />
        {notifications.length > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
            {notifications.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-12 z-40 w-96 rounded-2xl border border-ink-100 bg-white p-2 shadow-xl">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
            Notificações {notifications.length > 0 ? `(${notifications.length})` : ''}
          </p>
          {notifications.length === 0 ? (
            <p className="px-3 pb-3 pt-1 text-sm text-ink-500">Tudo em dia — sem notificações no momento.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate(n.to);
                    }}
                    className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink-700 transition hover:bg-paper"
                  >
                    <span className={`mt-0.5 rounded-lg p-1.5 ${toneClasses[n.tone]}`}>
                      <n.icon className="size-4" />
                    </span>
                    <span className="leading-snug">{n.text}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ProfileMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));

  const resetDemoData = () => {
    const ok = window.confirm(
      'Restaurar os dados de demonstração? Todas as alterações locais (clientes, comandas, lançamentos...) serão descartadas.',
    );
    if (!ok) return;
    for (const key of Object.keys(window.localStorage).filter((k) => k.startsWith('silvia-erp.'))) {
      window.localStorage.removeItem(key);
    }
    window.location.reload();
  };

  const item =
    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-ink-700 transition hover:bg-paper';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-paper"
      >
        <UserCircle2 className="size-8 text-accent-500" />
        <div className="leading-tight">
          <p className="text-left text-sm font-semibold text-ink-900">Silvia</p>
          <p className="text-xs text-ink-300">Administradora</p>
        </div>
        <ChevronDown className={`size-4 text-ink-300 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute right-0 top-14 z-40 w-64 rounded-2xl border border-ink-100 bg-white p-2 shadow-xl">
          <button type="button" className={item} onClick={() => { setOpen(false); navigate('/configuracoes'); }}>
            <Settings className="size-4 text-ink-400" /> Configurações
          </button>
          <button type="button" className={item} onClick={() => { setOpen(false); navigate('/suporte'); }}>
            <LifeBuoy className="size-4 text-ink-400" /> Suporte
          </button>
          <div className="my-1 border-t border-ink-100" />
          <button type="button" className={`${item} text-rose-600 hover:bg-rose-50`} onClick={resetDemoData}>
            <RefreshCcw className="size-4" /> Restaurar dados de demonstração
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Topbar({ title }: { title: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-ink-100 bg-white px-8">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        <p className="text-xs text-ink-300">Hoje é {formatDate(todayISO())}</p>
      </div>
      <div className="flex items-center gap-4">
        <NotificationsMenu />
        <ProfileMenu />
      </div>
    </header>
  );
}
