import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';

export interface ConfirmationTemplate {
  id: string;
  label: string;
  message: string;
  builtIn: boolean;
}

export interface ConfirmationVariables {
  cliente: string;
  quando: string;
  hora: string;
  hora_curta: string;
  servico: string;
  /** Quem atende — variável nova (estudo 61). */
  profissional: string;
  estabelecimento: string;
}

export type ConfirmationLogStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  /** Descartada pelas travas de envio (fila velha, aviso desligado). Estudo 60. */
  | 'expired';

export interface ConfirmationLog {
  id: string;
  /**
   * Qual dos três avisos do agendamento é esta linha. Antes o log só trazia
   * confirmação; cancelamento e lembrete não apareciam em lugar nenhum da tela,
   * nem quando eram recusados. Ver estudo 82.
   */
  kind: 'confirmation' | 'cancellation' | 'reminder' | null;
  /** O backend diz quando faz sentido oferecer "Reenviar" (só o que não saiu). */
  podeReenviar: boolean;
  phone: string;
  text: string;
  status: ConfirmationLogStatus;
  attempts: number;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface AppointmentConfirmationSetup {
  authorization: {
    companyDefault: boolean;
    appointment: boolean | null;
    allowed: boolean;
  };
  recipient: {
    customerId: string | null;
    name: string | null;
    phone: string | null;
    notificationsEnabled: boolean | null;
    whatsappOptIn: boolean | null;
  };
  variables: ConfirmationVariables;
  defaultTemplateId: string;
  templates: ConfirmationTemplate[];
  preview: string;
  /** Bloco do acompanhamento pós-atendimento. Ver estudo 86. */
  followUp: {
    enabled: boolean;
    templates: { id: string; label: string; message: string }[];
    message: string;
    includeBookingLink: boolean;
    preview: string;
    /** O que está configurado para o envio AUTOMÁTICO. */
    agendado: {
      prazoValor: number;
      prazoUnidade: string;
      repete: boolean;
      repeteValor: number;
      repeteUnidade: string;
      maximo: number;
    };
  };
  logs: ConfirmationLog[];
}

export interface SendConfirmationInput {
  authorize: true;
  requestKey: string;
  templateId?: string;
  message?: string;
  allowResend?: boolean;
}

export interface SendConfirmationResult {
  id: string;
  status: string;
  deduplicated: boolean;
}

const confirmationKey = (appointmentId: string | null) =>
  ['appointments', appointmentId, 'confirmation'] as const;

export function useAppointmentConfirmation(
  appointmentId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: confirmationKey(appointmentId),
    queryFn: () =>
      api.get<AppointmentConfirmationSetup>(
        `/appointments/${appointmentId}/confirmation`,
      ),
    enabled: enabled && Boolean(appointmentId),
    refetchInterval: enabled ? 5_000 : false,
  });
}

/**
 * Reenvia um aviso que não saiu — decisão MANUAL de uma pessoa. Não existe
 * reenvio automático ao reconectar de propósito: é o incidente que a trava 1
 * previne. Ver estudo 82.
 */
export function useResendAppointmentMessage(appointmentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { messageId: string; requestKey: string }) =>
      api.post<SendConfirmationResult>(
        `/appointments/${appointmentId}/messages/${body.messageId}/resend`,
        { authorize: true, requestKey: body.requestKey },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: confirmationKey(appointmentId) });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

/**
 * Envia o acompanhamento pós-atendimento AGORA, sem esperar o prazo. Serve
 * inclusive depois de finalizado — foi o que o dono pediu. Ver estudo 84.
 */
/*
 * `useSendAppointmentFreeMessage` foi REMOVIDO junto com a aba "Livre" do
 * drawer de confirmação: a aba de Confirmação já tem o texto editável, com
 * prévia e as mesmas variáveis, então o envio livre era a mesma coisa por outra
 * porta. Sem consumidor, o hook virava código morto.
 *
 * A rota `POST /appointments/:id/message` continua no backend
 * (appointments.controller.ts:184) e NÃO foi desligada — só perdeu o consumidor
 * na web. A confirmação usa outra rota, `/appointments/:id/confirmation`.
 * Ver estudo 87.
 */

export function useSendAppointmentFollowUp(appointmentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      requestKey: string;
      templateId?: string;
      message?: string;
    }) =>
      api.post<{ ok: true; texto: string }>(
        `/appointments/${appointmentId}/followup`,
        {
          authorize: true,
          requestKey: body.requestKey,
          templateId: body.templateId,
          message: body.message,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: confirmationKey(appointmentId) });
    },
  });
}

export function useSendAppointmentConfirmation(appointmentId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SendConfirmationInput) =>
      api.post<SendConfirmationResult>(
        `/appointments/${appointmentId}/confirmation`,
        body,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: confirmationKey(appointmentId),
      });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useSaveConfirmationTemplates(
  appointmentId: string | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      defaultTemplateId: string;
      templates: Array<{ id: string; label: string; message: string }>;
    }) =>
      api.put<{
        defaultTemplateId: string;
        templates: ConfirmationTemplate[];
      }>('/notification-settings/confirmation-templates', body),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: confirmationKey(appointmentId),
      });
    },
  });
}

export function renderConfirmationPreview(
  template: string,
  variables: ConfirmationVariables,
): string {
  return Object.entries(variables).reduce(
    (message, [name, value]) =>
      message.replace(new RegExp(`\\{${name}\\}`, 'g'), value),
    template,
  );
}
