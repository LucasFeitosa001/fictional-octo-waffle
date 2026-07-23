import { useEffect, useRef, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from './lib/auth';
import { useCan } from './lib/queries/permissions';
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
import { FinanceiroCategoriasPage } from './pages/financeiro/FinanceiroCategoriasPage';
import { BelasisPayCadastroPage } from './pages/financeiro/BelasisPayCadastroPage';
import { CaixasAbertosPage } from './pages/financeiro/CaixasAbertosPage';
import { CaixaHistoricoPage } from './pages/financeiro/CaixaHistoricoPage';
import { NotasFiscaisPage } from './pages/financeiro/NotasFiscaisPage';
import { FinanceiroConfiguracoesPage } from './pages/financeiro/FinanceiroConfiguracoesPage';
import { AnamnesesPage } from './pages/cadastros/AnamnesesPage';
// "Convidar profissionais" e "Usuários" foram ABSORVIDOS pela página
// consolidada Profissionais (/profissionais). As rotas antigas redirecionam
// pra lá — os componentes originais não são mais montados.
import { ConvitePage } from './pages/ConvitePage';
import { PacotesPredefinidosPage } from './pages/controle/PacotesPredefinidosPage';
import { ComprasPage } from './pages/controle/ComprasPage';
import { GeradorDocumentoPage } from './pages/controle/GeradorDocumentoPage';
import { AgendamentoOnlinePage } from './pages/marketing/AgendamentoOnlinePage';
import { CampanhasPage } from './pages/marketing/CampanhasPage';
import { AjudaPage } from './pages/AjudaPage';
import { HelpArticlePage } from './pages/HelpArticlePage';
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
import { FluxoCaixaPage } from './pages/relatorios/FluxoCaixaPage';
import { ExtratoContasPage } from './pages/relatorios/ExtratoContasPage';
import { ExtratoMovimentacoesPage } from './pages/relatorios/ExtratoMovimentacoesPage';
import { ProdutosServicosPage } from './pages/relatorios/ProdutosServicosPage';
import {
  ResultadoServicosPage,
  ResultadoProdutosPage,
  ProjecaoFaturamentoPage,
  RecebimentosPage,
  DespesasPage,
  AgendamentosExcluidosPage,
  OrigemAgendamentosPage,
  CriacaoAgendamentoPage,
  CuidadosHojePage,
  SugestaoCompraPage,
} from './pages/relatorios/EmBreveReports';
import { MovimentacaoEstoquePage } from './pages/relatorios/MovimentacaoEstoquePage';
import { ComprasRelatorioPage } from './pages/relatorios/ComprasRelatorioPage';
import { ProdutosConsumidosPage } from './pages/relatorios/ProdutosConsumidosPage';
import { MetasPage } from './pages/metas/MetasPage';
import { LinkAgendamentoPage } from './pages/marketing/LinkAgendamentoPage';
import { PromocoesPage } from './pages/marketing/PromocoesPage';
import { AvaliacoesPage } from './pages/marketing/AvaliacoesPage';
import { CashbackPage } from './pages/marketing/CashbackPage';
import { IAAtendimentoPage } from './pages/ia/IAAtendimentoPage';
import { PerfilPage } from './pages/PerfilPage';
import { NotificacoesCategoriasPage } from './pages/NotificacoesCategoriasPage';
import { NotificacoesDetalhePage } from './pages/NotificacoesDetalhePage';
import { PerfilAdicionaisPage } from './pages/PerfilAdicionaisPage';
import { PerfilAssinaturaPage } from './pages/PerfilAssinaturaPage';
import { FeatureGate } from './components/FeatureGate';
import { IconLock } from './components/icons';

/**
 * Splash fade-out controller.
 *
 * The pre-hydration splash lives in index.html at the <body> level (outside
 * #root). It stays visible on top of everything until we set
 * `data-app-ready="1"` on <html>, which triggers the CSS opacity transition,
 * then we remove the element from the DOM after the transition ends.
 *
 * Called ONCE from <App> as soon as the initial session query resolves
 * (isPending flips from true → false). This eliminates the reload flash
 * cascade: splash covers the screen from t=0 until the app has actually
 * decided what to render (LoginPage vs DashboardLayout).
 */
function useHideSplashWhenReady(ready: boolean) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    // Two RAFs: give React a paint to commit the real UI beneath the splash
    // BEFORE we start fading, so the reveal is content-first (never a flash
    // of empty cream body). done.current guards against StrictMode re-invoke.
    let timeoutId: number | undefined;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.documentElement.dataset.appReady = '1';
        timeoutId = window.setTimeout(() => {
          document.getElementById('splash')?.remove();
        }, 260);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [ready]);
}

