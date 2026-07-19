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
import { CaixasAbertosPage } from './pages/financeiro/CaixasAbertosPage';
import { CaixaHistoricoPage } from './pages/financeiro/CaixaHistoricoPage';
import { NotasFiscaisPage } from './pages/financeiro/NotasFiscaisPage';
import { FinanceiroConfiguracoesPage } from './pages/financeiro/FinanceiroConfiguracoesPage';
import { AnamnesesPage } from './pages/cadastros/AnamnesesPage';
import { ConvidarProfissionaisPage } from './pages/cadastros/ConvidarProfissionaisPage';
import { PacotesPredefinidosPage } from './pages/controle/PacotesPredefinidosPage';
import { ComprasPage } from './pages/controle/ComprasPage';
import { GeradorDocumentoPage } from './pages/controle/GeradorDocumentoPage';
import { AgendamentoOnlinePage } from './pages/marketing/AgendamentoOnlinePage';
import { CampanhasPage } from './pages/marketing/CampanhasPage';
import { AjudaPage } from './pages/AjudaPage';
import { IndiquePage } from './pages/IndiquePage';
import { ComissoesResumoPage } from './pages/comissoes/ComissoesResumoPage';
import { ComissoesConfigPage } from './pages/comissoes/ComissoesConfigPage';
import { FornecedoresPage } from './pages/FornecedoresPage';
import { ProdutosPage } from './pages/ProdutosPage';
import { CategoriasPage } from './pages/CategoriasPage';
import { MarcasPage } from './pages/MarcasPage';
import { RelatoriosPage } from './pages/RelatoriosPage';
import { VendasPage } from './pages/relatorios/VendasPage';
import { DrePage } from './pages/relatorios/DrePage';
import { EstoquePage } from './pages/relatorios/EstoquePage';
import { MensagensPage } from './pages/relatorios/MensagensPage';
import { AniversariantesPage } from './pages/relatorios/AniversariantesPage';
import { AgendamentosPage as RelAgendamentosPage } from './pages/relatorios/AgendamentosPage';
import { ClientesPage as RelClientesPage } from './pages/relatorios/ClientesPage';
import { RankingPage } from './pages/relatorios/RankingPage';
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
        <Route path="/cadastros/anamneses" element={<AnamnesesPage />} />
        <Route path="/cadastros/convidar" element={<ConvidarProfissionaisPage />} />
        <Route path="/servicos" element={<ServicosPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/categorias" element={<CategoriasPage />} />
        <Route path="/marcas" element={<MarcasPage />} />
        <Route path="/controle/pacotes-predefinidos" element={<PacotesPredefinidosPage />} />
        <Route path="/controle/compras" element={<ComprasPage />} />
        <Route path="/controle/gerador-documento" element={<GeradorDocumentoPage />} />
        <Route path="/fornecedores" element={<FornecedoresPage />} />
        <Route path="/pacotes" element={<PacotesPage />} />
        <Route path="/assinaturas" element={<AssinaturasPage />} />
        <Route path="/financeiro" element={<FinanceiroPainelPage />} />
        <Route path="/financeiro/transacoes" element={<TransacoesPage />} />
        <Route path="/financeiro/contas" element={<ContasPage />} />
        <Route path="/financeiro/caixas" element={<CaixasAbertosPage />} />
        <Route path="/financeiro/caixas/historico" element={<CaixaHistoricoPage />} />
        <Route path="/financeiro/notas-fiscais" element={<NotasFiscaisPage />} />
        <Route path="/financeiro/configuracoes" element={<FinanceiroConfiguracoesPage />} />
        <Route path="/caixa" element={<CaixaPage />} />
        <Route path="/comissoes" element={<ComissoesResumoPage />} />
        <Route path="/comissoes/pagas" element={<ComissoesResumoPage />} />
        <Route path="/comissoes/config" element={<ComissoesConfigPage />} />
        <Route path="/relatorios" element={<RelatoriosPage />} />
        <Route path="/relatorios/vendas" element={<VendasPage />} />
        <Route path="/relatorios/financeiro/dre" element={<DrePage />} />
        <Route path="/relatorios/agendamentos" element={<RelAgendamentosPage />} />
        <Route path="/relatorios/clientes" element={<RelClientesPage />} />
        <Route path="/relatorios/aniversariantes" element={<AniversariantesPage />} />
        <Route path="/relatorios/estoque" element={<EstoquePage />} />
        <Route path="/relatorios/ranking" element={<RankingPage />} />
        <Route path="/relatorios/mensagens" element={<MensagensPage />} />
        <Route path="/metas" element={<MetasPage />} />
        <Route path="/marketing/agendamento-online" element={<AgendamentoOnlinePage />} />
        <Route path="/marketing/link" element={<LinkAgendamentoPage />} />
        <Route path="/marketing/promocoes" element={<PromocoesPage />} />
        <Route path="/marketing/campanhas" element={<CampanhasPage />} />
        <Route path="/marketing/avaliacoes" element={<AvaliacoesPage />} />
        <Route path="/marketing/cashback" element={<CashbackPage />} />
        <Route path="/whatsapp" element={<IAAtendimentoPage />} />
        <Route path="/ia-atendimento" element={<IAAtendimentoPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="/ajuda" element={<AjudaPage />} />
        <Route path="/ajuda/suporte" element={<AjudaPage />} />
        <Route path="/ajuda/base-conhecimento" element={<AjudaPage />} />
        <Route path="/ajuda/feedback" element={<AjudaPage />} />
        <Route path="/ajuda/novidades" element={<AjudaPage />} />
        <Route path="/indique" element={<IndiquePage />} />
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
