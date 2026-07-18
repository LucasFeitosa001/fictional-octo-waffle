import { Module } from '@nestjs/common';
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

class OpenCashDto {
  @IsOptional() @IsNumber() @Min(0) openingBalance?: number;
  @IsOptional() @IsString() responsibleUserId?: string;
}

class CloseCashDto {
  @IsNumber() @Min(0) countedBalance: number;
  // Sem coluna própria no schema (ver camposFaltantes); aceito mas não persistido.
  @IsOptional() @IsString() note?: string;
}

class MovementDto {
  @IsIn(['in', 'out']) type: 'in' | 'out';
  @IsNumber() @Min(0) amount: number;
  @IsOptional() @IsString() paymentMethodId?: string;
  // 'sangria' | 'suprimento' | 'payment' — tag da movimentação (usa campo refType existente).
  @IsOptional() @IsString() refType?: string;
  @IsOptional() @IsString() refId?: string;
  @IsOptional() @IsString() description?: string;
}

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
  image: true,
} as const;

const OPEN_INCLUDE = {
  responsibleUser: { select: USER_SELECT },
  movements: {
    include: { paymentMethod: { select: { id: true, name: true } } },
    orderBy: { at: 'desc' as const },
  },
} as const;

@Injectable()
export class CashRegistersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consolida os movimentos de um caixa nos totais que a tela de conferência
   * (Belasis "Conferência de caixa") mostra. Só usa campos existentes do schema.
   */
  private summarize(reg: any) {
    const opening = Number(reg.openingBalance ?? 0);
    const byMethod: Record<string, number> = {};
    let dinheiro = 0;
    let credito = 0;
    let pix = 0;
    let outros = 0;
    let suprimentos = 0;
    let sangrias = 0;
    let totalIn = 0;
    let totalOut = 0;

    for (const m of reg.movements ?? []) {
      const amt = Number(m.amount ?? 0);
      if (m.type === 'in') totalIn += amt;
      else totalOut += amt;

      if (m.refType === 'suprimento') {
        suprimentos += amt;
        continue;
      }
      if (m.refType === 'sangria') {
        sangrias += amt;
        continue;
      }

      // Lançamento de pagamento (recebimento em caixa).
      const name: string = m.paymentMethod?.name ?? 'Outros';
      byMethod[name] = (byMethod[name] ?? 0) + (m.type === 'in' ? amt : -amt);
      const norm = name.toLowerCase();
      if (norm.includes('dinheiro')) dinheiro += m.type === 'in' ? amt : -amt;
      else if (norm.includes('pix')) pix += m.type === 'in' ? amt : -amt;
      else if (norm.includes('créd') || norm.includes('cred'))
        credito += m.type === 'in' ? amt : -amt;
      else outros += m.type === 'in' ? amt : -amt;
    }

    const net = totalIn - totalOut;
    return {
      openingBalance: opening,
      dinheiro,
      credito,
      pix,
      outros,
      byMethod: Object.entries(byMethod).map(([name, total]) => ({ name, total })),
      suprimentos,
      sangrias,
      movements: net,
      saldoEmCaixa: opening + net,
      totalPago: dinheiro + credito + pix + outros,
    };
  }

  async open(companyId: string, dto: OpenCashDto, userId?: string) {
    const responsibleUserId = dto.responsibleUserId ?? userId;
    // Regra: um usuário não abre 2 caixas simultâneos.
    if (responsibleUserId) {
      const existing = await this.prisma.client.cashRegister.findFirst({
        where: { companyId, status: 'open', responsibleUserId },
        select: { id: true, number: true },
      });
      if (existing) {
        throw new ConflictException(
          `Este usuário já possui o caixa #${existing.number} aberto.`,
        );
      }
    }
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
        responsibleUserId,
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

  /** Todos os caixas abertos, com responsável, movimentos e conferência consolidada. */
  async listOpened(companyId: string) {
    const regs = await this.prisma.client.cashRegister.findMany({
      where: { companyId, status: 'open' },
      orderBy: { number: 'desc' },
      include: OPEN_INCLUDE,
    });
    return regs.map((r) => ({ ...r, summary: this.summarize(r) }));
  }

  /** Sangria (retirada, type 'out') ou Suprimento (reforço, type 'in'). */
  async addMovement(companyId: string, id: string, dto: MovementDto) {
    const reg = await this.prisma.client.cashRegister.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!reg) throw new NotFoundException('Caixa não encontrado');
    if (reg.status !== 'open')
      throw new ConflictException('Não é possível movimentar um caixa fechado.');
    return this.prisma.client.cashMovement.create({
      data: {
        cashRegisterId: id,
        type: dto.type,
        amount: dto.amount,
        paymentMethodId: dto.paymentMethodId,
        refType: dto.refType,
        refId: dto.refId,
        description: dto.description,
      },
    });
  }

  async close(companyId: string, id: string, dto: CloseCashDto, userId?: string) {
    const reg = await this.prisma.client.cashRegister.findFirst({
      where: { id, companyId },
      include: { movements: true },
    });
    if (!reg) throw new NotFoundException('Caixa não encontrado');
    if (reg.status === 'closed')
      throw new ConflictException('Este caixa já está fechado.');
    // Saldo esperado a partir dos movimentos; divergência = conferido − esperado.
    const summary = this.summarize(reg);
    const expectedBalance = summary.saldoEmCaixa;
    const divergence = Number(dto.countedBalance) - expectedBalance;
    const updated = await this.prisma.client.cashRegister.update({
      where: { id },
      data: {
        status: 'closed',
        countedBalance: dto.countedBalance,
        // Conferência persistida: saldo esperado, divergência e quem fechou.
        expectedBalance,
        divergence,
        ...(userId ? { closedByUserId: userId } : {}),
        closedAt: new Date(),
      },
    });
    return { ...updated, expectedBalance, divergence };
  }

  async history(companyId: string, from?: string, to?: string) {
    let openedAt: { gte?: Date; lte?: Date } | undefined;
    if (from || to) {
      openedAt = {};
      if (from) openedAt.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        openedAt.lte = end;
      }
    }
    const data = await this.prisma.client.cashRegister.findMany({
      where: { companyId, ...(openedAt ? { openedAt } : {}) },
      orderBy: { number: 'desc' },
      include: { responsibleUser: { select: USER_SELECT } },
    });
    return { data, page: 1, pageSize: data.length, total: data.length };
  }

  async detail(companyId: string, id: string) {
    const reg = await this.prisma.client.cashRegister.findFirst({
      where: { id, companyId },
      include: OPEN_INCLUDE,
    });
    if (!reg) throw new NotFoundException('Caixa não encontrado');
    return { ...reg, summary: this.summarize(reg) };
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

  @Get('opened')
  listOpened(@CurrentUser('companyId') companyId: string) {
    return this.service.listOpened(companyId);
  }

  @Get()
  history(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.history(companyId, from, to);
  }

  @Get(':id')
  detail(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.detail(companyId, id);
  }

  @Post(':id/movements')
  addMovement(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: MovementDto,
  ) {
    return this.service.addMovement(companyId, id, dto);
  }

  @Post(':id/close')
  close(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CloseCashDto,
  ) {
    return this.service.close(companyId, id, dto, userId);
  }
}

@Module({
  controllers: [CashRegistersController],
  providers: [CashRegistersService],
})
export class CashRegistersModule {}
