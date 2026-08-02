import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

class SwitchCompanyDto {
  @IsString() companyId: string;
}

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
  me(
    @CurrentUser('userId') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.auth.me(userId, companyId);
  }

  // Permissões da EMPRESA ATIVA (companyId já reflete a empresa ativa da sessão).
  @UseGuards(JwtAuthGuard)
  @Get('permissions')
  permissions(
    @CurrentUser('userId') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.auth.permissions(userId, companyId);
  }

  // Empresas do usuário (multi-conta), marcando a ativa.
  @UseGuards(JwtAuthGuard)
  @Get('companies')
  companies(
    @CurrentUser('userId') userId: string,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.auth.companies(userId, companyId);
  }

  // Alterna a empresa ativa da sessão. Valida membership; 403 se não for membro.
  @UseGuards(JwtAuthGuard)
  @Post('switch-company')
  @HttpCode(200)
  switchCompany(
    @CurrentUser('userId') userId: string,
    @Body() dto: SwitchCompanyDto,
    @Req() req: { sessionId?: string | null },
  ) {
    return this.auth.switchCompany(userId, req.sessionId ?? null, dto.companyId);
  }
}

/**
 * Papéis da empresa ativa (para telas de gestão de usuários/permissões).
 * Montado em /api/v1/roles. Protegido: exige gestão de papéis/usuários.
 */
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @RequirePermission('papeis:manage', 'usuarios:manage')
  list(@CurrentUser('companyId') companyId: string) {
    return this.auth.roles(companyId);
  }
}

/**
 * Catálogo de permissões GRANULARES (estilo Belasis) para a UI renderizar o
 * editor de permissões por funcionário. Montado em /api/v1/permissions/catalog.
 * Protegido: exige gestão de usuários ou de equipe.
 */
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly auth: AuthService) {}

  @Get('catalog')
  @RequirePermission('usuarios:manage', 'equipe:manage')
  catalog() {
    return this.auth.getPermissionCatalog();
  }
}
