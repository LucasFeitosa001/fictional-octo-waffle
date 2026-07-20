import { type ReactNode } from 'react';
import { Tooltip } from '@heroui/react';
import { IconInfo } from './icons';

// <HelpTooltip>Texto explicativo</HelpTooltip>  → ícone ⓘ com tooltip on hover.
// Reproduz o padrão Belasis (question-circle ao lado do label).
export function HelpTooltip({
  children,
  placement = 'top',
  size = 14,
  className = 'ml-1 inline-flex items-center text-muted-ink hover:text-ink',
}: {
  children: ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
  size?: number;
  className?: string;
}) {
  return (
    <Tooltip delay={0}>
      <Tooltip.Trigger className={className}>
        <IconInfo size={size} aria-label="Ajuda" />
      </Tooltip.Trigger>
      <Tooltip.Content
        placement={placement}
        className="max-w-[280px] rounded-md border border-line bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg"
      >
        {children}
      </Tooltip.Content>
    </Tooltip>
  );
}

// Wrapper conveniente pra label + tooltip inline: <LabelWithHelp label="X" help="..."/>
export function LabelWithHelp({
  label,
  help,
  className = 'text-sm font-medium text-ink',
  htmlFor,
}: {
  label: ReactNode;
  help: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label className={`inline-flex items-center gap-1 ${className}`} htmlFor={htmlFor}>
      <span>{label}</span>
      <HelpTooltip>{help}</HelpTooltip>
    </label>
  );
}
