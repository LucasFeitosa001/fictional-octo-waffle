import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { toast, TOAST_TIMEOUT } from '../toast';
import { useMinhasContas } from './contas';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  /**
   * ID da entidade referenciada. Para `type` começando com `appointment.`,
   * carrega o `appointmentId` — é o que habilita o deep-link do sino → drawer
   * do agendamento em /agenda.
   */
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsResponse {
  data: NotificationItem[];
  total: number;
  unreadCount: number;
}

export interface NotificationSummaryResponse {
  types: { type: string; total: number; unread: number }[];
}

// ─── Taxonomia de categorias (front) ────────────────────────────────────────
// O backend emite `appointment.created | confirmed | canceled` e `crm.*`. Cada
// categoria da UI mapeia para um conjunto de tipos reais. NÃO inventar
// categorias sem tipo real por trás — se um dia surgirem novos tipos no
// backend, adicione a categoria aqui.
export interface NotifCategoryDef {
  /** slug da rota (/notificacoes/:tipo) */
  slug: string;
  label: string;
  /** tipos reais do backend que compõem esta categoria */
  types: string[];
}

export const NOTIF_CATEGORIES: NotifCategoryDef[] = [
  {
    slug: 'agendamentos',
    label: 'Agendamentos',
    types: ['appointment.created', 'appointment.confirmed'],
  },
  {
    slug: 'agendamentos-cancelados',
    label: 'Agendamentos cancelados',
    types: ['appointment.canceled'],
  },
  {
    // Emitidos por follow-up-sender.service.ts:23-24 (e pelo poller e pelo
    // processor). Existiam em produção e não estavam em categoria nenhuma: o
    // aviso caía no sino e sumia da página de notificações, com o tipo cru
    // `automation.follow_up` na tela por falta de rótulo.
    slug: 'follow-up',
    label: 'Follow-up',
    types: ['automation.follow_up', 'automation.follow_up.customer'],
  },
  // NÃO existe categoria 'crm.agenda_pendencia': o tipo estava listado aqui e
  // NADA no backend o cria (grep vazio em apps/api/src, zero linhas na base de
  // produção). Era uma categoria permanentemente vazia — exatamente o que o
  // comentário acima manda evitar. Volta quando algum código emitir o tipo.
];

export function categoryBySlug(slug: string | undefined): NotifCategoryDef | undefined {
  return NOTIF_CATEGORIES.find((c) => c.slug === slug);
}

/**
 * Rótulo pt-BR por tipo de notificação (para itens individuais).
 *
 * Tipo sem rótulo aqui cai no fallback `?? n.type` de
 * NotificacoesDetalhePage.tsx:167 e o dono lê a chave crua na tela — foi o que
 * acontecia com os dois de follow-up.
 */
export const NOTIF_TYPE_LABEL: Record<string, string> = {
  'appointment.created': 'Agendamento criado',
  'appointment.confirmed': 'Agendamento confirmado',
  'appointment.canceled': 'Agendamento cancelado',
  'automation.follow_up': 'Follow-up do salão',
  'automation.follow_up.customer': 'Follow-up enviado ao cliente',
};

/**
 * Opções de POLLING do sino — e por que elas não são o padrão do app.
 *
 * O aviso chegava com atraso grande, e a causa era a soma de dois padrões que,
 * isolados, fazem sentido (ver estudo 116):
 *
 *  1. `refetchIntervalInBackground` é `false` por padrão no React Query, então
 *     o `refetchInterval` PARA quando a aba não está em primeiro plano — e o
 *     painel do salão passa o dia numa aba de fundo, que é exatamente quando
 *     um cancelamento precisa aparecer;
 *  2. `refetchOnWindowFocus: false` global (main.tsx:91) é bom para o resto do
 *     app — voltar à aba não deve refazer TODAS as queries montadas —, mas
 *     também tira a chance de recuperar o atraso ao voltar.
 *
 * Juntos: nada chegava com a aba de fundo, e voltar para ela ainda esperava o
 * próximo tique. Um cancelamento feito pela IA levava minutos para aparecer,
 * com o painel aberto o tempo todo.
 *
 * A exceção vale SÓ para notificação: é o dado cuja utilidade depende de chegar
 * rápido, são queries pequenas, e o sino não desloca conteúdo da página — o
 * risco de "layout tremendo" que motivou o padrão global não se aplica aqui.
 *
 * Limite honesto: isto reduz o atraso ao intervalo, não o elimina. Entrega
 * instantânea exigiria push nativo ou realtime no painel; nenhum dos dois
 * existe hoje.
 */
