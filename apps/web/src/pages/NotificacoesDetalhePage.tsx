import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@heroui/react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/States';
import { useSetPageActions } from '../layout/PageActions';
import {
  IconBell,
  IconCheck,
  IconChevron,
  IconGrip,
  IconPlus,
} from '../components/icons';

// TODO backend: mapear cada `tipo` para uma query real (novidades,
// agendamentos, etc). Por enquanto só temos o placeholder de novidades.
const TIPO_LABEL: Record<string, string> = {
  novidades: 'Novidades',
  agendamentos: 'Agendamentos',
  'agendamentos-cancelados': 'Agendamentos cancelados',
  avaliacoes: 'Avaliações',
  'respostas-sms': 'Respostas (SMS)',
  'retornos-clientes': 'Retornos de clientes',
  'pagamentos-online': 'Pagamentos online',
};

type Novidade = { id: string; titulo: string; data: string };

// TODO backend: substituir por GET /notifications/novidades quando existir.
const MOCK_NOVIDADES: Novidade[] = [
  {
    id: 'n1',
    titulo: 'Novo módulo de comissões disponível',
    data: '18/07/2026',
  },
  {
    id: 'n2',
    titulo: 'Agora você pode importar clientes via CSV',
    data: '10/07/2026',
  },
];

export function NotificacoesDetalhePage() {
  const { tipo } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  const label = (tipo && TIPO_LABEL[tipo]) ?? 'Notificações';

  // Bottom action bar (mobile): Menu / Marcar como lida / Mostrar mais.
  // Desktop já exibe os mesmos botões inline no rodapé desta página.
  useSetPageActions(
    [
      {
        key: 'notif-menu',
        label: 'Menu',
        icon: <IconGrip size={22} />,
        // TODO backend: abrir menu de contexto quando houver ações reais.
        onClick: () => {},
      },
      {
        key: 'notif-marcar-lida',
        label: 'Marcar lida',
        icon: <IconCheck size={22} />,
        // TODO backend: POST /notifications/read-all filtrado por tipo.
        onClick: () => {},
      },
      {
        key: 'notif-mostrar-mais',
        label: 'Mais',
        icon: <IconPlus size={22} />,
        // TODO backend: paginação — carregar próxima página.
        onClick: () => {},
      },
    ],
    [tipo],
  );

  const items = useMemo<Novidade[]>(() => {
    if (tipo === 'novidades') return MOCK_NOVIDADES;
    // TODO backend: demais tipos ainda não têm dados reais.
    return [];
  }, [tipo]);

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/notificacoes')}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        aria-label="Voltar"
      >
        <IconChevron size={16} className="rotate-90" /> Voltar
      </button>

      <PageHeader title={label} />

      {items.length === 0 ? (
        <EmptyState
          icon={<IconBell size={32} />}
          title="Nenhum item encontrado"
          description="Assim que houver novidades, elas aparecem aqui."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-[var(--color-soft-border)] bg-warm-white px-3 py-3 shadow-[var(--shadow-card)]"
            >
              <div className="text-sm font-medium text-foreground">
                {n.titulo}
              </div>
              <div className="mt-1 text-xs text-muted">{n.data}</div>
            </li>
          ))}
        </ul>
      )}

      {/* Bottom action bar (desktop). Mobile usa a BottomNav via useSetPageActions. */}
      <div className="mt-6 hidden md:flex items-center justify-center gap-2 border-t border-[var(--color-soft-border)] pt-4">
        <Button variant="outline" onClick={() => { /* TODO backend: menu */ }}>
          <IconGrip size={16} /> Menu
        </Button>
        <Button
          variant="outline"
          onClick={() => { /* TODO backend: marcar como lida */ }}
        >
          <IconCheck size={16} /> Marcar como lida
        </Button>
        <Button
          variant="outline"
          onClick={() => { /* TODO backend: paginação */ }}
        >
          <IconPlus size={16} /> Mostrar mais
        </Button>
      </div>
    </div>
  );
}
