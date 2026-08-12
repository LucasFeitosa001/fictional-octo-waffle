import { useEffect } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useSession } from '../lib/auth';
import { useCan } from '../lib/queries/permissions';
import { useEmpresa } from '../lib/queries/empresa';
import { LoginPage } from '../pages/LoginPage';
import { IAAtendimentoPage } from '../pages/ia/IAAtendimentoPage';
import { ConfirmProvider } from '../components/ConfirmDialog';
import { FeatureGate } from '../components/FeatureGate';
import { IconSparkles, IconBot, IconHome, IconChevron } from '../components/icons';
import { urlDoPainel } from '../lib/aiHost';
import { AiDadosPage } from './AiDadosPage';

/**
 * Casca da ÁREA DE IA (`ai.salonpass.com.br`) — estudo 62.
 *
 * Mesmo bundle do painel, servido em outro hostname; quem decide é
 * `isAiHost()`, chamado no App. Aqui não existe a sidebar do painel: é um
 * produto separado, com duas seções (Dados e Atendimento).
 *
 * Login: NÃO há segundo login. O cookie de sessão vale para
 * `salonpass.com.br` inteiro (`crossSubDomainCookies` no backend), então quem
 * entrou no painel chega aqui logado. Se cair sem sessão — link direto, cookie
 * limpo — a mesma tela de login do painel é montada aqui, e o cookie que ela
 * cria serve os dois domínios.
 */
export function AiApp() {
  const { data: session, isPending } = useSession();
  const { can, isLoading: carregandoPermissoes } = useCan();
  const empresa = useEmpresa();

  useEffect(() => {
    document.title = 'SalonPass IA';
  }, []);

  // Primeiro load sem sessão em cache: espera. Refetch em background não
  // apaga a tela (mesma regra do painel).
  if (isPending && !session) return null;
  if (!session) return <LoginPage />;

  return (
    <ConfirmProvider>
      <div className="min-h-screen bg-canvas">
        <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <IconSparkles size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                SalonPass IA
                <span className="ml-2 rounded-full bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Beta
                </span>
              </p>
              <p className="truncate text-xs text-muted-ink">
                {empresa.data?.name ?? 'Carregando…'}
              </p>
            </div>
            <a
              href={urlDoPainel('/painel')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-canvas"
            >
              <IconHome size={14} />
              <span className="hidden sm:inline">Painel</span>
              <span className="rotate-90 text-muted-ink">
                <IconChevron size={12} />
              </span>
            </a>
          </div>

          <nav className="mx-auto flex max-w-6xl gap-1 px-3 pb-2 sm:px-6">
            {[
              { to: '/', label: 'Dados', Icon: IconHome, end: true },
              { to: '/atendimento', label: 'Atendimento IA', Icon: IconBot, end: false },
            ].map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  [
                    'inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-[color-mix(in_oklab,var(--sp-primary)_14%,transparent)] text-primary'
                      : 'text-muted-ink hover:text-ink',
                  ].join(' ')
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-6">
          {carregandoPermissoes ? null : can('config:manage') ? (
            <Routes>
              <Route path="/" element={<AiDadosPage />} />
              {/* A recepcionista virtual é do plano com WhatsApp. Sem o gate a
                  página montava e tomava 402 em cada chamada — a tela ficava
                  quebrada em vez de oferecer o plano. */}
              <Route
                path="/atendimento"
                element={
                  <FeatureGate feature="whatsapp_api">
                    <IAAtendimentoPage />
                  </FeatureGate>
                }
              />
              {/* Link antigo do painel abre a aba certa aqui. */}
              <Route path="/ia-atendimento" element={<Navigate to="/atendimento" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          ) : (
            <AreaRestrita />
          )}
        </main>
      </div>
    </ConfirmProvider>
  );
}

/**
 * Sem `config:manage` não entra: esta área mostra faturamento e dados de
 * clientes do salão inteiro. Decisão do dono nesta sessão (estudo 62).
 */
function AreaRestrita() {
  return (
    <section className="rounded-2xl border border-line bg-card p-6 text-center shadow-[var(--shadow-card)]">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-muted-ink">
        <IconSparkles size={22} />
      </span>
      <h1 className="mt-4 text-base font-semibold text-ink">
        Área restrita ao administrador
      </h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-ink">
        A área de IA reúne os dados do salão inteiro — faturamento, clientes e
        conversas. Só quem administra a conta pode abrir. Peça ao dono do salão
        se você precisa desse acesso.
      </p>
      <a
        href={urlDoPainel('/painel')}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <IconHome size={15} />
        Voltar ao painel
      </a>
    </section>
  );
}
