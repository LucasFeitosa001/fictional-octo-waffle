import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';

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

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  // Full-bleed pages manage their own height + scroll (no page padding,
  // no max-width, no main scroll). The agenda is one big internal scroller.
  const fullBleed = pathname === '/agenda';

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop static sidebar */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile off-canvas drawer — always mounted so it can slide in/out
          smoothly. Visibility + interactivity are driven by transitions, not
          conditional mounting (which made it vanish instantly). */}
      <div
        className={[
          'fixed inset-0 z-50 lg:hidden',
          drawerOpen ? '' : 'pointer-events-none',
        ].join(' ')}
        aria-hidden={!drawerOpen}
      >
        {/* Backdrop fades */}
        <div
          className={[
            'absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
        {/* Panel slides from the left */}
        <div
          className={[
            'absolute inset-y-0 left-0 shadow-[var(--shadow-pop)] transition-transform duration-300 ease-out will-change-transform',
            drawerOpen ? 'translate-x-0' : '-translate-x-full',
          ].join(' ')}
        >
          <Sidebar mobile onNavigate={() => setDrawerOpen(false)} />
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          aria-label="Fechar menu"
          tabIndex={drawerOpen ? 0 : -1}
          className={[
            'absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white transition-opacity duration-300',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <IconClose size={20} />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar */}
        <Topbar />

        {fullBleed ? (
          <main className="db-canvas flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </main>
        ) : (
          <main className="db-canvas min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
            <div className="mobile-page-content mx-auto min-w-0 max-w-[1400px] px-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:py-8 lg:pb-8">
              {children}
            </div>
          </main>
        )}
      </div>

      {/* Mobile bottom tab bar (same style as the club) */}
      <BottomNav onMenuOpen={() => setDrawerOpen(true)} />
    </div>
  );
}
