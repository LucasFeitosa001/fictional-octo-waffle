import { AI_ORIGIN } from './config';

/**
 * A área de IA é o MESMO bundle servido em outro hostname
 * (`ai.salonpass.com.br`). Ver estudo 62.
 *
 * Não existe login separado: o cookie de sessão é emitido para o domínio-base
 * `salonpass.com.br` (`apps/api/src/auth/better-auth.ts` →
 * `crossSubDomainCookies`), então quem já entrou no painel já está logado aqui.
 */

const CHAVE_SESSAO = 'salonpass.modoIa';

/** `?app=ia` liga o modo IA fora de produção (mesma origem do Vite dev). */
function flagNaUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const valor = new URLSearchParams(window.location.search).get('app');
  return valor === 'ia' || valor === 'ai';
}

export function isAiHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  if (host === 'ai.salonpass.com.br' || host.startsWith('ai.')) return true;
  // O flag precisa sobreviver à navegação interna da SPA (que reescreve a URL
  // sem o query param), por isso fica na sessão da aba.
  try {
    // `?app=painel` desliga o modo IA na aba — é como se volta ao painel no
    // ambiente de desenvolvimento, onde as duas coisas moram na mesma origem.
    if (new URLSearchParams(window.location.search).get('app') === 'painel') {
      window.sessionStorage.removeItem(CHAVE_SESSAO);
      return false;
    }
    if (flagNaUrl()) {
      window.sessionStorage.setItem(CHAVE_SESSAO, '1');
      return true;
    }
    return window.sessionStorage.getItem(CHAVE_SESSAO) === '1';
  } catch {
    return flagNaUrl();
  }
}

/** Volta para o painel: `ai.` → `app.`; fora de produção, a própria origem. */
export function urlDoPainel(caminho = '/'): string {
  if (typeof window === 'undefined') return 'https://app.salonpass.com.br';
  const host = window.location.hostname.toLowerCase();
  if (host.startsWith('ai.')) {
    const base = `${window.location.protocol}//${host.replace(/^ai\./, 'app.')}`;
    return new URL(caminho.startsWith('/') ? caminho : `/${caminho}`, base).toString();
  }
  // Mesma origem (dev): precisa do `?app=painel` para desligar o modo IA.
  const url = new URL(caminho.startsWith('/') ? caminho : `/${caminho}`, window.location.origin);
  url.searchParams.set('app', 'painel');
  return url.toString();
}

/** URL da área de IA, com o flag de modo quando a origem não é o `ai.`. */
export function urlDaAreaDeIa(caminho = '/'): string {
  const url = new URL(caminho.startsWith('/') ? caminho : `/${caminho}`, AI_ORIGIN);
  if (!url.hostname.toLowerCase().startsWith('ai.')) {
    url.searchParams.set('app', 'ia');
  }
  return url.toString();
}

/** Abre a área de IA em outra janela/aba, sem dar acesso ao `window` de origem. */
export function abrirAreaDeIa(caminho = '/'): void {
  window.open(urlDaAreaDeIa(caminho), '_blank', 'noopener,noreferrer');
}
