import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

// ---------------------------------------------------------------------------
// Interações do cliente — timeline de mensagens (aba "Mensagens" do perfil).
// Espelha GET /customers/:id/interactions do backend.
// ---------------------------------------------------------------------------

export interface CustomerInteraction {
  id: string;
  channel: 'whatsapp' | 'campaign';
  kind: string | null;
  text: string;
  status: string;
  /** ISO — quando a mensagem foi enviada (ou criada, se ainda pendente). */
  at: string;
  direction: 'outgoing';
}

export interface CustomerInteractionsResponse {
  data: CustomerInteraction[];
  total: number;
  limit: number;
  offset: number;
}

/** GET /customers/:id/interactions — timeline cronológica de mensagens. */
export function useCustomerInteractions(
  id: string | null | undefined,
  opts: { limit?: number; offset?: number } = {},
) {
  const { limit, offset } = opts;
  return useQuery({
    queryKey: ['customer-interactions', id, limit ?? null, offset ?? null],
    queryFn: () =>
      api.get<CustomerInteractionsResponse>(`/customers/${id}/interactions`, {
        limit: limit ?? undefined,
        offset: offset ?? undefined,
      }),
    enabled: Boolean(id),
  });
}
