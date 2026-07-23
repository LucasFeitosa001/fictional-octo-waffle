import { SetMetadata } from '@nestjs/common';

/** Metadata key sob a qual as permissões exigidas ficam no handler. */
export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Marca um endpoint como exigindo permissão RBAC. Combine com `PermissionGuard`:
 *
 *   @UseGuards(JwtAuthGuard, PermissionGuard)
 *   @RequirePermission('usuarios:manage')
 *   @Post('users')
 *   create(...) { ... }
 *
 * Aceita 1+ keys — a lógica é OR (basta o usuário ter UMA delas). Owner (['*'])
 * satisfaz qualquer exigência. Fail-closed: sem a permissão → 403.
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, permissions);
