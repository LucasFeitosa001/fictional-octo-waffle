import { SetMetadata } from '@nestjs/common';
import type { FeatureKey } from './feature-catalog';

/** Metadata key under which the required feature is stored on a handler. */
export const REQUIRE_FEATURE_KEY = 'require_feature';

/**
 * Marks an endpoint as requiring a paid feature. Combine with `FeatureGuard`:
 *
 *   @UseGuards(JwtAuthGuard, FeatureGuard)
 *   @RequireFeature('messaging')
 *   @Post('campaigns/send')
 *   send(...) { ... }
 *
 * If the logged-in company's active plan (+ overrides) does not include the
 * feature, FeatureGuard throws 402 Payment Required.
 *
 * NOTE (FASE 2): not yet applied to any domain endpoint — the decorator/guard
 * are shipped ready-to-use; wiring onto endpoints happens in a later phase.
 */
export const RequireFeature = (feature: FeatureKey) =>
  SetMetadata(REQUIRE_FEATURE_KEY, feature);
