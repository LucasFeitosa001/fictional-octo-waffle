import { useMemo, useRef, useState } from 'react';
import { Avatar, Button, Card, Input, TextField } from '@heroui/react';
import { PageHeader } from '../../components/PageHeader';
import { AppSwitch } from '../../components/SwitchRow';
import {
  IconBot,
  IconCalendarPlus,
  IconCheck,
  IconChevron,
  IconCircleCheck,
  IconClock,
  IconMessage,
  IconPlus,
  IconSend,
  IconSparkles,
  IconStar,
  IconTrash,
  IconWhatsApp,
  IconX,
} from '../../components/icons';
import { initials } from '../../lib/format';

// ---------------------------------------------------------------------------
// Types & seeded mock state (client-side only — no backend exists for IA yet)
// ---------------------------------------------------------------------------

type Sender = 'customer' | 'ai' | 'agent';

interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  time: string;
}

interface Conversation {
  id: string;
  name: string;
  phone: string;
  unread: number;
  handledByAi: boolean;
  resolved: boolean;
  messages: ChatMessage[];
}

let idSeq = 1000;
const nextId = () => `id-${++idSeq}`;

const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    name: 'Marina Costa',
    phone: '+55 11 98877-1020',
    unread: 0,
    handledByAi: true,
    resolved: true,
    messages: [
      { id: 'm1', sender: 'customer', text: 'Oi! Vocês têm horário pra corte amanhã de manhã?', time: '09:12' },
      { id: 'm2', sender: 'ai', text: 'Olá, Marina! 😊 Temos sim. Amanhã às 09:30 ou 11:00 com a Paula. Qual prefere?', time: '09:12' },
      { id: 'm3', sender: 'customer', text: 'Pode ser 09:30!', time: '09:13' },
      { id: 'm4', sender: 'ai', text: 'Perfeito! Agendei seu corte com a Paula amanhã às 09:30. Te envio um lembrete 1h antes. ✅', time: '09:13' },
    ],
  },
  {
    id: 'c2',
    name: 'Bruno Almeida',
    phone: '+55 11 99654-3321',
    unread: 2,
    handledByAi: true,
    resolved: false,
    messages: [
      { id: 'm5', sender: 'customer', text: 'Quanto fica barba + corte?', time: '14:02' },
      { id: 'm6', sender: 'ai', text: 'Oi, Bruno! O combo Barba + Corte sai por R$ 75. Quer que eu já reserve um horário?', time: '14:02' },
      { id: 'm7', sender: 'customer', text: 'Tem hoje à tarde?', time: '14:30' },
    ],
  },
  {
    id: 'c3',
    name: 'Carla Nunes',
    phone: '+55 11 98123-7788',
    unread: 0,
    handledByAi: false,
    resolved: false,
    messages: [
      { id: 'm8', sender: 'customer', text: 'Preciso remarcar meu horário de sexta, deu um imprevisto.', time: '11:40' },
      { id: 'm9', sender: 'agent', text: 'Claro, Carla! Posso passar para sábado às 15h, tudo bem?', time: '11:45' },
    ],
  },
  {
    id: 'c4',
    name: 'Diego Ramos',
    phone: '+55 11 99011-2255',
    unread: 1,
    handledByAi: true,
    resolved: false,
    messages: [
      { id: 'm10', sender: 'ai', text: 'Oi, Diego! Faz tempo que você não aparece por aqui. 💈 Que tal um corte essa semana? Tenho 20% off pra te receber de volta.', time: '08:30' },
      { id: 'm11', sender: 'customer', text: 'Opa, que legal! Quinta de tarde dá?', time: '10:15' },
    ],
  },
  {
    id: 'c5',
    name: 'Eduarda Lima',
    phone: '+55 11 98455-9090',
    unread: 0,
    handledByAi: true,
    resolved: true,
    messages: [
      { id: 'm12', sender: 'customer', text: 'Vocês abrem no feriado?', time: 'Ontem' },
      { id: 'm13', sender: 'ai', text: 'Olá, Eduarda! No feriado funcionamos das 10h às 16h. Quer agendar algo? ✨', time: 'Ontem' },
      { id: 'm14', sender: 'customer', text: 'Por enquanto não, obrigada!', time: 'Ontem' },
      { id: 'm15', sender: 'ai', text: 'Imagina! Qualquer coisa é só chamar. 💛', time: 'Ontem' },
    ],
  },
];

type Tone = 'simpatico' | 'profissional' | 'direto';

