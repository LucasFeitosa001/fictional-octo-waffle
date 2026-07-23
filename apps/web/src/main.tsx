import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '@heroui/react';
import { App } from './App';
import './index.css';
import { initTheme } from './theme/theme';
import { initButtonRadius } from './theme/buttonStyle';
import { initZoom } from './theme/zoom';
import { toastMutationError } from './lib/toast';

// Restore the saved color theme + button style + zoom before the first React
// paint (no flash of the default palette/radius/size when a non-default choice
// is active).
initTheme();
initButtonRadius();
initZoom();

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
        {/* Região global de toasts (pilha no canto inferior direito; o HeroUI
            adapta para o topo/centro no mobile). Montada no root para que a
            função global `toast()` funcione de qualquer lugar. */}
        <ToastProvider placement="bottom end" />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
