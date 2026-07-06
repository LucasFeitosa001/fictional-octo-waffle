import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

/**
 * Sign-in / sign-up / sign-out live in Better Auth (mounted at /api/v1/auth/*):
 *   POST /api/v1/auth/sign-in/email   { email, password }
 *   POST /api/v1/auth/sign-up/email   { name, email, password }
 *   POST /api/v1/auth/sign-out
 *   GET  /api/v1/auth/get-session
 *
 * These Nest endpoints add companyId-aware data on top of the session.
 * Mounted under /api/v1/session/* to avoid colliding with the Better Auth
 * wildcard handler that owns /api/v1/auth/*.
 */
@Controller('session')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser('userId') userId: string) {
    return this.auth.me(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('permissions')
  permissions(
    @CurrentUser('userId') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.auth.permissions(userId, companyId);
  }
}
