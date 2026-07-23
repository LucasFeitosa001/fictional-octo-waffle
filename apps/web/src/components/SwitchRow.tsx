import { Switch } from '@heroui/react';
import type { ReactNode } from 'react';

/**
 * Switch on/off PADRÃO do app — HeroUI v3 Switch (o mesmo do card de Campanhas).
 * Use `AppSwitch`/`SwitchRow` em TODO toggle do app; nada de switch feito à mão
 * (role="switch") nem componentes `Toggle` locais duplicados.
 *
 * API HeroUI v3 (confirmada): `isSelected` + `onChange: (v: boolean) => void`.
 */

interface AppSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  isDisabled?: boolean;
  'aria-label'?: string;
}

/** Só o toggle (sem label). Passe `aria-label` para acessibilidade. */
export function AppSwitch({
  checked,
  onChange,
  isDisabled,
  'aria-label': ariaLabel,
}: AppSwitchProps) {
  return (
    <Switch
      isSelected={checked}
      onChange={onChange}
      isDisabled={isDisabled}
      aria-label={ariaLabel}
    >
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
    </Switch>
  );
}

interface SwitchRowProps {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  isDisabled?: boolean;
  className?: string;
}

/**
 * Linha de configuração: rótulo (+ descrição opcional) à esquerda e o switch à
 * direita — o layout usado nas telas de Configurações/Personalização.
 */
export function SwitchRow({
  label,
  description,
  checked,
  onChange,
  isDisabled,
  className,
}: SwitchRowProps) {
  return (
    <div
      className={['flex items-center justify-between gap-4', className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        {description ? (
          <div className="text-xs text-muted-ink">{description}</div>
        ) : null}
      </div>
      <AppSwitch
        checked={checked}
        onChange={onChange}
        isDisabled={isDisabled}
        aria-label={typeof label === 'string' ? label : undefined}
      />
    </div>
  );
}
