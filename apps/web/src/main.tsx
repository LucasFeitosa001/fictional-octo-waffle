import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';
import { initTheme } from './theme/theme';
import { initButtonRadius } from './theme/buttonStyle';
import { initZoom } from './theme/zoom';
import { toast } from './lib/toast';
import { AvisosGlobais } from './components/AvisosGlobais';

// Só em desenvolvimento: permite disparar um aviso pelo console/E2E sem ter de
// reproduzir a tela inteira. Foi a falta disto que travou a verificação do
// estudo 138 — o `import()` dinâmico do Vite devolve outra instância do módulo,
// então não dava para acionar a store real de fora.
if (import.meta.env.DEV) {
  (window as unknown as { __avisos?: typeof toast }).__avisos = toast;
}
import { toastMutationError } from './lib/toast';

// Restore the saved color theme + button style + zoom before the first React
// paint (no flash of the default palette/radius/size when a non-default choice
// is active).
initTheme();
initButtonRadius();
initZoom();

/**
 * Recarrega quando o service worker novo assume o controle.
 *
 * O `sw.js` é gerado com `skipWaiting` + `clientsClaim` (VitePWA `autoUpdate`),
 * então a versão nova toma conta assim que instala — mas a ABA ABERTA continua
 * executando o JS antigo, porque nada reagia ao evento. Era isso que fazia o
 * dono ver a tela anterior depois de todo deploy: abre, está velho; recarrega,
 * aparece o novo.
 *
 * Não é cosmético. Front antigo contra API nova manda requisição fora do
 * contrato — foi assim que nasceram os pagamentos de comissão de R$ 0,00, com o
 * bundle velho sem `accountId` e sem conhecer a recusa nova.
 */
function recarregarQuandoAtualizar() {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  // Com `clientsClaim`, `controllerchange` também dispara na PRIMEIRA visita
  // (não havia controlador). Recarregar ali seria um reload gratuito em todo
  // primeiro acesso.
  const jaTinhaControlador = Boolean(sw.controller);
  let recarregando = false;

  sw.addEventListener('controllerchange', () => {
    if (!jaTinhaControlador || recarregando) return;

    // Recarregar por cima de um formulário preenchido perde o trabalho da
    // pessoa. Nesse caso avisa e deixa ela escolher a hora.
    const foco = document.activeElement;
    const digitando =
      foco instanceof HTMLElement &&
      (['INPUT', 'TEXTAREA', 'SELECT'].includes(foco.tagName) || foco.isContentEditable);
    const modalAberto = document.querySelector('[role="dialog"],[aria-modal="true"]');
    if (digitando || modalAberto) {
      toast.info('Nova versão disponível. Recarregue a página para atualizar.', {
        timeout: 10_000,
      });
      return;
    }

    recarregando = true;
    window.location.reload();
  });
}
recarregarQuandoAtualizar();

const queryClient = new QueryClient({
  // Handler GLOBAL de erro de mutation: qualquer create/update/delete que falhe
  // dispara um toast de erro com a mensagem da ApiClientError, sem precisar de
  // onError em cada hook/página. Centralizado aqui.
  mutationCache: new MutationCache({
    onError: (error) => toastMutationError(error),
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      // staleTime 30s: revisitar uma rota em <30s NÃO dispara refetch nem
      // spinner (dados considerados frescos). Passado esse tempo, ocorre
      // refetch em background — como as páginas gateiam LoadingState em
      // `isLoading` (v5: true só quando não há data em cache), o refetch
      // silencioso mantém os dados stale na tela enquanto atualiza.
      staleTime: 30_000,
      // gcTime 30min: mantém o cache vivo mesmo quando não há observers
      // (usuário navegou pra outra rota). Isso evita que voltar pra uma
      // tela recém-visitada volte pro estado inicial "sem dados" e
      // reapresente o spinner de LoadingState.
      gcTime: 30 * 60_000,
      // refetchOnWindowFocus desligado: voltar pra aba não deve disparar
      // refetch de todas as queries montadas (era ruído de rede + risco de
      // layout tremer). Reconexão de rede continua invalidando, pois é
      // sinal real de que dados podem ter mudado enquanto estávamos offline.
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      // Mutations não devem retry por padrão — evita duplicar POSTs/PATCHes
      // não-idempotentes quando o servidor demora ou devolve 5xx transitório.
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        {/* Pilha global de avisos (canto inferior direito). Implementação
            própria — o toast do HeroUI evaporava em ~0,3s no fluxo real, ver
            estudo 138. Montada no root para funcionar de qualquer lugar. */}
        <AvisosGlobais />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
