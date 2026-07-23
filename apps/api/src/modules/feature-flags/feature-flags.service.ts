import { Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FEATURE_KEYS,
  PLAN_FEATURES,
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
