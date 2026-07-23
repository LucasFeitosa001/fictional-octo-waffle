/**
 * Barrel de conveniência do RBAC (guards + decorators) para importar tudo de um
 * lugar só nos módulos de gestão:
 *
 *   import { JwtAuthGuard, PermissionGuard, RequirePermission } from '../../common/rbac';
 */
export { BetterAuthGuard, JwtAuthGuard } from './jwt-auth.guard';
export { PermissionGuard } from './permission.guard';
export { RequirePermission, REQUIRE_PERMISSION_KEY } from './require-permission.decorator';
export { CurrentUser } from './current-user.decorator';
export type { RequestUser } from './current-user.decorator';
