import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { Prisma } from '@beautypass/db';
import { seedCompanyRoles } from '@beautypass/db/rbac';
import { PrismaService } from '../../prisma/prisma.service';
import { auth } from '../../auth/better-auth';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

class CreateUserDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsBoolean() generatePassword?: boolean;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() roleId?: string;
}

class CreateProfessionalAccessDto {
  @IsEmail() email: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsOptional() @IsBoolean() generatePassword?: boolean;
  @IsOptional() @IsString() roleId?: string;
}

export function generateTemporaryPassword(length = 14): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%';
  const all = `${lower}${upper}${digits}${symbols}`;
  const chars = [
    lower[randomInt(lower.length)],
    upper[randomInt(upper.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapWith = randomInt(index + 1);
    [chars[index], chars[swapWith]] = [chars[swapWith], chars[index]];
  }
  return chars.join('');
}

// Atribui/troca o papel do usuário na empresa ativa.
class AssignRoleDto {
  @IsString() roleId: string;
}

// Permissões GRANULARES do funcionário na empresa ativa (chaves do catálogo).
// A validação de existência das chaves é feita no AuthService (contra o catálogo).
class SetPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

// Perfil → Notificações: canais que a conta aceita receber. Persistido no User
// (colunas booleanas), separado das preferências de Cliente (que ficam em
// Customer.whatsappOptIn/smsOptIn) porque isso é sobre o operador do salão.
class NotificationPrefsDto {
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() sms?: boolean;
}

// IDs oferecidos em Configurações → Personalizar. Esta lista precisa espelhar
// apps/web/src/theme/theme.ts; antes a UI oferecia sete opções, mas a API
// aceitava apenas duas e descartava silenciosamente as demais com HTTP 400.
const THEME_IDS = [
  'salonpass',
  'belasis',
  'esmeralda',
  'blush',
  'violeta',
  'grafite',
  'coral',
] as const;
const BUTTON_RADIUS_IDS = ['rounded', 'medium', 'square'] as const;
const SIDEBAR_STYLE_IDS = ['solid', 'floating'] as const;
const CLOSE_STYLE_IDS = ['label', 'round', 'icon'] as const;

class ThemePrefDto {
  @IsString()
  @IsIn(THEME_IDS as unknown as string[])
  theme: string;
}

class AppearancePrefDto {
  @IsOptional()
  @IsString()
  @IsIn(THEME_IDS as unknown as string[])
  theme?: string;

  @IsOptional()
  @IsString()
  @IsIn(BUTTON_RADIUS_IDS as unknown as string[])
  buttonRadius?: string;

  @IsOptional()
  @IsString()
  @IsIn(SIDEBAR_STYLE_IDS as unknown as string[])
  sidebarStyle?: string;

  @IsOptional()
  @IsString()
  @IsIn(CLOSE_STYLE_IDS as unknown as string[])
  closeStyle?: string;

  @IsOptional()
  @IsBoolean()
  crmShortcut?: boolean;
}

type AppearancePreferences = {
  theme?: string;
  buttonRadius?: string;
  sidebarStyle?: string;
  closeStyle?: string;
  crmShortcut?: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string) {
    const data = await this.prisma.client.user.findMany({
      where: { companyId },
      select: { id: true, name: true, email: true, phone: true, active: true, provider: true },
      orderBy: { name: 'asc' },
    });
    return { data, page: 1, pageSize: data.length, total: data.length };
  }

  async create(companyId: string, dto: CreateUserDto) {
    return this.createCredentialAccess(companyId, {
      name: dto.name,
      email: dto.email,
      password: dto.password,
      generatePassword: dto.generatePassword,
      phone: dto.phone,
      roleId: dto.roleId,
    });
  }

  async createProfessionalAccess(
    companyId: string,
    professionalId: string,
    dto: CreateProfessionalAccessDto,
  ) {
    const professional =
      await this.prisma.client.professional.findFirst({
        where: {
          id: professionalId,
          companyId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          phone: true,
          userId: true,
        },
      });
    if (!professional) {
      throw new NotFoundException('Profissional não encontrado');
    }
    if (professional.userId) {
      throw new BadRequestException('Este profissional já tem acesso vinculado');
    }
    return this.createCredentialAccess(companyId, {
      name: professional.name,
      email: dto.email,
      password: dto.password,
      generatePassword: dto.generatePassword,
      phone: professional.phone ?? undefined,
      roleId: dto.roleId,
      professionalId,
    });
  }

  /**
   * Cria uma credencial REAL do Better Auth e só então move o usuário para a
   * empresa ativa. Gravar apenas User.passwordHash não funciona: o login por
   * e-mail lê Account(providerId=credential). A senha temporária, quando
   * gerada, só volta nesta resposta e nunca é persistida em texto puro.
   */
  private async createCredentialAccess(
    companyId: string,
    input: {
      name: string;
      email: string;
      password?: string;
      generatePassword?: boolean;
      phone?: string;
      roleId?: string;
      professionalId?: string;
    },
  ) {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2) throw new BadRequestException('Informe o nome');

    const generated = !input.password && input.generatePassword === true;
    const password = input.password || (generated ? generateTemporaryPassword() : '');
    if (password.length < 8) {
      throw new BadRequestException(
        'Informe uma senha com pelo menos 8 caracteres ou escolha gerar uma senha',
      );
    }

    const existing = await this.prisma.client.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Já existe uma conta com este e-mail');
    }

    let roleId = input.roleId;
    if (roleId) {
      const role = await this.prisma.client.role.findFirst({
        where: { id: roleId, companyId },
        select: { id: true },
      });
      if (!role) {
        throw new BadRequestException('Papel não pertence a esta empresa');
      }
    } else {
      const seeded = await seedCompanyRoles(this.prisma.client, companyId);
      roleId = seeded.roleIdByCode.professional;
    }

    const signUp = await auth.api.signUpEmail({
      body: {
        name,
        email,
        password,
        accountType: 'staff',
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
      },
    });
    const userId = signUp.user.id;
    const provisioned = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    const throwawayCompanyId =
      provisioned?.companyId && provisioned.companyId !== companyId
        ? provisioned.companyId
        : null;

    try {
      await this.prisma.client.$transaction(async (tx) => {
        await tx.userCompany.deleteMany({ where: { userId } });
        await tx.user.update({
          where: { id: userId },
          data: {
            companyId,
            phone: input.phone?.trim() || null,
            accountType: 'staff',
          },
        });
        await tx.userCompany.create({
          data: { userId, companyId, roleId },
        });
        // signUpEmail também cria uma sessão para o chamador. Como foi o gestor
        // — não o novo funcionário — quem criou a conta, esse token não deve
        // permanecer ativo. O primeiro login legítimo cria a própria sessão.
        await tx.session.deleteMany({ where: { userId } });
        if (input.professionalId) {
          // O hook de signup cria um Professional "Proprietário(a)" na empresa
          // temporária. Professional.userId é unique, então removemos esse
          // perfil descartável antes de vincular o perfil real do salão.
          if (throwawayCompanyId) {
            await tx.professional.deleteMany({
              where: { companyId: throwawayCompanyId, userId },
            });
          }
          const linked = await tx.professional.updateMany({
            where: {
              id: input.professionalId,
              companyId,
              userId: null,
            },
            data: { userId },
          });
          if (linked.count !== 1) {
            throw new BadRequestException(
              'O profissional já recebeu outro acesso',
            );
          }
          // Qualquer link anterior deixa de ser válido assim que o acesso é
          // criado diretamente pelo gestor.
          await tx.professionalInvite.updateMany({
            where: {
              companyId,
              professionalId: input.professionalId,
              status: 'pending',
            },
            data: { status: 'accepted', email },
          });
        }
        if (throwawayCompanyId) {
          await tx.company.delete({ where: { id: throwawayCompanyId } });
        }
      });
    } catch (error) {
      // O signUp ocorre antes da transação porque é o Better Auth que cria a
      // Account credential. Se o vínculo falhar, remove o provisionamento
      // temporário para o mesmo e-mail poder ser tentado novamente.
      if (throwawayCompanyId) {
        await this.prisma.client.company
          .delete({ where: { id: throwawayCompanyId } })
          .catch(() => undefined);
      } else {
        await this.prisma.client.user
          .delete({ where: { id: userId } })
          .catch(() => undefined);
      }
      throw error;
    }

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        active: true,
      },
    });
    return {
      ...user,
      professionalId: input.professionalId ?? null,
      temporaryPassword: generated ? password : undefined,
    };
  }

  findOne(companyId: string, id: string) {
    return this.prisma.client.user.findFirst({
      where: { id, companyId },
      select: { id: true, name: true, email: true, phone: true, active: true, provider: true },
    });
  }

  // Atribui/troca o papel do usuário NESTA empresa. Valida que o papel pertence à
  // empresa e que o usuário é membro dela (via UserCompany).
  async assignRole(companyId: string, userId: string, roleId: string) {
    const role = await this.prisma.client.role.findFirst({
      where: { id: roleId, companyId },
      select: { id: true },
    });
    if (!role) throw new NotFoundException('Papel não encontrado nesta empresa');

    const membership = await this.prisma.client.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      select: { id: true },
    });
    if (!membership) throw new NotFoundException('Usuário não pertence a esta empresa');

    await this.prisma.client.userCompany.update({
      where: { id: membership.id },
      data: { roleId },
    });
    return { userId, roleId };
  }

  async getNotificationPrefs(userId: string) {
    const row = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { notifyEmail: true, notifySms: true },
    });
    return { email: row?.notifyEmail ?? true, sms: row?.notifySms ?? false };
  }

  async updateNotificationPrefs(userId: string, dto: NotificationPrefsDto) {
    const data: { notifyEmail?: boolean; notifySms?: boolean } = {};
    if (dto.email !== undefined) data.notifyEmail = dto.email;
    if (dto.sms !== undefined) data.notifySms = dto.sms;
    const row = await this.prisma.client.user.update({
      where: { id: userId },
      data,
      select: { notifyEmail: true, notifySms: true },
    });
    return { email: row.notifyEmail, sms: row.notifySms };
  }

  async getTheme(userId: string) {
    const row = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { themePreference: true },
    });
    return { theme: row?.themePreference ?? null };
  }

  async updateTheme(userId: string, dto: ThemePrefDto) {
    const row = await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        themePreference: dto.theme,
        appearancePreferences: {
          ...(await this.getStoredAppearance(userId)),
          theme: dto.theme,
        } as Prisma.InputJsonValue,
      },
      select: { themePreference: true },
    });
    return { theme: row.themePreference };
  }

  private async getStoredAppearance(userId: string): Promise<AppearancePreferences> {
    const row = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { appearancePreferences: true },
    });
    const stored = row?.appearancePreferences;
    return stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as AppearancePreferences)
      : {};
  }

  async getAppearance(userId: string) {
    const row = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { appearancePreferences: true, themePreference: true },
    });
    const stored =
      row?.appearancePreferences &&
      typeof row.appearancePreferences === 'object' &&
      !Array.isArray(row.appearancePreferences)
        ? (row.appearancePreferences as AppearancePreferences)
        : {};
    // A coluna antiga continua sendo fallback para contas que já tinham tema
    // salvo antes da preferência unificada existir.
    return {
      ...stored,
      theme: stored.theme ?? row?.themePreference ?? null,
    };
  }

  async updateAppearance(userId: string, dto: AppearancePrefDto) {
    const current = await this.getStoredAppearance(userId);
    const merged: AppearancePreferences = {
      ...current,
      ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
      ...(dto.buttonRadius !== undefined ? { buttonRadius: dto.buttonRadius } : {}),
      ...(dto.sidebarStyle !== undefined ? { sidebarStyle: dto.sidebarStyle } : {}),
      ...(dto.closeStyle !== undefined ? { closeStyle: dto.closeStyle } : {}),
      ...(dto.crmShortcut !== undefined ? { crmShortcut: dto.crmShortcut } : {}),
    };
    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        appearancePreferences: merged as Prisma.InputJsonValue,
        ...(dto.theme !== undefined ? { themePreference: dto.theme } : {}),
      },
    });
    return merged;
  }
}

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly service: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.service.list(companyId);
  }

  // Notification prefs are scoped to the caller (`me`). Declared BEFORE the
  // `:id` routes so Nest doesn't match "me" as an id and hit findOne.
  @Get('me/notification-prefs')
  getMyNotificationPrefs(@CurrentUser('userId') userId: string) {
    return this.service.getNotificationPrefs(userId);
  }

  @Post('me/notification-prefs')
  updateMyNotificationPrefs(
    @CurrentUser('userId') userId: string,
    @Body() dto: NotificationPrefsDto,
  ) {
    return this.service.updateNotificationPrefs(userId, dto);
  }

  // Theme preference is scoped to the caller (`me`). Declared BEFORE the `:id`
  // routes so Nest doesn't match "me" as an id and hit findOne.
  @Get('me/theme')
  getMyTheme(@CurrentUser('userId') userId: string) {
    return this.service.getTheme(userId);
  }

  @Post('me/theme')
  @HttpCode(200)
  updateMyTheme(@CurrentUser('userId') userId: string, @Body() dto: ThemePrefDto) {
    return this.service.updateTheme(userId, dto);
  }

  // Preferências visuais completas por usuário. Mantidas antes de `:id` para
  // "me" nunca ser interpretado como identificador de outro usuário.
  @Get('me/appearance')
  getMyAppearance(@CurrentUser('userId') userId: string) {
    return this.service.getAppearance(userId);
  }

  @Post('me/appearance')
  @HttpCode(200)
  updateMyAppearance(
    @CurrentUser('userId') userId: string,
    @Body() dto: AppearancePrefDto,
  ) {
    return this.service.updateAppearance(userId, dto);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  @RequirePermission('usuarios:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateUserDto) {
    return this.service.create(companyId, dto);
  }

  @Post('professional/:professionalId')
  @RequirePermission('usuarios:manage', 'equipe:manage')
  createProfessionalAccess(
    @CurrentUser('companyId') companyId: string,
    @Param('professionalId') professionalId: string,
    @Body() dto: CreateProfessionalAccessDto,
  ) {
    return this.service.createProfessionalAccess(
      companyId,
      professionalId,
      dto,
    );
  }

  // Atribui/troca o papel do usuário na empresa ativa.
  @Patch(':id/role')
  @RequirePermission('usuarios:manage')
  assignRole(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.service.assignRole(companyId, id, dto.roleId);
  }

  // Permissões GRANULARES efetivas do funcionário (para pré-carregar o editor).
  // Se não tem set customizado, deriva um default a partir do papel.
  @Get(':id/permissions')
  @RequirePermission('usuarios:manage', 'equipe:manage')
  getPermissions(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.auth.userPermissions(companyId, id);
  }

  // Salva as permissões GRANULARES do funcionário na empresa ativa. Valida contra
  // o catálogo. Set vazio → funcionário volta a herdar do papel.
  @Put(':id/permissions')
  @HttpCode(200)
  @RequirePermission('usuarios:manage', 'equipe:manage')
  setPermissions(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: SetPermissionsDto,
  ) {
    return this.auth.setUserPermissions(companyId, id, dto.permissions);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
