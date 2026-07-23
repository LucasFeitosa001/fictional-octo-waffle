import type { ReactNode } from 'react';
import { Checkbox } from '@heroui/react';

/**
 * Checkbox de FILTRO das páginas de listagem, construído sobre o `Checkbox`
 * do HeroUI v3 (compound: Root + Content + Control + Indicator).
 *
 * Uniformiza os antigos `CheckRow`/`CheckboxRow`/`Check` locais (que usavam
 * `<input type="checkbox">` cru ou `<button>` com SVG/dot desenhado à mão).
 *
 * API compatível com os dois padrões que existiam no app:
 *  - controlado por valor:  `onChange(next: boolean)`  (era o `CheckRow` tipo `<label>`)
 *  - toggle simples:        `onToggle()`               (era o `CheckRow` tipo `<button>`)
 *
 * O `Checkbox.Indicator` sem children já renderiza o checkmark SVG animado do
 * HeroUI. `isSelected`/`onChange` são a API real do react-aria por baixo.
 */
export function FilterCheckbox({
  checked,
  onChange,
  onToggle,
  children,
  className = '',
  isDisabled,
  isIndeterminate,
}: {
  checked: boolean;
  /** Recebe o novo estado (true/false). */
  onChange?: (next: boolean) => void;
  /** Alternativa a `onChange` para quem só quer alternar. */
  onToggle?: () => void;
  children: ReactNode;
  className?: string;
  isDisabled?: boolean;
  /** Estado "parcial" (ex: um "Selecionar tudo" com seleção parcial). */
  isIndeterminate?: boolean;
}) {
  return (
    <Checkbox
      isSelected={checked}
      isDisabled={isDisabled}
      isIndeterminate={isIndeterminate}
      onChange={(next) => {
        onChange?.(next);
        onToggle?.();
      }}
      className={`flex w-full items-center gap-2 text-sm text-ink ${className}`}
    >
      <Checkbox.Content className="flex min-w-0 items-center gap-2">
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <span className="min-w-0 truncate">{children}</span>
      </Checkbox.Content>
    </Checkbox>
  );
}
