import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

// =====================================================================
// Modelos de anamnese (AnamnesisTemplate) — CRUD real /anamnesis-templates.
// questionsJson: array de perguntas configuráveis persistidas no modelo;
// instanciado por CustomerAnamnesis.answersJson ao preencher a ficha.
// =====================================================================

export type AnamnesisQuestionType = 'text' | 'boolean' | 'choice';

export interface AnamnesisQuestion {
  id: string;
  label: string;
  type: AnamnesisQuestionType;
}

export interface AnamnesisTemplate {
  id: string;
  companyId: string;
  name: string;
  questionsJson: AnamnesisQuestion[] | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnamnesisTemplateBody {
  name: string;
  questionsJson?: AnamnesisQuestion[];
  active?: boolean;
}

const TEMPLATES_KEY = ['anamnesis-templates'] as const;

/** GET /anamnesis-templates — modelos de ficha da empresa. */
export function useAnamnesisTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: () => api.get<AnamnesisTemplate[]>('/anamnesis-templates'),
  });
}

/** POST /anamnesis-templates — cria um modelo (persiste questionsJson). */
export function useCreateAnamnesisTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AnamnesisTemplateBody) =>
      api.post<AnamnesisTemplate>('/anamnesis-templates', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

/** PATCH /anamnesis-templates/:id — atualiza nome/perguntas/status. */
export function useUpdateAnamnesisTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<AnamnesisTemplateBody> }) =>
      api.patch<AnamnesisTemplate>(`/anamnesis-templates/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

/** DELETE /anamnesis-templates/:id — remove um modelo. */
export function useDeleteAnamnesisTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string; deleted: boolean }>(`/anamnesis-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}
