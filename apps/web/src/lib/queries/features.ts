import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

/**
 * FASE 2 — paid modules / feature gating (client side).
 *
 * Mirrors apps/api/src/modules/feature-flags/feature-catalog.ts. A feature key
 * gates a route / menu item / endpoint behind the company's plan.
 */
export const FEATURE_KEYS = [
  'online_booking',
  'cashback',
  'goals',
  'commissions',
  'packages',
  'memberships',
  'messaging',
  'campaigns',
  'reports_advanced',
  'whatsapp_api',
  'nfe',
  // Adicionais avulsos (estudo 124): contratados no suporte e ligados por
  // `FeatureFlag` da empresa, sem obrigar troca de plano. Esta lista é a cópia
  // do front de `feature-catalog.ts` — as duas andam juntas.
  'media_messages',
  'documents',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

/** Shape returned by GET /feature-flags. */
export interface FeaturesResponse {
  features: FeatureKey[];
  plan: string | null;
  status: string | null;
}

const FEATURES_KEY = ['feature-flags'] as const;

/**
 * Loads the logged-in company's active features. Cached aggressively — plan
 * changes are rare, so a long staleTime avoids re-fetching on every navigation.
 */
export function useFeatures() {
  return useQuery({
    queryKey: FEATURES_KEY,
    queryFn: () => api.get<FeaturesResponse>('/feature-flags'),
    staleTime: 5 * 60_000, // 5 min: features change rarely
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

/**
 * Returns whether the current company has `key`.
 *
 * FAIL-OPEN by design: while the query is loading OR if it errored, we treat the
 * feature as ENABLED. Gating is a UX affordance, not a security boundary (the
 * backend `FeatureGuard` is the real enforcement). A network blip must never
 * hide the whole app behind upsells.
 */
export function useFeature(key: FeatureKey): boolean {
  const { data, isLoading, isError } = useFeatures();

  // Fail-open: no data yet, or the request failed → allow.
  if (isLoading || isError || !data) return true;

  return data.features.includes(key);
}
