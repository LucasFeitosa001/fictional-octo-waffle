import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PERMISSION_CATALOG,
  GRANULAR_PERMISSION_KEYS,
  ROLE_DEFAULT_GRANULAR,
  expandGranularPermissions,
} from '../../common/permission-catalog';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string, activeCompanyId?: string | null) {
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.toPublicUser({
      ...user,
      companyId: activeCompanyId ?? user.companyId,
    });
  }

  /**
   * Resolve as permissões efetivas do usuário na empresa informada.
   *   - owner (roleCode 'owner') → ['*'] (curinga: concede tudo, sem materializar linhas).
   *   - SE UserCompany.permissions (granulares) tiver itens → UNIÃO das próprias
   *     chaves granulares + as coarse expandidas via GRANULAR_TO_ENFORCED (para os
   *     guards). Se contiver 'admin:full' → ['*'].
   *   - senão (permissions vazio) → keys das RolePermission do papel (legado).
   *   - papel sem permissões / sem papel → [] (fail-closed).
   * O admin de teste é owner, então continua com acesso total.
   */
  async permissions(userId: string, companyId: string): Promise<{ permissions: string[] }> {
    const uc = await this.prisma.client.userCompany.findFirst({
      where: { userId, companyId },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
      },
    });

    // owner recebe curinga; independe de granulares.
    if (uc?.role?.code === 'owner') return { permissions: ['*'] };

    // Funcionário com permissões granulares customizadas: sobrescreve o papel.
    const granular = uc?.permissions ?? [];
    if (granular.length > 0) {
      return { permissions: expandGranularPermissions(granular) };
    }

    // Sem customização → herda do papel (comportamento legado).
    const keys = uc?.role?.rolePermissions.map((rp) => rp.permission.key) ?? [];
    return { permissions: keys };
  }

  /** Catálogo granular (categorias/itens/labels/modificadores) para o front. */
  getPermissionCatalog() {
    return { categories: PERMISSION_CATALOG };
  }

  /**
   * Permissões GRANULARES efetivas de um funcionário na empresa ativa, para
   * pré-carregar o editor. Se o funcionário já tem um set customizado
   * (UserCompany.permissions não-vazio), retorna-o. Caso contrário, deriva um
   * default a partir do papel (ROLE_DEFAULT_GRANULAR); se nem papel houver,
   * retorna [].
   * Retorna também `roleCode` e `customized` (se o set é próprio ou derivado).
   */
  async userPermissions(companyId: string, userId: string) {
    const uc = await this.prisma.client.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: { role: { select: { code: true } } },
    });
    if (!uc) throw new NotFoundException('Usuário não pertence a esta empresa');

    const roleCode = uc.role?.code ?? null;
    const own = uc.permissions ?? [];
    if (own.length > 0) {
      return { permissions: own, roleCode, customized: true };
    }
    const derived = roleCode ? (ROLE_DEFAULT_GRANULAR[roleCode] ?? []) : [];
    return { permissions: derived, roleCode, customized: false };
  }

  /**
   * Salva as permissões GRANULARES do funcionário na empresa ativa
   * (UserCompany.permissions). Valida que o usuário é membro e que TODAS as
   * chaves existem no catálogo. Set vazio volta o funcionário ao papel (legado).
   */
  async setUserPermissions(companyId: string, userId: string, permissions: string[]) {
    const uc = await this.prisma.client.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { id: true, role: { select: { code: true } } },
    });
    if (!uc) throw new NotFoundException('Usuário não pertence a esta empresa');

    // Deduplica e valida contra o catálogo.
    const unique = [...new Set(permissions)];
    const invalid = unique.filter((k) => !GRANULAR_PERMISSION_KEYS.has(k));
    if (invalid.length > 0) {
      throw new BadRequestException(`Permissões inválidas: ${invalid.join(', ')}`);
    }

    await this.prisma.client.userCompany.update({
      where: { id: uc.id },
      data: { permissions: unique },
    });

    return { permissions: unique, roleCode: uc.role?.code ?? null, customized: unique.length > 0 };
  }

  /**
   * Lista as empresas às quais o usuário pertence (multi-conta), marcando qual é
   * a ativa (empresa passada como `activeCompanyId`).
   */
  async companies(userId: string, activeCompanyId: string) {
    const rows = await this.prisma.client.userCompany.findMany({
      where: { userId },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        role: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      data: rows.map((uc) => ({
        company: uc.company,
        role: uc.role ? { code: uc.role.code, name: uc.role.name } : null,
        active: uc.companyId === activeCompanyId,
      })),
    };
  }

  /**
   * Alterna a empresa ativa da sessão. Valida membership antes de gravar
   * Session.activeCompanyId; também atualiza User.companyId como "última usada".
   * Lança 403 se o usuário não for membro da empresa alvo.
   */
  async switchCompany(userId: string, sessionId: string | null, companyId: string) {
    if (!sessionId) {
      throw new UnauthorizedException(
        'Sessão ativa não encontrada; entre novamente antes de trocar de empresa.',
      );
    }
    const membership = await this.prisma.client.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        role: { select: { code: true, name: true } },
      },
    });
    if (!membership) throw new ForbiddenException('Sem acesso a esta empresa');

    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: { activeCompanyId: companyId },
    });
    // "Última usada" — assim um novo login já cai na empresa correta.
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { companyId },
    });

    return {
      company: membership.company,
      role: membership.role ? { code: membership.role.code, name: membership.role.name } : null,
    };
  }

  /** Papéis da empresa ativa (para telas de gestão de usuários/permissões). */
  async roles(companyId: string) {
    const rows = await this.prisma.client.role.findMany({
      where: { companyId },
      select: { id: true, code: true, name: true, isSystem: true },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
    return { data: rows };
  }

  private toPublicUser(user: {
    id: string;
    companyId: string | null;
    name: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    image: string | null;
    provider: string;
  }) {
    return {
      id: user.id,
      companyId: user.companyId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl ?? user.image,
      provider: user.provider,
    };
  }
}
