import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { prisma } from '@beautypass/db';
import { auth } from '../auth/better-auth';

/**
 * BetterAuthGuard — valida a sessão Better Auth (cookie no web ou
 * `Authorization: Bearer <token>` no mobile/Expo) e popula `request.user` com
 * { userId, companyId, email, roleCode, professionalId } — onde `companyId` é a
 * EMPRESA ATIVA da sessão (multi-conta), não necessariamente a última do User.
 *
 * Resolução da empresa ativa (multi-conta):
 *   1. Session.activeCompanyId (empresa escolhida via /session/switch-company);
 *   2. fallback User.companyId (empresa "principal"/última usada).
 * O activeCompanyId é lido do banco (fonte de verdade), pois não faz parte dos
 * additionalFields expostos por getSession.
 *
 * Segurança multi-tenant: com o switch, o tenant ativo TEM que ser autorizado —
 * exigimos uma UserCompany { userId, companyId ativo }. Sem membership → 403.
 * (O owner sempre tem UserCompany, então o login admin nunca é bloqueado.)
 *
 * Exportado como `JwtAuthGuard` também, para os `@UseGuards(JwtAuthGuard)`
 * existentes seguirem funcionando sem edição.
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
    // O token identifica a Session; usamos para ler activeCompanyId e gravar o
    // switch de empresa. `id` é opcional no shape inferido, então caímos no token.
    const sessionToken = session.session.token;
    const sessionId = (session.session as { id?: string }).id;

    // Empresa ativa: activeCompanyId da sessão (lido do banco) ?? User.companyId.
    let activeCompanyId: string | null | undefined = user.companyId;
    const sessionRow = await prisma.session.findUnique({
      where: { token: sessionToken },
      select: { id: true, activeCompanyId: true },
    });
    if (sessionRow?.activeCompanyId) {
      activeCompanyId = sessionRow.activeCompanyId;
    }

    if (!activeCompanyId) {
      throw new UnauthorizedException('Usuário sem empresa associada');
    }

    // Valida membership na empresa ativa (fecha o buraco do switch): sem
    // UserCompany autorizada, nega. O owner sempre tem UserCompany.
    const membership = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId: user.id, companyId: activeCompanyId } },
      include: { role: { select: { code: true } } },
    });

    if (!membership) {
      throw new ForbiddenException('Sem acesso a esta empresa');
    }

    // professionalId: perfil de profissional do usuário NESTA empresa (se existir).
    const professional = await prisma.professional.findFirst({
      where: { userId: user.id, companyId: activeCompanyId, deletedAt: null },
      select: { id: true },
    });

    request.user = {
      userId: user.id,
      companyId: activeCompanyId,
      email: user.email,
      roleCode: membership.role?.code ?? null,
      professionalId: professional?.id ?? null,
    };
    request.session = session.session;
    // Guardado para o endpoint de switch-company gravar Session.activeCompanyId.
    request.sessionId = sessionRow?.id ?? sessionId ?? null;
    request.sessionToken = sessionToken;

    return true;
  }
}

// Back-compat alias so existing imports keep working.
export const JwtAuthGuard = BetterAuthGuard;
