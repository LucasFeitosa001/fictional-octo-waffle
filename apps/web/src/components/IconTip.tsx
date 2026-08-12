import { type ReactNode, type MouseEventHandler } from 'react';
import { Tooltip } from '@heroui/react';

/**
 * IconTip — envolve uma AÇÃO DE ÍCONE e mostra o rótulo textual num Tooltip
 * (HeroUI v3) ao passar o mouse ou focar. Padroniza a acessibilidade dos botões
 * de ícone das toolbars/linhas de tabela: rótulo visível no hover + `aria-label`
 * garantido para leitores de tela.
 *
 * O Tooltip do React Aria precisa de um gatilho com CAIXA REAL — nunca usamos
 * `display:contents`. Aqui o `Tooltip.Trigger` renderiza o próprio elemento
 * (um <button> no modo botão, ou um wrapper <span> em volta do filho no modo
 * embrulho), garantindo posicionamento correto.
 *
 * Dois modos de uso:
 *
 *  1) Passando o ícone + comportamento e deixando o IconTip renderizar o botão
 *     (recomendado — mais enxuto no call-site):
 *       <IconTip label="Editar" onClick={...}>
 *         <IconPencil size={16} />
 *       </IconTip>
 *     Renderiza um <button aria-label="Editar"> real com o feedback de hover
 *     consistente (`.btn-ghost-hover`). Basta passar `onClick` (ou `asButton`).
 *
 *  2) Embrulhando um botão/ação que você já montou (o filho continua sendo o
 *     elemento clicável; o IconTip só adiciona o tooltip):
 *       <IconTip label="Editar">
 *         <button aria-label="Editar" onClick={...}><IconPencil /></button>
 *       </IconTip>
 *     Use quando o botão tem estilo/estado próprio. O `label` vira aria-label de
 *     fallback no wrapper caso o filho não traga o seu.
 */

type Placement = 'top' | 'right' | 'bottom' | 'left';

interface IconTipCommonProps {
  /** Rótulo textual mostrado no tooltip e usado como aria-label. */
  label: string;
  /** Conteúdo do gatilho: o ícone (modo 1) ou o botão pronto (modo 2). */
  children: ReactNode;
  /** Posição do tooltip relativo ao gatilho. Default 'top'. */
  placement?: Placement;
  /** Atraso de exibição em ms. Default 300. */
  delay?: number;
  /** Mostra a setinha apontando para o gatilho. Default true. */
  showArrow?: boolean;
  /** Classe extra no elemento gatilho. */
  className?: string;
}

type IconTipProps =
  | (IconTipCommonProps & {
      /** Modo 1: IconTip renderiza o próprio <button>. Implícito se houver onClick. */
      asButton?: boolean;
      onClick?: MouseEventHandler<HTMLButtonElement>;
      type?: 'button' | 'submit' | 'reset';
      disabled?: boolean;
    })
  | (IconTipCommonProps & {
      asButton?: undefined;
      onClick?: undefined;
      type?: undefined;
      disabled?: undefined;
    });

export function IconTip(props: IconTipProps) {
  const {
    label,
    children,
    placement = 'top',
    delay = 300,
    showArrow = true,
    className,
  } = props;

  // Modo 1 (renderiza o botão) se pediram explicitamente ou passaram onClick.
  const renderOwnButton = props.asButton === true || props.onClick != null;

  const content = (
    <Tooltip.Content
      placement={placement}
      showArrow={showArrow}
      className="max-w-[240px] rounded-md border border-line bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg"
    >
      {showArrow ? <Tooltip.Arrow /> : null}
      {label}
    </Tooltip.Content>
  );

  if (renderOwnButton) {
    // <button> real com caixa própria — gatilho válido para o React Aria Tooltip.
    // `.btn-ghost-hover` dá o feedback de hover consistente (cor primária) e as
    // classes de tamanho reproduzem os botões de ícone das toolbars/linhas.
    return (
      <Tooltip delay={delay}>
        <Tooltip.Trigger<'button'>
          type={props.type ?? 'button'}
          onClick={props.onClick}
          disabled={props.disabled}
          aria-label={label}
          className={
            'btn-ghost-hover inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-ink transition-colors' +
            (className ? ` ${className}` : '')
          }
        >
          {children}
        </Tooltip.Trigger>
        {content}
      </Tooltip>
    );
  }

  // Modo 2: o filho já é o elemento clicável. O Tooltip.Trigger renderiza um
  // <span inline-flex> (caixa real, sem display:contents) em volta dele e serve
  // de gatilho. O aria-label é fallback caso o filho não traga o seu.
  return (
    <Tooltip delay={delay}>
      <Tooltip.Trigger<'span'>
        aria-label={label}
        className={'inline-flex' + (className ? ` ${className}` : '')}
      >
        {children}
      </Tooltip.Trigger>
      {content}
    </Tooltip>
  );
}
