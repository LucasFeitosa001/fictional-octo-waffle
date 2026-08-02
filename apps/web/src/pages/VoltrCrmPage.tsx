import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorState, LoadingState } from '../components/States';
import { AppSwitch } from '../components/SwitchRow';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/toast';
import { CustomerCreateModal } from './ClientePerfilTabs';

/**
 * Host do Chat/CRM da Voltr embarcado no painel (estudo 68).
 *
 * O token curto vem do NOSSO backend (o segredo de parceiro nunca chega ao
 * navegador). Ele entra por query na primeira carga e por `postMessage` nas
 * renovações — recriar o `src` recarregaria o iframe e perderia o que a pessoa
 * estava fazendo. Toda troca usa ORIGEM ESTRITA, nunca '*'.
 */
interface RespostaToken {
  embedUrl: string;
  expiresIn: number;
  accessToken: string;
}

type Escopo = 'crm' | 'chat' | 'boards' | 'ia';
type TokenEmCache = RespostaToken & { salvoEm: number };

interface ResumoIa {
  conversationsToday: number;
  aiMessagesToday: number;
  bookingsViaAi: number;
  resolutionRate: number;
}

interface ConfigIa {
  enabled: boolean;
  channel?: { phone?: string | null } | null;
}

// Trocar Atendimento ↔ Contatos ↔ Kanban não deve parecer uma navegação para
// outro produto. As rotas do host desmontam este componente, então mantemos o
// último token de cada área por alguns minutos e o iframe já nasce apontando
// para a tela correta. O EmbedBootstrap continua renovando o JWT por
// postMessage; isto é apenas cache de navegação, não bypass de autenticação.
const EMBED_CACHE = new Map<Escopo, TokenEmCache>();
const CACHE_MS = 8 * 60 * 1000;

function origemDe(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

async function buscarTokenComFallback(scope: Escopo): Promise<RespostaToken> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    try {
      return await api.get<RespostaToken>('/voltr/embed-token', { scope });
    } catch (erro) {
      ultimoErro = erro;
      // Falhas de rede transitórias são comuns enquanto o iframe troca de
      // escopo. Pequena espera evita exibir um erro permanente por um único
      // pacote perdido.
      if (tentativa < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (tentativa + 1)));
    }
  }
  try {
    // O caminho normal preserva a sessão host-only do app. Se o proxy da
    // aplicação falhar em rede, tenta apenas o token no domínio da API;
    // nenhuma outra chamada do SalonPass é desviada.
    if (!(ultimoErro instanceof TypeError)) throw ultimoErro;
    const resposta = await fetch(
      `https://api.salonpass.com.br/api/v1/voltr/embed-token?scope=${encodeURIComponent(scope)}`,
      { credentials: 'include' },
    );
    if (!resposta.ok) throw ultimoErro;
    return (await resposta.json()) as RespostaToken;
  } catch {
    throw ultimoErro;
  }
}

