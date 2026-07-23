import { useNavigate } from 'react-router-dom';
import { Spinner } from '@heroui/react';
import { IconCheck } from './icons';
import { initials } from '../lib/format';
import {
  useMinhasContas,
  useSwitchCompany,
  type MinhaConta,
} from '../lib/queries/contas';

/**
 * FASE RBAC — seletor de empresa ativa (multi-conta).
 *
 * Lista as empresas do usuário (useMinhasContas), destaca a ativa com um check e,
 * ao clicar em outra, chama useSwitchCompany — que derruba o cache (troca de
 * tenant) e, no onSuccess desta UI, navega pra /painel.
 *
 * Só faz sentido quando há MAIS de uma conta: por padrão retorna null quando
 * `contas.length <= 1`. Passe `showSingle` pra forçar a renderização mesmo com
 * uma conta só (ex.: dentro de um menu que sempre mostra a empresa atual).
 *
 * Estilo: cartões warm-white do app (mesmos tokens de Topbar/Sidebar). Confirme
 * os componentes HeroUI reais antes de trocar (aqui usamos só <Spinner>).
 */
export interface CompanySwitcherProps {
  /** Renderiza mesmo quando há só uma conta. Padrão: false (retorna null). */
  showSingle?: boolean;
  /** Chamado após trocar com sucesso, antes da navegação (ex.: fechar menu). */
  onSwitched?: () => void;
  /** Destino após a troca. Padrão: '/painel'. Passe null pra não navegar. */
  redirectTo?: string | null;
  className?: string;
}

export function CompanySwitcher({
  showSingle = false,
  onSwitched,
  redirectTo = '/painel',
  className,
}: CompanySwitcherProps) {
  const navigate = useNavigate();
  const { data: contas, isLoading } = useMinhasContas();
  const switchCompany = useSwitchCompany();

  // Carregando a lista: um spinner discreto (não piscar UI).
  if (isLoading) {
    return (
      <div
        className={[
          'flex items-center justify-center px-3 py-4 text-muted',
          className ?? '',
        ].join(' ')}
      >
        <Spinner size="sm" />
      </div>
    );
  }

  const lista = contas ?? [];
  // Só uma conta (ou nenhuma) → não há o que alternar.
  if (!showSingle && lista.length <= 1) return null;

  function handleSelect(conta: MinhaConta) {
    if (conta.active || switchCompany.isPending) return;
    switchCompany.mutate(conta.companyId, {
      onSuccess: () => {
        onSwitched?.();
        if (redirectTo) navigate(redirectTo);
      },
    });
  }

  return (
    <div className={['flex flex-col gap-1', className ?? ''].join(' ')} role="menu">
      {lista.map((conta) => {
        // Só a linha em troca mostra spinner (evita travar todas).
        const isSwitching =
          switchCompany.isPending && switchCompany.variables === conta.companyId;
        return (
          <button
            key={conta.companyId}
            type="button"
            role="menuitemradio"
            aria-checked={conta.active}
            onClick={() => handleSelect(conta)}
            disabled={conta.active || switchCompany.isPending}
            className={[
              'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
              conta.active
                ? 'bg-cream'
                : 'hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60',
            ].join(' ')}
          >
            {/* Logo da empresa ou iniciais no quadrado dourado do app. */}
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-gold text-sm font-bold text-ink">
              {conta.logoUrl ? (
                <img
                  src={conta.logoUrl}
                  alt={conta.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials(conta.name)
              )}
            </span>

            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold text-foreground">
                {conta.name}
              </span>
              {conta.roleName && (
                <span className="block truncate text-xs text-muted">
                  {conta.roleName}
                </span>
              )}
            </span>

            {/* Ativa → check; trocando → spinner. */}
            {isSwitching ? (
              <Spinner size="sm" />
            ) : conta.active ? (
              <span className="shrink-0 text-pink" aria-label="Empresa ativa">
                <IconCheck size={18} />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
