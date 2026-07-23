import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController, RolesController, PermissionsController } from './auth.controller';
import { PermissionGuard } from '../../common/permission.guard';

/**
 * Auth module. Sign-in / sign-up / sign-out are handled by Better Auth
 * (mounted in main.ts at /api/v1/auth/*). This module only exposes the
 * companyId-aware convenience endpoints (/session/*, /roles) that read from the
 * validated Better Auth session via BetterAuthGuard.
 *
 * Exporta AuthService + PermissionGuard para os módulos de gestão (users,
 * professionals) aplicarem @UseGuards(JwtAuthGuard, PermissionGuard).
 */
@Module({
  controllers: [AuthController, RolesController, PermissionsController],
  providers: [AuthService, PermissionGuard],
  exports: [AuthService, PermissionGuard],
})
export class AuthModule {}
