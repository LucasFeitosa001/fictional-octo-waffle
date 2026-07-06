import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.toPublicUser(user);
  }

  async permissions(userId: string, companyId: string) {
    // Resolve role -> permissions. Stub returns admin-all when no role is set.
    const uc = await this.prisma.client.userCompany.findFirst({
      where: { userId, companyId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    const keys = uc?.role?.rolePermissions.map((rp) => rp.permission.key) ?? ['*'];
    return { permissions: keys };
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
