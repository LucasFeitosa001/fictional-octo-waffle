'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, TextField } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '@/components/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/States';
import {
  IconCalendar,
  IconChart,
  IconReceipt,
  IconScissors,
  IconSparkles,
  IconUsers,
} from '@/components/icons';
import {
  useAiAttendant,
  useAiAttendantStats,
  useUpdateAiAttendant,
  type AiTone,
  type FaqEntry,
} from '@/lib/queries/ia-atendimento';

const TONES: { value: AiTone; label: string; sample: string }[] = [
  { value: 'amigavel', label: 'Amigável', sample: 'Oi! Que bom te ver por aqui 😊 Posso já agendar seu horário?' },
  { value: 'profissional', label: 'Profissional', sample: 'Olá. Posso verificar a disponibilidade e confirmar seu agendamento.' },
  { value: 'descontraido', label: 'Descontraído', sample: 'E aí, beleza? Bora marcar aquele corte? 💈' },
];

export default function IaAtendimentoPage() {
  const config = useAiAttendant();
  const stats = useAiAttendantStats();
  const update = useUpdateAiAttendant();

  // Local, editable copy of the persisted config.
  const [enabled, setEnabled] = useState(false);
  const [agentName, setAgentName] = useState('Bia');
  const [greeting, setGreeting] = useState('');
  const [tone, setTone] = useState<AiTone>('amigavel');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [autoReply, setAutoReply] = useState(true);
  const [bookingViaChat, setBookingViaChat] = useState(true);
  const [handoffEnabled, setHandoffEnabled] = useState(true);
  const [knowledgeBase, setKnowledgeBase] = useState('');
  const [faq, setFaq] = useState<FaqEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const data = config.data;
  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setAgentName(data.agentName);
    setGreeting(data.greeting);
    setTone(data.tone);
    setWhatsappNumber(data.whatsappNumber ?? '');
    setWhatsappConnected(data.whatsappConnected);
    setAutoReply(data.autoReply);
    setBookingViaChat(data.bookingViaChat);
    setHandoffEnabled(data.handoffEnabled);
    setKnowledgeBase(data.knowledgeBase ?? '');
    setFaq(data.faqJson ?? []);
  }, [data]);

  async function persist(patch: Parameters<typeof update.mutateAsync>[0]) {
    setError(null);
    try {
      await update.mutateAsync(patch);
      setSavedAt(Date.now());
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar as configurações.',
      );
    }
  }

  function saveAll() {
    void persist({
      enabled,
      agentName: agentName.trim() || 'Bia',
      greeting: greeting.trim(),
      tone,
      whatsappNumber: whatsappNumber.trim(),
      whatsappConnected,
      autoReply,
      bookingViaChat,
      handoffEnabled,
      knowledgeBase: knowledgeBase.trim(),
      faq: faq.filter((f) => f.question.trim() && f.answer.trim()),
    });
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    void persist({ enabled: next });
  }

  function connectWhatsapp() {
    const next = !whatsappConnected;
    setWhatsappConnected(next);
    void persist({ whatsappConnected: next, whatsappNumber: whatsappNumber.trim() });
  }

  const s = stats.data;

  if (config.isLoading) return <LoadingState />;
  if (config.isError || !data) return <ErrorState onRetry={() => config.refetch()} />;

  return (
    <div>
      <PageHeader
        title="IA Atendimento"
        subtitle="Recepcionista virtual que conversa, tira dúvidas e agenda pelo WhatsApp"
        actions={
          <div className="flex items-center gap-3">
            <StatusPill enabled={enabled} />
            <Button variant={enabled ? 'outline' : 'primary'} onClick={toggleEnabled}>
              {enabled ? 'Pausar IA' : 'Ativar IA'}
            </Button>
          </div>
        }
      />

      {/* Metrics strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          icon={<IconReceipt size={18} />}
          label="Conversas atendidas"
          value={s?.conversationsHandled ?? 0}
          hint="no mês"
        />
        <MetricCard
          icon={<IconCalendar size={18} />}
          label="Agendamentos pela IA"
          value={s?.bookingsViaChat ?? 0}
          hint="no mês"
        />
        <MetricCard
          icon={<IconUsers size={18} />}
          label="Clientes ativos"
          value={s?.activeCustomers ?? 0}
          hint="a IA pode atender"
        />
        <MetricCard
          icon={<IconScissors size={18} />}
          label="Serviços online"
          value={s?.onlineServices ?? 0}
          hint="agendáveis pela IA"
        />
        <MetricCard
          icon={<IconChart size={18} />}
          label="Agendamentos"
          value={s?.appointmentsThisMonth ?? 0}
          hint="no mês"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: configuration (2 cols) */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* WhatsApp channel */}
          <Card className="db-card">
            <Card.Content className="p-5">
              <SectionTitle icon={<IconSparkles size={18} />} title="Canal WhatsApp" />
              <p className="mb-4 text-sm text-muted">
                Conecte o número do WhatsApp do salão para a IA atender e agendar 24h por dia.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Número do WhatsApp
                  </label>
                  <TextField value={whatsappNumber} onChange={setWhatsappNumber} aria-label="Número do WhatsApp">
                    <Input placeholder="(00) 00000-0000" />
                  </TextField>
                </div>
                <Button
                  variant={whatsappConnected ? 'outline' : 'primary'}
                  onClick={connectWhatsapp}
                  isDisabled={!whatsappNumber.trim() && !whatsappConnected}
                >
                  {whatsappConnected ? 'Desconectar' : 'Conectar'}
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    whatsappConnected ? 'bg-emerald-400' : 'bg-white/30'
                  }`}
                />
                <span className={whatsappConnected ? 'text-foreground' : 'text-muted'}>
                  {whatsappConnected ? 'WhatsApp conectado' : 'Aguardando conexão'}
                </span>
              </div>
            </Card.Content>
          </Card>

          {/* Persona */}
          <Card className="db-card">
            <Card.Content className="p-5">
              <SectionTitle icon={<IconSparkles size={18} />} title="Personalidade da IA" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Nome da assistente</label>
                  <TextField value={agentName} onChange={setAgentName} aria-label="Nome da assistente">
                    <Input placeholder="Ex.: Bia" />
                  </TextField>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Tom de voz</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as AiTone)}
                    aria-label="Tom de voz"
                    className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-foreground [color-scheme:dark]"
                  >
                    {TONES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-muted">
                  Mensagem de saudação
                </label>
                <textarea
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  rows={2}
                  aria-label="Mensagem de saudação"
                  className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-foreground"
                />
              </div>
            </Card.Content>
          </Card>

          {/* Capabilities */}
          <Card className="db-card">
            <Card.Content className="p-5">
              <SectionTitle icon={<IconSparkles size={18} />} title="O que a IA pode fazer" />
              <div className="flex flex-col divide-y divide-white/10">
                <ToggleRow
                  label="Responder automaticamente"
                  description="A IA responde mensagens sozinha, sem precisar de um atendente."
                  checked={autoReply}
                  onChange={setAutoReply}
                />
                <ToggleRow
                  label="Agendar pela conversa"
                  description="A IA sugere horários livres e cria o agendamento direto na agenda."
                  checked={bookingViaChat}
                  onChange={setBookingViaChat}
                />
                <ToggleRow
                  label="Transferir para humano"
                  description="Encaminha para a equipe quando o cliente pede ou a IA não tem certeza."
                  checked={handoffEnabled}
                  onChange={setHandoffEnabled}
                />
              </div>
            </Card.Content>
          </Card>

          {/* Knowledge base */}
          <Card className="db-card">
            <Card.Content className="p-5">
              <SectionTitle icon={<IconSparkles size={18} />} title="Base de conhecimento" />
              <p className="mb-3 text-sm text-muted">
                Informações que a IA usa para responder: endereço, horários, formas de pagamento,
                políticas. Quanto mais completo, melhor o atendimento.
              </p>
              <textarea
                value={knowledgeBase}
                onChange={(e) => setKnowledgeBase(e.target.value)}
                rows={4}
                placeholder="Ex.: Funcionamos de terça a sábado, das 9h às 20h. Aceitamos PIX, cartão e dinheiro. Estacionamento na rua…"
                aria-label="Base de conhecimento"
                className="w-full rounded-lg border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-foreground"
              />

              <div className="mt-5 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-foreground">Perguntas frequentes</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFaq((f) => [...f, { question: '', answer: '' }])}
                >
                  Adicionar
                </Button>
              </div>
              <div className="mt-3 flex flex-col gap-3">
                {faq.length === 0 && (
                  <p className="text-sm text-muted">Nenhuma pergunta cadastrada ainda.</p>
                )}
                {faq.map((entry, i) => (
                  <div key={i} className="rounded-lg border border-white/10 p-3">
                    <input
                      value={entry.question}
                      onChange={(e) =>
                        setFaq((f) => f.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))
                      }
                      placeholder="Pergunta (ex.: Vocês atendem sem agendar?)"
                      aria-label="Pergunta"
                      className="mb-2 w-full rounded-md border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-foreground"
                    />
                    <textarea
                      value={entry.answer}
                      onChange={(e) =>
                        setFaq((f) => f.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))
                      }
                      rows={2}
                      placeholder="Resposta"
                      aria-label="Resposta"
                      className="w-full rounded-md border border-white/15 bg-[#1a1a1a] px-3 py-2 text-sm text-foreground"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => setFaq((f) => f.filter((_, j) => j !== i))}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {savedAt && !update.isPending && (
              <span className="text-sm text-muted">Configurações salvas.</span>
            )}
            <Button variant="primary" onClick={saveAll} isDisabled={update.isPending}>
              {update.isPending ? 'Salvando…' : 'Salvar configurações'}
            </Button>
          </div>
        </div>

        {/* Right: live preview + inbox */}
        <div className="flex flex-col gap-6">
          <Card className="db-card">
            <Card.Content className="p-5">
              <SectionTitle icon={<IconSparkles size={18} />} title="Pré-visualização" />
              <ChatPreview agentName={agentName} greeting={greeting} tone={tone} />
            </Card.Content>
          </Card>

          <Card className="db-card">
            <Card.Content className="p-5">
              <SectionTitle icon={<IconReceipt size={18} />} title="Conversas" />
              <EmptyState
                icon={<IconSparkles size={28} />}
                title={whatsappConnected ? 'Nenhuma conversa ainda' : 'Conecte o WhatsApp'}
                description={
                  whatsappConnected
                    ? 'As conversas dos seus clientes aparecerão aqui assim que chegarem.'
                    : 'Conecte o número do WhatsApp acima para a IA começar a atender e as conversas aparecerem aqui.'
                }
              />
            </Card.Content>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-muted'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-white/40'}`} />
      {enabled ? 'Ativa' : 'Pausada'}
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card className="db-card">
      <Card.Content className="p-4">
        <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-foreground">
          {icon}
        </div>
        <div className="text-2xl font-semibold text-foreground">{value}</div>
        <div className="text-xs text-muted">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted/70">{hint}</div>}
      </Card.Content>
    </Card>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-foreground">{icon}</span>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-white' : 'bg-white/20'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${
            checked ? 'left-[22px] bg-[#0d0d0d]' : 'left-0.5 bg-white'
          }`}
        />
      </button>
    </div>
  );
}

function ChatPreview({
  agentName,
  greeting,
  tone,
}: {
  agentName: string;
  greeting: string;
  tone: AiTone;
}) {
  const sample = useMemo(() => TONES.find((t) => t.value === tone)?.sample ?? '', [tone]);
  return (
    <div className="rounded-xl bg-[#0f0f0f] p-3">
      <div className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#0d0d0d]">
          <IconSparkles size={15} />
        </div>
        <div className="text-sm font-semibold text-foreground">{agentName || 'Assistente'}</div>
        <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
          IA
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Bubble from="ai" text={greeting || 'Olá! Como posso ajudar?'} />
        <Bubble from="user" text="Quero marcar um corte pra sexta" />
        <Bubble from="ai" text={sample} />
      </div>
    </div>
  );
}

function Bubble({ from, text }: { from: 'ai' | 'user'; text: string }) {
  const isAi = from === 'ai';
  return (
    <div className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
          isAi ? 'bg-white/10 text-foreground' : 'bg-white text-[#0d0d0d]'
        }`}
      >
        {text}
      </div>
    </div>
  );
}
