import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth/better-auth';

/**
 * BetterAuthGuard — validates the Better Auth session from either the session
 * cookie (web) or the `Authorization: Bearer <token>` header (mobile/Expo),
 * then populates `request.user` with { userId, companyId, email }, preserving
 * the exact shape the domain controllers + CurrentUser decorator expect.
 *
 * Exported as `JwtAuthGuard` too so existing `@UseGuards(JwtAuthGuard)` usages
 * across the domain modules keep working without edits.
 */
@Injectable()
export class BetterAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session?.user) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    const user = session.user as typeof session.user & { companyId?: string | null };

    if (!user.companyId) {
      throw new UnauthorizedException('Usuário sem empresa associada');
    }

    request.user = {
      userId: user.id,
      companyId: user.companyId,
      email: user.email,
    };
    request.session = session.session;

    return true;
  }
}

// Back-compat alias so existing imports keep working.
export const JwtAuthGuard = BetterAuthGuard;
