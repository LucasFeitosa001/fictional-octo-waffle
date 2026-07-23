import { useNotificationToasts } from '../lib/queries/notificacoes';

/**
 * "Notification watcher" sem UI própria: enquanto montado (só na área logada,
 * via DashboardLayout), observa a lista de notificações polada pelo React Query
 * e dispara um toast do HeroUI no canto inferior direito para cada notificação
 * NOVA — uma vez por notificação, sem repetir a cada poll e sem explodir a tela
 * com o histórico no primeiro load.
 *
 * Toda a lógica vive em `useNotificationToasts`; este componente existe só para
 * dar um ponto de montagem dentro do Router (o hook usa `useNavigate` no
 * deep-link do toast).
 */
export function NotificationToaster() {
  useNotificationToasts();
  return null;
}
