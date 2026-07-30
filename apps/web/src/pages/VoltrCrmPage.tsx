import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
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

export function VoltrCrmPage({ scope = 'crm' }: { scope?: 'crm' | 'chat' }) {
  const [src, setSrc] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const tokenRef = useRef<string>('');
  const origemRef = useRef<string>('');

  const buscarToken = useCallback(async () => {
    try {
      const r = await api.get<RespostaToken>('/voltr/embed-token', { scope });
      tokenRef.current = r.accessToken;
      origemRef.current = origemDe(r.embedUrl);
      // Só fixa o src na PRIMEIRA vez; renovações vão por postMessage.
      setSrc((atual) => atual ?? r.embedUrl);
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

  const titulo = scope === 'chat' ? 'Atendimento (Voltr)' : 'CRM (Voltr)';

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col">
      <PageHeader
        title={titulo}
        subtitle="Conversas e clientes na plataforma Voltr, dentro do painel."
      />
      {carregando ? (
        <LoadingState label="Abrindo a Voltr…" />
      ) : erro ? (
        <ErrorState message={erro} onRetry={() => void buscarToken()} />
      ) : src ? (
        <div className="mt-3 min-h-[70vh] flex-1 overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
          <iframe
            ref={iframeRef}
            src={src}
            title={titulo}
            className="h-full min-h-[70vh] w-full border-0"
            allow="clipboard-write; microphone"
          />
        </div>
      ) : null}
    </div>
  );
}
