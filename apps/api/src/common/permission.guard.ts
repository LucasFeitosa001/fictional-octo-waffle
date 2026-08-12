import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../modules/auth/auth.service';
import { REQUIRE_PERMISSION_KEY } from './require-permission.decorator';

/**
 * Guard que aplica `@RequirePermission('...')`. Lê as keys exigidas do handler,
 * resolve as permissões efetivas do usuário na empresa ativa (via AuthService),
 * e permite se o usuário tiver PELO MENOS UMA das keys (OR) OU o curinga '*'
 * (owner). Fail-closed: sem permissão → 403.
 *
 * Deve rodar DEPOIS do auth guard, para `request.user` estar populado:
 *   @UseGuards(JwtAuthGuard, PermissionGuard)
 *
 * O módulo que usa este guard precisa importar o AuthModule (que exporta
 * AuthService) — espelha como o FeatureGuard depende do FeatureFlagsService.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sem @RequirePermission no handler → nada a exigir.
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    const companyId: string | undefined = request.user?.companyId;

    if (!userId || !companyId) {
      throw new ForbiddenException('Usuário não identificado na requisição');
    }

    // Cache por-requisição: se o guard rodar mais de uma vez no mesmo request,
    // reaproveita a resolução (evita idas extras ao banco).
    let keys: string[] | undefined = request.__permissionKeys;
    if (!keys) {
      const { permissions } = await this.auth.permissions(userId, companyId);
      keys = permissions;
      request.__permissionKeys = keys;
    }

    // Owner (curinga) satisfaz tudo; senão, basta ter UMA das keys exigidas (OR).
    if (keys.includes('*')) return true;
    if (required.some((k) => keys!.includes(k))) return true;

    throw new ForbiddenException('Você não tem permissão para esta ação');
  }
}
