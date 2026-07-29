import { useEffect, useMemo, useState } from 'react';
import { Button } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from './Drawer';
import { ErrorState, LoadingState } from './States';
import {
  renderConfirmationPreview,
  useAppointmentConfirmation,
  useSaveConfirmationTemplates,
  useSendAppointmentConfirmation,
  type ConfirmationLog,
  type ConfirmationLogStatus,
} from '../lib/queries/confirmationMessages';
import { apiErrorMessage } from '../lib/toast';
import { formatPhone } from '../lib/format';

type ConfirmationTab = 'message' | 'logs';

interface AppointmentConfirmationDrawerProps {
  appointmentId: string | null;
  isOpen: boolean;
  initialTab?: ConfirmationTab;
  canSendConfirmation: boolean;
  canManageTemplates: boolean;
  onClose: () => void;
  onAuthorized?: () => void;
}

const STATUS_META: Record<
  ConfirmationLogStatus,
  { label: string; description: string; className: string }
> = {
  pending: {
    label: 'Na fila',
    description:
      'Ainda não saiu do sistema. Se o WhatsApp estiver desconectado, ficará aqui.',
    className: 'bg-warning/15 text-warning',
  },
  sent: {
    label: 'Enviada',
    description:
      'O WhatsApp aceitou o envio, mas ainda não confirmou a entrega no aparelho.',
    className: 'bg-primary/10 text-primary',
  },
  delivered: {
    label: 'Entregue',
    description: 'O WhatsApp confirmou que a mensagem chegou ao aparelho.',
    className: 'bg-success/15 text-success',
  },
  read: {
    label: 'Lida',
    description:
      'O WhatsApp confirmou a leitura (quando o destinatário fornece recibo).',
    className: 'bg-success/15 text-success',
  },
  failed: {
    label: 'Falhou',
    description: 'A mensagem não foi entregue. Veja o motivo abaixo.',
    className: 'bg-danger/10 text-danger',
  },
};

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

function requestUuid(): string {
  return crypto.randomUUID();
}

function statusMeta(status: string) {
  return (
    STATUS_META[status as ConfirmationLogStatus] ?? {
      label: status,
      description: 'Status informado pelo serviço de mensagens.',
      className: 'bg-canvas text-muted-ink',
    }
  );
}

function logTimestamp(log: ConfirmationLog): string {
  const value =
    log.readAt ??
    log.deliveredAt ??
    log.sentAt ??
    log.createdAt;
  return dateTimeFormatter.format(new Date(value));
}

