import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class CreateUserDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() roleId?: string;
}

// Perfil → Notificações: canais que a conta aceita receber. Persistido no User
// (colunas booleanas), separado das preferências de Cliente (que ficam em
// Customer.whatsappOptIn/smsOptIn) porque isso é sobre o operador do salão.
class NotificationPrefsDto {
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() sms?: boolean;
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
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

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

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateUserDto) {
    return this.service.create(companyId, dto);
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
