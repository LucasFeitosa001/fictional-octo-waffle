import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import {
  NOTIF_CATEGORIES,
  useNotificationSummary,
} from '../lib/queries/notificacoes';
import { IconBell, IconCalendar, IconChevron, IconX } from '../components/icons';

// Contagens REAIS via GET /notifications/summary (agregação por tipo no
// backend). Cada categoria mapeia para tipos `appointment.*` reais — sem
// números fake. Slugs/tipos vivem em lib/queries/notificacoes.ts.
type NotifIcon = ComponentType<{ size?: number; className?: string }>;

const CATEGORY_ICON: Record<string, NotifIcon> = {
  agendamentos: IconCalendar,
  'agendamentos-cancelados': IconX,
};

export function NotificacoesCategoriasPage() {
  const navigate = useNavigate();
  const summary = useNotificationSummary();

  if (summary.isLoading) return <LoadingState />;
  if (summary.isError) {
    return (
      <div>
        <PageHeader title="Notificações" subtitle="Escolha uma categoria" />
        <ErrorState onRetry={() => summary.refetch()} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Notificações" subtitle="Escolha uma categoria" />

      {NOTIF_CATEGORIES.length === 0 ? (
        <EmptyState
          icon={<IconBell size={32} />}
          title="Nenhuma categoria disponível"
        />
      ) : (
        <ul className="flex flex-col">
          {NOTIF_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICON[cat.slug] ?? IconBell;
            const count = summary.unreadForCategory(cat.types);
            return (
              <li key={cat.slug}>
                <button
                  type="button"
                  onClick={() => navigate(`/notificacoes/${cat.slug}`)}
                  className="flex w-full items-center gap-3 border-b border-[var(--color-soft-border)] px-1 py-3 text-left transition-colors hover:bg-cream/60"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-foreground">
                    <Icon size={18} />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {cat.label}
                  </span>
                  {count > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-white">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                  <IconChevron size={16} className="-rotate-90 text-muted" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