const TONES: { key: Tone; label: string; hint: string }[] = [
  { key: 'simpatico', label: 'Simpático', hint: 'Caloroso, com emojis' },
  { key: 'profissional', label: 'Profissional', hint: 'Cordial e formal' },
  { key: 'direto', label: 'Direto', hint: 'Objetivo e rápido' },
];

interface Automation {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

const SEED_AUTOMATIONS: Automation[] = [
  { key: 'confirm', label: 'Confirmar agendamentos', description: 'IA confirma horários automaticamente pelo WhatsApp.', enabled: true },
  { key: 'reminders', label: 'Lembretes de horário', description: 'Envia lembrete 1h antes do atendimento.', enabled: true },
  { key: 'winback', label: 'Recuperar inativos 30+ dias', description: 'Reengaja clientes que sumiram com oferta especial.', enabled: true },
  { key: 'review', label: 'Pedir avaliação no Google', description: 'Solicita review após o atendimento concluído.', enabled: false },
];

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

const SEED_FAQ: FaqItem[] = [
  { id: 'f1', question: 'Qual o horário de funcionamento?', answer: 'Seg a Sáb, das 09h às 19h.' },
  { id: 'f2', question: 'Vocês aceitam Pix?', answer: 'Sim! Aceitamos Pix, cartão e dinheiro.' },
  { id: 'f3', question: 'Onde fica o salão?', answer: 'Rua das Flores, 123 — ao lado da praça central.' },
];

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function IAAtendimentoPage() {
  const [connected, setConnected] = useState(true);
  const [autoReply, setAutoReply] = useState(true);
  const [tone, setTone] = useState<Tone>('simpatico');
  const [automations, setAutomations] = useState<Automation[]>(SEED_AUTOMATIONS);
  const [faq, setFaq] = useState<FaqItem[]>(SEED_FAQ);
  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string>(SEED_CONVERSATIONS[1].id);
  // On mobile the inbox is master-detail: false = show list, true = show open thread.
  const [threadOpenMobile, setThreadOpenMobile] = useState(false);
  const [draft, setDraft] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const metrics = useMemo(() => {
    const today = conversations.length;
    const byAi = conversations.filter((c) => c.handledByAi).length;
    const resolved = conversations.filter((c) => c.resolved).length;
    const rate = today > 0 ? Math.round((resolved / today) * 100) : 0;
    return { today, byAi, rate };
  }, [conversations]);

  function selectConversation(id: string) {
    setSelectedId(id);
    setThreadOpenMobile(true);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    );
  }