/**
 * FASE RBAC — 403 amigável quando o papel não concede acesso à rota. Mantém o
 * usuário dentro do app (não estoura pra /login) e oferece voltar ao painel.
 */
function ForbiddenRoute() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-pink/12 text-pink ring-1 ring-inset ring-pink/20">
        <IconLock size={26} />
      </span>
      <h1 className="font-brand text-xl font-bold text-foreground">Acesso restrito</h1>
      <p className="text-sm text-muted">
        Seu perfil não tem permissão para acessar esta área. Fale com o
        responsável pela conta se precisar de acesso.
      </p>
      <Link
        to="/painel"
        className="mt-1 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}

/**
 * FASE RBAC — envolve rotas que exigem uma permissão específica. Enquanto as
 * permissões carregam não decide nada (null: evita piscar o 403); resolvido,
 * libera os filhos ou mostra o 403 amigável. `perm` aceita lista (OR).
 */
function ProtectedRoute({
  perm,
  children,
}: {
  perm: string | string[];
  children: ReactNode;
}) {
  const { can, isLoading } = useCan();
  if (isLoading) return null; // não pisca o 403 antes de saber o papel
  const perms = Array.isArray(perm) ? perm : [perm];
  if (perms.some((p) => can(p))) return <>{children}</>;
  return <ForbiddenRoute />;
}

