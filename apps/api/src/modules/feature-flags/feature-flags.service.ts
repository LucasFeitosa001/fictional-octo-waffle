import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FEATURE_KEYS,
  PLAN_FEATURES,
  PLAN_META,
  PLAN_PRICE,
  type FeatureKey,
  type PlanName,
} from './feature-catalog';

/** Subscription statuses that grant the plan's features. */
const ACTIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.active,
  SubscriptionStatus.trialing,
];

export interface FeaturesResponse {
  /** Active feature keys for the company (plan ∪ overrides). */
  features: FeatureKey[];
  /** Current plan name, or null when the company has no subscription. */
  plan: string | null;
  /** Subscription status, or null. */
  status: string | null;
}

/** A single add-on line inside the consolidated billing summary. */
export interface BillingAddon {
  label: string;
  monthly: number;
}

/** Payment/charge status derived from the `billing.details` Setting. */
export interface BillingPayment {
  status: string | null;
  startDate: string | null;
  dueDate: string | null;
}

/**
 * Consolidated billing summary for the active company — merges the
 * Subscription (plan/status/currentPeriodEnd) with the optional
 * `billing.details` Setting (per-company pricing/add-ons/installments).
 */
export interface SubscriptionSummary {
  plan: string | null;
  planLabel: string;
  status: string | null;
  payment: BillingPayment;
  baseMonthly: number;
  addons: BillingAddon[];
  totalMonthly: number;
  cycle: string;
  installments: number;
  annualTotal: number;
  currency: string;
  currentPeriodEnd: string | null;
}

/** Shape of the `billing.details` Setting.valueJson (all fields optional). */
interface BillingDetailsJson {
  plan?: string;
  baseMonthly?: number;
  addons?: { key?: string; label?: string; monthly?: number }[];
  totalMonthly?: number;
  cycle?: string;
  installments?: number;
  annualTotal?: number;
  status?: string;
  startDate?: string;
  dueDate?: string;
  currency?: string;
}

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the effective feature set for a company:
   *   1. Take the plan of the company's most recent active/trialing subscription.
   *   2. Start from that plan's `featuresJson` (falling back to the catalog map
   *      keyed by plan name when the JSON is absent).
   *   3. Apply per-company `FeatureFlag` overrides: enabled=true adds a key,
   *      enabled=false removes it.
   *
   * Returns a de-duplicated, catalog-validated list of feature keys.
   */
  async getActiveFeatures(companyId: string): Promise<FeatureKey[]> {
    const { features } = await this.getFeatures(companyId);
    return features;
  }

  async getFeatures(companyId: string): Promise<FeaturesResponse> {
    const subscription = await this.prisma.client.subscription.findFirst({
      where: {
        companyId,
        status: { in: ACTIVE_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    const set = new Set<FeatureKey>();
    let planName: string | null = null;
    let status: string | null = null;

    if (subscription) {
      planName = subscription.plan.name;
      status = subscription.status;
      for (const key of this.resolvePlanFeatures(subscription.plan.name, subscription.plan.featuresJson)) {
        set.add(key);
      }
    }

    // Per-company overrides layered on top of the plan.
    const overrides = await this.prisma.client.featureFlag.findMany({
      where: { companyId },
    });
    for (const flag of overrides) {
      if (!this.isKnownFeature(flag.key)) continue;
      if (flag.enabled) set.add(flag.key);
      else set.delete(flag.key);
    }

    return { features: [...set], plan: planName, status };
  }

  /**
   * Consolidated billing summary for the subscription page. Reads the company's
   * most recent active/trialing Subscription (plan, status, currentPeriodEnd)
   * and merges the optional per-company `billing.details` Setting, which holds
   * the real pricing (base + add-ons + installments/cycle). When the Setting is
   * absent, everything falls back to values derived from the plan catalog so the
   * page always renders a sensible summary.
   */
  async getSubscriptionSummary(companyId: string): Promise<SubscriptionSummary> {
    const subscription = await this.prisma.client.subscription.findFirst({
      where: { companyId, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    const setting = await this.prisma.client.setting.findUnique({
      where: { companyId_key: { companyId, key: 'billing.details' } },
    });
    const details = (setting?.valueJson as BillingDetailsJson | null) ?? null;

    // Plan identity: prefer the live subscription, fall back to the Setting.
    const planName =
      subscription?.plan.name ?? (details?.plan ? String(details.plan) : null);
    const planLabel =
      (planName && PLAN_META[planName as PlanName]?.label) ||
      (planName ? this.capitalize(planName) : 'Sem plano');

    // Pricing: prefer the Setting, else derive from the plan (priceMonthly).
    const derivedBase =
      subscription != null
        ? Number(subscription.plan.priceMonthly)
        : planName
        ? PLAN_PRICE[planName as PlanName] ?? 0
        : 0;
    const baseMonthly =
      typeof details?.baseMonthly === 'number' ? details.baseMonthly : derivedBase;

    const addons: BillingAddon[] = Array.isArray(details?.addons)
      ? details!.addons
          .filter((a) => a && typeof a === 'object')
          .map((a) => ({
            label: String(a.label ?? a.key ?? 'Adicional'),
            monthly: typeof a.monthly === 'number' ? a.monthly : 0,
          }))
      : [];

    const addonsTotal = addons.reduce((sum, a) => sum + a.monthly, 0);
    const totalMonthly =
      typeof details?.totalMonthly === 'number'
        ? details.totalMonthly
        : baseMonthly + addonsTotal;

    const cycle = details?.cycle ? String(details.cycle) : 'monthly';
    const installments =
      typeof details?.installments === 'number' && details.installments > 0
        ? details.installments
        : cycle === 'annual'
        ? 12
        : 1;
    const annualTotal =
      typeof details?.annualTotal === 'number'
        ? details.annualTotal
        : totalMonthly * installments;

    return {
      plan: planName,
      planLabel,
      status: subscription?.status ?? null,
      payment: {
        status: details?.status ? String(details.status) : null,
        startDate: details?.startDate ? String(details.startDate) : null,
        dueDate: details?.dueDate ? String(details.dueDate) : null,
      },
      baseMonthly,
      addons,
      totalMonthly,
      cycle,
      installments,
      annualTotal,
      currency: details?.currency ? String(details.currency) : 'BRL',
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    };
  }

  private capitalize(s: string): string {
    return s.length ? s[0].toUpperCase() + s.slice(1) : s;
  }

  /**
   * Read a plan's feature list from its stored `featuresJson`; when that is
   * missing/malformed, fall back to the static catalog keyed by plan name so a
   * partially-seeded DB never strands a tenant with zero features.
   */
  private resolvePlanFeatures(planName: string, featuresJson: unknown): FeatureKey[] {
    if (Array.isArray(featuresJson)) {
      const fromJson = featuresJson.filter(
        (k): k is FeatureKey => typeof k === 'string' && this.isKnownFeature(k),
      );
      if (fromJson.length > 0) return fromJson;
    }
    const fallback = PLAN_FEATURES[planName as PlanName];
    return fallback ? [...fallback] : [];
  }

  private isKnownFeature(key: string): key is FeatureKey {
    return (FEATURE_KEYS as readonly string[]).includes(key);
  }
}