  function sendMessage(asAgent: boolean) {
    const text = draft.trim();
    if (!text || !selected) return;
    const msg: ChatMessage = {
      id: nextId(),
      sender: asAgent ? 'agent' : 'ai',
      text,
      time: 'agora',
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selected.id
          ? { ...c, messages: [...c.messages, msg], handledByAi: asAgent ? false : c.handledByAi }
          : c,
      ),
    );
    setDraft('');
    requestAnimationFrame(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
    });
  }

  function takeOver() {
    if (!selected) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === selected.id ? { ...c, handledByAi: false } : c)),
    );
  }

  function toggleAutomation(key: string) {
    setAutomations((prev) =>
      prev.map((a) => (a.key === key ? { ...a, enabled: !a.enabled } : a)),
    );
  }

  function addFaq() {
    const q = newQuestion.trim();
    const a = newAnswer.trim();
    if (!q || !a) return;
    setFaq((prev) => [...prev, { id: nextId(), question: q, answer: a }]);
    setNewQuestion('');
    setNewAnswer('');
  }

  function removeFaq(id: string) {
    setFaq((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div>
      <PageHeader
        title="WhatsApp API Oficial"
        subtitle="Recepcionista virtual no WhatsApp — agenda, confirma e tira dúvidas sozinha"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* WhatsApp connection */}
            <button
              type="button"
              onClick={() => setConnected((v) => !v)}
              className={[
                'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                connected
                  ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#128C3E]'
                  : 'border-default-300 bg-white text-muted-ink hover:bg-default-50',
              ].join(' ')}
            >
              <IconWhatsApp size={16} />
              {connected ? 'WhatsApp conectado' : 'Conectar WhatsApp'}
              <span
                className={`h-2 w-2 rounded-full ${connected ? 'bg-[#25D366]' : 'bg-default-300'}`}
              />
            </button>
            {/* Auto-reply */}
            <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-soft-border)] bg-warm-white px-3 py-2 shadow-[var(--shadow-soft)]">
              <IconBot size={16} className="text-gold-strong" />
              <span className="text-sm font-medium text-ink">Auto-resposta</span>
              <AppSwitch
                checked={autoReply}
                onChange={(v) => setAutoReply(v)}
                aria-label="Auto-resposta"
              />
            </div>
          </div>
        }
      />

      {/* Metrics strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          icon={<IconMessage size={20} className="text-data-messages" />}
          label="Conversas hoje"
          value={String(metrics.today)}
          accent="var(--sp-data-messages-soft)"
        />
        <MetricCard
          icon={<IconCalendarPlus size={20} className="text-data-appointments" />}
          label="Agendamentos pela IA"
          value={String(metrics.byAi)}
          accent="var(--sp-data-appointments-soft)"
        />
        <MetricCard
          icon={<IconClock size={20} className="text-data-messages" />}
          label="Tempo médio de resposta"
          value="8s"
          accent="var(--sp-data-messages-soft)"
        />
        <MetricCard
          icon={<IconCircleCheck size={20} className="text-status-success-fg" />}
          label="Taxa de resolução"
          value={`${metrics.rate}%`}
          accent="var(--sp-status-success-soft)"
        />
      </div>

      {/* Inbox: list + thread */}
      <div className="mb-5 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <Card
          className={`min-w-0 overflow-hidden border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)] ${
            threadOpenMobile ? 'hidden lg:block' : ''
          }`}
        >
          <div className="flex items-center justify-between border-b border-[var(--color-soft-border)] px-4 py-3">
            <p className="font-brand text-sm font-semibold text-ink">Conversas</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-strong">
              <IconWhatsApp size={12} /> {conversations.length}
            </span>
          </div>
          <div className="max-h-[560px] divide-y divide-[var(--color-soft-border)] overflow-y-auto">
            {conversations.map((c) => {
              const last = c.messages[c.messages.length - 1];
              const isActive = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectConversation(c.id)}
                  className={[
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                    isActive ? 'bg-gold/10' : 'hover:bg-cream',
                  ].join(' ')}
                >
                  <Avatar size="sm">
                    <Avatar.Fallback className="bg-ink text-gold">
                      {initials(c.name)}
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-ink">{c.name}</span>
                      {c.handledByAi && <IaBadge />}
                    </div>
                    <p className="truncate text-xs text-muted-ink">
                      {last.sender === 'customer' ? '' : '✓ '}
                      {last.text}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="mt-1 grid h-5 min-w-5 place-items-center rounded-full bg-pink px-1 text-[11px] font-bold text-white">
                      {c.unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Thread */}
        <Card
          className={`min-h-[560px] min-w-0 flex-col border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)] lg:flex ${
            threadOpenMobile ? 'flex' : 'hidden'
          }`}
        >
          {selected ? (
            <>
              {/* Thread header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-soft-border)] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setThreadOpenMobile(false)}
                    aria-label="Voltar para conversas"
                    className="-ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-ink transition-colors hover:bg-cream hover:text-ink lg:hidden"
                  >
                    <IconChevron size={20} className="rotate-90" />
                  </button>
                  <Avatar size="sm">
                    <Avatar.Fallback className="bg-ink text-gold">
                      {initials(selected.name)}
                    </Avatar.Fallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-ink">{selected.name}</p>
                    <p className="text-xs text-muted-ink">{selected.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selected.handledByAi ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-xs font-semibold text-gold-strong">
                      <IconBot size={13} /> IA no comando
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-pink/15 px-2.5 py-1 text-xs font-semibold text-[#c25d77]">
                      Atendente
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={takeOver} isDisabled={!selected.handledByAi}>
                    Assumir conversa
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {selected.messages.map((m) => {
                  const isCustomer = m.sender === 'customer';
                  return (
                    <div
                      key={m.id}
                      className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={[
                          'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-[var(--shadow-soft)]',
                          isCustomer
                            ? 'rounded-tl-sm bg-white text-ink'
                            : m.sender === 'ai'
                              ? 'rounded-tr-sm bg-gold text-ink'
                              : 'rounded-tr-sm bg-ink text-white',
                        ].join(' ')}
                      >
                        {m.sender === 'ai' && (
                          <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#7a5a12]">
                            <IconSparkles size={11} /> IA
                          </span>
                        )}
                        {m.sender === 'agent' && (
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/60">
                            Atendente
                          </span>
                        )}
                        <p className="leading-snug">{m.text}</p>
                        <p
                          className={`mt-0.5 text-right text-[10px] ${
                            isCustomer ? 'text-[#9a948c]' : m.sender === 'ai' ? 'text-[#7a5a12]' : 'text-white/50'
                          }`}
                        >
                          {m.time}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Composer */}
              <div className="border-t border-[var(--color-soft-border)] p-3">
                <div className="flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-xl border border-[var(--color-soft-border)] bg-white focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/25">
                    <TextField
                      value={draft}
                      onChange={setDraft}
                      aria-label="Mensagem"
                      className="min-w-0 flex-1"
                    >
                      <Input
                        placeholder="Escreva uma mensagem…"
                        className="border-0 shadow-none focus:ring-0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage(true);
                          }
                        }}
                      />
                    </TextField>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => sendMessage(true)}
                    isDisabled={!draft.trim()}
                    className="bg-gold text-ink shadow-[var(--shadow-gold)] hover:bg-[#e6a92f]"
                  >
                    <IconSend size={16} /> Enviar
                  </Button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-[#9a948c]">
                  Enviar como atendente pausa a IA nesta conversa.
                </p>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-muted">
              <div className="flex flex-col items-center gap-2">
                <IconMessage size={32} />
                <p className="text-sm">Selecione uma conversa</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Config panel */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Persona / tone */}
        <Card className="min-w-0 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
          <Card.Content className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-gold">
                <IconBot size={18} />
              </span>
              <div>
                <p className="font-brand text-sm font-semibold text-ink">Persona da IA</p>
                <p className="text-xs text-muted">Tom de voz das respostas</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {TONES.map((t) => {
                const isActive = tone === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTone(t.key)}
                    className={[
                      'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-all',
                      isActive
                        ? 'border-transparent bg-gold shadow-[var(--shadow-gold)]'
                        : 'border-[var(--color-soft-border)] bg-white hover:bg-cream',
                    ].join(' ')}
                  >
                    <span>
                      <span
                        className={`block text-sm font-semibold ${isActive ? 'text-ink' : 'text-ink'}`}
                      >
                        {t.label}
                      </span>
                      <span className={`block text-xs ${isActive ? 'text-[#7a5a12]' : 'text-muted-ink'}`}>
                        {t.hint}
                      </span>
                    </span>
                    {isActive && <IconCheck size={18} className="text-ink" />}
                  </button>
                );
              })}
            </div>
          </Card.Content>
        </Card>

        {/* Automations */}
        <Card className="min-w-0 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
          <Card.Content className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/15 text-gold-strong">
                <IconSparkles size={18} />
              </span>
              <div>
                <p className="font-brand text-sm font-semibold text-ink">Automações</p>
                <p className="text-xs text-muted">O que a IA faz sozinha</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {automations.map((a) => (
                <div
                  key={a.key}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{a.label}</p>
                    <p className="text-xs text-muted-ink">{a.description}</p>
                  </div>
                  <AppSwitch
                    checked={a.enabled}
                    onChange={() => toggleAutomation(a.key)}
                    aria-label={a.label}
                  />
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>

        {/* FAQ / knowledge base */}
        <Card className="min-w-0 border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]">
          <Card.Content className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-pink/15 text-[#c25d77]">
                <IconStar size={18} />
              </span>
              <div>
                <p className="font-brand text-sm font-semibold text-ink">Base de conhecimento</p>
                <p className="text-xs text-muted">Perguntas e respostas da IA</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {faq.map((f) => (
                <div
                  key={f.id}
                  className="group flex items-start justify-between gap-2 rounded-xl border border-[var(--color-soft-border)] bg-white px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{f.question}</p>
                    <p className="text-xs text-muted-ink">{f.answer}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFaq(f.id)}
                    aria-label="Remover pergunta"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#9a948c] transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              ))}
              {faq.length === 0 && (
                <p className="rounded-xl border border-dashed border-[var(--color-soft-border)] px-3 py-4 text-center text-xs text-muted">
                  Nenhuma pergunta cadastrada ainda.
                </p>
              )}
            </div>

            {/* Add new FAQ */}
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-[var(--color-soft-border)] bg-white p-3">
              <TextField value={newQuestion} onChange={setNewQuestion} aria-label="Pergunta">
                <Input placeholder="Nova pergunta…" />
              </TextField>
              <TextField value={newAnswer} onChange={setNewAnswer} aria-label="Resposta">
                <Input placeholder="Resposta da IA…" />
              </TextField>
              <div className="flex justify-end gap-2">
                {(newQuestion || newAnswer) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewQuestion('');
                      setNewAnswer('');
                    }}
                  >
                    <IconX size={15} /> Limpar
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={addFaq}
                  isDisabled={!newQuestion.trim() || !newAnswer.trim()}
                >
                  <IconPlus size={15} /> Adicionar
                </Button>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
