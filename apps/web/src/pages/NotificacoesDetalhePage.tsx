import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@heroui/react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { useSetPageActions } from '../layout/PageActions';
import { formatDateTime } from '../lib/format';
import {
  categoryBySlug,
  NOTIF_TYPE_LABEL,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsByType,
  type NotificationItem,
} from '../lib/queries/notificacoes';
import { IconBell, IconCheck, IconChevron, IconPlus } from '../components/icons';

const PAGE_SIZE = 20;

export function NotificacoesDetalhePage() {
  const { tipo } = useParams<{ tipo: string }>();
  const navigate = useNavigate();
  const category = categoryBySlug(tipo);
  const label = category?.label ?? 'Notificações';

  // Paginação real por offset. Acumulamos as janelas já carregadas em `list`;
  // cada clique em "Mostrar mais" avança o offset em PAGE_SIZE e a página que
  // chega é mesclada (dedup por id) no `useEffect` abaixo.
  const [offset, setOffset] = useState(0);
  const [list, setList] = useState<NotificationItem[]>([]);

  const types = category?.types ?? [];
  const typeKey = types.join(',');
  const query = useNotificationsByType(types, { limit: PAGE_SIZE, offset });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const total = query.data?.total ?? 0;
  const unread = query.data?.unreadCount ?? 0;

  // Ao trocar de categoria, zera a paginação acumulada.
  const prevKey = useRef(typeKey);
  useEffect(() => {
    if (prevKey.current !== typeKey) {
      prevKey.current = typeKey;
      setOffset(0);
      setList([]);
    }
  }, [typeKey]);

  // Mescla a página recém-chegada no acumulado. offset 0 → substitui (também
  // pega refetches do poll); offset > 0 → concatena, deduplicando por id.
  const page = query.data?.data;
  useEffect(() => {
    if (!page) return;
    setList((prev) => {
      if (offset === 0) return page;
      const seen = new Set(prev.map((n) => n.id));
      return [...prev, ...page.filter((n) => !seen.has(n.id))];
    });
  }, [page, offset]);

  const hasMore = list.length < total;

  function handleShowMore() {
    if (query.isFetching || !hasMore) return;
    setOffset(list.length);
  }

  function markLocal(predicate: (n: NotificationItem) => boolean) {
    const now = new Date().toISOString();
    setList((prev) =>
      prev.map((it) => (predicate(it) && !it.readAt ? { ...it, readAt: now } : it)),
    );
  }

  function handleMarkOne(n: NotificationItem) {
    if (n.readAt || markRead.isPending) return;
    // Reflete localmente já (a query invalida e refaz a 1ª página; para as
    // páginas seguintes o estado local é a fonte da verdade).
    markLocal((it) => it.id === n.id);
    markRead.mutate(n.id);
  }

  function handleMarkAll() {
    if (unread === 0 || markAll.isPending || types.length === 0) return;
    markLocal(() => true);
    markAll.mutate(types);
  }

  // Bottom action bar (mobile): Marcar todas como lidas / Mostrar mais.
  useSetPageActions(
    [
      {
        key: 'notif-marcar-lida',
        label: 'Marcar lidas',
        icon: <IconCheck size={22} />,
        onClick: handleMarkAll,
      },
      {
        key: 'notif-mostrar-mais',
        label: 'Mais',
        icon: <IconPlus size={22} />,
        onClick: handleShowMore,
      },
    ],
    [tipo, unread, total, list.length],
  );

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

      <PageHeader
        title={label}
        subtitle={total > 0 ? `${total} no total • ${unread} não lidas` : undefined}
      />

      {!category ? (
        <EmptyState
          icon={<IconBell size={32} />}
          title="Categoria não encontrada"
          description="Volte e escolha uma categoria válida."
        />
      ) : query.isLoading || (list.length === 0 && query.isFetching) ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState onRetry={() => query.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<IconBell size={32} />}
          title="Nenhuma notificação"
          description="Assim que houver novidades desta categoria, elas aparecem aqui."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {list.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleMarkOne(n)}
                  className={`flex w-full flex-col gap-0.5 rounded-md border border-[var(--color-soft-border)] px-3 py-3 text-left shadow-[var(--shadow-card)] transition-colors ${
                    n.readAt ? 'bg-warm-white' : 'bg-primary/5 hover:bg-primary/10'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {!n.readAt && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                    )}
                    <span className="text-sm font-medium text-foreground">
                      {n.title}
                    </span>
                  </span>
                  {n.body && <span className="text-xs text-muted">{n.body}</span>}
                  <span className="mt-0.5 flex items-center gap-2 text-[11px] text-muted/80">
                    <span>{NOTIF_TYPE_LABEL[n.type] ?? n.type}</span>
                    <span aria-hidden>•</span>
                    <span>{formatDateTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Bottom action bar (desktop). Mobile usa a BottomNav via useSetPageActions. */}
          <div className="mt-6 flex flex-col items-center gap-2 border-t border-[var(--color-soft-border)] pt-4 md:flex-row md:justify-center">
            <Button
              variant="outline"
              onClick={handleMarkAll}
              isDisabled={unread === 0 || markAll.isPending}
            >
              <IconCheck size={16} />{' '}
              {markAll.isPending ? 'Marcando…' : 'Marcar todas como lidas'}
            </Button>
            {hasMore && (
              <Button
                variant="outline"
                onClick={handleShowMore}
                isDisabled={query.isFetching}
              >
                <IconPlus size={16} />{' '}
                {query.isFetching ? 'Carregando…' : 'Mostrar mais'}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
