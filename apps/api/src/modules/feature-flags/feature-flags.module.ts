import { Module } from '@nestjs/common';
import { FeatureFlagsController } from './feature-flags.controller';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureGuard } from './feature.guard';

/**
 * FASE 2 — paid modules / feature gating.
 *
 * Register in app.module.ts by adding `FeatureFlagsModule` to the `imports`
 * array. PrismaModule is @Global, so no extra imports are needed here.
 *
 * Exports FeatureFlagsService + FeatureGuard so other modules can reuse the
 * resolver and apply `@RequireFeature(...)` on their own endpoints later.
 */
@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService, FeatureGuard],
  exports: [FeatureFlagsService, FeatureGuard],
})
export class FeatureFlagsModule {}
