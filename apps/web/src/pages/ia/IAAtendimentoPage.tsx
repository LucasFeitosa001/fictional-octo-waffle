import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button, Card, Input, Spinner, TextField } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { Drawer } from '../../components/Drawer';
import {
  CustomerPickerDrawer,
  type PickedCustomer,
} from '../../components/CustomerPickerDrawer';
import { AppSwitch, SwitchRow } from '../../components/SwitchRow';
import { WhatsappConnectionCard } from '../../components/WhatsappConnectionCard';
import {
  IconAlertTriangle,
  IconBot,
  IconCalendarPlus,
  IconCheck,
  IconChevron,
  IconCircleCheck,
  IconMessage,
  IconMic,
  IconPaperclip,
  IconPlus,
  IconSearch,
  IconSend,
  IconSparkles,
  IconTrash,
  IconWhatsApp,
  IconX,
} from '../../components/icons';
import { initials } from '../../lib/format';
import { API_BASE_URL } from '../../lib/config';
import { toast, toastSuccess } from '../../lib/toast';
import { useCan } from '../../lib/queries/permissions';
import {
  useWhatsappStatus,
  type WhatsappStatus,
} from '../../lib/queries/whatsapp';
import {
  type AiTone,
  type ConversationFilter,
  type WhatsappFaq,
  type WhatsappInboxMessage,
  useSendWhatsappInboxMedia,
  useSendWhatsappInboxMessage,
  useStartWhatsappConversation,
  useUpdateWhatsappConversation,
  useUpdateWhatsappInboxConfig,
  useWhatsappConversations,
  useWhatsappInboxConfig,
  useWhatsappInboxMessages,
  useWhatsappInboxStats,
} from '../../lib/queries/whatsappInbox';

const TONES: Array<{ key: AiTone; label: string; hint: string }> = [
  { key: 'simpatico', label: 'Simpático', hint: 'Caloroso e natural' },
  { key: 'profissional', label: 'Profissional', hint: 'Cordial e formal' },
  { key: 'direto', label: 'Direto', hint: 'Objetivo e breve' },
];

const FILTERS: Array<{ key: ConversationFilter; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'open', label: 'Em aberto' },
  { key: 'resolved', label: 'Resolvidas' },
];

interface ConfigDraft {
  agentName: string;
  greeting: string;
  tone: AiTone;
  autoReply: boolean;
  bookingViaChat: boolean;
  handoffEnabled: boolean;
  knowledgeBase: string;
  faq: WhatsappFaq[];
}

const EMPTY_CONFIG: ConfigDraft = {
  agentName: 'Duda',
  greeting: 'Olá! Sou a assistente virtual do salão. Como posso ajudar?',
  tone: 'simpatico',
  autoReply: true,
  bookingViaChat: true,
  handoffEnabled: true,
  knowledgeBase: '',
  faq: [],
};

function IaBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-strong">
      <IconSparkles size={11} /> IA
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-soft)]">
      <Card.Content className="flex items-center gap-3 p-4">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: accent }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted">{label}</p>
          <p className="text-lg font-bold text-ink">{value}</p>
        </div>
      </Card.Content>
    </Card>
  );
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 13) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return phone.startsWith('+') ? phone : `+${phone}`;
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function automationLabel(kind: string | null) {
  const labels: Record<string, string> = {
    confirmation: 'Confirmação',
    cancellation: 'Cancelamento',
    reminder: 'Lembrete',
    followup: 'Pós-atendimento',
    campaign: 'Campanha',
  };
  return kind ? (labels[kind] ?? 'Automação') : 'Automação';
}

function mediaMetadata(message: WhatsappInboxMessage): {
  type: 'image' | 'audio';
  url: string;
  mimeType?: string;
  ptt?: boolean;
} | null {
  const value = message.metadataJson;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  const type =
    metadata.mediaType === 'image' || metadata.mediaType === 'audio'
      ? metadata.mediaType
      : message.kind === 'image' || message.kind === 'audio'
        ? message.kind
        : null;
  if (!type || typeof metadata.mediaUrl !== 'string') return null;
  const url = metadata.mediaUrl.startsWith('/api/')
    ? `${new URL(API_BASE_URL, window.location.origin).origin}${metadata.mediaUrl}`
    : metadata.mediaUrl;
  return {
    type,
    url,
    mimeType:
      typeof metadata.mimetype === 'string' ? metadata.mimetype : undefined,
    ptt: metadata.ptt === true,
  };
}

function isMediaPlaceholder(message: WhatsappInboxMessage): boolean {
  if (message.kind === 'image') return /^📷 Imagem(?: recebida)?$/.test(message.text);
  if (message.kind === 'audio') return /^🎤 Áudio(?: recebido)?$/.test(message.text);
  return false;
}

