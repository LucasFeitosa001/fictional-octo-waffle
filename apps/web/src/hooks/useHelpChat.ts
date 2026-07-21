import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * Uma mensagem trocada no chat de suporte (assistente SalonPass).
 * O backend usa o mesmo shape para persistir o histórico enviado.
 */
export interface HelpChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface HelpChatResponse {
  reply: string;
  /** true quando a IA está desligada (sem ANTHROPIC_API_KEY) ou falhou. */
  fallback?: boolean;
}

interface HelpChatVars {
  message: string;
  history: HelpChatMessage[];
}

/**
 * Envia uma pergunta ao endpoint /help/chat (Claude Haiku ancorado nos artigos
 * da Base de Conhecimento). Usado pelo ChatSupportDrawer flutuante.
 */
export function useHelpChat() {
  return useMutation<HelpChatResponse, Error, HelpChatVars>({
    mutationFn: ({ message, history }) =>
      api.post<HelpChatResponse>('/help/chat', { message, history }),
  });
}
