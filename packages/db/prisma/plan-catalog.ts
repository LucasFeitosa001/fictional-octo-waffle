/**
 * Plan / feature catalog for seeding (FASE 2 — paid modules).
 *
 * Kept in sync with the API's runtime catalog at
 * apps/api/src/modules/feature-flags/feature-catalog.ts. This copy exists so the
 * DB package's seed has zero cross-package import (packages/db must not depend on
 * apps/api). If you change one, change the other.
 */

export type FeatureKey =
  | 'online_booking'
  | 'cashback'
  | 'goals'
  | 'commissions'
  | 'packages'
  | 'memberships'
  | 'messaging'
  | 'campaigns'
  | 'reports_advanced'
  | 'whatsapp_api'
  | 'nfe';

export type PlanName = 'starter' | 'pro' | 'max';

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

export const PLANS: {
  name: PlanName;
  priceMonthly: number;
  features: FeatureKey[];
}[] = [
  { name: 'starter', priceMonthly: 99, features: STARTER_FEATURES },
  { name: 'pro', priceMonthly: 199, features: PRO_FEATURES },
  { name: 'max', priceMonthly: 349, features: MAX_FEATURES },
];

/**
 * Map from the OLD plan names (pre-Starter/Pro/Max) to the NEW equivalent, used
 * by the seed to re-point existing Subscriptions instead of leaving them orphaned
 * on a plan that no longer exists.
 *   premium → max, pro → pro, basic → pro, free → starter
 */
export const LEGACY_PLAN_MAP: Record<string, PlanName> = {
  free: 'starter',
  basic: 'pro',
  pro: 'pro',
  premium: 'max',
};

/**
 * Plan every existing/dev company gets so nothing in the app breaks while FASE 2
 * is wired up. Generous on purpose: max == all features.
 */
export const DEV_DEFAULT_PLAN: PlanName = 'max';