export function VoltrCrmPage({ scope = 'crm' }: { scope?: Escopo }) {
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [resumoIa, setResumoIa] = useState<ResumoIa | null>(null);
  const [configIa, setConfigIa] = useState<ConfigIa | null>(null);
  const [salvandoIa, setSalvandoIa] = useState(false);
  const [chatMobileAberto, setChatMobileAberto] = useState(false);
  const [novoClienteAberto, setNovoClienteAberto] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef<string>('');
  const origemRef = useRef<string>('');
  /** Escopo que o `src` atual representa — troca de aba precisa de src novo. */
  const scopeDoSrc = useRef<'crm' | 'chat' | 'boards' | 'ia' | null>(null);

  const enviarTema = useCallback(() => {
    const iframe = iframeRef.current;
    const origem = origemRef.current;
    if (!iframe?.contentWindow || !origem) return;
    const root = getComputedStyle(document.documentElement);
    // O CRM deve receber exatamente a personalização ativa, não uma lista
    // parcial. Enumerar os tokens --sp-* evita que novos estados/temas voltem
    // a cair nos defaults do iframe.
    const vars: Record<string, string> = {};
    for (let i = 0; i < root.length; i += 1) {
      const nome = root.item(i);
      if (!nome.startsWith('--sp-')) continue;
      const valor = root.getPropertyValue(nome).trim();
      if (valor) vars[nome] = valor;
    }
    iframe.contentWindow.postMessage({ type: 'salonpass-theme', vars }, origem);
  }, []);

  const buscarToken = useCallback(async () => {
    const agora = Date.now();
    const guardado = EMBED_CACHE.get(scope);
    if (guardado && agora - guardado.salvoEm < CACHE_MS) {
      tokenRef.current = guardado.accessToken;
      origemRef.current = origemDe(guardado.embedUrl);
      scopeDoSrc.current = scope;
      setSrc(guardado.embedUrl);
      setErro(null);
      setCarregando(false);
      // Atualiza em segundo plano para a próxima troca, sem bloquear a tela.
      void buscarTokenComFallback(scope).then((novo) => {
        EMBED_CACHE.set(scope, { ...novo, salvoEm: Date.now() });
      }).catch(() => undefined);
      return guardado;
    }
    try {
      const r = await buscarTokenComFallback(scope);
      EMBED_CACHE.set(scope, { ...r, salvoEm: Date.now() });
      tokenRef.current = r.accessToken;
      origemRef.current = origemDe(r.embedUrl);
      // Fixa na primeira vez de CADA escopo; renovações de token vão por
      // postMessage e não recarregam o iframe. Sem o escopo na conta, trocar
      // Atendimento ↔ CRM pelo menu não remontava o componente (as duas rotas
      // têm a mesma árvore) e o iframe ficava na tela anterior. Ver estudo 75.
      setSrc((atual) => (atual && scopeDoSrc.current === scope ? atual : r.embedUrl));
      scopeDoSrc.current = scope;
      setErro(null);
      // Pré-carrega as outras áreas autorizadas. Se uma não estiver habilitada,
      // o erro fica restrito ao prefetch e não interfere na tela atual.
      const demais: Escopo[] = ['crm', 'chat', 'boards', 'ia'].filter((s) => s !== scope) as Escopo[];
      void Promise.allSettled(demais.map(async (s) => {
        if (EMBED_CACHE.has(s)) return;
        const outro = await buscarTokenComFallback(s);
        EMBED_CACHE.set(s, { ...outro, salvoEm: Date.now() });
      }));
      return r;
    } catch (err) {
      setErro(apiErrorMessage(err));
      return null;
    } finally {
      setCarregando(false);
    }
  }, [scope]);

  useEffect(() => {
    void buscarToken();
  }, [buscarToken]);

  // O resumo pertence ao Atendimento (e não a Contatos/Kanban/IA). Ele usa os
  // mesmos dados reais da tela /atendimento, agora visíveis também no /voltr-chat.
  useEffect(() => {
    if (scope !== 'chat') return;
    let vivo = true;
    void Promise.all([
      api.get<ResumoIa>('/whatsapp/inbox/stats'),
      api.get<ConfigIa>('/whatsapp/inbox/config'),
    ]).then(([stats, config]) => {
      if (!vivo) return;
      setResumoIa(stats);
      setConfigIa(config);
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [scope]);

  async function alternarIa(enabled: boolean) {
    setSalvandoIa(true);
    try {
      const salvo = await api.patch<ConfigIa>('/whatsapp/inbox/config', { enabled });
      setConfigIa(salvo);
    } finally {
      setSalvandoIa(false);
    }
  }

  useEffect(() => {
    function aoReceber(event: MessageEvent) {
      const origem = origemRef.current;
      if (!origem || event.origin !== origem) return; // rejeita outra origem
      const tipo = (event.data as { type?: string } | null)?.type;
      if (tipo === 'voltr-embed:awaiting-token') {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'voltr-embed:token', token: tokenRef.current, scope },
          origem,
        );
        // O handshake é o momento garantido em que o listener do iframe já
        // está montado. Reenvia o tema aqui (e não só no onLoad), evitando
        // perder a personalização por uma corrida de carregamento.
        enviarTema();
      }
      if (tipo === 'voltr-embed:token-expired') {
        void buscarToken().then((r) => {
          if (!r) return;
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'voltr-embed:token', token: r.accessToken, scope },
            origem,
          );
          enviarTema();
        });
      }
      if (tipo === 'voltr-embed:mobile-chat') {
        setChatMobileAberto(
          (event.data as { aberto?: unknown }).aberto === true,
        );
      }
      if (tipo === 'voltr-embed:novo-cliente' && scope === 'chat') {
        // O cadastro pertence à SalonPass (fonte da verdade), não ao banco
        // auxiliar da Voltr. O iframe apenas solicita a abertura do modal.
        setNovoClienteAberto(true);
      }
    }
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [buscarToken, enviarTema, scope]);

  const aoCriarCliente = useCallback(async () => {
    try {
      // Empurra o cadastro oficial atualizado para o tenant da Voltr. A rota é
      // idempotente e não envia mensagem; só atualiza a agenda de contatos.
      await api.post('/voltr/sync-clientes');
      const origem = origemRef.current;
      if (origem) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'voltr-embed:clientes-atualizados' },
          origem,
        );
      }
    } catch {
      // O cliente já foi salvo na SalonPass. Uma falha transitória do sync não
      // pode transformar o cadastro concluído em erro; o próximo sync corrige.
    }
  }, []);

  const titulo =
    scope === 'chat'
      ? 'Atendimento'
      : scope === 'boards'
        ? 'Kanban'
        : scope === 'ia'
          ? 'Inteligência artificial'
          : 'Contatos';

  // Tela cheia de verdade: sem max-width, sem padding e sem moldura de cartão.
  // A rota está na lista de full-bleed do DashboardLayout, então aqui não sobra
  // nenhuma margem do painel — o iframe ocupa a área inteira.
  return (
    // O fundo é o MESMO tom do app da Voltr desde o primeiro quadro. Sem isso o
    // refresh piscava entre três brancos: o splash, o canvas do painel e o fundo
    // da Voltr — o iframe só entra depois de dois saltos de rede. Ver estudo 71.
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0"
      style={{ background: 'var(--sp-warm-white)' }}
    >
      {scope === 'chat' ? (
        <section className={`${chatMobileAberto ? 'hidden lg:block' : ''} shrink-0 border-b border-[var(--sp-border)] bg-[var(--sp-warm-white)] px-3 py-2.5 sm:px-5 sm:py-4 lg:px-7`}>
          <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3 sm:flex-wrap sm:gap-3">
            <div className="min-w-0">
              <h1 className="m-0 truncate text-lg font-bold text-[var(--sp-ink)] sm:text-xl">WhatsApp e IA</h1>
              <p className="m-0 mt-1 hidden text-sm text-[var(--sp-muted-ink)] sm:block">Caixa real do número vinculado, atendimento humano e recepcionista virtual</p>
            </div>
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--sp-border)] bg-[var(--sp-card)] px-2.5 py-1.5 text-xs shadow-sm sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm">
              <span className="font-semibold text-[var(--sp-ink)]">IA {configIa?.enabled ? 'ativa' : 'pausada'}</span>
              <AppSwitch checked={!!configIa?.enabled} onChange={(v) => void alternarIa(v)} isDisabled={!configIa || salvandoIa} aria-label="Ativar ou pausar a IA" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
            {[
              { label: 'Conversas hoje', mobile: 'Conversas', value: resumoIa?.conversationsToday ?? 0 },
              { label: 'Respostas da IA hoje', mobile: 'Respostas IA', value: resumoIa?.aiMessagesToday ?? 0 },
              { label: 'Agendamentos feitos pela IA', mobile: 'Agendamentos', value: resumoIa?.bookingsViaAi ?? 0 },
              { label: 'Taxa de resolução', mobile: 'Resolução', value: `${resumoIa?.resolutionRate ?? 0}%` },
            ].map(({ label, mobile, value }) => (
              <div key={label} className="min-w-0 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-card)] px-2 py-2 shadow-sm sm:rounded-2xl sm:px-4 sm:py-3">
                <div className="truncate text-[0.64rem] leading-tight text-[var(--sp-muted-ink)] sm:hidden">{mobile}</div>
                <div className="hidden text-xs text-[var(--sp-muted-ink)] sm:block">{label}</div>
                <div className="mt-0.5 text-lg font-bold leading-none text-[var(--sp-ink)] sm:mt-1 sm:text-xl">{value}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {carregando ? (
        <div className="grid flex-1 place-items-center">
          <LoadingState label="Abrindo a Voltr…" />
        </div>
      ) : erro ? (
        <div className="grid flex-1 place-items-center p-6">
          <ErrorState message={erro} onRetry={() => void buscarToken()} />
        </div>
      ) : src ? (
        <iframe
          ref={iframeRef}
          src={src}
          title={titulo}
          className="block h-full min-h-0 w-full min-w-0 flex-1 border-0"
          onLoad={enviarTema}
          allow="clipboard-write; microphone"
        />
      ) : null}
      <CustomerCreateModal
        isOpen={novoClienteAberto}
        onClose={() => setNovoClienteAberto(false)}
        onCreated={() => void aoCriarCliente()}
      />
    </div>
  );
}
