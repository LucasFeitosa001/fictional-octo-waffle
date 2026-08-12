import type { ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { AppSwitch } from '../../components/SwitchRow';
import { ErrorState, LoadingState } from '../../components/States';
import {
  useFinanceSettings,
  useUpdateFinanceSettings,
  type FinanceSettings,
} from '../../lib/queries/financeiro';

/**
 * FinanceiroConfig — clone fiel da tela /finance/settings do Belasis.
 *
 * A tela do Belasis é um formulário de configurações do módulo financeiro:
 * uma lista de linhas (`wb__sc-nvq6fg-0`) com rótulo + descrição à esquerda e
 * um switch (ant-switch) à direita, separadas por divisórias inferiores. O
 * container (`wb__sc-z3olam-0`) tem fundo transparente (background: unset).
 *
 * Não há tabela, abas, gráficos nem drawer nesta tela — é apenas o form de
 * toggles. Estrutura e textos batem 1:1 com o HTML capturado.
 */

interface SettingSwitch {
  /** id do atributo no salon_configuration do Belasis (para wiring futuro). */
  id: keyof FinanceSettings;
  title: string;
  description: ReactNode;
}

const SETTINGS: SettingSwitch[] = [
  {
    id: 'allowRetroactive',
    title: 'Permitir lançamentos retroativos?',
    description:
      'Ative essa opção se precisar lançar recebimentos e despesas com datas anteriores à atual. Lançamentos retroativos podem comprometer o seu caixa.',
  },
  {
    id: 'allowEditAfterCashClose',
    title: 'Permitir alterações de faturas após a sua conferência no caixa?',
    description: (
      <>
        Se <strong>sim</strong>, será possível alterar todas as informações dos
        recebimentos e despesas.
        <br />
        Se <strong>não</strong>, lançamentos de comandas já conferidos em um
        caixa fechado não poderão ser alterados, reabertos ou excluídos.
      </>
    ),
  },
  {
    id: 'allowTransactionsWithClosedCash',
    title: 'Permitir movimentações financeiras com o caixa fechado?',
    description: (
      <>
        Se <strong>sim</strong>, você permite que inserções, edições e exclusões
        financeiras sejam realizadas dentro do sistema mesmo com o caixa fechado.
        <br />
        Se <strong>não</strong>, um aviso será exibido no momento de realizar
        alguma transação financeira pedindo a abertura do caixa.
      </>
    ),
  },
  {
    id: 'allowMultipleCash',
    title: 'Permitir múltiplos caixas por operador?',
    description:
      'Permite que cada operador abra e feche o próprio caixa de forma independente. Você pode conceder ou não a permissão para que cada profissional consiga visualizar todos os caixas ou somente o seu próprio caixa.',
  },
];

export function FinanceiroConfiguracoesPage() {
  const query = useFinanceSettings();
  const update = useUpdateFinanceSettings();

  const toggle = (id: keyof FinanceSettings) => {
    if (!query.data || update.isPending) return;
    update.mutate({ [id]: !query.data[id] });
  };

  return (
    <div>
      <PageHeader title="Configurações" />

      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : null}
      {update.isError ? (
        <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Não foi possível salvar a configuração. Tente novamente.
        </p>
      ) : null}

      {/* Cada switch persiste imediatamente no Setting finance.settings. */}
      {query.data ? (
      <form
        className="w-full"
        onSubmit={(e) => e.preventDefault()}
      >
        {SETTINGS.map((setting) => (
          <div
            key={setting.id}
            // wb__sc-nvq6fg-0: flex space-between, border-bottom rgba(0,0,0,.1), padding 20px 0
            className="flex w-full items-center justify-between border-b border-line py-5 last:border-b-0"
          >
            <div className="flex min-w-0 flex-col pr-5">
              <span className="flex items-center text-[15px] leading-tight text-foreground">
                {setting.title}
              </span>
              <span className="mt-1 text-[14px] leading-snug text-muted-ink sm:text-xs">
                {setting.description}
              </span>
            </div>
            <div className="flex shrink-0 justify-start">
              <AppSwitch
                checked={query.data[setting.id]}
                onChange={() => toggle(setting.id)}
                isDisabled={update.isPending}
                aria-label={setting.title}
              />
            </div>
          </div>
        ))}
      </form>
      ) : null}
    </div>
  );
}
