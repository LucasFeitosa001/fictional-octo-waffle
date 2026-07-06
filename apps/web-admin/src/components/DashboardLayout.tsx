'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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

/**
 * Protected dashboard shell. Redirects to /entrar when there is no staff
 * session, otherwise renders the B&W sidebar + content area.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 shadow-2xl">
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
        <header className="db-sidebar flex items-center gap-3 px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menu"
            className="rounded-lg p-1.5 text-white hover:bg-white/10"
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
          <div className="mx-auto min-w-0 max-w-[1400px] px-4 py-6 sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