function DeliveryTicks({
  status,
}: {
  status: WhatsappInboxMessage['status'];
}) {
  if (status === 'pending') return <span title="Na fila">◷</span>;
  if (status === 'failed') return <span title="Falha no envio">!</span>;
  if (status === 'sent') return <span title="Enviada">✓</span>;
  const read = status === 'read';
  return (
    <span
      title={read ? 'Lida' : 'Entregue'}
      aria-label={read ? 'Mensagem lida' : 'Mensagem entregue'}
      className={read ? 'font-bold text-[#53bdeb]' : 'font-bold'}
    >
      ✓✓
    </span>
  );
}

export function IAAtendimentoPage() {
  const permissions = useCan();
  const canManage = permissions.can('marketing:manage');
  const whatsapp = useWhatsappStatus();
  const configQuery = useWhatsappInboxConfig();
  const stats = useWhatsappInboxStats();
  const updateConfig = useUpdateWhatsappInboxConfig();
  const updateConversation = useUpdateWhatsappConversation();
  const sendMessage = useSendWhatsappInboxMessage();
  const sendMedia = useSendWhatsappInboxMedia();
  const startConversation = useStartWhatsappConversation();

  const whatsappStatus: WhatsappStatus =
    whatsapp.data?.status ?? 'connecting';
  const connected = whatsappStatus === 'open';
  const [showConnectionPanel, setShowConnectionPanel] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const conversationsQuery = useWhatsappConversations(search, filter);
  const conversations = conversationsQuery.data?.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    conversations.find((conversation) => conversation.id === selectedId) ??
    null;
  const messagesQuery = useWhatsappInboxMessages(selectedId);
  const messages = messagesQuery.data?.data ?? [];
  const [threadOpenMobile, setThreadOpenMobile] = useState(false);
  const [draft, setDraft] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [newRecipient, setNewRecipient] = useState<PickedCustomer | null>(null);
  const [newConversationText, setNewConversationText] = useState('');
  const [configDraft, setConfigDraft] =
    useState<ConfigDraft>(EMPTY_CONFIG);
  const [loadedConfigVersion, setLoadedConfigVersion] = useState<string | null>(
    null,
  );
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const config = configQuery.data;
    if (!config || config.updatedAt === loadedConfigVersion) return;
    setConfigDraft({
      agentName: config.agentName,
      greeting: config.greeting,
      tone: config.tone,
      autoReply: config.autoReply,
      bookingViaChat: config.bookingViaChat,
      handoffEnabled: config.handoffEnabled,
      knowledgeBase: config.knowledgeBase ?? '',
      faq: config.faq,
    });
    setLoadedConfigVersion(config.updatedAt);
  }, [configQuery.data, loadedConfigVersion]);

  useEffect(() => {
    if (!selectedId && conversations.length) {
      setSelectedId(conversations[0].id);
    } else if (
      selectedId &&
      conversations.length &&
      !conversations.some((conversation) => conversation.id === selectedId)
    ) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    if (!selected || selected.unreadCount === 0) return;
    updateConversation.mutate({
      id: selected.id,
      body: { read: true },
    });
  }, [selected?.id, selected?.unreadCount]);

  useEffect(() => {
    requestAnimationFrame(() => {
      threadRef.current?.scrollTo({
        top: threadRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  }, [messages.length, selectedId]);

  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const configDirty = useMemo(() => {
    const current = configQuery.data;
    if (!current) return false;
    return (
      configDraft.agentName !== current.agentName ||
      configDraft.greeting !== current.greeting ||
      configDraft.tone !== current.tone ||
      configDraft.autoReply !== current.autoReply ||
      configDraft.bookingViaChat !== current.bookingViaChat ||
      configDraft.handoffEnabled !== current.handoffEnabled ||
      configDraft.knowledgeBase !== (current.knowledgeBase ?? '') ||
      JSON.stringify(configDraft.faq) !== JSON.stringify(current.faq)
    );
  }, [configDraft, configQuery.data]);

  function selectConversation(id: string) {
    setSelectedId(id);
    setThreadOpenMobile(true);
  }

  function submitMessage() {
    const text = draft.trim();
    if (!connected || !selected || !text || sendMessage.isPending) return;
    sendMessage.mutate(
      { id: selected.id, text },
      {
        onSuccess: () => {
          setDraft('');
          requestAnimationFrame(() => {
            threadRef.current?.scrollTo({
              top: threadRef.current.scrollHeight,
              behavior: 'smooth',
            });
          });
        },
        onError: (error) =>
          toast.danger(
            error instanceof Error
              ? error.message
              : 'Falha ao enviar a mensagem',
          ),
      },
    );
  }

  function submitMedia(file: File, ptt = false) {
    if (!connected || !selected || sendMedia.isPending) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.danger('O arquivo deve ter no máximo 16 MB');
      return;
    }
    if (!file.type.startsWith('image/') && !file.type.startsWith('audio/')) {
      toast.danger('Escolha uma imagem ou um áudio');
      return;
    }
    const caption = file.type.startsWith('image/') ? draft.trim() : '';
    sendMedia.mutate(
      { id: selected.id, file, caption, ptt },
      {
        onSuccess: () => {
          if (caption) setDraft('');
          requestAnimationFrame(() => {
            threadRef.current?.scrollTo({
              top: threadRef.current.scrollHeight,
              behavior: 'smooth',
            });
          });
        },
        onError: (error) => {
          toast.danger(
            error instanceof Error ? error.message : 'Falha ao enviar mídia',
          );
        },
      },
    );
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!connected || !selected || sendMedia.isPending) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.danger('Este navegador não permite gravar áudio');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supportedMime = [
        'audio/mp4',
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(
        stream,
        supportedMime ? { mimeType: supportedMime } : undefined,
      );
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const rawType = recorder.mimeType || supportedMime || 'audio/webm';
        const type = rawType.split(';')[0];
        const extension =
          type === 'audio/mp4' ? 'm4a' : type === 'audio/ogg' ? 'ogg' : 'webm';
        const blob = new Blob(recordingChunksRef.current, { type });
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        recordingChunksRef.current = [];
        setRecording(false);
        if (blob.size > 0) {
          submitMedia(
            new File([blob], `audio-${Date.now()}.${extension}`, { type }),
            true,
          );
        }
      };
      recorder.start(500);
      setRecording(true);
    } catch {
      toast.danger('Não foi possível acessar o microfone');
    }
  }

  function chooseNewRecipient(customer: PickedCustomer) {
    if (!customer.phone?.trim()) {
      toast.danger('Esse cliente não possui telefone cadastrado');
      return;
    }
    setNewRecipient(customer);
    setNewConversationText('');
  }

  function submitNewConversation() {
    const text = newConversationText.trim();
    if (
      !connected ||
      !newRecipient?.phone ||
      !text ||
      startConversation.isPending
    ) {
      return;
    }
    startConversation.mutate(
      {
        customerId: newRecipient.id,
        phone: newRecipient.phone,
        text,
      },
      {
        onSuccess: ({ conversation }) => {
          setSelectedId(conversation.id);
          setThreadOpenMobile(true);
          setNewRecipient(null);
          setNewConversationText('');
          toastSuccess('Mensagem adicionada à fila do WhatsApp');
        },
        onError: (error) =>
          toast.danger(
            error instanceof Error
              ? error.message
              : 'Falha ao iniciar a conversa',
          ),
      },
    );
  }

  function patchConversation(body: {
    handledByAi?: boolean;
    resolved?: boolean;
  }) {
    if (!selected) return;
    updateConversation.mutate(
      { id: selected.id, body },
      {
        onError: (error) =>
          toast.danger(
            error instanceof Error
              ? error.message
              : 'Falha ao atualizar a conversa',
          ),
      },
    );
  }

  function addFaq() {
    const question = newQuestion.trim();
    const answer = newAnswer.trim();
    if (!question || !answer) return;
    setConfigDraft((current) => ({
      ...current,
      faq: [...current.faq, { question, answer }],
    }));
    setNewQuestion('');
    setNewAnswer('');
  }

  function saveConfig() {
    updateConfig.mutate(
      {
        ...configDraft,
        agentName: configDraft.agentName.trim(),
        greeting: configDraft.greeting.trim(),
        knowledgeBase: configDraft.knowledgeBase.trim(),
      },
      {
        onSuccess: () => toastSuccess('Configuração da recepcionista salva'),
        onError: (error) =>
          toast.danger(
            error instanceof Error
              ? error.message
              : 'Falha ao salvar a configuração',
          ),
      },
    );
  }

  function setAiEnabled(enabled: boolean) {
    updateConfig.mutate(
      { enabled },
      {
        onSuccess: () =>
          toastSuccess(
            enabled ? 'Recepcionista virtual ativada' : 'Recepcionista pausada',
          ),
        onError: (error) =>
          toast.danger(
            error instanceof Error
              ? error.message
              : 'Falha ao alterar a recepcionista virtual',
          ),
      },
    );
  }

  const linkedPhone = whatsapp.data?.phone;
  const isAiEnabled = configQuery.data?.enabled ?? false;

  return (
    <div>
      <PageHeader
        title="WhatsApp e IA"
        subtitle="Caixa real do número vinculado, atendimento humano e recepcionista virtual"
        actions={
          <>
            <button
              type="button"
              onClick={() =>
                setShowConnectionPanel((visible) =>
                  connected ? !visible : true,
                )
              }
              className={[
                'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                connected
                  ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#128C3E]'
                  : whatsappStatus === 'qr' ||
                      whatsappStatus === 'connecting'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
                    : 'border-default-300 bg-white text-muted-ink hover:bg-default-50',
              ].join(' ')}
            >
              <IconWhatsApp size={16} />
              {whatsapp.isLoading
                ? 'Verificando…'
                : connected
                  ? linkedPhone
                    ? formatPhone(linkedPhone)
                    : 'WhatsApp conectado'
                  : whatsappStatus === 'qr' ||
                      whatsappStatus === 'connecting'
                    ? 'Conectando…'
                    : 'Conectar WhatsApp'}
              <span
                className={[
                  'h-2 w-2 rounded-full',
                  connected
                    ? 'bg-[#25D366]'
                    : whatsappStatus === 'qr' ||
                        whatsappStatus === 'connecting'
                      ? 'animate-pulse bg-amber-500'
                      : 'bg-default-300',
                ].join(' ')}
              />
            </button>
            <div className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--color-soft-border)] bg-warm-white px-3 py-2 shadow-[var(--shadow-soft)]">
              <IconBot size={16} className="text-gold-strong" />
              <span className="text-sm font-medium text-ink">
                {isAiEnabled ? 'IA ativa' : 'IA pausada'}
              </span>
              <AppSwitch
                checked={isAiEnabled}
                onChange={setAiEnabled}
                isDisabled={
                  configQuery.isLoading ||
                  updateConfig.isPending ||
                  permissions.isLoading ||
                  !canManage
                }
                aria-label="Ativar recepcionista virtual"
              />
            </div>
          </>
        }
      />

      {whatsapp.isError || configQuery.isError || stats.isError ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <span>Não foi possível carregar todos os dados do WhatsApp e IA.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void whatsapp.refetch();
              void configQuery.refetch();
              void stats.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {!whatsapp.isLoading && (!connected || showConnectionPanel) ? (
        <Card className="mb-5 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
          <Card.Content className="p-5 sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="font-brand text-base font-semibold text-ink">
                  Número vinculado ao salão
                </p>
                <p className="mt-1 text-sm text-muted-ink">
                  A conexão é a mesma de Configurações e alimenta esta caixa de
                  entrada, lembretes e automações.
                </p>
              </div>
              {connected ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConnectionPanel(false)}
                >
                  <IconX size={16} /> Fechar
                </Button>
              ) : null}
            </div>
            <WhatsappConnectionCard />
          </Card.Content>
        </Card>
      ) : null}

      {!configQuery.isLoading && !configQuery.data?.aiAvailable ? (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-amber-900">
          <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              IA generativa sem chave configurada
            </p>
            <p className="text-xs leading-relaxed">
              FAQ, preços e agendamento continuam funcionando pelo motor local.
              Configure GROQ_API_KEY ou ANTHROPIC_API_KEY na API para respostas
              livres e contextuais.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={<IconMessage size={20} className="text-data-messages" />}
          label="Conversas hoje"
          value={String(stats.data?.conversationsToday ?? 0)}
          accent="var(--sp-data-messages-soft)"
        />
        <MetricCard
          icon={<IconSparkles size={20} className="text-gold-strong" />}
          label="Respostas da IA hoje"
          value={String(stats.data?.aiMessagesToday ?? 0)}
          accent="var(--sp-gold-soft)"
        />
        <MetricCard
          icon={<IconCalendarPlus size={20} className="text-data-appointments" />}
          label="Agendamentos feitos pela IA"
          value={String(stats.data?.bookingsViaAi ?? 0)}
          accent="var(--sp-data-appointments-soft)"
        />
        <MetricCard
          icon={<IconCircleCheck size={20} className="text-status-success-fg" />}
          label="Taxa de resolução"
          value={`${stats.data?.resolutionRate ?? 0}%`}
          accent="var(--sp-status-success-soft)"
        />
      </div>

      {/* Janela de atendimento com altura própria, como WhatsApp Web.
          O histórico nunca aumenta a página: somente a lista lateral e o miolo
          das mensagens rolam. No mobile a janela ocupa o viewport útil acima
          da barra inferior; no desktop usa uma altura confortável e limitada. */}
      <div className="mb-5 grid h-[max(520px,calc(100dvh-8rem))] max-h-[720px] min-h-0 gap-4 lg:h-[clamp(560px,68dvh,720px)] lg:grid-cols-[340px_1fr]">
        <Card
          className={`h-full min-h-0 min-w-0 flex-col overflow-hidden border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)] ${
            threadOpenMobile ? 'hidden lg:block' : ''
          } ${threadOpenMobile ? '' : 'flex'} lg:!flex`}
        >
          <div className="shrink-0 border-b border-[var(--color-soft-border)] p-3">
            <div className="relative">
              <IconSearch
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar nome ou telefone"
                className="h-10 w-full rounded-xl border border-[var(--color-soft-border)] bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>
            <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={[
                    'shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
                    filter === item.key
                      ? 'bg-ink text-white'
                      : 'bg-cream text-muted-ink hover:text-ink',
                  ].join(' ')}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-soft-border)] px-4 py-2.5">
            <p className="font-brand text-sm font-semibold text-ink">
              Conversas
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!connected}
                onClick={() => setCustomerPickerOpen(true)}
                className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-ink px-2.5 text-xs font-semibold text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <IconPlus size={13} /> Nova
              </button>
              <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-strong">
                <IconWhatsApp size={12} /> {conversations.length}
              </span>
            </div>
          </div>

          <div className="min-h-0 flex-1 divide-y divide-[var(--color-soft-border)] overflow-y-auto overscroll-contain">
            {conversationsQuery.isLoading ? (
              <div className="grid min-h-48 place-items-center">
                <Spinner size="sm" />
              </div>
            ) : conversationsQuery.isError ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-danger">
                  Não foi possível carregar as conversas.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => conversationsQuery.refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <IconMessage
                  size={28}
                  className="mx-auto mb-2 text-muted"
                />
                <p className="text-sm font-medium text-ink">
                  Nenhuma conversa encontrada
                </p>
                <p className="mt-1 text-xs text-muted">
                  Novas mensagens do número vinculado aparecerão aqui.
                </p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => selectConversation(conversation.id)}
                  className={[
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                    conversation.id === selectedId
                      ? 'bg-gold/10'
                      : 'hover:bg-cream',
                  ].join(' ')}
                >
                  <Avatar size="sm">
                    {conversation.customer?.avatarUrl ? (
                      <Avatar.Image
                        src={conversation.customer.avatarUrl}
                        alt=""
                      />
                    ) : null}
                    <Avatar.Fallback className="bg-ink text-gold">
                      {initials(conversation.name)}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">
                        {conversation.name}
                      </span>
                      {conversation.handledByAi ? <IaBadge /> : null}
                    </div>
                    <p className="truncate text-xs text-muted-ink">
                      {conversation.lastOutboundAt ===
                      conversation.lastMessageAt
                        ? '✓ '
                        : ''}
                      {conversation.lastMessageText || 'Sem mensagens'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-[10px] text-muted">
                      {formatConversationTime(conversation.lastMessageAt)}
                    </span>
                    {conversation.unreadCount > 0 ? (
                      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1 text-[11px] font-bold text-white">
                        {conversation.unreadCount}
                      </span>
                    ) : conversation.resolved ? (
                      <IconCheck size={14} className="text-status-success-fg" />
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card
          className={`h-full min-h-0 min-w-0 flex-col overflow-hidden border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)] lg:flex ${
            threadOpenMobile ? 'flex' : 'hidden'
          }`}
        >
          {selected ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-soft-border)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setThreadOpenMobile(false)}
                    aria-label="Voltar para conversas"
                    className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-ink transition hover:bg-cream hover:text-ink lg:hidden"
                  >
                    <IconChevron size={20} className="rotate-90" />
                  </button>
                  <Avatar size="sm">
                    <Avatar.Fallback className="bg-ink text-gold">
                      {initials(selected.name)}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {selected.name}
                    </p>
                    <p className="text-xs text-muted-ink">
                      {formatPhone(selected.phone)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selected.handledByAi ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-strong">
                        <IconBot size={13} /> IA no comando
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => patchConversation({ handledByAi: false })}
                        isDisabled={updateConversation.isPending}
                      >
                        Assumir
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-pink/15 px-2.5 py-1 text-xs font-semibold text-[#c25d77]">
                        Atendente
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          patchConversation({ handledByAi: true })
                        }
                        isDisabled={
                          updateConversation.isPending || !isAiEnabled
                        }
                      >
                        Devolver para IA
                      </Button>
                    </>
                  )}
                  <Button
                    variant={selected.resolved ? 'outline' : 'primary'}
                    size="sm"
                    onClick={() =>
                      patchConversation({ resolved: !selected.resolved })
                    }
                    isDisabled={updateConversation.isPending}
                  >
                    <IconCircleCheck size={15} />
                    {selected.resolved ? 'Reabrir' : 'Resolver'}
                  </Button>
                </div>
              </div>

              <div
                ref={threadRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[var(--sp-canvas)] px-4 py-4"
              >
                {messagesQuery.isLoading ? (
                  <div className="grid h-full place-items-center">
                    <Spinner size="sm" />
                  </div>
                ) : messagesQuery.isError ? (
                  <div className="grid h-full place-items-center text-center">
                    <div>
                      <p className="text-sm text-danger">
                        Não foi possível carregar as mensagens.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => messagesQuery.refetch()}
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="grid h-full place-items-center text-center text-muted">
                    <div>
                      <IconMessage size={30} className="mx-auto mb-2" />
                      <p className="text-sm">A conversa ainda está vazia.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isCustomer = message.sender === 'customer';
                    const media = mediaMetadata(message);
                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          isCustomer ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <div
                          className={[
                            'max-w-[86%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-[var(--shadow-soft)] sm:max-w-[75%]',
                            isCustomer
                              ? 'rounded-tl-sm border border-[var(--color-soft-border)] bg-white text-ink'
                              : message.sender === 'ai'
                                ? 'rounded-tr-sm bg-gold text-ink'
                                : message.sender === 'system'
                                  ? 'rounded-tr-sm border border-[#b7dfb2] bg-[#dcf8d2] text-ink'
                                : 'rounded-tr-sm bg-ink text-white',
                          ].join(' ')}
                        >
                          {message.sender === 'ai' ? (
                            <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#7a5a12]">
                              <IconSparkles size={11} /> IA
                            </span>
                          ) : null}
                          {message.sender === 'agent' ? (
                            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/60">
                              Atendente
                            </span>
                          ) : null}
                          {message.sender === 'system' ? (
                            <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#367347]">
                              <IconWhatsApp size={11} />
                              {automationLabel(message.kind)}
                            </span>
                          ) : null}
                          {media?.type === 'image' ? (
                            <a
                              href={media.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mb-1 block overflow-hidden rounded-xl bg-black/5"
                              title="Abrir imagem em tamanho completo"
                            >
                              <img
                                src={media.url}
                                alt={message.text || 'Imagem do WhatsApp'}
                                loading="lazy"
                                className="max-h-80 w-full object-contain"
                              />
                            </a>
                          ) : null}
                          {media?.type === 'audio' ? (
                            <audio
                              controls
                              preload="metadata"
                              src={media.url}
                              className="my-1 h-10 w-[min(280px,70vw)] max-w-full"
                            >
                              Seu navegador não consegue reproduzir este áudio.
                            </audio>
                          ) : null}
                          {!media || !isMediaPlaceholder(message) ? (
                            <p className="break-words leading-snug [overflow-wrap:anywhere]">
                              {message.text}
                            </p>
                          ) : null}
                          <div
                            className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                              isCustomer
                                ? 'text-[#9a948c]'
                                : message.sender === 'ai'
                                  ? 'text-[#7a5a12]'
                                  : message.sender === 'system'
                                    ? 'text-[#4f805d]'
                                  : 'text-white/55'
                            }`}
                          >
                            <span>{formatMessageTime(message.createdAt)}</span>
                            {!isCustomer ? (
                              <DeliveryTicks status={message.status} />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="shrink-0 border-t border-[var(--color-soft-border)] bg-warm-white p-3">
                {!connected ? (
                  <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Vincule o WhatsApp para enviar mensagens.
                  </p>
                ) : null}
                <div className="flex items-center gap-2">
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,audio/ogg,audio/mpeg,audio/mp4,audio/aac,audio/webm,audio/wav"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      if (file) submitMedia(file);
                    }}
                  />
                  <Button
                    variant="ghost"
                    isIconOnly
                    aria-label="Anexar imagem ou áudio"
                    onClick={() => mediaInputRef.current?.click()}
                    isDisabled={!connected || !selected || sendMedia.isPending}
                    className="shrink-0 text-muted-ink"
                  >
                    <IconPaperclip size={18} />
                  </Button>
                  <Button
                    variant={recording ? 'primary' : 'ghost'}
                    isIconOnly
                    aria-label={recording ? 'Parar gravação' : 'Gravar áudio'}
                    onClick={() => void toggleRecording()}
                    isDisabled={!connected || !selected || sendMedia.isPending}
                    className={
                      recording
                        ? 'shrink-0 animate-pulse bg-red-500 text-white'
                        : 'shrink-0 text-muted-ink'
                    }
                  >
                    <IconMic size={18} />
                  </Button>
                  <TextField
                    value={draft}
                    onChange={setDraft}
                    aria-label="Mensagem"
                    className="min-w-0 flex-1"
                  >
                    <Input
                      placeholder="Escreva como atendente…"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          submitMessage();
                        }
                      }}
                    />
                  </TextField>
                  <Button
                    variant="primary"
                    onClick={submitMessage}
                    isDisabled={
                      !connected ||
                      !draft.trim() ||
                      sendMessage.isPending ||
                      sendMedia.isPending
                    }
                    className="bg-gold text-ink shadow-[var(--shadow-gold)] hover:bg-[#e6a92f]"
                  >
                    {sendMessage.isPending || sendMedia.isPending ? (
                      <Spinner size="sm" />
                    ) : (
                      <IconSend size={16} />
                    )}
                    Enviar
                  </Button>
                </div>
                {recording ? (
                  <p className="mt-1.5 px-1 text-xs font-medium text-red-600">
                    Gravando… toque no microfone para parar e enviar.
                  </p>
                ) : null}
                <p className="mt-1.5 px-1 text-[11px] text-[#9a948c]">
                  Uma mensagem humana assume a conversa e pausa a IA apenas
                  para este contato.
                </p>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center text-muted">
              <div>
                <IconMessage size={34} className="mx-auto mb-2" />
                <p className="text-sm font-medium text-ink">
                  Selecione uma conversa
                </p>
                <p className="mt-1 text-xs">
                  As mensagens reais do número vinculado aparecerão aqui.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-brand text-lg font-semibold text-ink">
            Configuração da recepcionista
          </h2>
          <p className="text-sm text-muted">
            Persona, comportamento e conhecimento usados nas respostas.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={saveConfig}
          isDisabled={!canManage || !configDirty || updateConfig.isPending}
        >
          {updateConfig.isPending ? <Spinner size="sm" /> : <IconCheck size={16} />}
          Salvar
        </Button>
      </div>

      {!permissions.isLoading && !canManage ? (
        <p className="mb-4 rounded-xl border border-[var(--color-soft-border)] bg-cream px-4 py-3 text-sm text-muted-ink">
          Seu perfil pode atender as conversas, mas somente um responsável com
          permissão de marketing pode alterar a configuração da IA.
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="min-w-0 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
          <Card.Content className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-gold">
                <IconBot size={18} />
              </span>
              <div>
                <p className="font-brand text-sm font-semibold text-ink">
                  Persona da IA
                </p>
                <p className="text-xs text-muted">Nome, saudação e tom</p>
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-ink">
                Nome da recepcionista
              </span>
              <input
                disabled={!canManage}
                value={configDraft.agentName}
                maxLength={80}
                onChange={(event) =>
                  setConfigDraft((current) => ({
                    ...current,
                    agentName: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-[var(--color-soft-border)] bg-white px-3 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-ink">
                Saudação inicial
              </span>
              <textarea
                disabled={!canManage}
                value={configDraft.greeting}
                maxLength={1000}
                rows={3}
                onChange={(event) =>
                  setConfigDraft((current) => ({
                    ...current,
                    greeting: event.target.value,
                  }))
                }
                className="w-full resize-y rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </label>

            <div className="flex flex-col gap-2">
              {TONES.map((tone) => {
                const active = configDraft.tone === tone.key;
                return (
                  <button
                    key={tone.key}
                    type="button"
                    disabled={!canManage}
                    onClick={() =>
                      setConfigDraft((current) => ({
                        ...current,
                        tone: tone.key,
                      }))
                    }
                    className={[
                      'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all',
                      active
                        ? 'border-transparent bg-gold shadow-[var(--shadow-gold)]'
                        : 'border-[var(--color-soft-border)] bg-white hover:bg-cream',
                    ].join(' ')}
                  >
                    <span>
                      <span className="block text-sm font-semibold text-ink">
                        {tone.label}
                      </span>
                      <span
                        className={`block text-xs ${
                          active ? 'text-[#7a5a12]' : 'text-muted-ink'
                        }`}
                      >
                        {tone.hint}
                      </span>
                    </span>
                    {active ? <IconCheck size={18} /> : null}
                  </button>
                );
              })}
            </div>
          </Card.Content>
        </Card>

        <Card className="min-w-0 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
          <Card.Content className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/15 text-gold-strong">
                <IconSparkles size={18} />
              </span>
              <div>
                <p className="font-brand text-sm font-semibold text-ink">
                  Comportamento
                </p>
                <p className="text-xs text-muted">O que a IA pode fazer</p>
              </div>
            </div>

            <div className="divide-y divide-[var(--color-soft-border)] rounded-xl border border-[var(--color-soft-border)] bg-white px-3.5">
              <SwitchRow
                label="Responder automaticamente"
                description="Responde novas mensagens quando a IA está ativa."
                checked={configDraft.autoReply}
                isDisabled={!canManage}
                onChange={(checked) =>
                  setConfigDraft((current) => ({
                    ...current,
                    autoReply: checked,
                  }))
                }
                className="py-3"
              />
              <SwitchRow
                label="Agendar pelo chat"
                description="Consulta a agenda e cria o horário após confirmação."
                checked={configDraft.bookingViaChat}
                isDisabled={!canManage}
                onChange={(checked) =>
                  setConfigDraft((current) => ({
                    ...current,
                    bookingViaChat: checked,
                  }))
                }
                className="py-3"
              />
              <SwitchRow
                label="Transferir para atendente"
                description="Pausa a IA quando a pergunta exige uma pessoa."
                checked={configDraft.handoffEnabled}
                isDisabled={!canManage}
                onChange={(checked) =>
                  setConfigDraft((current) => ({
                    ...current,
                    handoffEnabled: checked,
                  }))
                }
                className="py-3"
              />
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-ink">
                Informações extras do salão
              </span>
              <textarea
                disabled={!canManage}
                value={configDraft.knowledgeBase}
                maxLength={12000}
                rows={8}
                placeholder="Ex.: estacionamento, formas de pagamento, política de atraso, endereço e orientações especiais."
                onChange={(event) =>
                  setConfigDraft((current) => ({
                    ...current,
                    knowledgeBase: event.target.value,
                  }))
                }
                className="w-full resize-y rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              <span className="mt-1 block text-right text-[10px] text-muted">
                {configDraft.knowledgeBase.length}/12000
              </span>
            </label>
          </Card.Content>
        </Card>

        <Card className="min-w-0 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
          <Card.Content className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-pink/15 text-[#c25d77]">
                <IconMessage size={18} />
              </span>
              <div>
                <p className="font-brand text-sm font-semibold text-ink">
                  Perguntas frequentes
                </p>
                <p className="text-xs text-muted">
                  Respostas exatas ensinadas à IA
                </p>
              </div>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto">
              {configDraft.faq.map((faq, index) => (
                <div
                  key={`${faq.question}-${index}`}
                  className="group flex items-start justify-between gap-2 rounded-xl border border-[var(--color-soft-border)] bg-white px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {faq.question}
                    </p>
                    <p className="whitespace-pre-wrap text-xs text-muted-ink">
                      {faq.answer}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() =>
                      setConfigDraft((current) => ({
                        ...current,
                        faq: current.faq.filter(
                          (_item, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                    aria-label="Remover pergunta"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#9a948c] transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              ))}
              {configDraft.faq.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--color-soft-border)] px-3 py-4 text-center text-xs text-muted">
                  Nenhuma pergunta cadastrada.
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--color-soft-border)] bg-white p-3">
              <input
                disabled={!canManage}
                value={newQuestion}
                maxLength={300}
                onChange={(event) => setNewQuestion(event.target.value)}
                placeholder="Nova pergunta…"
                className="h-10 rounded-xl border border-[var(--color-soft-border)] px-3 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              <textarea
                disabled={!canManage}
                value={newAnswer}
                maxLength={2000}
                rows={3}
                onChange={(event) => setNewAnswer(event.target.value)}
                placeholder="Resposta da recepcionista…"
                className="resize-y rounded-xl border border-[var(--color-soft-border)] px-3 py-2 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              <div className="flex justify-end gap-2">
                {newQuestion || newAnswer ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={!canManage}
                    onClick={() => {
                      setNewQuestion('');
                      setNewAnswer('');
                    }}
                  >
                    <IconX size={15} /> Limpar
                  </Button>
                ) : null}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={addFaq}
                  isDisabled={
                    !canManage || !newQuestion.trim() || !newAnswer.trim()
                  }
                >
                  <IconPlus size={15} /> Adicionar
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      <CustomerPickerDrawer
        isOpen={customerPickerOpen}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={chooseNewRecipient}
      />
      <Drawer
        isOpen={Boolean(newRecipient)}
        onClose={() => {
          setNewRecipient(null);
          setNewConversationText('');
        }}
        title="Nova conversa"
        widthClass="sm:w-[480px]"
        zClass="z-[100]"
        mobileBackLabel="Voltar"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setNewRecipient(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={submitNewConversation}
              isDisabled={
                !newConversationText.trim() || startConversation.isPending
              }
            >
              {startConversation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <IconSend size={16} />
              )}
              Enviar
            </Button>
          </>
        }
      >
        {newRecipient ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-soft-border)] bg-cream px-4 py-3">
              <p className="text-sm font-semibold text-ink">
                {newRecipient.name}
              </p>
              <p className="text-xs text-muted-ink">
                {formatPhone(newRecipient.phone ?? '')}
              </p>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-muted-ink">
                Mensagem
              </span>
              <textarea
                autoFocus
                value={newConversationText}
                maxLength={4096}
                rows={6}
                onChange={(event) =>
                  setNewConversationText(event.target.value)
                }
                placeholder="Escreva a primeira mensagem…"
                className="w-full resize-y rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </label>
            <p className="text-xs leading-relaxed text-muted">
              A mensagem entra na fila com atraso humanizado e aparece nesta
              conversa como atendimento humano.
            </p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
