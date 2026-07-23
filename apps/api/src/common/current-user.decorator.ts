import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  userId: string;
  companyId: string;
  email: string;
  /** Código do papel do usuário na empresa ativa (owner|manager|…). null se sem papel. */
  roleCode?: string | null;
  /** Id do perfil Professional do usuário nesta empresa, se existir. */
  professionalId?: string | null;
}

/**
 * Extracts the authenticated user (set by JwtStrategy) from the request.
 * Use `@CurrentUser('companyId')` to get the tenant scope directly.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: RequestUser = request.user;
    return data ? user?.[data] : user;
  },
);
