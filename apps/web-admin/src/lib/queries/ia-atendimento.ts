'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export type AiTone = 'amigavel' | 'profissional' | 'descontraido';

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface AiAttendantConfig {
  id: string;
  companyId: string;
  enabled: boolean;
  agentName: string;
  greeting: string;
  tone: AiTone;
  whatsappNumber: string | null;
  whatsappConnected: boolean;
  autoReply: boolean;
  bookingViaChat: boolean;
  handoffEnabled: boolean;
  knowledgeBase: string | null;
  faqJson: FaqEntry[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiAttendantStats {
  enabled: boolean;
  whatsappConnected: boolean;
  activeCustomers: number;
  onlineServices: number;
  appointmentsThisMonth: number;
  conversationsHandled: number;
  bookingsViaChat: number;
}

export interface UpdateAiAttendantBody {
  enabled?: boolean;
  agentName?: string;
  greeting?: string;
  tone?: AiTone;
  whatsappNumber?: string;
  whatsappConnected?: boolean;
  autoReply?: boolean;
  bookingViaChat?: boolean;
  handoffEnabled?: boolean;
  knowledgeBase?: string;
  faq?: FaqEntry[];
}

export function useAiAttendant() {
  return useQuery({
    queryKey: ['ai-attendant'],
    queryFn: () => api.get<AiAttendantConfig>('/ai-attendant'),
  });
}

export function useAiAttendantStats() {
  return useQuery({
    queryKey: ['ai-attendant', 'stats'],
    queryFn: () => api.get<AiAttendantStats>('/ai-attendant/stats'),
  });
}

export function useUpdateAiAttendant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAiAttendantBody) =>
      api.patch<AiAttendantConfig>('/ai-attendant', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-attendant'] });
    },
  });
}
