/**
 * Cliente HTTP do console. Ver estudo 135.
 *
 * `credentials: 'include'` em toda chamada: a sessão vive num cookie host-only
 * emitido pela API, e sem isso o navegador simplesmente não o envia.
 */

const BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '') || 'http://localhost:3334/api/v1';

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ErroApi';
  }

  /** 401 é "faça login de novo", e a interface reage diferente disso. */
  get expirou(): boolean {
    return this.status === 401;
  }

  get semPermissao(): boolean {
    return this.status === 403;
  }
}

async function requisitar<T>(
  caminho: string,
  init: RequestInit & { corpo?: unknown } = {},
): Promise<T> {
  const { corpo, ...resto } = init;

  const resposta = await fetch(`${BASE}${caminho}`, {
    ...resto,
    credentials: 'include',
    headers: {
      ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(resto.headers ?? {}),
    },
    ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
  }).catch(() => {
    // Falha de rede não tem status; sem este tratamento a tela mostraria
    // "undefined" e o técnico não saberia se o problema é dele ou do servidor.
    throw new ErroApi(0, 'Não foi possível falar com a API. Verifique a conexão.');
  });

  if (resposta.status === 204) return undefined as T;

  const texto = await resposta.text();
  let corpoResposta: unknown = null;
  try {
    corpoResposta = texto ? JSON.parse(texto) : null;
  } catch {
    corpoResposta = texto;
  }

  if (!resposta.ok) {
    const msg =
      (corpoResposta as { message?: string | string[] })?.message ??
      (typeof corpoResposta === 'string' && corpoResposta) ??
      `Erro ${resposta.status}`;
    // O ValidationPipe do Nest devolve `message` como ARRAY quando um DTO
    // reprova. Juntar aqui evita a tela exibir "[object Object]".
    throw new ErroApi(resposta.status, Array.isArray(msg) ? msg.join(' · ') : String(msg));
  }

  return corpoResposta as T;
}

export const api = {
  get: <T>(caminho: string) => requisitar<T>(caminho),
  post: <T>(caminho: string, corpo?: unknown) =>
    requisitar<T>(caminho, { method: 'POST', corpo: corpo ?? {} }),
  patch: <T>(caminho: string, corpo?: unknown) =>
    requisitar<T>(caminho, { method: 'PATCH', corpo: corpo ?? {} }),
};

/** Monta querystring ignorando vazio — evita `?busca=&pagina=` no histórico. */
export function query(params: Record<string, string | number | undefined | null>): string {
  const partes = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return partes.length ? `?${partes.join('&')}` : '';
}