const POLL_SINO = {
  refetchInterval: 30_000,
  /** Continua contando com a aba em segundo plano. */
  refetchIntervalInBackground: true,
  /** Vence o `false` global: voltar à aba mostra na hora o que chegou. */
  refetchOnWindowFocus: true,
} as const;

/**
 * Lista do sino. É ela que alimenta TAMBÉM o badge de não-lidas
 * (NotificationBell.tsx:87 lê `data.unreadCount`), então é a query que decide
 * quanto tempo um aviso novo demora a aparecer.
 */
export function useNotifications(limit = 30) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => api.get<NotificationsResponse>('/notifications', { limit }),
    ...POLL_SINO,
  });
}

/**
 * Contagem de não-lidas.
 *
 * ATENÇÃO: hoje NENHUMA tela consome este hook — o badge do sino sai de
 * `useNotifications`. Mantido com o mesmo polling para que, se alguém o ligar,
 * já nasça com o comportamento certo; ligar ou remover é decisão à parte.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ unreadCount: number }>('/notifications/unread-count'),
    ...POLL_SINO,
  });
}

/**
 * Contagem por tipo (total + não-lidas), agregada no backend. Alimenta a
 * página de categorias com números REAIS. Devolve um mapa por tipo e um helper
 * pra somar os tipos de uma categoria.
 */
export function useNotificationSummary() {
  const query = useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: () => api.get<NotificationSummaryResponse>('/notifications/summary'),
    ...POLL_SINO,
  });

  const unreadByType = new Map(
    (query.data?.types ?? []).map((t) => [t.type, t.unread]),
  );

  /** Soma as NÃO-LIDAS de todos os tipos de uma categoria (o badge da lista). */
  const unreadForCategory = (types: string[]): number =>
    types.reduce((acc, t) => acc + (unreadByType.get(t) ?? 0), 0);

  return { ...query, unreadForCategory };
}

/**
 * Lista paginada filtrada por tipos (uma categoria). Usada pela página de
 * detalhe. `offset` habilita o "Mostrar mais" real; `total`/`unreadCount` já
 * vêm restritos aos tipos filtrados (backend).
 */
