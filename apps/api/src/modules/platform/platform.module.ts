import { Module } from '@nestjs/common';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformUsersService } from './platform-users.service';
import { PlatformCompaniesService } from './platform-companies.service';
import { PlatformStaffService } from './platform-staff.service';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformUsersController } from './platform-users.controller';
import {
  PlatformCompaniesController,
  PlatformResumoController,
} from './platform-companies.controller';
import { PlatformStaffController } from './platform-staff.controller';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformGuard } from './platform.guard';

/**
 * Console de suporte da SalonPass (admin.salonpass.com.br). Ver estudo 135.
 *
 * NÃO importa o AuthModule. É a marca do desenho: nada aqui passa pelo
 * BetterAuthGuard nem pelo PermissionGuard do tenant, porque aqueles exigem uma
 * empresa ativa que um técnico da plataforma não tem (jwt-auth.guard.ts:60-73).
 * O caminho de autenticação é inteiramente próprio.
 *
 * O PlatformGuard é declarado como provider — e não como guard global — para
 * nenhuma rota de salão herdar este caminho por acidente.
 */
@Module({
  controllers: [
    PlatformAuthController,
    PlatformUsersController,
    PlatformCompaniesController,
    PlatformResumoController,
    PlatformStaffController,
    PlatformAuditController,
  ],
  providers: [
    PlatformGuard,
    PlatformAuthService,
    PlatformAuditService,
    PlatformUsersService,
    PlatformCompaniesService,
    PlatformStaffService,
  ],
})
export class PlatformModule {}
