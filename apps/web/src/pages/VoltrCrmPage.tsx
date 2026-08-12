import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../components/States';
import { AppSwitch } from '../components/SwitchRow';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/toast';
import { useCan } from '../lib/queries/permissions';
import { useTheme } from '../theme/theme';
import { IconCalendar, IconMessage, IconSparkles, IconTarget } from '../components/icons';

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

type Escopo = 'crm' | 'chat' | 'boards' | 'tarefas' | 'ia';
type TokenEmCache = RespostaToken & { salvoEm: number };

/**
 * Números da IA que REALMENTE atende nesta tela — vêm de `/voltr/metricas`.
 *
 * Antes vinham de `/whatsapp/inbox/stats`, que conta `sender:'ai'`: carimbo da
 * recepcionista NATIVA do SalonPass. Nos salões atendidos pela IA da Voltr
 * (outro servidor, outro banco) esse carimbo nunca aparece, então os quatro
 * cartões tendiam a ZERO e o dono lia "a IA não fez nada".
 *
 * `null` é NÃO MEDIDO e vira "—" na tela. Zero só aparece quando é zero de
 * verdade — trocar um número indisponível por 0 é a mentira que estamos
 * consertando.
 */
interface MetricasIa {
  /** Conversas com mensagem hoje (fonte: Voltr). */
  conversasHoje: number | null;
  /** Mensagens que a IA da Voltr enviou hoje (fonte: Voltr). */
  respostasIaHoje: number | null;
  /** % das conversas já arquivadas (fonte: Voltr). */
  taxaResolucao: number | null;
  /**
   * Agendamentos criados pela IA no mês — fonte: o banco do SALONPASS
   * (`Appointment.legacySource='voltr-ia'`). É o efeito real dela na agenda e
   * o único dos quatro que continua medido com a Voltr fora do ar.
   */
  agendamentosIaMes: number;
  fonteVoltr: 'ok' | 'indisponivel' | 'desligada';
}

/**
 * Estado da IA da VOLTR — a que de fato atende no WhatsApp desta tela.
 *
 * NÃO é `/whatsapp/inbox/config` (a recepcionista NATIVA do SalonPass, que tem
 * a tela própria em /whatsapp). O botão daqui mexia naquele interruptor: o dono
 * apertava "pausar a IA" ao lado do CRM da Voltr e a IA da Voltr, que roda em
 * outro servidor e outro banco, seguia respondendo. Ver o estudo da pausa.
 */
interface EstadoIaVoltr {
  /** `false` = PAUSADA: ela segue rascunhando, mas não responde ninguém sozinha. */
  envioAutomatico: boolean;
  /** Sem agente ativo na Voltr não há o que retomar. */
  agenteAtivo: boolean;
  /** Chave-mestra do processo da Voltr — desligada, ninguém responde sozinho. */
  autopilotAtivo: boolean;
}

/** Procedência dos três números que a Voltr mede — vai no title do cartão. */
const ORIGEM_VOLTR = 'Medido no atendimento da IA (Voltr).';

/** Por que um cartão está em "—". Explicar é obrigatório; zero seria mentira. */
const MOTIVO_INDISPONIVEL: Record<MetricasIa['fonteVoltr'], string> = {
  ok: '',
  indisponivel:
    'Os números do atendimento da IA não puderam ser lidos agora — nova tentativa automática em instantes.',
  desligada:
    'A integração com o atendimento da IA não está configurada nesta instalação.',
};

/** `null`/indefinido é NÃO MEDIDO e aparece como "—". Zero só quando é zero. */
function numeroOuTraco(v: number | null | undefined): number | string {
  return typeof v === 'number' ? v : '—';
}

// Trocar Atendimento ↔ Contatos ↔ Kanban não deve parecer uma navegação para
// outro produto. As rotas do host desmontam este componente, então mantemos o
// último token de cada área por alguns minutos e o iframe já nasce apontando
// para a tela correta. O EmbedBootstrap continua renovando o JWT por
// postMessage; isto é apenas cache de navegação, não bypass de autenticação.
const EMBED_CACHE = new Map<Escopo, TokenEmCache>();

