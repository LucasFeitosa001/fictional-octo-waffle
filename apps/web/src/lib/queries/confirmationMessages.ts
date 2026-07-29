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
  estabelecimento: string;
}

export type ConfirmationLogStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface ConfirmationLog {
  id: string;
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