export function useNotificationsByType(
  types: string[],
  opts: { limit?: number; offset?: number } = {},
) {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const typeParam = types.join(',');
  return useQuery({
    queryKey: ['notifications', 'by-type', typeParam, limit, offset],
    queryFn: () =>
      api.get<NotificationsResponse>('/notifications', {
        type: typeParam,
        limit,
        offset,
      }),
    enabled: types.length > 0,
    // Mesmo polling do sino: esta página não tinha refetchInterval NENHUM, então
    // quem deixava aberta "Agendamentos cancelados" não via nada novo chegar —
    // justamente a tela de quem está acompanhando aquele assunto.
    ...POLL_SINO,
    // Mantém páginas anteriores visíveis enquanto a próxima carrega ("Mostrar
    // mais" não pisca a lista inteira).
    placeholderData: (prev) => prev,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ ok: true }>(`/notifications/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

/**
 * Marca todas como lidas. Sem argumento marca TODAS da empresa (sino). Com
 * `types` marca só as daquela categoria (página de detalhe). A mutation aceita
 * o argumento opcional, então `markAll.mutate()` continua válido.
 */
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (types?: string[]) =>
      api.post<{ ok: true }>(
        '/notifications/read-all',
        {},
        types && types.length > 0 ? { type: types.join(',') } : undefined,
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ─── Toasts em tempo (quase) real ───────────────────────────────────────────

// Marca d'água dos toasts, POR EMPRESA: a chave leva o companyId ativo. Antes
// era uma chave única global do navegador — como a troca de empresa NÃO recarrega
// a página, a marca de uma empresa vazava e suprimia (ou estourava em rajada) os
// toasts de outra. Agora cada tenant tem a sua marca.
const LAST_SEEN_KEY_PREFIX = 'salonpass:notif-last-seen-at';
const lastSeenKeyFor = (companyId: string) => `${LAST_SEEN_KEY_PREFIX}:${companyId}`;

/**
 * Deep-link a partir do tipo/entidade da notificação — espelha a lógica do
 * `NotificationBell`. Hoje o backend só emite `appointment.*`, cujo `entityId`
 * é o `appointmentId` → abre o drawer do agendamento em /agenda.
 */
function hrefForNotification(n: NotificationItem): string | null {
  if (n.type.startsWith('appointment.')) {
    return n.entityId
      ? `/agenda?appointmentId=${encodeURIComponent(n.entityId)}`
      : '/agenda';
  }
  return null;
}

/**
 * Escolhe o "sabor" do toast pelo tipo da notificação:
 *   - appointment.canceled → danger (vermelho)
 *   - appointment.confirmed → success (verde)
 *   - appointment.created / demais → info (azul)
 */
function toastForNotification(n: NotificationItem): 'success' | 'info' | 'danger' {
  if (n.type === 'appointment.canceled') return 'danger';
  if (n.type === 'appointment.confirmed') return 'success';
  return 'info';
}

/**
 * "Notification watcher": detecta notificações NOVAS (chegadas depois da última
 * vista) e dispara UM toast do HeroUI por notificação, no canto inferior direito
 * (placement global do ToastProvider), sem repetir a cada poll.
 *
 * Estratégia:
 *   - Reaproveita a lista já polada por `useNotifications` (refetchInterval 30s),
 *     evitando uma segunda query.
 *   - Marca água por `createdAt` (timestamp) — mais robusto que assumir ids
 *     ordenáveis. Persiste o maior `createdAt` já "toastado" em localStorage,
 *     então recarregar a aba não re-explode toasts antigos.
 *   - PRIMEIRA montagem: apenas registra o baseline (o `createdAt` mais recente
 *     atual) e NÃO toasta nada retroativo. Só notificações que chegarem DEPOIS
 *     viram toast.
 *
 * Deve ser montado num ponto que só existe logado (ex.: DashboardLayout).
 */
export function useNotificationToasts() {
  const navigate = useNavigate();
  const { data } = useNotifications(30);
  const items = data?.data;
  // Empresa ativa: a marca d'água é POR-EMPRESA (ver lastSeenKeyFor). Mesma
  // fonte usada por useThemeSync; a lista de `items` já é escopada por tenant.
  const { data: contas } = useMinhasContas();
  const activeCompanyId = contas?.find((c) => c.active)?.companyId ?? null;

  // Baseline (ms epoch) do último `createdAt` já processado, DA empresa ativa.
  const lastSeenAt = useRef<number | null>(null);
  const initialized = useRef(false);

  // Chave de storage da empresa ativa, guardada em ref para o efeito de `items`
  // (que mantém deps só `[items]`) sempre gravar/ler no tenant correto.
  const storageKeyRef = useRef<string | null>(null);
  storageKeyRef.current = activeCompanyId ? lastSeenKeyFor(activeCompanyId) : null;

  // `navigate` guardado em ref pra manter o efeito com deps estável (só `items`).
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // Ao trocar de empresa ativa (troca de tenant, SEM reload da página): zera a
  // marca em memória e re-lê a marca DAQUELA empresa. Sem isso, a marca da
  // empresa anterior sobreviveria e suprimiria/estouraria os toasts da nova.
  // Definido ANTES do efeito de `items` para, num mesmo commit de troca, o
  // baseline ser restabelecido antes de processar a lista.
  useEffect(() => {
    initialized.current = false;
    const key = activeCompanyId ? lastSeenKeyFor(activeCompanyId) : null;
    const stored = key ? localStorage.getItem(key) : null;
    const parsed = stored ? Number(stored) : NaN;
    lastSeenAt.current = Number.isFinite(parsed) ? parsed : null;
  }, [activeCompanyId]);

  useEffect(() => {
    if (!items || items.length === 0) return;
    const key = storageKeyRef.current;
    if (!key) return; // empresa ativa ainda não resolvida → não toasta

    // Timestamps válidos, ordenados do mais antigo → mais novo (a lista vem
    // desc; invertemos pra toastar em ordem cronológica).
    const withTs = items
      .map((n) => ({ n, ts: new Date(n.createdAt).getTime() }))
      .filter((x) => Number.isFinite(x.ts))
      .sort((a, b) => a.ts - b.ts);
    if (withTs.length === 0) return;

    const newestTs = withTs[withTs.length - 1].ts;

    // Primeiro batch sem baseline: adota o mais recente como marca d'água e
    // NÃO toasta o histórico (evita explodir a tela no primeiro load).
    if (lastSeenAt.current === null) {
      lastSeenAt.current = newestTs;
      initialized.current = true;
      localStorage.setItem(key, String(newestTs));
      return;
    }

    const baseline = lastSeenAt.current;
    const fresh = withTs.filter((x) => x.ts > baseline);
    if (fresh.length === 0) return;

    for (const { n } of fresh) {
      const variant = toastForNotification(n);
      const href = hrefForNotification(n);
      toast[variant](n.title, {
        description: n.body ?? undefined,
        timeout: TOAST_TIMEOUT,
        ...(href
          ? {
              actionProps: {
                children: 'Ver',
                onPress: () => navigateRef.current(href),
              },
            }
          : {}),
      });
    }

    // Avança a marca d'água pro mais novo toastado e persiste (por-empresa).
    lastSeenAt.current = newestTs;
    initialized.current = true;
    localStorage.setItem(key, String(newestTs));
  }, [items]);
}
