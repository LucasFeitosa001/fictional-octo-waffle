import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { FeatureFlagsService } from './feature-flags.service';
import { getPlanCatalog, type PlanCatalogEntry } from './feature-catalog';

/**
 * Exposes the logged-in company's effective feature set to the web/mobile apps.
 * Global prefix is `api/v1` (see main.ts) → `GET /api/v1/feature-flags`.
 */
@UseGuards(JwtAuthGuard)
@Controller()
export class FeatureFlagsController {
  constructor(private readonly service: FeatureFlagsService) {}

  /**
   * Returns the active features plus the current plan/status:
   *   { features: string[], plan: string | null, status: string | null }
   *
   * `GET /api/v1/feature-flags`.
   */
  @Get('feature-flags')
  getFeatures(@CurrentUser('companyId') companyId: string) {
    return this.service.getFeatures(companyId);
  }

  /**
   * Plan catalog — the single source of truth the front consumes to render the
   * plan-comparison / upsell UI. Authenticated (inherits the class JwtAuthGuard):
   * the catalog with prices is only relevant to a signed-in company choosing a
   * plan, and it keeps every route in this module behind the same guard.
   *
   * `GET /api/v1/plans` →
   *   [{ name, label, tagline, priceMonthly, features: [{ key, label, description }] }]
   */
  @Get('plans')
  getPlans(): PlanCatalogEntry[] {
    return getPlanCatalog();
  }
}
