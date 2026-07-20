import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { IconCheck } from '../../components/icons';

interface ModuleAction {
  label: string;
  /** Internal route (navigates within the app). */
  to?: string;
  /** External URL (opens in a new tab). */
  href?: string;
  icon?: ReactNode;
}

interface ModulePlaceholderProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  /** Optional status chip, e.g. "Em configuração". */
  statusLabel?: string;
  description: string;
  /** What the module will offer — shown as a checklist. */
  bullets?: string[];
  primaryAction?: ModuleAction;
  secondaryAction?: ModuleAction;
  /** Small footnote below the actions. */
  note?: string;
}

/**
 * Honest module page for features that are not backed by data yet.
 * No invented data — just an explanation of the module, an optional
 * "em configuração" status, and links to related real screens.
 */
export function ModulePlaceholder({
  title,
  subtitle,
  icon,
  statusLabel,
  description,
  bullets,
  primaryAction,
  secondaryAction,
  note,
}: ModulePlaceholderProps) {
  const navigate = useNavigate();

  function renderAction(action: ModuleAction, variant: 'primary' | 'outline') {
    const content = (
      <>
        {action.icon}
        {action.label}
      </>
    );
    if (action.href) {
      const base =
        'inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors sm:w-auto';
      const style =
        variant === 'primary'
          ? 'bg-gold text-ink shadow-[var(--shadow-gold)] hover:bg-[#e6a92f]'
          : 'border border-default-300 bg-white text-foreground hover:bg-default-50';
      return (
        <a
          href={action.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} ${style}`}
        >
          {content}
        </a>
      );
    }
    return (
      <Button
        variant={variant}
        className="w-full sm:w-auto"
        isDisabled={!action.to}
        onClick={() => action.to && navigate(action.to)}
      >
        {content}
      </Button>
    );
  }

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />

      <Card className="border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
        <Card.Content className="flex flex-col items-center gap-5 px-5 py-12 text-center sm:py-16">
          <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gold/15 text-gold-strong">
            {icon}
          </span>

          {statusLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-strong">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {statusLabel}
            </span>
          )}

          <div className="max-w-md">
            <h2 className="text-lg font-bold text-foreground">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
          </div>

          {bullets && bullets.length > 0 && (
            <ul className="flex w-full max-w-md flex-col gap-2 text-left">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-gold-strong">
                    <IconCheck size={13} />
                  </span>
                  <span className="leading-snug">{b}</span>
                </li>
              ))}
            </ul>
          )}

          {(primaryAction || secondaryAction) && (
            <div className="flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center">
              {primaryAction && renderAction(primaryAction, 'primary')}
              {secondaryAction && renderAction(secondaryAction, 'outline')}
            </div>
          )}

          {note && <p className="max-w-md text-xs text-muted">{note}</p>}
        </Card.Content>
      </Card>
    </div>
  );
}
