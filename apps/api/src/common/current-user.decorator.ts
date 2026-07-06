import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface RequestUser {
  userId: string;
  companyId: string;
  email: string;
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
