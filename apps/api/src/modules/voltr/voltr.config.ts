/**
 * Configuração da integração com a Voltr (CRM/Chat embarcado + ponte WhatsApp).
 * Ver estudo 68 e `docs/INTEGRACAO-SALONPASS.md` no repositório da Voltr.
 *
 * Tudo vem de env com default tolerante: a API sobe sem a integração
 * configurada, e quem reclama é o serviço, com mensagem clara, quando alguém
 * tenta usar. Segredos NUNCA no código.
 */

export interface VoltrConfig {
  /** Base da API da Voltr para o token de embed (ex.: http://localhost:3001). */
  embedUrl: string;
  /** Base da API da Voltr para o ingest (cai no embedUrl quando ausente). */
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  /** `{ "<Company.id>": "<slug da Voltr>" }` */
  tenantMap: Record<string, string>;
  defaultTenantSlug: string;
  /** `{ "<slug>": "<ingestToken>" }` + fallback global. */
  ingestTokens: Record<string, string>;
  ingestTokenGlobal: string;
  /** `{ "<slug>": "<connectorSecret>" }` + fallback global. */
  connectorSecrets: Record<string, string>;
  connectorSecretGlobal: string;
}

function json(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v.trim();
    }
    return out;
  } catch {
    // JSON inválido não pode derrubar a API — a integração é opcional.
    return {};
  }
}

export function readVoltrConfig(): VoltrConfig {
  const embedUrl = (process.env.VOLTR_EMBED_URL ?? '').trim().replace(/\/$/, '');
  return {
    embedUrl,
    apiUrl: (process.env.VOLTR_API_URL ?? embedUrl).trim().replace(/\/$/, ''),
    clientId: (process.env.VOLTR_EMBED_CLIENT_ID ?? '').trim(),
    clientSecret: (process.env.VOLTR_EMBED_CLIENT_SECRET ?? '').trim(),
    tenantMap: json(process.env.VOLTR_TENANT_MAP),
    defaultTenantSlug: (process.env.VOLTR_DEFAULT_TENANT_SLUG ?? '').trim(),
    ingestTokens: json(process.env.VOLTR_INGEST_TOKENS),
    ingestTokenGlobal: (process.env.VOLTR_INGEST_TOKEN ?? '').trim(),
    connectorSecrets: json(process.env.VOLTR_CONNECTOR_SECRETS),
    connectorSecretGlobal: (process.env.VOLTR_CONNECTOR_SECRET ?? '').trim(),
  };
}

/** `Company.id` → slug da Voltr (sem entrada, cai no default; vazio = sem tenant). */
export function resolveTenantSlug(companyId: string, cfg: VoltrConfig): string {
  return cfg.tenantMap[companyId] ?? cfg.defaultTenantSlug;
}

/** Slug → `emp_<slug>`, formato que a Voltr valida (`^emp_[a-z0-9_]+$`). */
export function schemaFromSlug(slug: string): string {
  return `emp_${slug}`;
}

export function resolveTenantSchema(companyId: string, cfg: VoltrConfig): string {
  const slug = resolveTenantSlug(companyId, cfg);
  return slug ? schemaFromSlug(slug) : '';
}

/**
 * Mapa REVERSO `emp_<slug>` → `Company.id`. É o que o webhook de saída usa para
 * saber em qual salão enviar. Sem correspondência devolve null (fail-closed).
 */
export function resolveCompanyIdBySchema(
  schema: string,
  cfg: VoltrConfig,
): string | null {
  const slug = schema.replace(/^emp_/, '');
  for (const [companyId, mapped] of Object.entries(cfg.tenantMap)) {
    if (mapped === slug) return companyId;
  }
  // Um único salão em dev pode usar só o default, sem mapa.
  if (slug && slug === cfg.defaultTenantSlug) {
    const [unico] = Object.keys(cfg.tenantMap);
    return unico ?? null;
  }
  return null;
}

/** Token de ingest do tenant (por slug) com fallback no global. */
export function resolveIngestToken(companyId: string, cfg: VoltrConfig): string {
  const slug = resolveTenantSlug(companyId, cfg);
  return cfg.ingestTokens[slug] ?? cfg.ingestTokenGlobal;
}

/** Segredo HMAC do tenant (por slug) com fallback no global. */
export function resolveConnectorSecretBySlug(
  slug: string,
  cfg: VoltrConfig,
): string {
  return cfg.connectorSecrets[slug] ?? cfg.connectorSecretGlobal;
}
