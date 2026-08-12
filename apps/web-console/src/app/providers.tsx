'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ErroApi } from '@/lib/api';

export function Providers({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dado de suporte envelhece rápido: o técnico está olhando enquanto
            // o cliente mexe do outro lado. 15s de frescor, e revalida ao focar.
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: (tentativas, erro) => {
              // Repetir um 401/403 não muda nada e só atrasa a tela de login.
              if (erro instanceof ErroApi && (erro.expirou || erro.semPermissao)) return false;
              return tentativas < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
