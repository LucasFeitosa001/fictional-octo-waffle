import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { CreateSheetProvider, PageActionsProvider } from './PageActions';
import { CreateDrawerHost, CreateDrawerProvider } from './CreateDrawer';
import { ConfirmProvider } from '../components/ConfirmDialog';
import { CrmLockedModal } from '../components/CrmLockedModal';
import { NotificationToaster } from '../components/NotificationToaster';
import { IconTip } from '../components/IconTip';
import { IconUsers } from '../components/icons';
import { useThemeSync } from '../theme/useThemeSync';
import { useSidebarStyle } from '../theme/sidebarStyle';
import { useCrmShortcutEnabled } from '../theme/crmShortcut';

export function DashboardLayout({ children }: { children: ReactNode }) {
  // Pull the account's theme once the session is available (localStorage stays
  // the fast pre-paint cache; the account is the cross-device source of truth).
  useThemeSync();
  const sidebarStyle = useSidebarStyle();
  const crmShortcutEnabled = useCrmShortcutEnabled();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [crmOpen, setCrmOpen] = useState(false);
  const { pathname } = useLocation();
  // Full-bleed pages manage their own height + scroll (no page padding,
  // no max-width, no main scroll). The agenda is one big internal scroller.
  // As telas da Voltr entram aqui porque são um iframe: qualquer padding ou
  // max-width do painel vira faixa vazia em volta do CRM do parceiro.
  // Lista, não encadeamento de ||: toda tela nova da Voltr é um iframe e PRECISA
  // entrar aqui. Esquecer uma faz ela cair no ramo com padding e SEM altura
  // definida — o iframe encolhe para uns poucos pixels e a tela parece quebrada,
  // que foi o que aconteceu com o Kanban e a IA. Ver estudo 82.
  const TELA_CHEIA = [
    '/agenda',
    '/voltr-crm',
    '/voltr-chat',
    '/voltr-boards',
    '/voltr-ia',
  ];
  const fullBleed = TELA_CHEIA.includes(pathname);

  return (
    <PageActionsProvider>
    <CreateSheetProvider>
    <CreateDrawerProvider>
    <ConfirmProvider>
    <div className="flex h-dvh w-full overflow-hidden">
      {/* Desktop static sidebar (sólida encostada, ou flutuante com margem) */}
      <div className={`hidden lg:block ${sidebarStyle === 'floating' ? 'p-2.5' : ''}`}>
        <Sidebar onOpenCrm={() => setCrmOpen(true)} />
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
        {/* Panel slides from the left. No mobile o menu é SEMPRE sólido/encostado
            — a personalização flutuante do sidebar só vale no desktop. */}
        <div
          className={[
            'absolute shadow-[var(--shadow-pop)] transition-transform duration-300 ease-out will-change-transform',
            'inset-y-0 left-0',
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
          // Full-bleed (agenda): gerencia a própria altura/scroll. Só reservamos
          // a safe-area do topo no mobile (o header interno da agenda não pode
          // ficar sob o notch); no desktop (lg:) não há notch e o topbar cobre.
          <main className="db-canvas flex min-h-0 flex-1 flex-col overflow-hidden pt-[var(--sp-safe-top)] lg:pt-0">
            {children}
          </main>
        ) : (
          <main className="db-canvas min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
            {/* pt: no mobile reserva o notch/dynamic island via env(safe-area-inset-top)
                — telas SEM MobileBackHeader não podem começar sob o notch. Telas
                COM MobileBackHeader cancelam esse padding com a classe .has-back-header
                (o próprio header assume a safe-area). No desktop (lg:) volta ao py-6. */}
            <div className="mobile-page-content mx-auto min-w-0 max-w-[1560px] px-3 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-[max(1rem,var(--sp-safe-top))] sm:px-4 lg:px-5 lg:py-6 lg:pb-6 lg:pt-6">
              {children}
            </div>
          </main>
        )}
      </div>

      {/* Mobile bottom tab bar (same style as the club) */}
      <BottomNav onMenuOpen={() => setDrawerOpen(true)} />

      {/* Atalho global do CRM — abre apenas o aviso de módulo não adquirido.
          Mobile: `.fab-above-nav` posiciona o botão ACIMA da BottomNav flutuante
          (offset único, ver index.css), nunca sobrepondo. z-30 fica ABAIXO da
          nav (z-40), reforçando que a nav sempre vence. Desktop (md:): a própria
          .fab-above-nav volta pro canto (bottom 1.5rem); right-6 alinha o X.
          Escondido quando o usuário desliga "Mostrar atalho do CRM" em
          Configurações → Personalizar (useCrmShortcutEnabled). */}
      {!fullBleed && crmShortcutEnabled && (
        <IconTip
          label="Abrir CRM"
          placement="left"
          className="fab-above-nav fixed right-4 z-30 md:right-6 md:z-40"
        >
          <button
            type="button"
            aria-label="Abrir CRM"
            onClick={() => setCrmOpen(true)}
            className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-[var(--shadow-pop)] transition-transform active:scale-95"
          >
            <IconUsers size={22} />
          </button>
        </IconTip>
      )}

      <CrmLockedModal open={crmOpen} onClose={() => setCrmOpen(false)} />

      {/* Create-in-place host — abre o drawer da entidade direto (Sidebar/BottomNav
          "Novo") sem navegar. Uma única instância global, dentro do provider. */}
      <CreateDrawerHost />

      {/* Notification watcher (sem UI): observa a lista de notificações e dispara
          toasts no canto inferior direito para agendamentos novos/confirmados/
          cancelados. Montado aqui pois só existe logado. */}
      <NotificationToaster />
    </div>
    </ConfirmProvider>
    </CreateDrawerProvider>
    </CreateSheetProvider>
    </PageActionsProvider>
  );
}
