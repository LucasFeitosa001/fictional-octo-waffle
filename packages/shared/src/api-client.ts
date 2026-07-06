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

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.token = opts.token ?? null;
    this.getToken = opts.getToken;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    this.credentials = opts.credentials;
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

    const res = await this.fetchImpl(this.buildUrl(path, opts.query), {
      method,
      headers,
      credentials: this.credentials,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    const text = await res.text();
    const json = text ? safeJson(text) : undefined;

    if (!res.ok) {
      const errBody = json as ApiError | undefined;
      const message = errBody
        ? Array.isArray(errBody.message)
          ? errBody.message.join(', ')
          : errBody.message
        : res.statusText;
      throw new ApiClientError(res.status, message, errBody);
    }

    return json as T;
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
