import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { BottomNav } from './BottomNav';
import { CreateSheetProvider, PageActionsProvider } from './PageActions';
import { ConfirmProvider } from '../components/ConfirmDialog';

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
    <PageActionsProvider>
    <CreateSheetProvider>
    <ConfirmProvider>
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
            'absolute inset-0 cursor-pointer bg-black/40 transition-opacity duration-300 ease-out',
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
            'absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/45 px-3 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition-opacity duration-300',
            drawerOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <IconClose size={17} />
          Fechar
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
            <div className="mobile-page-content mx-auto min-w-0 max-w-[1560px] px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-4 sm:px-4 sm:pt-5 lg:px-5 lg:py-6 lg:pb-6">
              {children}
            </div>
          </main>
        )}
      </div>

      {/* Mobile bottom tab bar (same style as the club) */}
      <BottomNav onMenuOpen={() => setDrawerOpen(true)} />
    </div>
    </ConfirmProvider>
    </CreateSheetProvider>
    </PageActionsProvider>
  );
}
