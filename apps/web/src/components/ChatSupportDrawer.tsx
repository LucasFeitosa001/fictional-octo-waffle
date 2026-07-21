import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { Drawer } from './Drawer';
import { IconSparkles, IconSend, IconAlertTriangle, IconExternalLink } from './icons';
import { useHelpChat, type HelpChatMessage } from '../hooks/useHelpChat';

interface ChatSupportDrawerProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTIONS = [
  'Como faço um agendamento?',
  'Como abrir uma comanda?',
  'Onde vejo os relatórios?',
  'Como configuro comissões?',
];

/**
 * Chat flutuante do FAB global (DashboardLayout). Assistente ancorado nos
 * artigos da Base de Conhecimento via POST /help/chat.
 *
 * - Enter envia, Shift+Enter quebra linha.
 * - Auto-scroll para o final a cada mensagem/typing.
 * - Fallback banner quando o backend responde { fallback: true } (IA off).
 */
export function ChatSupportDrawer({ open, onClose }: ChatSupportDrawerProps) {
  const [messages, setMessages] = useState<HelpChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [fallback, setFallback] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chat = useHelpChat();

  // Auto-scroll para o fim a cada nova mensagem ou toggle do typing indicator.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Deixa o layout aplicar a nova altura antes de rolar.
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, chat.isPending]);

  // Reset ao fechar para não vazar histórico entre sessões.
  useEffect(() => {
    if (!open) {
      setInput('');
    }
  }, [open]);

  function send(rawText: string) {
    const text = rawText.trim();
    if (!text || chat.isPending) return;

    const userMsg: HelpChatMessage = { role: 'user', content: text };
    const history = messages;
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    chat.mutate(
      { message: text, history },
      {
        onSuccess: (res) => {
          setFallback(Boolean(res.fallback));
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: res.reply },
          ]);
        },
        onError: (err) => {
          setFallback(true);
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                'Não consegui responder agora (' +
                (err?.message || 'erro de rede') +
                '). Tente novamente ou consulte a Base de Conhecimento.',
            },
          ]);
        },
      },
    );
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const footer = (
    <div className="flex w-full items-end gap-2">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escreva sua dúvida..."
        rows={1}
        disabled={chat.isPending}
        className="min-h-[42px] max-h-32 flex-1 resize-none rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2.5 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted focus:border-gold/60 focus:ring-2 focus:ring-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => send(input)}
        disabled={chat.isPending || !input.trim()}
        aria-label="Enviar mensagem"
        title="Enviar (Enter)"
        className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition-transform hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <IconSend size={18} />
      </button>
    </div>
  );

  const isEmpty = messages.length === 0;

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title="Assistente SalonPass"
      widthClass="sm:w-[420px]"
      footer={footer}
    >
      <div className="flex h-full flex-col">
        <p className="-mt-2 mb-3 text-xs text-muted">
          Tire suas dúvidas sobre a plataforma
        </p>

        {fallback && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span className="mt-0.5 shrink-0 text-amber-700">
              <IconAlertTriangle size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">A IA não está configurada</p>
              <p className="mt-0.5">
                Consulte a{' '}
                <Link
                  to="/ajuda"
                  onClick={onClose}
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-amber-950"
                >
                  Base de Conhecimento
                  <IconExternalLink size={11} />
                </Link>
                {' '}enquanto o assistente está fora do ar.
              </p>
            </div>
          </div>
        )}

        <div ref={scrollerRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
          {isEmpty && !chat.isPending && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <AssistantAvatar />
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[var(--color-soft-border)] bg-white px-3 py-2 text-sm text-foreground shadow-sm">
                  <p>Olá! Sou o assistente do SalonPass.</p>
                  <p className="mt-1 text-muted">
                    Posso te ajudar com agenda, comandas, clientes, relatórios e
                    configurações. O que você precisa?
                  </p>
                </div>
              </div>
              <div className="pt-1">
                <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                  Sugestões
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-[var(--color-soft-border)] bg-white px-3 py-1.5 text-xs text-foreground shadow-sm transition-colors hover:border-gold/50 hover:bg-gold/[0.08]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}

          {chat.isPending && (
            <div className="flex items-start gap-2">
              <AssistantAvatar />
              <div className="rounded-2xl rounded-tl-sm border border-[var(--color-soft-border)] bg-white px-3 py-2.5 shadow-sm">
                <TypingDots />
              </div>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function AssistantAvatar() {
  return (
    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold/15 text-gold-strong">
      <IconSparkles size={14} />
    </span>
  );
}

function MessageBubble({ message }: { message: HelpChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-primary px-3 py-2 text-sm text-white shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2">
      <AssistantAvatar />
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm border border-[var(--color-soft-border)] bg-white px-3 py-2 text-sm text-foreground shadow-sm">
        {message.content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1" aria-label="Assistente digitando">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted [animation-delay:-0.3s]" />
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted [animation-delay:-0.15s]" />
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
    </div>
  );
}
