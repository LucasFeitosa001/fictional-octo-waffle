import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { CreateSheetProvider, PageActionsProvider } from './PageActions';
import { CreateDrawerHost, CreateDrawerProvider } from './CreateDrawer';
import { ConfirmProvider } from '../components/ConfirmDialog';
import { ChatSupportDrawer } from '../components/ChatSupportDrawer';
import { IconMessage } from '../components/icons';
import { useThemeSync } from '../theme/useThemeSync';

export function DashboardLayout({ children }: { children: ReactNode }) {
  // Pull the account's theme once the session is available (localStorage stays
  // the fast pre-paint cache; the account is the cross-device source of truth).
  useThemeSync();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { pathname } = useLocation();
  // Full-bleed pages manage their own height + scroll (no page padding,
  // no max-width, no main scroll). The agenda is one big internal scroller.
  const fullBleed = pathname === '/agenda';

  return (
    <PageActionsProvider>
    <CreateSheetProvider>
    <CreateDrawerProvider>
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
          {/* mobileOpen sinaliza pra Sidebar resetar collapsedGroups (via useEffect)
              sem remontar — remount quebra a animação de saída do drawer. */}
          <Sidebar mobile mobileOpen={drawerOpen} onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
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

      {/* Chat FAB global — visível em todas as páginas exceto Agenda
          (Belasis /calendar não tem FAB nesta rota). */}
      {!fullBleed && (
        <button
          type="button"
          aria-label="Abrir chat de suporte"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-24 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[var(--shadow-pop)] transition-transform active:scale-95 md:bottom-6 md:right-6"
        >
          <IconMessage size={22} />
        </button>
      )}

      {/* Drawer do chat de suporte — POST /help/chat (Claude Haiku). */}
      <ChatSupportDrawer open={chatOpen} onClose={() => setChatOpen(false)} />

      {/* Create-in-place host — abre o drawer da entidade direto (Sidebar/BottomNav
          "Novo") sem navegar. Uma única instância global, dentro do provider. */}
      <CreateDrawerHost />
    </div>
    </ConfirmProvider>
    </CreateDrawerProvider>
    </CreateSheetProvider>
    </PageActionsProvider>
  );
}
