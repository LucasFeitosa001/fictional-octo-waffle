import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

/**
 * Auth module. Sign-in / sign-up / sign-out are handled by Better Auth
 * (mounted in main.ts at /api/v1/auth/*). This module only exposes the
 * companyId-aware convenience endpoints (/auth/me, /auth/permissions) that
 * read from the validated Better Auth session via BetterAuthGuard.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
