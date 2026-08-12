import { AppSwitch } from './SwitchRow';

/**
 * Switch inline com rótulo clicável à direita — o padrão do Belasis para
 * opções soltas dentro de um formulário ("Encaixar agendamento", "Mostrar
 * comissões anteriores", "Receita organizacional").
 *
 * Vive aqui porque já existia copiado em duas telas (agendamento e transações)
 * e a de comissões seria a terceira. Rótulo clicável não é enfeite: o alvo de
 * toque de um switch é pequeno demais no celular, e quem tenta acertar só o
 * switch erra.
 */
export function InlineToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <AppSwitch checked={checked} onChange={onChange} aria-label={label || 'Alternar'} />
      {label && (
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={'text-sm ' + (checked ? 'font-medium text-foreground' : 'text-muted')}
        >
          {label}
        </button>
      )}
    </span>
  );
}
