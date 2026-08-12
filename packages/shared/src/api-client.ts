// Typed fetch wrapper: baseURL + bearer token + get/post/patch/delete.
import type { ApiError } from './types';

export interface ApiClientOptions {
  baseUrl: string;
  token?: string | null;
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
  fetchImpl?: typeof fetch;
  /**
   * fetch credentials mode. Web should pass 'include' so the Better Auth
   * session cookie is sent on protected requests. Mobile (bearer) can omit it.
   */
  credentials?: RequestCredentials;
  /** Limite por tentativa. Evita uma tela presa indefinidamente em rede ruim. */
  timeoutMs?: number;
}

export class ApiClientError extends Error {
  statusCode: number;
  body: ApiError | undefined;
  constructor(statusCode: number, message: string, body?: ApiError) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.body = body;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export class ApiClient {
  private baseUrl: string;
  private token?: string | null;
  private getToken?: ApiClientOptions['getToken'];
  private fetchImpl: typeof fetch;
  private credentials?: RequestCredentials;
  private timeoutMs: number;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.token = opts.token ?? null;
    this.getToken = opts.getToken;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.credentials = opts.credentials;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async resolveToken(): Promise<string | null | undefined> {
    if (this.getToken) return this.getToken();
    return this.token;
  }

  private buildUrl(path: string, query?: Query): string {
    const url = new URL(this.baseUrl + (path.startsWith('/') ? path : `/${path}`));
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { query?: Query; body?: unknown } = {},
  ): Promise<T> {
    const token = await this.resolveToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Escritas nunca são repetidas implicitamente: mesmo com idempotência no
    // backend, o cliente compartilhado não pode assumir que todo POST/PATCH é
    // seguro. GET ganha duas novas tentativas apenas para rede/502/503/504.
    const attempts = method === 'GET' ? 3 : 1;
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(this.buildUrl(path, opts.query), {
          method,
          headers,
          credentials: this.credentials,
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: controller.signal,
        });

        const text = await res.text();
        const json = text ? safeJson(text) : undefined;
        if (res.ok) return json as T;

        const errBody = json as ApiError | undefined;
        const message = errBody
          ? Array.isArray(errBody.message)
            ? errBody.message.join(', ')
            : errBody.message
          : res.statusText;
        const error = new ApiClientError(res.status, message, errBody);
        if (
          method === 'GET' &&
          attempt < attempts - 1 &&
          [502, 503, 504].includes(res.status)
        ) {
          lastError = error;
          await delay(200 * (attempt + 1));
          continue;
        }
        throw error;
      } catch (error) {
        lastError = error;
        const retryableNetworkError =
          method === 'GET' &&
          !(error instanceof ApiClientError) &&
          attempt < attempts - 1;
        if (retryableNetworkError) {
          await delay(200 * (attempt + 1));
          continue;
        }
        if (controller.signal.aborted) {
          throw new Error('A conexão demorou demais. Tente novamente.');
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError;
  }

  get<T>(path: string, query?: Query): Promise<T> {
    return this.request<T>('GET', path, { query });
  }
  post<T>(path: string, body?: unknown, query?: Query): Promise<T> {
    return this.request<T>('POST', path, { body, query });
  }
  put<T>(path: string, body?: unknown, query?: Query): Promise<T> {
    return this.request<T>('PUT', path, { body, query });
  }
  patch<T>(path: string, body?: unknown, query?: Query): Promise<T> {
    return this.request<T>('PATCH', path, { body, query });
  }
  delete<T>(path: string, query?: Query): Promise<T> {
    return this.request<T>('DELETE', path, { query });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  return new ApiClient(opts);
}
