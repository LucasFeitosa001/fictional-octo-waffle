import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './index.css';
import { DEFAULT_BOOKING_SLUG, getSubdomainSlug } from './lib/config';
import {
  applyBookingAppearanceToDocument,
  readCachedBookingAppearance,
} from './lib/booking';

// A consulta do portal é assíncrona. Reaplicar a última aparência conhecida
// antes do primeiro render evita que uma atualização mostre por um instante o
// tema padrão rosa/creme enquanto o tema do salão é carregado.
function bootstrapCachedAppearance(): void {
  if (typeof window === 'undefined') return;
  const slug =
    getSubdomainSlug() ??
    window.location.pathname.split('/').filter(Boolean)[0] ??
    DEFAULT_BOOKING_SLUG;
  const cached = readCachedBookingAppearance(slug);
  if (cached) applyBookingAppearanceToDocument(cached);
}

bootstrapCachedAppearance();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