/**
 * Último estado CONHECIDO da pausa da IA, para a faixa não piscar ao abrir.
 *
 * Sem isto o `useState(null)` renderizava o switch DESLIGADO por ~1 segundo até
 * o GET voltar, e ele saltava para ligado — medido no navegador em 04/08: a
 * faixa ia de "IA indisponível" para "IA respondendo". Parecia que a coisa
 * ligava e desligava sozinha.
 *
 * Em MEMÓRIA de propósito, nunca em localStorage: configuração é por empresa e
 * não pode sobreviver a uma troca de tenant. Recarregar a página zera, que é o
 * comportamento seguro. Ver estudo 108.
 */
let ULTIMO_ESTADO_IA: EstadoIaVoltr | null = null;
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

/**
 * Anexa a conversa alvo à URL do embed. O sino do SalonPass aponta para
 * `/voltr-chat?conversa=<id>` quando a IA abre uma pendência; a página de
 * conversas da Voltr já sabe abrir por `?id=`, só faltava alguém carregar o id
 * daqui até lá. Sem isto o link do sino abriria o CRM na conversa errada — um
 * atalho decorativo. Ver estudo 99.
 */
function comConversaAlvo(embedUrl: string, conversaId: string | null): string {
  if (!conversaId) return embedUrl;
  const separador = embedUrl.includes('?') ? '&' : '?';
  return `${embedUrl}${separador}id=${encodeURIComponent(conversaId)}`;
}

