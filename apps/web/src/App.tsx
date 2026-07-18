import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardLayout } from './layout/DashboardLayout';
import { PainelPage } from './pages/PainelPage';
import { AgendaPage } from './pages/AgendaPage';
import { AgendamentosPage } from './pages/AgendamentosPage';
import { ComandasPage } from './pages/ComandasPage';
import { ComandaDetalhePage } from './pages/ComandaDetalhePage';
import { ClientesPage } from './pages/ClientesPage';
import { ProfissionaisPage } from './pages/ProfissionaisPage';
import { ServicosPage } from './pages/ServicosPage';
import { CaixaPage } from './pages/CaixaPage';
import { ConfiguracoesPage } from './pages/ConfiguracoesPage';
import { PacotesPage } from './pages/PacotesPage';
import { AssinaturasPage } from './pages/AssinaturasPage';
import { FinanceiroPainelPage } from './pages/financeiro/FinanceiroPainelPage';
import { TransacoesPage } from './pages/financeiro/TransacoesPage';
import { ContasPage } from './pages/financeiro/ContasPage';
import { ComissoesResumoPage } from './pages/comissoes/ComissoesResumoPage';
import { ComissoesConfigPage } from './pages/comissoes/ComissoesConfigPage';
import { FornecedoresPage } from './pages/FornecedoresPage';
import { ProdutosPage } from './pages/ProdutosPage';
import { CategoriasPage } from './pages/CategoriasPage';
import { MarcasPage } from './pages/MarcasPage';
import { RelatoriosPage } from './pages/RelatoriosPage';
import { MetasPage } from './pages/metas/MetasPage';
import { LinkAgendamentoPage } from './pages/marketing/LinkAgendamentoPage';
import { PromocoesPage } from './pages/marketing/PromocoesPage';
import { AvaliacoesPage } from './pages/marketing/AvaliacoesPage';
import { CashbackPage } from './pages/marketing/CashbackPage';
import { IAAtendimentoPage } from './pages/ia/IAAtendimentoPage';
import { PerfilPage } from './pages/PerfilPage';

function FullScreenSpinner() {
  return (
    <div className="flex h-dvh w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

function ProtectedRoutes() {
  const { data: session, isPending } = useSession();
  if (isPending) return <FullScreenSpinner />;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<PainelPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/agendamentos" element={<AgendamentosPage />} />
        <Route path="/comandas" element={<ComandasPage />} />
        <Route path="/comandas/:id" element={<ComandaDetalhePage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/profissionais" element={<ProfissionaisPage />} />
        <Route path="/servicos" element={<ServicosPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/categorias" element={<CategoriasPage />} />
        <Route path="/marcas" element={<MarcasPage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/pacotes" element={<PacotesPage />} />
        <Route path="/assinaturas" element={<AssinaturasPage />} />
        <Route path="/financeiro" element={<FinanceiroPainelPage />} />
        <Route path="/financeiro/transacoes" element={<TransacoesPage />} />
        <Route path="/financeiro/contas" element={<ContasPage />} />
        <Route path="/caixa" element={<CaixaPage />} />
        <Route path="/comissoes" element={<ComissoesResumoPage />} />
        <Route path="/comissoes/config" element={<ComissoesConfigPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/metas" element={<MetasPage />} />
        <Route path="/marketing/link" element={<LinkAgendamentoPage />} />
        <Route path="/marketing/promocoes" element={<PromocoesPage />} />
        <Route path="/marketing/avaliacoes" element={<AvaliacoesPage />} />
        <Route path="/marketing/cashback" element={<CashbackPage />} />
        <Route path="/ia-atendimento" element={<IAAtendimentoPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

export function App() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();

  // Tenant isolation: every cached query (services, customers, dashboard, etc.)
  // is scoped to the logged-in user's company on the server, but TanStack Query
  // keys are not. If we kept the cache across a sign-out/sign-in we'd briefly
  // show the previous account's data to the next one. Resetting the cache on any
  // change of user id (login, logout, or switching accounts) guarantees no
  // cross-account bleed.
  //
  // IMPORTANT: we skip the initial null→userId transition that happens on every
  // page load (session starts as null while the /get-session request is in
  // flight, then resolves to the real user). Calling queryClient.clear() during
  // that transition destroyed queries whose observers had already mounted,
  // leaving useQuery hooks permanently stuck in `isPending: true` — the
  // F5-reload infinite spinner bug. We now only clear on a *real* user change
  // (logout or account switch), when ProtectedRoutes has already redirected to
  // /login and unmounted every page component and its observers.
  const UNSET = '__unset__';
  const lastUserId = useRef<string>(UNSET);
  useEffect(() => {
    const userId = session?.user?.id ?? '';
    // First run after mount: just record the id, nothing to clear.
    if (lastUserId.current === UNSET) {
      lastUserId.current = userId;
      return;
    }
    if (userId !== lastUserId.current) {
      const hadUser = lastUserId.current !== '';
      lastUserId.current = userId;
      if (hadUser) {
        // User changed or logged out. At this point the ProtectedRoutes guard
        // will redirect to /login, unmounting every page component (and their
        // query observers), so removing queries from the cache is safe.
        queryClient.clear();
      }
    }
  }, [session?.user?.id, queryClient]);

  return (
    <Routes>
      {/* The customer-facing booking portal now lives in the dedicated club app
          (apps/web-club), served at its own origin. */}
      <Route
        path="/login"
        element={
          isPending ? (
            <FullScreenSpinner />
          ) : session ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage />
          )
        }
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}
