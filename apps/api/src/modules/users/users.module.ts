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
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
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
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.service.list(companyId);
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
