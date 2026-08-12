import { useMutation } from '@tanstack/react-query';
import { api } from '../api';

/**
 * MÓDULO "ENVIO DE IMAGENS E ARQUIVOS" (`media_messages`).
 *
 * Manda para a cliente, pelo WhatsApp do salão, um arquivo que já está na ficha
 * dela — foto de referência, contrato, recibo. O envio é de uma PESSOA: quem
 * clica está olhando a tela e escolheu o arquivo. Nada dispara sozinho (regra
 * permanente do projeto).
 *
 * O backend recusa quando a empresa não tem o adicional (`media_messages`) ou
 * quando a cliente não tem telefone no cadastro — a tela mostra a mensagem dele,
 * sem inventar.
 */
export interface EnvioDeMidia {
  customerId: string;
  type: 'image' | 'document';
  url: string;
  mimeType: string;
  fileName?: string;
  /** Recado que vai junto do arquivo. */
  caption?: string;
  requestKey?: string;
}

export interface ResultadoDoEnvio {
  id: string;
  /** `pending` = na fila. "Enviado" só quando o WhatsApp confirmar. */
  status: string;
  deduplicated: boolean;
}

export function useEnviarArquivoNoWhatsapp() {
  return useMutation({
    mutationFn: (body: EnvioDeMidia) =>
      api.post<ResultadoDoEnvio>('/whatsapp/media', body),
  });
}
