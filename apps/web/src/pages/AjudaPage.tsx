import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@heroui/react';
import { PageHeader } from '../components/PageHeader';
import {
  IconCalendar,
  IconChevron,
  IconInfo,
  IconLayers,
  IconPercent,
  IconReceipt,
  IconScissors,
  IconUsers,
} from '../components/icons';

interface Topic {
  to: string;
  title: string;
  description: string;
  icon: ReactNode;
}

const TOPICS: Topic[] = [
  {
    to: '/agenda',
    title: 'Agenda e agendamentos',
    description: 'Marcar, remarcar e acompanhar os horários da equipe.',
    icon: <IconCalendar size={20} />,
  },
  {
    to: '/comandas',
    title: 'Comandas e vendas',
    description: 'Abrir comandas, lançar itens e receber pagamentos.',
    icon: <IconReceipt size={20} />,
  },
  {
    to: '/clientes',
    title: 'Clientes',
    description: 'Cadastrar clientes e acompanhar o histórico de cada um.',
    icon: <IconUsers size={20} />,
  },
  {
    to: '/servicos',
    title: 'Serviços e catálogo',
    description: 'Definir preços, duração e disponibilidade online.',
    icon: <IconScissors size={20} />,
  },
  {
    to: '/pacotes',
    title: 'Pacotes e assinaturas',
    description: 'Vender pacotes de sessões e planos recorrentes.',
    icon: <IconLayers size={20} />,
  },
  {
    to: '/comissoes',
    title: 'Comissões',
    description: 'Acompanhar e pagar as comissões da equipe.',
    icon: <IconPercent size={20} />,
  },
];

export function AjudaPage() {
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader title="Ajuda" subtitle="Guias rápidos e primeiros passos no Salonpass" />

      <Card className="mb-4 border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="flex items-start gap-3 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
            <IconInfo size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Precisa de ajuda?</p>
            <p className="mt-1 text-sm text-muted">
              Escolha um tema abaixo para ir direto à área correspondente. Para dúvidas específicas
              da sua conta, fale com o suporte pelo canal de atendimento do Salonpass.
            </p>
          </div>
        </Card.Content>
      </Card>

      <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="p-3 sm:p-4">
          <div className="mb-2 px-1 text-sm font-semibold text-foreground">Temas comuns</div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TOPICS.map((topic) => (
              <li key={topic.to}>
                <button
                  type="button"
                  onClick={() => navigate(topic.to)}
                  className="flex w-full items-center gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white p-3 text-left transition-colors hover:border-[#f2b33d]/50 hover:bg-[#f2b33d]/[0.06]"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#111111] text-[#f2b33d]">
                    {topic.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      {topic.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">{topic.description}</span>
                  </span>
                  <span className="shrink-0 text-muted">
                    <IconChevron size={18} className="-rotate-90" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card.Content>
      </Card>
    </div>
  );
}
