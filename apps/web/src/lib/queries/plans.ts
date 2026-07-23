import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { FeatureKey } from './features';

/**
 * FASE 2 — plan catalog (client side).
 *
 * Mirrors the shape returned by GET /plans (single source of truth on the API,
 * built from apps/api/src/modules/feature-flags/feature-catalog.ts). Used to
 * render the plan-comparison cards on the subscription page and the upsell copy.
 */
export type PlanName = 'starter' | 'pro' | 'max';

export interface PlanFeature {
  key: FeatureKey;
  label: string;
  description: string;
}

export interface Plan {
  name: PlanName;
  label: string;
  tagline: string;
  priceMonthly: number;
  features: PlanFeature[];
}

const PLANS_KEY = ['plans'] as const;

/**
 * Loads the plan catalog. Cached aggressively — the catalog is effectively
 * static (changes only on a deploy), so a long staleTime avoids re-fetching.
 */
export function usePlans() {
  return useQuery({
    queryKey: PLANS_KEY,
    queryFn: () => api.get<Plan[]>('/plans'),
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });
}

/**
 * Given the plan catalog, returns the FIRST plan (cheapest tier) that includes
 * `feature`. Used by the upsell to tell the user "this unlocks in the Pro plan".
 * Returns null while the catalog is loading or if the feature is in no plan.
 */
export function findPlanForFeature(
  plans: Plan[] | undefined,
  feature: FeatureKey,
): Plan | null {
  if (!plans) return null;
  return plans.find((p) => p.features.some((f) => f.key === feature)) ?? null;
}

/** Finds the metadata (label/description) for a feature across the catalog. */
export function findFeatureMeta(
  plans: Plan[] | undefined,
  feature: FeatureKey,
): PlanFeature | null {
  if (!plans) return null;
  for (const plan of plans) {
    const match = plan.features.find((f) => f.key === feature);
    if (match) return match;
  }
  return null;
}
