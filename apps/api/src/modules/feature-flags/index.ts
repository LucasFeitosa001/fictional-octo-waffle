export { FeatureFlagsModule } from './feature-flags.module';
export { FeatureFlagsService } from './feature-flags.service';
export type { FeaturesResponse } from './feature-flags.service';
export { FeatureGuard } from './feature.guard';
export { RequireFeature, REQUIRE_FEATURE_KEY } from './require-feature.decorator';
export {
  FEATURE_KEYS,
  PLAN_NAMES,
  PLAN_FEATURES,
  PLAN_PRICE,
  PLAN_META,
  FEATURE_META,
  ALL_FEATURES,
  getPlanCatalog,
} from './feature-catalog';
export type { FeatureKey, PlanName, PlanCatalogEntry } from './feature-catalog';