export function AppointmentConfirmationDrawer({
  appointmentId,
  isOpen,
  initialTab = 'message',
  canSendConfirmation,
  canManageTemplates,
  onClose,
  onAuthorized,
}: AppointmentConfirmationDrawerProps) {
  const setupQuery = useAppointmentConfirmation(appointmentId, isOpen);
  const sendMutation = useSendAppointmentConfirmation(appointmentId);
  const saveTemplates = useSaveConfirmationTemplates(appointmentId);
  const [tab, setTab] = useState<ConfirmationTab>(initialTab);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [message, setMessage] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [modelName, setModelName] = useState('');
  const [requestKey, setRequestKey] = useState<string | null>(null);
  const [resendRequired, setResendRequired] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'danger' | 'warning';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setLoadedFor(null);
      return;
    }
    setTab(initialTab);
    setAuthorized(false);
    setRequestKey(null);
    setResendRequired(false);
    setFeedback(null);
  }, [isOpen, initialTab]);

  useEffect(() => {
    const setup = setupQuery.data;
    if (!isOpen || !appointmentId || !setup || loadedFor === appointmentId) {
      return;
    }
    const selected =
      setup.templates.find(
        (template) => template.id === setup.defaultTemplateId,
      ) ?? setup.templates[0];
    setTemplateId(selected?.id ?? '');
    setMessage(selected?.message ?? '');
    setModelName('');
    setLoadedFor(appointmentId);
  }, [appointmentId, isOpen, loadedFor, setupQuery.data]);

  const setup = setupQuery.data;
  const preview = useMemo(
    () =>
      setup
        ? renderConfirmationPreview(message, setup.variables).trim()
        : '',
    [message, setup],
  );
  const customerBlocked =
    setup?.recipient.notificationsEnabled === false ||
    setup?.recipient.whatsappOptIn === false;
  const readyToSend =
    canSendConfirmation &&
    Boolean(setup?.recipient.phone) &&
    !customerBlocked &&
    authorized &&
    preview.length > 0 &&
    !sendMutation.isPending;

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const template = setup?.templates.find((item) => item.id === id);
    if (template) setMessage(template.message);
    setRequestKey(null);
    setResendRequired(false);
    setFeedback(null);
  }

  async function send(forceResend = false) {
    if (!readyToSend) return;
    const stableRequestKey = requestKey ?? requestUuid();
    setRequestKey(stableRequestKey);
    setFeedback(null);
    try {
      const result = await sendMutation.mutateAsync({
        authorize: true,
        requestKey: stableRequestKey,
        templateId: templateId || undefined,
        message,
        allowResend: forceResend || undefined,
      });
      setResendRequired(false);
      setAuthorized(false);
      setFeedback({
        tone: 'success',
        message: result.deduplicated
          ? 'A mesma solicitação já estava registrada; nenhuma cópia foi criada.'
          : 'Confirmação colocada na fila. Acompanhe Entregue/Lida nos logs.',
      });
      onAuthorized?.();
      setTab('logs');
    } catch (error) {
      const text = apiErrorMessage(error);
      const isSentConflict =
        error instanceof ApiClientError &&
        error.statusCode === 409 &&
        text.includes('já foi enviada');
      setResendRequired(isSentConflict);
      setFeedback({
        tone: isSentConflict ? 'warning' : 'danger',
        message: text,
      });
    }
  }

  async function saveAsModel() {
    if (!setup || !canManageTemplates) return;
    const label = modelName.trim();
    if (!label) {
      setFeedback({
        tone: 'danger',
        message: 'Informe um nome para o novo modelo.',
      });
      return;
    }
    if (!message.trim()) {
      setFeedback({
        tone: 'danger',
        message: 'Escreva a mensagem antes de salvar o modelo.',
      });
      return;
    }
    const id = `custom-${requestUuid()}`;
    const custom = setup.templates
      .filter((template) => !template.builtIn)
      .map(({ id: currentId, label: currentLabel, message: currentMessage }) => ({
        id: currentId,
        label: currentLabel,
        message: currentMessage,
      }));
    try {
      await saveTemplates.mutateAsync({
        defaultTemplateId: id,
        templates: [...custom, { id, label, message: message.trim() }],
      });
      setTemplateId(id);
      setModelName('');
      setFeedback({
        tone: 'success',
        message: 'Modelo salvo e definido como padrão de texto da empresa.',
      });
    } catch (error) {
      setFeedback({ tone: 'danger', message: apiErrorMessage(error) });
    }
  }

  async function useAsCompanyTextDefault() {
    if (!setup || !canManageTemplates || !templateId) return;
    const custom = setup.templates
      .filter((template) => !template.builtIn)
      .map(({ id, label, message: templateMessage }) => ({
        id,
        label,
        message: templateMessage,
      }));
    try {
      await saveTemplates.mutateAsync({
        defaultTemplateId: templateId,
        templates: custom,
      });
      setFeedback({
        tone: 'success',
        message:
          'Modelo definido como padrão de texto. Isso não liga envios automáticos.',
      });
    } catch (error) {
      setFeedback({ tone: 'danger', message: apiErrorMessage(error) });
    }
  }

  const footer =
    tab === 'message' ? (
      <>
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        {resendRequired ? (
          <Button
            variant="primary"
            isDisabled={!readyToSend}
            onClick={() => void send(true)}
          >
            {sendMutation.isPending ? 'Reenviando…' : 'Reenviar mesmo assim'}
          </Button>
        ) : (
          <Button
            variant="primary"
            isDisabled={!readyToSend}
            onClick={() => void send(false)}
          >
            {sendMutation.isPending ? 'Enviando…' : 'Enviar confirmação'}
          </Button>
        )}
      </>
    ) : (
      <Button variant="outline" onClick={onClose}>
        Fechar
      </Button>
    );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmação por WhatsApp"
      widthClass="sm:w-[560px]"
      zClass="z-[95]"
      footer={footer}
      mobileBackLabel="Voltar"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
          <button
            type="button"
            onClick={() => setTab('message')}
            className={[
              'min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors',
              tab === 'message'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-ink',
            ].join(' ')}
          >
            Mensagem
          </button>
          <button
            type="button"
            onClick={() => setTab('logs')}
            className={[
              'min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors',
              tab === 'logs'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-ink',
            ].join(' ')}
          >
            Logs {setup?.logs.length ? `(${setup.logs.length})` : ''}
          </button>
        </div>

        {setupQuery.isLoading ? (
          <LoadingState label="Carregando confirmação…" />
        ) : setupQuery.isError || !setup ? (
          <ErrorState
            message="Não foi possível carregar os dados da confirmação."
            onRetry={() => void setupQuery.refetch()}
          />
        ) : tab === 'message' ? (
          <>
            <section className="flex flex-col gap-1 border-b border-line pb-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
                Destinatária
              </span>
              <strong className="text-sm text-foreground">
                {setup.recipient.name ?? 'Cliente sem nome'}
              </strong>
              <span className="text-sm text-muted-ink">
                {setup.recipient.phone
                  ? formatPhone(setup.recipient.phone)
                  : 'Telefone não cadastrado'}
              </span>
              {customerBlocked && (
                <p className="mt-2 text-sm text-danger">
                  A cliente optou por não receber mensagens no WhatsApp. O backend
                  bloqueará o envio.
                </p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <label
                htmlFor="confirmation-template"
                className="text-xs font-semibold uppercase tracking-wide text-muted-ink"
              >
                Modelo
              </label>
              <select
                id="confirmation-template"
                value={templateId}
                onChange={(event) => chooseTemplate(event.target.value)}
                className="min-h-11 rounded-lg border border-line bg-white px-3 text-sm text-foreground outline-none focus:border-primary/50"
              >
                {setup.templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                    {template.id === setup.defaultTemplateId
                      ? ' — padrão'
                      : ''}
                  </option>
                ))}
              </select>
              {canManageTemplates && (
                <Button
                  variant="ghost"
                  size="sm"
                  isDisabled={
                    templateId === setup.defaultTemplateId ||
                    saveTemplates.isPending
                  }
                  onClick={() => void useAsCompanyTextDefault()}
                >
                  Usar como padrão de texto da empresa
                </Button>
              )}
              <p className="text-xs text-muted-ink">
                O padrão de texto não ativa automação. A autorização de envio é
                controlada separadamente.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <label
                htmlFor="confirmation-message"
                className="text-xs font-semibold uppercase tracking-wide text-muted-ink"
              >
                Mensagem
              </label>
              <textarea
                id="confirmation-message"
                value={message}
                onChange={(event) => {
                  setMessage(event.target.value);
                  setRequestKey(null);
                  setResendRequired(false);
                  setFeedback(null);
                }}
                rows={9}
                maxLength={2_000}
                className="min-h-[220px] resize-y rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary/50"
              />
              <p className="text-xs text-muted-ink">
                Variáveis: {'{cliente}'} · {'{quando}'} · {'{hora}'} ·{' '}
                {'{hora_curta}'} · {'{servico}'} · {'{estabelecimento}'}
              </p>
            </section>

            <section className="flex flex-col gap-2 border-y border-line py-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
                Prévia
              </span>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                {preview || 'Escreva uma mensagem para visualizar.'}
              </p>
            </section>

            {canManageTemplates && (
              <section className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-ink">
                  Salvar outro padrão
                </span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={modelName}
                    onChange={(event) => setModelName(event.target.value)}
                    maxLength={80}
                    placeholder="Nome do modelo"
                    className="min-h-11 flex-1 rounded-lg border border-line bg-white px-3 text-sm text-foreground outline-none focus:border-primary/50"
                  />
                  <Button
                    variant="outline"
                    isDisabled={saveTemplates.isPending}
                    onClick={() => void saveAsModel()}
                  >
                    {saveTemplates.isPending ? 'Salvando…' : 'Salvar modelo'}
                  </Button>
                </div>
              </section>
            )}

            <label className="flex cursor-pointer items-start gap-3 border-t border-line pt-4">
              <input
                type="checkbox"
                checked={authorized}
                disabled={!canSendConfirmation}
                onChange={(event) => setAuthorized(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--sp-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span className="text-sm text-foreground">
                <strong>Autorizo este envio</strong> para este agendamento.
                Essa escolha será gravada no horário; não altera os demais
                agendamentos.
              </span>
            </label>

            {!setup.recipient.phone && (
              <p className="text-sm text-danger">
                Cadastre o telefone da cliente antes de enviar.
              </p>
            )}
            {!canSendConfirmation && (
              <p className="text-sm text-muted-ink">
                Seu perfil pode consultar os logs, mas não pode disparar
                confirmações.
              </p>
            )}
          </>
        ) : setup.logs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-foreground">
              Nenhum envio registrado
            </p>
            <p className="mt-1 text-sm text-muted-ink">
              Os estados aparecerão aqui depois do primeiro envio autorizado.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {setup.logs.map((log) => {
              const meta = statusMeta(log.status);
              return (
                <li key={log.id} className="flex flex-col gap-2 py-4 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                    <time className="text-xs text-muted-ink">
                      {logTimestamp(log)}
                    </time>
                  </div>
                  <p className="text-sm text-muted-ink">{meta.description}</p>
                  <p className="text-xs text-muted-ink">
                    Número: {formatPhone(log.phone)} · Tentativas: {log.attempts}
                  </p>
                  {log.error && (
                    <p className="text-xs text-danger">{log.error}</p>
                  )}
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-primary">
                      Ver mensagem
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap border-l-2 border-line pl-3 text-xs leading-5 text-foreground">
                      {log.text}
                    </p>
                  </details>
                </li>
              );
            })}
          </ul>
        )}

        {feedback && (
          <div
            className={[
              'rounded-lg border px-3 py-2 text-sm',
              feedback.tone === 'success'
                ? 'border-success/30 bg-success/10 text-success'
                : feedback.tone === 'warning'
                  ? 'border-warning/30 bg-warning/10 text-warning'
                  : 'border-danger/30 bg-danger/10 text-danger',
            ].join(' ')}
          >
            {feedback.message}
          </div>
        )}
      </div>
    </Drawer>
  );
}
