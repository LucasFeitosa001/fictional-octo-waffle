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

function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-100 bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-600 text-lg font-bold text-white shadow-sm">
          S
        </span>
        <div className="leading-tight">
          <p className="font-semibold tracking-tight text-ink-900">Silvia Hair</p>
          <p className="text-xs font-medium uppercase tracking-widest text-gold-700">ERP</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {MENU.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
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

export function AppLayout() {
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Silvia Hair ERP';

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