function ProtectedRoutes() {
  const { data: session, isPending } = useSession();
  // Render null SOMENTE no primeiro load (sem session em cache). Better Auth
  // dispara isPending=true também em REFETCHES (blur/focus, mutations, etc.);
  // retornar null nesses casos VIRA A APP INTEIRA em branco → parece reload
  // ao voltar pra aba. Manter a app renderizada com session cached quando
  // refetching preserva o UX. Splash HTML só cobre no primeiro paint.
  if (isPending && !session) return null;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/painel" replace />} />
        <Route path="/painel" element={<PainelPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/agendamentos" element={<AgendamentosPage />} />
        <Route path="/comandas" element={<ComandasPage />} />
        <Route path="/comandas/:id" element={<ComandaDetalhePage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/profissionais" element={<ProfissionaisPage />} />
        <Route path="/cadastros/anamneses" element={<AnamnesesPage />} />
        {/* Rotas antigas de equipe → redirecionam para a página consolidada
            Profissionais (que agora concentra convite/acesso + permissões). */}
        <Route path="/cadastros/convidar" element={<Navigate to="/profissionais" replace />} />
        <Route path="/cadastros/usuarios" element={<Navigate to="/profissionais" replace />} />
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
        <Route path="/vendas-por-assinatura" element={<AssinaturasPage />} />
        {/* Financeiro — exige financeiro:view (profissional/recepção não veem). */}
        <Route path="/financeiro" element={<ProtectedRoute perm="financeiro:view"><FinanceiroPainelPage /></ProtectedRoute>} />
        <Route path="/financeiro/transacoes" element={<ProtectedRoute perm="financeiro:view"><TransacoesPage /></ProtectedRoute>} />
        <Route path="/financeiro/contas" element={<ProtectedRoute perm="financeiro:view"><ContasPage /></ProtectedRoute>} />
        {/* Caixas: quem opera o próprio caixa (caixa:operate) ou vê todos (view_all). */}
        <Route path="/financeiro/caixas" element={<ProtectedRoute perm={['caixa:operate', 'caixa:view_all']}><CaixasAbertosPage /></ProtectedRoute>} />
        <Route path="/financeiro/caixas-abertos" element={<ProtectedRoute perm={['caixa:operate', 'caixa:view_all']}><CaixasAbertosPage /></ProtectedRoute>} />
        <Route path="/financeiro/caixas/historico" element={<ProtectedRoute perm={['caixa:operate', 'caixa:view_all']}><CaixaHistoricoPage /></ProtectedRoute>} />
        <Route path="/financeiro/notas-fiscais" element={<ProtectedRoute perm="financeiro:view"><NotasFiscaisPage /></ProtectedRoute>} />
        <Route path="/financeiro/configuracoes" element={<ProtectedRoute perm="financeiro:view"><FinanceiroConfiguracoesPage /></ProtectedRoute>} />
        <Route path="/financeiro/cadastros/categorias" element={<ProtectedRoute perm="financeiro:view"><FinanceiroCategoriasPage /></ProtectedRoute>} />
        <Route path="/financeiro/cadastros/formas-pagamento" element={<ProtectedRoute perm="financeiro:view"><ContasPage defaultTab="formas" /></ProtectedRoute>} />
        <Route path="/financeiro/cadastros/contas" element={<ProtectedRoute perm="financeiro:view"><ContasPage defaultTab="contas" /></ProtectedRoute>} />
        <Route path="/financeiro/belasis-pay" element={<ProtectedRoute perm="financeiro:view"><BelasisPayCadastroPage /></ProtectedRoute>} />
        <Route path="/financeiro/historico-caixa" element={<ProtectedRoute perm={['caixa:operate', 'caixa:view_all']}><CaixaHistoricoPage /></ProtectedRoute>} />
        <Route path="/financeiro/caixas-abertos/:id" element={<ProtectedRoute perm={['caixa:operate', 'caixa:view_all']}><CaixasAbertosPage /></ProtectedRoute>} />
        <Route path="/caixa" element={<ProtectedRoute perm={['caixa:operate', 'caixa:view_all']}><CaixaPage /></ProtectedRoute>} />
        {/* Comissões — profissional vê as próprias (view_own); config é gestão. */}
        <Route path="/comissoes" element={<ProtectedRoute perm={['comissoes:view_own', 'comissoes:view_all']}><ComissoesResumoPage /></ProtectedRoute>} />
        <Route path="/comissoes/resumo" element={<ProtectedRoute perm={['comissoes:view_own', 'comissoes:view_all']}><ComissoesResumoPage /></ProtectedRoute>} />
        <Route path="/comissoes/em-aberto" element={<ProtectedRoute perm={['comissoes:view_own', 'comissoes:view_all']}><ComissoesResumoPage /></ProtectedRoute>} />
        <Route path="/comissoes/pagas" element={<ProtectedRoute perm={['comissoes:view_own', 'comissoes:view_all']}><ComissoesResumoPage /></ProtectedRoute>} />
        <Route path="/comissoes/config" element={<ProtectedRoute perm="comissoes:config"><ComissoesConfigPage /></ProtectedRoute>} />
        {/* Relatórios operacionais — exigem relatorios:operacional. */}
        <Route path="/relatorios" element={<ProtectedRoute perm="relatorios:operacional"><RelatoriosPage /></ProtectedRoute>} />
        <Route path="/relatorios/vendas" element={<ProtectedRoute perm="relatorios:operacional"><VendasPage /></ProtectedRoute>} />
        {/* Relatórios financeiros — exigem relatorios:financeiro. */}
        <Route path="/relatorios/financeiro/dre" element={<ProtectedRoute perm="relatorios:financeiro"><DrePage /></ProtectedRoute>} />
        <Route path="/relatorios/agendamentos" element={<ProtectedRoute perm="relatorios:operacional"><RelAgendamentosPage /></ProtectedRoute>} />
        <Route path="/relatorios/clientes" element={<ProtectedRoute perm="relatorios:operacional"><RelClientesPage /></ProtectedRoute>} />
        <Route path="/relatorios/aniversariantes" element={<ProtectedRoute perm="relatorios:operacional"><AniversariantesPage /></ProtectedRoute>} />
        <Route path="/relatorios/estoque" element={<ProtectedRoute perm="relatorios:operacional"><EstoquePage /></ProtectedRoute>} />
        <Route path="/relatorios/ranking" element={<ProtectedRoute perm="relatorios:operacional"><RankingPage /></ProtectedRoute>} />
        <Route path="/relatorios/mensagens" element={<ProtectedRoute perm="relatorios:operacional"><MensagensPage /></ProtectedRoute>} />
        {/* Relatórios — rotas /reports/... antes mortas no submenu (navegação
            quebrada → 404). Agora registradas: reais sobre dados existentes ou
            placeholder "Em breve" quando dependem de backend novo. */}
        <Route path="/reports/financial" element={<Navigate to="/reports/financial/dre" replace />} />
        <Route path="/reports/financial/dre" element={<ProtectedRoute perm="relatorios:financeiro"><DrePage /></ProtectedRoute>} />
        <Route path="/reports/financial/cash-movements" element={<ProtectedRoute perm="relatorios:financeiro"><FluxoCaixaPage /></ProtectedRoute>} />
        <Route path="/reports/financial/extract" element={<ProtectedRoute perm="relatorios:financeiro"><ExtratoContasPage /></ProtectedRoute>} />
        <Route path="/reports/financial/extract-movements" element={<ProtectedRoute perm="relatorios:financeiro"><ExtratoMovimentacoesPage /></ProtectedRoute>} />
        <Route path="/reports/financial/service-revenue" element={<ProtectedRoute perm="relatorios:financeiro"><ResultadoServicosPage /></ProtectedRoute>} />
        <Route path="/reports/financial/product-revenue" element={<ProtectedRoute perm="relatorios:financeiro"><ResultadoProdutosPage /></ProtectedRoute>} />
        <Route path="/reports/financial/billing-projection" element={<ProtectedRoute perm="relatorios:financeiro"><ProjecaoFaturamentoPage /></ProtectedRoute>} />
        <Route path="/reports/financial/bill-recs" element={<ProtectedRoute perm="relatorios:financeiro"><RecebimentosPage /></ProtectedRoute>} />
        <Route path="/reports/financial/bill-pays" element={<ProtectedRoute perm="relatorios:financeiro"><DespesasPage /></ProtectedRoute>} />
        <Route path="/reports/calendars" element={<Navigate to="/reports/calendars/all" replace />} />
        <Route path="/reports/calendars/all" element={<ProtectedRoute perm="relatorios:operacional"><RelAgendamentosPage /></ProtectedRoute>} />
        <Route path="/reports/calendars/deleted" element={<ProtectedRoute perm="relatorios:operacional"><AgendamentosExcluidosPage /></ProtectedRoute>} />
        <Route path="/reports/calendars/origin" element={<ProtectedRoute perm="relatorios:operacional"><OrigemAgendamentosPage /></ProtectedRoute>} />
        <Route path="/reports/calendars/creation" element={<ProtectedRoute perm="relatorios:operacional"><CriacaoAgendamentoPage /></ProtectedRoute>} />
        <Route path="/reports/calendars/care-messages-today" element={<ProtectedRoute perm="relatorios:operacional"><CuidadosHojePage /></ProtectedRoute>} />
        <Route path="/reports/inventory" element={<Navigate to="/reports/inventory/stock" replace />} />
        <Route path="/reports/inventory/stock" element={<ProtectedRoute perm="relatorios:operacional"><EstoquePage /></ProtectedRoute>} />
        <Route path="/reports/inventory/products-services" element={<ProtectedRoute perm="relatorios:operacional"><ProdutosServicosPage /></ProtectedRoute>} />
        <Route path="/reports/inventory/movements" element={<ProtectedRoute perm="relatorios:operacional"><MovimentacaoEstoquePage /></ProtectedRoute>} />
        <Route path="/reports/inventory/purchases" element={<ProtectedRoute perm="relatorios:operacional"><ComprasRelatorioPage /></ProtectedRoute>} />
        <Route path="/reports/inventory/suggestion" element={<ProtectedRoute perm="relatorios:operacional"><SugestaoCompraPage /></ProtectedRoute>} />
        <Route path="/reports/inventory/consumed" element={<ProtectedRoute perm="relatorios:operacional"><ProdutosConsumidosPage /></ProtectedRoute>} />
        <Route path="/reports/invoices" element={<ProtectedRoute perm="relatorios:operacional"><NotasFiscaisPage /></ProtectedRoute>} />
        <Route path="/metas" element={<ProtectedRoute perm="relatorios:operacional"><MetasPage /></ProtectedRoute>} />
        {/* Marketing — exige marketing:view. */}
        <Route path="/marketing/agendamento-online" element={<ProtectedRoute perm="marketing:view"><AgendamentoOnlinePage /></ProtectedRoute>} />
        <Route path="/marketing/link" element={<ProtectedRoute perm="marketing:view"><LinkAgendamentoPage /></ProtectedRoute>} />
        <Route path="/marketing/promocoes" element={<ProtectedRoute perm="marketing:view"><PromocoesPage /></ProtectedRoute>} />
        <Route
          path="/marketing/campanhas"
          element={
            <ProtectedRoute perm="marketing:view">
              <FeatureGate
                feature="messaging"
                title="Automação de Marketing"
                description="A automação de marketing (envio de campanhas e mensagens automáticas) faz parte de um plano superior — faça upgrade para desbloquear."
              >
                <CampanhasPage />
              </FeatureGate>
            </ProtectedRoute>
          }
        />
        <Route path="/marketing/avaliacoes" element={<ProtectedRoute perm="marketing:view"><AvaliacoesPage /></ProtectedRoute>} />
        <Route path="/marketing/cashback" element={<ProtectedRoute perm="marketing:view"><CashbackPage /></ProtectedRoute>} />
        <Route path="/whatsapp" element={<IAAtendimentoPage />} />
        <Route path="/ia-atendimento" element={<IAAtendimentoPage />} />
        <Route path="/configuracoes" element={<ProtectedRoute perm="config:view"><ConfiguracoesPage /></ProtectedRoute>} />
        <Route path="/ajuda" element={<AjudaPage />} />
        <Route path="/ajuda/suporte" element={<AjudaPage />} />
        <Route path="/ajuda/base-conhecimento" element={<AjudaPage />} />
        <Route path="/ajuda/feedback" element={<AjudaPage />} />
        <Route path="/ajuda/novidades" element={<AjudaPage />} />
        <Route path="/ajuda/artigo/:slug" element={<HelpArticlePage />} />
        <Route path="/indique" element={<IndiquePage />} />
        <Route path="/perfil/assinatura" element={<PerfilAssinaturaPage />} />
        <Route path="/perfil/adicionais" element={<PerfilAdicionaisPage />} />
        <Route path="/perfil" element={<PerfilPage />} />
        <Route path="/notificacoes" element={<NotificacoesCategoriasPage />} />
        <Route path="/notificacoes/:tipo" element={<NotificacoesDetalhePage />} />
        <Route path="/indique-e-ganhe" element={<div className="p-6"><h1 className="text-2xl font-bold">Indique e ganhe</h1><p className="mt-2 text-muted-ink">Em breve.</p></div>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DashboardLayout>
  );
}

export function App() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();

  // Hand off from the pre-hydration HTML splash to React exactly once, the
  // first time the session query resolves. Until this fires, the splash sits
  // on top of everything and any React tree can render null underneath.
  useHideSplashWhenReady(!isPending);

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
      {/* FASE RBAC — aceite de convite é PÚBLICO: fica FORA do gate de sessão
          (ProtectedRoutes) para abrir sem login. Precisa vir antes do "/*". */}
      <Route path="/convite/:token" element={<ConvitePage />} />
      <Route
        path="/login"
        element={
          // Só oculta no PRIMEIRO load (sem session). Refetch em background
          // (blur/focus) mantém a rota renderizada com session cached.
          (isPending && !session) ? null : session ? (
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
