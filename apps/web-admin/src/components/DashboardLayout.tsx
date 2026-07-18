'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Spinner } from '@heroui/react';
import { useSession } from '../lib/auth';
import { Sidebar } from './Sidebar';
import { SalonpassMark } from './Brand';
import { NotificationsBell } from './NotificationsBell';

function IconMenu({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function IconClose({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function FullScreenSpinner() {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function DockIcon({ name }: { name: 'home' | 'calendar' | 'plus' | 'users' | 'menu' }) {
  const paths = {
    home: (
      <>
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9v11h13V9M9.5 20v-6h5v6" />
      </>
    ),
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M8 3v4M16 3v4M3.5 10h17" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    users: (
      <>
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" />
        <circle cx="9.5" cy="7.5" r="3.5" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 6.7M18 14.8a4 4 0 0 1 3 3.7V20" />
      </>
    ),
    menu: <path d="M4 6.5h16M4 12h16M4 17.5h16" />,
  };
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function MobileDock({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname() ?? '/';
  const itemClass = (active: boolean) =>
    `mobile-dock-item ${active ? 'mobile-dock-item-active' : ''}`;

  return (
    <nav className="mobile-dock lg:hidden" aria-label="Navegação principal">
      <Link
        href="/"
        className={itemClass(pathname === '/')}
        aria-current={pathname === '/' ? 'page' : undefined}
      >
        <DockIcon name="home" />
        <span>Painel</span>
      </Link>
      <Link
        href="/agenda"
        className={itemClass(pathname.startsWith('/agenda'))}
        aria-current={pathname.startsWith('/agenda') ? 'page' : undefined}
      >
        <DockIcon name="calendar" />
        <span>Agenda</span>
      </Link>
      <Link href="/agenda?new=1" className="mobile-dock-create" aria-label="Criar novo agendamento">
        <span>
          <DockIcon name="plus" />
        </span>
        <strong>Novo</strong>
      </Link>
      <Link
        href="/clientes"
        className={itemClass(pathname.startsWith('/clientes'))}
        aria-current={pathname.startsWith('/clientes') ? 'page' : undefined}
      >
        <DockIcon name="users" />
        <span>Clientes</span>
      </Link>
      <button
        type="button"
        className="mobile-dock-item"
        onClick={onMenu}
        aria-label="Abrir todos os módulos"
      >
        <DockIcon name="menu" />
        <span>Menu</span>
      </button>
    </nav>
  );
}

/**
 * Protected dashboard shell. Redirects to /entrar when there is no staff
 * session, otherwise renders the B&W sidebar + content area.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  // Club (/) and admin (/admin) share the same domain and therefore the same
  // Better Auth cookie. A *customer* session (created on the club) must NOT be
  // treated as a staff login — otherwise customers land on a broken dashboard.
  const isCustomer =
    (session?.user as { accountType?: string | null } | undefined)?.accountType === 'customer';

  if (isPending) return <FullScreenSpinner />;
  if (!session || isCustomer) {
    if (typeof window !== 'undefined') router.replace('/entrar');
    return <FullScreenSpinner />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Desktop static sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile off-canvas drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-[70] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu principal"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 max-w-[88vw] shadow-2xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Fechar menu"
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white"
          >
            <IconClose size={20} />
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="mobile-topbar db-sidebar flex items-center gap-3 px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="mobile-icon-button text-white hover:bg-white/10"
          >
            <IconMenu size={24} />
          </button>
          <SalonpassMark size={28} />
          <span className="font-brand text-base font-semibold tracking-tight text-white">
            Salonpass
          </span>
          <div className="ml-auto">
            <NotificationsBell compact />
          </div>
        </header>

        {/* Desktop top bar — slim, hairline, bell on the right */}
        <header className="hidden h-14 shrink-0 items-center justify-end border-b border-white/[0.07] px-6 lg:flex">
          <NotificationsBell />
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto db-surface">
          <div className="mobile-page mx-auto min-w-0 max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6">{children}</div>
        </main>
      </div>
      <MobileDock onMenu={() => setDrawerOpen(true)} />
    </div>
  );
}
