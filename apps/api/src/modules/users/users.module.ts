import { Module } from '@nestjs/common';
import {
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
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

class CreateUserDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() roleId?: string;
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

// IDs de tema válidos — espelha THEMES em apps/web/src/theme/theme.ts. Persistido
// por-usuário (User.themePreference) para sincronizar o tema entre dispositivos.
// null → o cliente aplica o default 'salonpass'.
const THEME_IDS = ['salonpass', 'belasis'] as const;

class ThemePrefDto {
  @IsString()
  @IsIn(THEME_IDS as unknown as string[])
  theme: string;
}

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
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.client.user.create({
      data: {
        companyId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        userCompanies: { create: { companyId, roleId: dto.roleId } },
      },
      select: { id: true, name: true, email: true, phone: true, active: true },
    });
    return user;
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
      data: { themePreference: dto.theme },
      select: { themePreference: true },
    });
    return { theme: row.themePreference };
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

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  @RequirePermission('usuarios:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateUserDto) {
    return this.service.create(companyId, dto);
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
