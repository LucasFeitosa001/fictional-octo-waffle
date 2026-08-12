import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { toastSuccess } from '../toast';

// ===========================================================================
// Campanhas (marketing → WhatsApp/SMS/email). Bate 1:1 com o backend REAL:
//   apps/api/src/modules/campaigns/{campaigns.controller,campaigns.service}.ts
//
// O model Campaign NÃO tem coluna `message` — a mensagem vive dentro do
// `segmentJson` junto do segmento. O backend aceita `message` no create/update
// e guarda em `segmentJson.message`, mas ao LER a campanha a mensagem volta
// dentro de `segmentJson`. Por isso o tipo Campaign expõe `segmentJson` com o
// campo `message` opcional (é de lá que a UI lê o texto atual).
//
// "Ativar" uma campanha = status draft → sent/sending (o backend só materializa
// e dispara aniversariantes automaticamente para campanhas já em sent/sending).
// Não existe flag `active`/`enabled`. NÃO existe tabela de créditos/saldo.
// ===========================================================================

export type CampaignChannel = 'whatsapp' | 'sms' | 'email';
export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'canceled';
export type SegmentKind = 'birthday_today' | 'inactive' | 'all';

export interface CampaignSegment {
  kind: SegmentKind;
  /** Só para kind = 'inactive'. Default do backend: 90. */
  inactiveDays?: number;
}

/** `segmentJson` como persistido: o segmento + a mensagem embutida. */
export interface StoredSegment extends CampaignSegment {
  message?: string;
}

export interface Campaign {
  id: string;
  companyId: string;
  name: string;
  channel: CampaignChannel;
  segmentJson: StoredSegment | null;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  /** Presente em GET /campaigns (list) — total de CampaignMessage já criadas. */
  _count?: { messages: number };
}

export interface CampaignMessageRow {
  id: string;
  campaignId: string;
  customerId: string;
  status: string;
  sentAt: string | null;
  customer?: { id: string; name: string; phone: string | null } | null;
}

/** GET /campaigns/:id inclui as mensagens materializadas. */
export interface CampaignDetail extends Campaign {
  messages: CampaignMessageRow[];
}

export interface CreateCampaignBody {
  name: string;
  channel: CampaignChannel;
  segmentJson?: CampaignSegment;
  message?: string;
}

export interface UpdateCampaignBody extends Partial<CreateCampaignBody> {
  /** Pausar/retomar automação: 'draft' = pausada, 'sent' = ativa. */
  status?: CampaignStatus;
}

export interface PreviewSegmentBody {
  kind: SegmentKind;
  inactiveDays?: number;
}

export interface PreviewSegmentResult {
  kind: SegmentKind;
  inactiveDays?: number;
  /** Quantos clientes o segmento casa AGORA. */
  count: number;
  /** Desses, quantos têm telefone (WhatsApp só envia para quem tem). */
  withPhone: number;
}

export interface DispatchResult {
  campaignId: string;
  /** Total de clientes que o segmento casou. */
  matched: number;
  /** Quantos ainda não tinham sido alvo desta campanha. */
  newlyTargeted: number;
  /** Quantas mensagens foram enfileiradas para envio. */
  queued: number;
  /** Quantas foram criadas como "skipped" (sem telefone / opt-out). */
  skipped: number;
  mode: string;
}

const KEY = ['campaigns'] as const;

// ------------------------------------------------------------------ queries

export function useCampaigns() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => api.get<Campaign[]>('/campaigns'),
  });
}

export function useCampaign(id: string | null) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: () => api.get<CampaignDetail>(`/campaigns/${id}`),
    enabled: !!id,
  });
}

// ---------------------------------------------------------------- mutations

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCampaignBody) =>
      api.post<Campaign>('/campaigns', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toastSuccess('Campanha criada');
    },
  });
}

/** PATCH — usado tanto para editar quanto para ativar/desativar (via status). */
export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCampaignBody }) =>
      api.patch<Campaign>(`/campaigns/${id}`, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['campaigns', id] });
      toastSuccess('Campanha salva');
    },
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/campaigns/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toastSuccess('Campanha excluída');
    },
  });
}

export function useDispatchCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<DispatchResult>(`/campaigns/${id}/dispatch`),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['campaigns', id] });
    },
  });
}

/**
 * Preview de segmento: NÃO persiste nada. Retornamos a mutation crua para a UI
 * disparar sob demanda (ao mudar segmento no drawer) e ler `data.count`.
 */
export function usePreviewSegment() {
  return useMutation({
    mutationFn: (body: PreviewSegmentBody) =>
      api.post<PreviewSegmentResult>('/campaigns/preview-segment', body),
  });
}
