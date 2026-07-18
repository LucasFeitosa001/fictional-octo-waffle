import { lazy, Suspense, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BookingPage } from './pages/BookingPage';
import { SalonGate } from './pages/SalonGate';
import { useCustomerSession } from './lib/auth';
import { DEFAULT_BOOKING_SLUG, getSubdomainSlug } from './lib/config';

// Secondary routes are code-split so the home (BookingPage) ships the smallest
// possible initial bundle. They load on demand when the customer navigates.
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then((m) => ({ default: m.AccountPage })),
);
const AgendaPage = lazy(() => import('./pages/AgendaPage').then((m) => ({ default: m.AgendaPage })));
const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })));
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
);

function BookingRoute() {
  const { slug } = useParams();
  if (!slug) return <Navigate to="/" replace />;
  return <BookingPage slug={slug} basePath={`/${slug}`} />;
}

// Path-based ("/:slug/...") login + account routes, so a salon reached via the
// shared host keeps its slug in the URL. The booking portal it returns to is
// "/:slug".
function SlugLoginRoute() {
  const { slug } = useParams();
  if (!slug) return <Navigate to="/" replace />;
  return <LoginPage backTo={`/${slug}`} />;
}

function SlugAccountRoute() {
  const { slug } = useParams();
  if (!slug) return <Navigate to="/" replace />;
  return <AccountPage slug={slug} backTo={`/${slug}`} />;
}

function SlugAgendaRoute() {
  const { slug } = useParams();
  if (!slug) return <Navigate to="/" replace />;
  return <AgendaPage slug={slug} backTo={`/${slug}`} />;
}

function RouteFallback() {
  return (
    <div className="club-page flex flex-col" role="status" aria-label="Carregando página">
      <header className="club-topbar">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center px-4 py-2.5">
          <img src="/brand/salonpass-wordmark-white.svg" alt="Salonpass" className="h-6 w-auto" />
        </div>
      </header>
      <main className="club-page-main mx-auto w-full max-w-2xl flex-1 py-7">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-black/10" />
        <div className="mt-3 h-4 w-64 max-w-full animate-pulse rounded bg-black/10" />
        <div className="mt-7 h-44 animate-pulse rounded-2xl bg-white/70" />
      </main>
    </div>
  );
}

export function App() {
  const { data: session } = useCustomerSession();
  const queryClient = useQueryClient();

  // Tenant isolation: my-appointments / my-notifications are scoped per customer
  // on the server, but the query cache is shared. Drop only those customer-scoped
  // queries whenever the logged-in user id changes (login, logout, account switch)
  // so one customer never sees the previous customer's cached data. We deliberately
  // do NOT clear the whole cache: the public portal/services queries that power the
  // home are tenant-public, and wiping them on login forced a full refetch waterfall
  // right after the first paint (the home appeared to "freeze"/reload).
  const lastUserId = useRef<string | null>(null);
  useEffect(() => {
    const userId = session?.user?.id ?? null;
    if (userId !== lastUserId.current) {
      lastUserId.current = userId;
      queryClient.removeQueries({ queryKey: ['my-appointments'] });
      queryClient.removeQueries({ queryKey: ['my-notifications'] });
    }
  }, [session?.user?.id, queryClient]);

  // A PRO salon's dedicated subdomain takes precedence over a baked-in default
  // slug. When present, the portal is rendered directly from the host.
  const tenantSlug = getSubdomainSlug() || DEFAULT_BOOKING_SLUG;

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route
        path="/"
        element={
          tenantSlug ? <BookingPage slug={tenantSlug} basePath="" /> : <SalonGate />
        }
      />
      {/* Subdomain / baked-default tenant: login + account live at the host root. */}
      <Route
        path="/login"
        element={tenantSlug ? <LoginPage backTo="/" /> : <Navigate to="/" replace />}
      />
      <Route
        path="/conta"
        element={
          tenantSlug ? <AccountPage slug={tenantSlug} backTo="/" /> : <Navigate to="/" replace />
        }
      />
      <Route
        path="/agenda"
        element={
          tenantSlug ? <AgendaPage slug={tenantSlug} backTo="/" /> : <Navigate to="/" replace />
        }
      />
      {/* Public, login-free institutional landing (Google OAuth homepage). */}
      <Route path="/sobre" element={<LandingPage />} />
      {/* Public legal pages (static URLs for the Google OAuth consent screen). */}
      <Route path="/privacidade" element={<LegalPage kind="privacy" backTo="/" />} />
      <Route path="/termos" element={<LegalPage kind="terms" backTo="/" />} />
      {/* Path-based tenant routing. */}
      <Route path="/:slug/login" element={<SlugLoginRoute />} />
      <Route path="/:slug/conta" element={<SlugAccountRoute />} />
      <Route path="/:slug/agenda" element={<SlugAgendaRoute />} />
      <Route path="/:slug" element={<BookingRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
