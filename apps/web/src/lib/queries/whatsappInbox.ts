import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { WhatsappConnection } from './whatsapp';

export type AiTone = 'simpatico' | 'profissional' | 'direto';
export type ConversationFilter = 'all' | 'unread' | 'open' | 'resolved';

export interface WhatsappFaq {
  question: string;
  answer: string;
}

export interface WhatsappInboxConfig {
  id: string;
  companyId: string;
  enabled: boolean;
  agentName: string;
  greeting: string;
  tone: AiTone;
  autoReply: boolean;
  bookingViaChat: boolean;
  handoffEnabled: boolean;
  knowledgeBase: string | null;
  faq: WhatsappFaq[];
  channel: WhatsappConnection;
  aiAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WhatsappInboxConfigUpdate = Partial<
  Pick<
    WhatsappInboxConfig,
    | 'enabled'
    | 'agentName'
    | 'greeting'
    | 'tone'
    | 'autoReply'
    | 'bookingViaChat'
    | 'handoffEnabled'
    | 'knowledgeBase'
    | 'faq'
  >
>;

export interface WhatsappConversation {
  id: string;
  companyId: string;
  remoteJid: string;
  phone: string;
  displayName: string | null;
  name: string;
  customerId: string | null;
  handledByAi: boolean;
  resolved: boolean;
  unreadCount: number;
  lastMessageText: string | null;
  lastMessageAt: string;
  lastInboundAt: string | null;
  lastOutboundAt: string | null;
  customer: {
    id: string;
    name: string;
    avatarUrl: string | null;
  } | null;
}

export interface WhatsappInboxMessage {
  id: string;
  companyId: string;
  conversationId: string;
  whatsappMessageId: string | null;
  direction: 'inbound' | 'outbound';
  sender: 'customer' | 'ai' | 'agent';
  text: string;
  status: 'received' | 'pending' | 'sent' | 'failed';
  kind: string | null;
  metadataJson: unknown;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
}

export interface WhatsappInboxStats {
  conversationsToday: number;
  aiMessagesToday: number;
  bookingsViaAi: number;
  resolutionRate: number;
  unread: number;
}

const CONFIG_KEY = ['whatsapp', 'inbox', 'config'] as const;
const STATS_KEY = ['whatsapp', 'inbox', 'stats'] as const;
const CONVERSATIONS_KEY = ['whatsapp', 'inbox', 'conversations'] as const;
const MESSAGES_KEY = ['whatsapp', 'inbox', 'messages'] as const;

export function useWhatsappInboxConfig() {
  return useQuery({
    queryKey: CONFIG_KEY,
    queryFn: () => api.get<WhatsappInboxConfig>('/whatsapp/inbox/config'),
    refetchInterval: 10_000,
  });
}

export function useUpdateWhatsappInboxConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: WhatsappInboxConfigUpdate) =>
      api.patch<WhatsappInboxConfig>('/whatsapp/inbox/config', body),
    onSuccess: (saved) => {
      queryClient.setQueryData(CONFIG_KEY, saved);
    },
  });
}

export function useWhatsappInboxStats() {
  return useQuery({
    queryKey: STATS_KEY,
    queryFn: () => api.get<WhatsappInboxStats>('/whatsapp/inbox/stats'),
    refetchInterval: 5_000,
  });
}

export function useWhatsappConversations(
  search: string,
  status: ConversationFilter,
) {
  return useQuery({
    queryKey: [...CONVERSATIONS_KEY, search, status],
    queryFn: () =>
      api.get<{ data: WhatsappConversation[] }>(
        '/whatsapp/inbox/conversations',
        {
          q: search || undefined,
          status: status === 'all' ? undefined : status,
        },
      ),
    refetchInterval: 3_000,
  });
}

export function useWhatsappInboxMessages(conversationId: string | null) {
  return useQuery({
    queryKey: [...MESSAGES_KEY, conversationId],
    enabled: Boolean(conversationId),
    queryFn: () =>
      api.get<{ data: WhatsappInboxMessage[] }>(
        `/whatsapp/inbox/conversations/${conversationId}/messages`,
      ),
    refetchInterval: conversationId ? 2_000 : false,
  });
}

export function useUpdateWhatsappConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        handledByAi?: boolean;
        resolved?: boolean;
        read?: boolean;
      };
    }) =>
      api.patch<WhatsappConversation>(
        `/whatsapp/inbox/conversations/${id}`,
        body,
      ),
    onSuccess: (_saved, variables) => {
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      if (variables.body.read) {
        void queryClient.invalidateQueries({ queryKey: STATS_KEY });
      }
    },
  });
}

export function useSendWhatsappInboxMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      api.post<WhatsappInboxMessage>(
        `/whatsapp/inbox/conversations/${id}/messages`,
        { text },
      ),
    onSuccess: (_message, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [...MESSAGES_KEY, variables.id],
      });
      void queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}