export function VoltrCrmPage({ scope = 'crm' }: { scope?: Escopo }) {
  const [src, setSrc] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const conversaAlvo = searchParams.get('conversa');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [metricasIa, setMetricasIa] = useState<MetricasIa | null>(null);
  const [estadoIa, setEstadoIa] = useState<EstadoIaVoltr | null>(ULTIMO_ESTADO_IA);
  // "Ainda não perguntei" é diferente de "perguntei e não deu". Sem separar os
  // dois, o primeiro acesso anunciava "IA indisponível" por um segundo — um
  // alarme falso para quem só abriu a tela.
  const [iaConsultada, setIaConsultada] = useState(ULTIMO_ESTADO_IA !== null);
  // Pausar a IA é ação de gestão (a mesma permissão da recepcionista nativa).
  // Sem ela o estado continua VISÍVEL — esconder o estado é o oposto de honesto
  // — mas o switch não fica clicável só para tomar 403 do servidor.
  const podeGerenciarIa = useCan().can('marketing:manage');
  const [erroPainelIa, setErroPainelIa] = useState<string | null>(null);
  const [salvandoIa, setSalvandoIa] = useState(false);
  const [chatMobileAberto, setChatMobileAberto] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef<string>('');
  const origemRef = useRef<string>('');
  /** Escopo que o `src` atual representa — troca de aba precisa de src novo. */
  const scopeDoSrc = useRef<Escopo | null>(null);
  const [temaAtual] = useTheme();

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
      setSrc(comConversaAlvo(guardado.embedUrl, conversaAlvo));
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
      setSrc((atual) => (atual && scopeDoSrc.current === scope ? atual : comConversaAlvo(r.embedUrl, conversaAlvo)));
      scopeDoSrc.current = scope;
      setErro(null);
      // Pré-carrega as outras áreas autorizadas. Se uma não estiver habilitada,
      // o erro fica restrito ao prefetch e não interfere na tela atual.
      const demais: Escopo[] = ['crm', 'chat', 'boards', 'tarefas', 'ia'].filter((s) => s !== scope) as Escopo[];
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

  // Alterar a personalização com o CRM já aberto precisa atualizar o iframe no
  // mesmo instante. Antes o tema era enviado apenas no load/handshake e ficava
  // velho até navegar ou recarregar a página.
  useEffect(() => {
    enviarTema();
  }, [temaAtual, enviarTema]);

  // O resumo pertence ao Atendimento (e não a Contatos/Kanban/IA).
  useEffect(() => {
    if (scope !== 'chat') return;
    let vivo = true;
    const carregar = async () => {
      const [metricas, config] = await Promise.allSettled([
        // A IA desta tela é a da VOLTR — nos dois pedidos. Ler a recepcionista
        // NATIVA aqui é o que fazia o cabeçalho anunciar um estado que não era
        // o dela e os cartões mostrarem zero enquanto a Mariana trabalhava.
        api.get<MetricasIa>('/voltr/metricas'),
        api.get<EstadoIaVoltr>('/voltr/ia'),
      ]);
      if (!vivo) return;
      if (metricas.status === 'fulfilled') setMetricasIa(metricas.value);
      if (config.status === 'fulfilled') {
        ULTIMO_ESTADO_IA = config.value;
        setEstadoIa(config.value);
      }
      setIaConsultada(true);
      setErroPainelIa(
        metricas.status === 'rejected' || config.status === 'rejected'
          ? 'Não foi possível atualizar o estado da IA agora. Nova tentativa automática em instantes.'
          : null,
      );
    };
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void carregar();
    };
    void carregar();
    // O painel fica aberto o dia inteiro no salão. Uma indisponibilidade curta
    // não pode congelar "IA pausada"/zeros até o próximo F5.
    const timer = window.setInterval(() => void carregar(), 30_000);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      vivo = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [scope]);

  /**
   * PAUSA / RETOMA a IA da Voltr de verdade.
   *
   * Nada de otimismo aqui: o estado exibido é o que o servidor devolveu depois
   * de gravar. Pedir "retomar" sem agente ativo na Voltr continua pausado, e a
   * tela precisa dizer isso — foi mostrar o que foi PEDIDO, e não o que
   * ACONTECEU, que deixou o dono achando que tinha pausado a IA.
   */
  async function alternarIa(envioAutomatico: boolean) {
    setSalvandoIa(true);
    try {
      const salvo = await api.patch<EstadoIaVoltr>('/voltr/ia', { envioAutomatico });
      ULTIMO_ESTADO_IA = salvo;
      setEstadoIa(salvo);
      // Avisa o inbox NA HORA. Sem isto ele só descobria no poll de 30s (ou
      // quando alguém recarregava a página) — e o dono via "pausei e continua
      // como estava". A mensagem não leva estado de propósito: é um gatilho
      // para o embed reler da API, então nada aqui pode mentir para ele.
      // Ver estudo 108.
      const iframe = iframeRef.current;
      const origem = origemRef.current;
      if (iframe?.contentWindow && origem) {
        iframe.contentWindow.postMessage({ type: 'salonpass-ia:mudou' }, origem);
      }
      setErroPainelIa(
        salvo.envioAutomatico === envioAutomatico
          ? null
          : envioAutomatico
            ? 'A IA continua pausada: não há agente ativo na Voltr para retomar.'
            : 'A IA continua ativa. Recarregue e tente de novo.',
      );
    } catch (error) {
      setErroPainelIa(apiErrorMessage(error));
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
      if (tipo === 'voltr-embed:sincronizar-clientes') {
        // O seletor do iframe trabalha com a cópia de clientes da Voltr. Antes
        // de mostrá-la, atualiza essa cópia pela fonte oficial (SalonPass).
        // A rota é idempotente e nunca cria ou envia mensagem.
        //
        // Vale em TODA tela que escolhe cliente, não só no Atendimento. Antes
        // era `&& scope === 'chat'`: no Kanban, vincular um cliente ao negócio
        // buscava numa carteira que nunca era atualizada, então quem foi
        // cadastrado hoje aqui não aparecia no autocomplete de lá — a não ser
        // que alguém tivesse aberto o Atendimento antes, por acaso.
        void api.post('/voltr/sync-clientes').then(() => {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'voltr-embed:clientes-atualizados' },
            origem,
          );
        }).catch(() => undefined);
      }
    }
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [buscarToken, enviarTema, scope]);

  const titulo =
    scope === 'chat'
      ? 'Atendimento'
      : scope === 'boards'
        ? 'Kanban'
        : scope === 'tarefas'
          ? 'Tarefas'
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
        // UMA tela só, não duas. Esta faixa já teve `border-b`: uma linha cheia
        // atravessando os 1920px, com quatro cartõezinhos de moldura própria
        // flutuando em cima dela. O olho lia como uma página empilhada sobre
        // outra — foi o que o dono apontou em 04/08. Agora a faixa não tem
        // costura: mesmo fundo do miolo (`--sp-warm-white` vira `--background`
        // dentro do iframe), sem linha divisória, e os números perderam a
        // moldura de cartão (ver a classe deles logo abaixo). O único objeto com
        // contorno na tela passa a ser o cartão do inbox.
        <section className={`${chatMobileAberto ? 'hidden lg:block' : ''} shrink-0 bg-[var(--sp-warm-white)] px-3 pt-2.5 pb-0.5 sm:px-5 sm:pt-4 sm:pb-1 lg:px-7`}>
          <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3 sm:flex-wrap sm:gap-3">
            <div className="min-w-0">
              <h1 className="m-0 truncate text-lg font-bold text-[var(--sp-ink)] sm:text-xl">WhatsApp e IA</h1>
              <p className="m-0 mt-1 hidden text-sm text-[var(--sp-muted-ink)] sm:block">Caixa real do número vinculado, atendimento humano e recepcionista virtual</p>
            </div>
            {/* PAUSA DA IA — o rótulo diz o estado REAL do servidor, não o que
                foi clicado. Três estados honestos: pausada, ativa e
                indisponível; e a pausa nunca aparece como "ativa" só porque a
                requisição saiu. */}
            <div
              // A FAIXA INTEIRA é o alvo, não só o switch.
              //
              // Medido no navegador em 03/08: o switch tem 40x20 px e fica no
              // canto superior direito (x=1839 num monitor de 1920). Ele
              // funciona — cliquei e o PATCH saiu — mas errar um alvo desse
              // tamanho, longe de onde a pessoa trabalha, é fácil, e errar não
              // dá retorno nenhum: parece que "não funcionou". Clicar em
              // qualquer ponto do rótulo agora alterna. Ver estudo 108.
              onClick={(evento) => {
                if (!estadoIa || salvandoIa || !podeGerenciarIa) return;
                // Clique direto no switch é DELE: deixar passar alternaria duas
                // vezes e voltaria ao estado anterior.
                if ((evento.target as HTMLElement).closest('[data-slot="switch"], label.switch')) return;
                void alternarIa(!estadoIa.envioAutomatico);
              }}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-xs shadow-sm sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm ${
                estadoIa && !salvandoIa && podeGerenciarIa ? 'cursor-pointer select-none' : ''
              }`}
              // Pausada, o estado tem que SALTAR aos olhos: o painel fica
              // aberto o dia inteiro e ninguém lê um rótulo que não muda de
              // cor. Tokens de tema (`--sp-status-warning-*`), nunca cor crua.
              style={{
                borderColor:
                  estadoIa && !estadoIa.envioAutomatico
                    ? 'var(--sp-status-warning)'
                    : 'var(--sp-border)',
                background:
                  estadoIa && !estadoIa.envioAutomatico
                    ? 'var(--sp-status-warning-soft)'
                    : 'var(--sp-card)',
              }}
            >
              <span
                className="font-semibold"
                style={{
                  color:
                    estadoIa && !estadoIa.envioAutomatico
                      ? 'var(--sp-status-warning-fg)'
                      : 'var(--sp-ink)',
                }}
                title={
                  erroPainelIa ??
                  (estadoIa
                    ? estadoIa.envioAutomatico
                      ? 'A IA responde sozinha os contatos autorizados.'
                      : 'A IA continua lendo e deixando rascunho, mas nada é enviado sem alguém mandar.'
                    : undefined)
                }
              >
                {!estadoIa
                  ? iaConsultada
                    ? 'IA indisponível'
                    : 'Verificando a IA…'
                  : estadoIa.envioAutomatico
                    ? 'IA respondendo'
                    : 'IA pausada · só rascunhos'}
              </span>
              <AppSwitch
                checked={!!estadoIa?.envioAutomatico}
                onChange={(v) => void alternarIa(v)}
                isDisabled={!estadoIa || salvandoIa || !podeGerenciarIa}
                aria-label="Pausar ou retomar as respostas automáticas da IA"
              />
            </div>
          </div>
          {/* Cards no estilo do painel próprio da Voltr (ai.salonpass.com.br):
              pílula de ícone tonalizada à esquerda + número grande à direita.
              O dono viu os dois lados e pediu que aqui ficasse igual — mesma
              linguagem visual do painel dela, mesmos tons por família de
              métrica. Cada cartão diz O QUE mede e DE ONDE vem no title.
              Um número indisponível aparece como "—" com o motivo — nunca como
              zero, que foi o que fez o dono achar que a IA estava parada. */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {[
              {
                label: 'Conversas hoje',
                mobile: 'Conversas',
                value: numeroOuTraco(metricasIa?.conversasHoje),
                ajuda: `Conversas com mensagem hoje no atendimento da IA. ${ORIGEM_VOLTR}`,
                icone: <IconMessage size={18} />,
                // Tom da MARCA do salão (`--sp-primary`): dá afinidade com a cor
                // que o dono escolheu. `color-mix` faz o "soft" acompanhar
                // qualquer tema — bege vira bege, roxo vira lilás.
                bg: 'color-mix(in oklab, var(--sp-primary) 14%, var(--sp-card) 86%)',
                fg: 'var(--sp-primary-strong, var(--sp-primary))',
              },
              {
                label: 'Respostas da IA hoje',
                mobile: 'Respostas IA',
                value: numeroOuTraco(metricasIa?.respostasIaHoje),
                ajuda: `Mensagens que a IA enviou hoje. Rascunho que ninguém aprovou não entra. ${ORIGEM_VOLTR}`,
                icone: <IconSparkles size={18} />,
                bg: 'color-mix(in oklab, var(--sp-primary) 22%, var(--sp-card) 78%)',
                fg: 'var(--sp-primary-strong, var(--sp-primary))',
              },
              {
                // O rótulo carrega a janela: sem "no mês" o número parecia do
                // dia e não batia com nada que o dono conseguisse conferir.
                label: 'Agendamentos pela IA no mês',
                mobile: 'Agend. mês',
                // Este NUNCA é "—": é medido no banco do SalonPass, então
                // continua de pé mesmo com a Voltr fora do ar.
                value: metricasIa ? metricasIa.agendamentosIaMes : '—',
                ajuda:
                  'Horários que a IA marcou na sua agenda no mês corrente. Medido aqui no SalonPass; cancelamento posterior não desconta.',
                icone: <IconCalendar size={18} />,
                bg: 'var(--sp-status-success-soft)',
                fg: 'var(--sp-status-success-fg)',
              },
              {
                label: 'Taxa de resolução',
                mobile: 'Resolução',
                value:
                  typeof metricasIa?.taxaResolucao === 'number'
                    ? `${metricasIa.taxaResolucao}%`
                    : '—',
                ajuda: `Percentual das conversas já arquivadas. Sem conversa nenhuma não há taxa. ${ORIGEM_VOLTR}`,
                icone: <IconTarget size={18} />,
                bg: 'var(--sp-status-warning-soft)',
                fg: 'var(--sp-status-warning-fg)',
              },
            ].map(({ label, mobile, value, ajuda, icone, bg, fg }) => (
              <div
                key={label}
                title={
                  value === '—' && metricasIa && metricasIa.fonteVoltr !== 'ok'
                    ? `${ajuda}\n\n${MOTIVO_INDISPONIVEL[metricasIa.fonteVoltr]}`
                    : ajuda
                }
                className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-card)] px-3 py-2 shadow-[var(--shadow-card)] sm:gap-3 sm:px-4 sm:py-3"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl sm:h-10 sm:w-10"
                  style={{ background: bg, color: fg }}
                >
                  {icone}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.68rem] font-medium leading-tight text-[var(--sp-muted-ink)] sm:hidden">{mobile}</span>
                  <span className="hidden truncate text-xs font-medium text-[var(--sp-muted-ink)] sm:block">{label}</span>
                  <span className="mt-0.5 block text-lg font-bold leading-none text-[var(--sp-ink)] sm:mt-1 sm:text-xl">{value}</span>
                </span>
              </div>
            ))}
          </div>
          {/* Quando os números da Voltr não vieram, a tela DIZ isso. Sem esta
              linha o "—" viraria adivinhação — e o silêncio é o que fez o dono
              confiar num zero que não era medição. */}
          {metricasIa && metricasIa.fonteVoltr !== 'ok' ? (
            <p className="m-0 mt-2 text-[0.68rem] leading-snug text-[var(--sp-muted-ink)] sm:text-xs">
              {MOTIVO_INDISPONIVEL[metricasIa.fonteVoltr]} Os agendamentos do mês
              continuam medidos aqui no SalonPass.
            </p>
          ) : null}
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
    </div>
  );
}
