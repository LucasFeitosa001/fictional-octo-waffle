import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  Factory,
  FolderTree,
  LayoutDashboard,
  LifeBuoy,
  Package,
  ReceiptText,
  Scissors,
  Search,
  Settings,
  Sparkles,
  Users,
  X,
  Menu,
} from 'lucide-react';
import { Topbar } from './Topbar';

const MENU = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/profissionais', label: 'Profissionais', icon: Scissors },
  { to: '/servicos', label: 'Serviços', icon: Sparkles },
  { to: '/produtos', label: 'Produtos', icon: Package },
  { to: '/fornecedores', label: 'Fornecedores', icon: Factory },
  { to: '/grupos', label: 'Grupos', icon: FolderTree },
  { to: '/estoque', label: 'Estoque', icon: Boxes },
  { to: '/caixa', label: 'Caixa / Comandas', icon: ReceiptText },
  { to: '/financeiro', label: 'Financeiro', icon: CircleDollarSign },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/consultas', label: 'Consultas', icon: Search },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/suporte', label: 'Suporte', icon: LifeBuoy },
] as const;

export const PAGE_TITLES: Record<string, string> = Object.fromEntries(MENU.map((m) => [m.to, m.label]));

function Sidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  return (
    <aside
      className={`${mobile ? 'flex h-full w-[min(88vw,22rem)] shadow-2xl' : 'hidden w-64 lg:flex'} shrink-0 flex-col border-r border-ink-100 bg-white`}
      aria-label="Navegação principal"
    >
      <div className="flex min-h-20 items-center gap-3 px-5 py-4">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 text-lg font-bold text-white shadow-sm">
          S
        </span>
        <div className="leading-tight">
          <p className="font-semibold tracking-tight text-ink-900">Silvia Hair</p>
          <p className="text-xs font-medium uppercase tracking-widest text-gold-700">ERP</p>
        </div>
        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            className="ml-auto flex size-11 items-center justify-center rounded-xl text-ink-500 transition hover:bg-paper"
            aria-label="Fechar menu"
          >
            <X className="size-5" />
          </button>
        ) : null}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {MENU.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-500 hover:bg-paper hover:text-ink-900'
              }`
            }
          >
            <item.icon className="size-4.5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ink-100 px-5 py-4">
        <p className="text-xs text-ink-300">Silvia Hair ERP v1.0</p>
      </div>
    </aside>
  );
}

const MOBILE_NAV = MENU.filter((item) => ['/dashboard', '/agenda', '/clientes', '/caixa'].includes(item.to));

function MobileDock({ onMenu }: { onMenu: () => void }) {
  return (
    <nav className="mobile-safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-ink-100 bg-white/95 px-1 pt-1 shadow-[0_-10px_30px_rgba(31,32,40,0.08)] backdrop-blur-xl lg:hidden" aria-label="Atalhos principais">
      {MOBILE_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition ${
              isActive ? 'text-brand-700' : 'text-ink-400 active:bg-paper'
            }`
          }
        >
          <item.icon className="size-5" />
          <span className="max-w-full truncate">{item.label === 'Caixa / Comandas' ? 'Caixa' : item.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMenu}
        className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold text-ink-400 active:bg-paper"
        aria-label="Abrir todos os módulos"
      >
        <Menu className="size-5" />
        <span>Menu</span>
      </button>
    </nav>
  );
}

export function AppLayout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Silvia Hair ERP';
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-paper">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
      <MobileDock onMenu={() => setMenuOpen(true)} />
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-ink-900/45 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
            aria-label="Fechar menu"
          />
          <div className="relative h-full animate-[slide-in_.2s_ease-out]">
            <Sidebar mobile onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
