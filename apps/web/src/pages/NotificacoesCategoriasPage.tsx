import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import {
  IconCalendar,
  IconChevron,
  IconCreditCard,
  IconMessage,
  IconRepeat,
  IconSparkles,
  IconStar,
  IconX,
} from '../components/icons';

// TODO backend: substituir contagens mockadas pela agregação real
// (GET /notifications/categories) quando o endpoint existir.
type NotifIcon = ComponentType<{ size?: number; className?: string }>;

type NotifCategory = {
  tipo: string;
  label: string;
  Icon: NotifIcon;
  count: number;
};

const CATEGORIES: NotifCategory[] = [
  { tipo: 'novidades', label: 'Novidades', Icon: IconSparkles, count: 0 },
  { tipo: 'agendamentos', label: 'Agendamentos', Icon: IconCalendar, count: 0 },
  {
    tipo: 'agendamentos-cancelados',
    label: 'Agendamentos cancelados',
    Icon: IconX,
    count: 0,
  },
  { tipo: 'avaliacoes', label: 'Avaliações', Icon: IconStar, count: 0 },
  { tipo: 'respostas-sms', label: 'Respostas (SMS)', Icon: IconMessage, count: 0 },
  {
    tipo: 'retornos-clientes',
    label: 'Retornos de clientes',
    Icon: IconRepeat,
    count: 0,
  },
  {
    tipo: 'pagamentos-online',
    label: 'Pagamentos online',
    Icon: IconCreditCard,
    count: 0,
  },
];

export function NotificacoesCategoriasPage() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader title="Notificações" subtitle="Escolha uma categoria" />

      <ul className="flex flex-col">
        {CATEGORIES.map(({ tipo, label, Icon, count }) => (
          <li key={tipo}>
            <button
              type="button"
              onClick={() => navigate(`/notificacoes/${tipo}`)}
              className="flex w-full items-center gap-3 border-b border-[var(--color-soft-border)] px-1 py-3 text-left transition-colors hover:bg-cream/60"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-foreground">
                <Icon size={18} />
              </span>
              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {label}
              </span>
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
              <IconChevron
                size={16}
                className="-rotate-90 text-muted"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
