import { useState, type ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { AppSwitch } from '../../components/SwitchRow';

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
  id: string;
  title: string;
  description: ReactNode;
  defaultOn: boolean;
}

const SETTINGS: SettingSwitch[] = [
  {
    id: 'retroactive',
    title: 'Permitir lançamentos retroativos?',
    description:
      'Ative essa opção se precisar lançar recebimentos e despesas com datas anteriores à atual. Lançamentos retroativos podem comprometer o seu caixa.',
    defaultOn: true,
  },
  {
    id: 'can_edit_bill_after_close_cash_accounting',
    title: 'Permitir alterações de faturas após a sua conferência no caixa?',
    description: (
      <>
        Se <strong>sim</strong>, será possível alterar todas as informações dos
        recebimentos e despesas.
        <br />
        Se <strong>não</strong>, somente o valor poderá ser alterado.
      </>
    ),
    defaultOn: true,
  },
  {
    id: 'can_transaction_closed_cash_accounting',
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
    defaultOn: false,
  },
  {
    id: 'multiple_cash_accounting',
    title: 'Permitir múltiplos caixas por operador?',
    description:
      'Permite que cada operador abra e feche o próprio caixa de forma independente. Você pode conceder ou não a permissão para que cada profissional consiga visualizar todos os caixas ou somente o seu próprio caixa.',
    defaultOn: false,
  },
];

export function FinanceiroConfiguracoesPage() {
  // TODO: substituir por hook/query real (salon_configuration) quando a API de
  // configurações financeiras estiver disponível; hoje mantém estado local.
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SETTINGS.map((s) => [s.id, s.defaultOn])),
  );

  const toggle = (id: string) => {
    setState((prev) => ({ ...prev, [id]: !prev[id] }));
    // TODO: persistir alteração no back-end (salon_configuration_attributes).
  };

  return (
    <div>
      <PageHeader title="Configurações" />

      {/* Container do form: fundo transparente, largura total (z3olam). */}
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
                checked={state[setting.id]}
                onChange={() => toggle(setting.id)}
                aria-label={setting.title}
              />
            </div>
          </div>
        ))}
      </form>
    </div>
  );
}
