/**
 * Feature catalog — single source of truth for the paid-module gating (FASE 2).
 *
 * A "feature" is a stable string key that an endpoint / route / menu item can be
 * gated behind. Each Plan owns a list of feature keys (`Plan.featuresJson`); a
 * company's *effective* features = the features of its active subscription's plan
 * UNION any per-company `FeatureFlag` overrides (enabled=true adds, enabled=false
 * removes). See FeatureFlagsService.getActiveFeatures.
 *
 * This file is imported by both the runtime resolver (service) and the seed so
 * plan→feature mappings never drift between them.
 */

export const FEATURE_KEYS = [
  'online_booking', // link de agendamento + agendamento online público
  'cashback', // programa de cashback
  'goals', // metas
  'commissions', // comissões
  'packages', // pacotes / pacotes predefinidos
  'memberships', // vendas por assinatura
  'messaging', // envio de mensagens (base p/ campanhas)
  'campaigns', // automação de marketing (/marketing/campanhas)
  'reports_advanced', // relatórios avançados
  'whatsapp_api', // WhatsApp conectado + inbox/recepcionista virtual
  'nfe', // emissão de notas fiscais (/financeiro/notas-fiscais)
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Canonical plan names (matches Plan.name unique constraint). */
export const PLAN_NAMES = ['starter', 'pro', 'max'] as const;
export type PlanName = (typeof PLAN_NAMES)[number];

/**
 * Cumulative plan → feature map. Higher tiers include everything below them
 * plus their own additions.
 */
const STARTER_FEATURES: FeatureKey[] = ['online_booking'];

const PRO_FEATURES: FeatureKey[] = [
  ...STARTER_FEATURES,
  'cashback',
  'goals',
  'commissions',
  'packages',
  'memberships',
  'reports_advanced',
  'messaging',
  'campaigns',
];

const MAX_FEATURES: FeatureKey[] = [
  ...PRO_FEATURES,
  'whatsapp_api',
  'nfe',
];

export const PLAN_FEATURES: Record<PlanName, FeatureKey[]> = {
  starter: STARTER_FEATURES,
  pro: PRO_FEATURES,
  max: MAX_FEATURES,
};

/** Suggested monthly price (BRL) per plan — used by the seed. */
export const PLAN_PRICE: Record<PlanName, number> = {
  starter: 99,
  pro: 199,
  max: 349,
};

/**
 * Human-readable, pt-BR plan metadata consumed by the UI (subscription page,
 * plan comparison cards). Label + a short tagline describing the audience/benefit.
 */
export const PLAN_META: Record<PlanName, { label: string; tagline: string }> = {
  starter: {
    label: 'Starter',
    tagline: 'Para começar: agenda e agendamento online sem complicação.',
  },
  pro: {
    label: 'Pro',
    tagline: 'Para crescer: fidelização, metas, comissões e marketing no automático.',
  },
  max: {
    label: 'Max',
    tagline: 'Recursos avançados de atendimento, automação e integrações para operar em escala.',
  },
};

/**
 * Human-readable, pt-BR metadata per feature key. This is what the upsell shows:
 * a clear label + a description of what the functionality actually delivers.
 */
export const FEATURE_META: Record<FeatureKey, { label: string; description: string }> = {
  online_booking: {
    label: 'Agendamento online',
    description:
      'Link público para o cliente agendar sozinho, 24h por dia, direto na sua agenda.',
  },
  cashback: {
    label: 'Programa de cashback',
    description:
      'Devolva parte do valor como crédito e traga o cliente de volta para gastar mais.',
  },
  goals: {
    label: 'Metas',
    description:
      'Defina metas de faturamento e serviços por profissional e acompanhe o progresso.',
  },
  commissions: {
    label: 'Comissões',
    description:
      'Cálculo automático de comissão por serviço e profissional, pronto para pagamento.',
  },
  packages: {
    label: 'Pacotes',
    description:
      'Venda combos de sessões (ex: 10 depilações) com controle de saldo e validade.',
  },
  memberships: {
    label: 'Assinaturas / mensalidades',
    description:
      'Organize planos recorrentes, vencimentos e renovações manuais dos clientes.',
  },
  messaging: {
    label: 'Mensagens automáticas',
    description:
      'Lembretes, follow-ups e campanhas de WhatsApp automáticas para reduzir faltas.',
  },
  campaigns: {
    label: 'Campanhas de marketing',
    description:
      'Automatize disparos segmentados (aniversário, inativos, promoções) em poucos cliques.',
  },
  reports_advanced: {
    label: 'Relatórios avançados',
    description:
      'Indicadores de faturamento, retenção e desempenho por profissional para decidir com dados.',
  },
  whatsapp_api: {
    label: 'WhatsApp integrado',
    description:
      'Conecte o número do salão, centralize conversas e use a recepcionista virtual com limites de envio.',
  },
  nfe: {
    label: 'Integração fiscal',
    description:
      'Integração com provedor fiscal em preparação; a emissão ainda não está habilitada.',
  },
};

/**
 * Shape of a single plan in the catalog returned by GET /plans — the single
 * source of truth the web/mobile front consumes to render the plan-comparison UI.
 */
export interface PlanCatalogEntry {
  name: PlanName;
  label: string;
  tagline: string;
  priceMonthly: number;
  features: { key: FeatureKey; label: string; description: string }[];
}

/**
 * Builds the full plan catalog (all plans, in tier order, with resolved feature
 * metadata). Pure/derived from the maps above — used by the /plans endpoint.
 */
export function getPlanCatalog(): PlanCatalogEntry[] {
  return PLAN_NAMES.map((name) => ({
    name,
    label: PLAN_META[name].label,
    tagline: PLAN_META[name].tagline,
    priceMonthly: PLAN_PRICE[name],
    features: PLAN_FEATURES[name].map((key) => ({
      key,
      label: FEATURE_META[key].label,
      description: FEATURE_META[key].description,
    })),
  }));
}

/** Every known feature key (max == all). */
export const ALL_FEATURES: FeatureKey[] = [...FEATURE_KEYS];
