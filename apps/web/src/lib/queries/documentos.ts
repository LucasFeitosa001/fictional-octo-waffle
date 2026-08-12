import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

/**
 * MÓDULO "GERADOR DE DOCUMENTOS" (`documents`) — ver estudo 124.
 *
 * Contratos, termos e recibos preenchidos com os dados do cliente e do
 * atendimento. Os modelos vivem em `Setting` no backend; o documento gerado NÃO
 * é guardado — sai montado na hora, dos dados vivos.
 */
export type TipoDeDocumento = 'contrato' | 'termo' | 'recibo' | 'outro';

export interface ModeloDeDocumento {
  id: string;
  nome: string;
  tipo: TipoDeDocumento;
  corpo: string;
}

export interface VariavelDeDocumento {
  chave: string;
  descricao: string;
}

export interface DocumentoGerado {
  nome: string;
  texto: string;
  /**
   * Variáveis que o modelo pede e o cadastro não tem. A tela AVISA antes de
   * imprimir: um termo com o CPF em branco só é descoberto na hora de assinar.
   */
  faltando: string[];
}

export function useModelosDeDocumento() {
  return useQuery({
    queryKey: ['documents', 'modelos'],
    queryFn: () => api.get<{ modelos: ModeloDeDocumento[] }>('/documents/modelos'),
    select: (d) => d.modelos,
  });
}

export function useVariaveisDeDocumento() {
  return useQuery({
    queryKey: ['documents', 'variaveis'],
    queryFn: () => api.get<{ variaveis: VariavelDeDocumento[] }>('/documents/variaveis'),
    select: (d) => d.variaveis,
    staleTime: 60 * 60 * 1000,
  });
}

export function useSalvarModelosDeDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (modelos: ModeloDeDocumento[]) =>
      api.put<{ modelos: ModeloDeDocumento[] }>('/documents/modelos', { modelos }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents', 'modelos'] });
    },
  });
}

export function useGerarDocumento() {
  return useMutation({
    mutationFn: (body: {
      modeloId: string;
      customerId: string;
      appointmentId?: string;
    }) => api.post<DocumentoGerado>('/documents/gerar', body),
  });
}
