import { Module } from '@nestjs/common';
import {
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class OpenCashDto {
  @IsOptional() @IsNumber() @Min(0) openingBalance?: number;
  @IsOptional() @IsString() responsibleUserId?: string;
}

class CloseCashDto {
  @IsNumber() @Min(0) countedBalance: number;
}

@Injectable()
export class CashRegistersService {
  constructor(private readonly prisma: PrismaService) {}

  async open(companyId: string, dto: OpenCashDto, userId?: string) {
    const last = await this.prisma.client.cashRegister.findFirst({
      where: { companyId },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    return this.prisma.client.cashRegister.create({
      data: {
        companyId,
        number: (last?.number ?? 0) + 1,
        openingBalance: dto.openingBalance ?? 0,
        responsibleUserId: dto.responsibleUserId ?? userId,
        status: 'open',
      },
    });
  }

  async getOpen(companyId: string) {
    return this.prisma.client.cashRegister.findFirst({
      where: { companyId, status: 'open' },
      orderBy: { openedAt: 'desc' },
    });
  }

  async close(companyId: string, id: string, dto: CloseCashDto) {
    const reg = await this.prisma.client.cashRegister.findFirst({ where: { id, companyId } });
    if (!reg) throw new NotFoundException('Caixa não encontrado');
    // TODO Fase 1: compute expected balance from cash_movements and compare to counted.
    return this.prisma.client.cashRegister.update({
      where: { id },
      data: { status: 'closed', countedBalance: dto.countedBalance, closedAt: new Date() },
    });
  }

  async history(companyId: string) {
    const data = await this.prisma.client.cashRegister.findMany({
      where: { companyId },
      orderBy: { number: 'desc' },
    });
    return { data, page: 1, pageSize: data.length, total: data.length };
  }

  async detail(companyId: string, id: string) {
    const reg = await this.prisma.client.cashRegister.findFirst({
      where: { id, companyId },
      include: { movements: true },
    });
    if (!reg) throw new NotFoundException('Caixa não encontrado');
    return reg;
  }
}

@UseGuards(JwtAuthGuard)
@Controller('cash-registers')
export class CashRegistersController {
  constructor(private readonly service: CashRegistersService) {}

  @Post('open')
  open(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: OpenCashDto,
  ) {
    return this.service.open(companyId, dto, userId);
  }

  @Get('open')
  getOpen(@CurrentUser('companyId') companyId: string) {
    return this.service.getOpen(companyId);
  }

  @Get()
  history(@CurrentUser('companyId') companyId: string) {
    return this.service.history(companyId);
  }

  @Get(':id')
  detail(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.detail(companyId, id);
  }

  @Post(':id/close')
  close(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: CloseCashDto,
  ) {
    return this.service.close(companyId, id, dto);
  }
}

@Module({
  controllers: [CashRegistersController],
  providers: [CashRegistersService],
})
export class CashRegistersModule {}
