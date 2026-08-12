import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FEATURE_KEY } from './require-feature.decorator';
import type { FeatureKey } from './feature-catalog';
import { FeatureFlagsService } from './feature-flags.service';

/**
 * Guard that enforces `@RequireFeature('...')`. Reads the required feature from
 * handler metadata, resolves the logged-in company's effective features, and
 * blocks the request when the feature is not active.
 *
 * Must run AFTER the auth guard so `request.user.companyId` is populated, e.g.:
 *   @UseGuards(JwtAuthGuard, FeatureGuard)
 *
 * Blocks with 402 Payment Required (the tenant *is* authenticated and allowed,
 * they just need to upgrade). Missing company scope → 403.
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<FeatureKey | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequireFeature on this route → nothing to enforce.
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const companyId: string | undefined = request.user?.companyId;

    if (!companyId) {
      throw new ForbiddenException('Empresa não identificada na requisição');
    }

    const active = await this.featureFlags.getActiveFeatures(companyId);
    if (active.includes(required)) return true;

    throw new HttpException(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Payment Required',
        message: `O recurso "${required}" faz parte de um plano superior.`,
        feature: required,
        code: 'feature_not_included',
      },
      HttpStatus.PAYMENT_REQUIRED, // 402
    );
  }
}
