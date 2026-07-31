import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorState, LoadingState } from '../components/States';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/toast';

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

function origemDe(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function VoltrCrmPage({ scope = 'crm' }: { scope?: 'crm' | 'chat' | 'boards' }) {
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef<string>('');
  const origemRef = useRef<string>('');
  /** Escopo que o `src` atual representa — troca de aba precisa de src novo. */
  const scopeDoSrc = useRef<'crm' | 'chat' | 'boards' | null>(null);

  const buscarToken = useCallback(async () => {
    try {
      const r = await api.get<RespostaToken>('/voltr/embed-token', { scope });
      tokenRef.current = r.accessToken;
      origemRef.current = origemDe(r.embedUrl);
      // Fixa na primeira vez de CADA escopo; renovações de token vão por
      // postMessage e não recarregam o iframe. Sem o escopo na conta, trocar
      // Atendimento ↔ CRM pelo menu não remontava o componente (as duas rotas
      // têm a mesma árvore) e o iframe ficava na tela anterior. Ver estudo 75.
      setSrc((atual) => (atual && scopeDoSrc.current === scope ? atual : r.embedUrl));
      scopeDoSrc.current = scope;
      setErro(null);
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
      }
      if (tipo === 'voltr-embed:token-expired') {
        void buscarToken().then((r) => {
          if (!r) return;
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'voltr-embed:token', token: r.accessToken, scope },
            origem,
          );
        });
      }
    }
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  }, [buscarToken, scope]);

  const titulo =
    scope === 'chat'
      ? 'Atendimento'
      : scope === 'boards'
        ? 'Kanban'
        : 'Contatos';

  // Tela cheia de verdade: sem max-width, sem padding e sem moldura de cartão.
  // A rota está na lista de full-bleed do DashboardLayout, então aqui não sobra
  // nenhuma margem do painel — o iframe ocupa a área inteira.
  return (
    // O fundo é o MESMO tom do app da Voltr desde o primeiro quadro. Sem isso o
    // refresh piscava entre três brancos: o splash, o canvas do painel e o fundo
    // da Voltr — o iframe só entra depois de dois saltos de rede. Ver estudo 71.
    <div
      className="flex h-full min-h-0 w-full flex-col"
      style={{ background: '#f4f8f8' }}
    >
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
          className="h-full min-h-0 w-full flex-1 border-0"
          allow="clipboard-write; microphone"
        />
      ) : null}
    </div>
  );
}
