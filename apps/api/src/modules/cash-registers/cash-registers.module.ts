import { Module } from '@nestjs/common';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';

class OpenCashDto {
  @IsOptional() @IsNumber() @Min(0) openingBalance?: number;
  @IsOptional() @IsString() responsibleUserId?: string;
}

class CloseCashDto {
  @IsNumber() @Min(0) countedBalance: number;
  // Sem coluna própria no schema (ver camposFaltantes); aceito mas não persistido.
  @IsOptional() @IsString() note?: string;
  // Data/hora do fechamento. O fechamento costuma ser feito no dia SEGUINTE, e
  // gravar sempre `new Date()` registrava a data errada no relatório de caixa.
  @IsOptional() @IsDateString() closedAt?: string;
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

  async open(
    companyId: string,
    dto: OpenCashDto,
    userId: string,
    canManageAll: boolean,
  ) {
    const responsibleUserId = dto.responsibleUserId ?? userId;
    if (responsibleUserId !== userId && !canManageAll) {
      throw new ForbiddenException(
        'Você só pode abrir um caixa em seu próprio nome.',
      );
    }

    return this.prisma.client.$transaction(async (tx) => {
      // Serializa abertura/numeração por empresa: evita dois operadores criarem
      // o mesmo `number` ou furarem a regra de caixa único simultaneamente.
      // $executeRaw (NÃO $queryRaw): pg_advisory_xact_lock() retorna `void` e o
      // $queryRaw falha ao desserializar (P2010), derrubando a abertura de caixa
      // com 500 — mesmo defeito que quebrou a criação de comanda.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${`${companyId}:cash-register`}))
      `;

      const membership = await tx.userCompany.findFirst({
        where: { companyId, userId: responsibleUserId },
        select: { userId: true },
      });
      if (!membership) {
        throw new ForbiddenException(
          'O responsável escolhido não pertence a esta empresa.',
        );
      }

      const setting = await tx.setting.findUnique({
        where: {
          companyId_key: { companyId, key: 'finance.settings' },
        },
        select: { valueJson: true },
      });
      const settings =
        setting?.valueJson &&
        typeof setting.valueJson === 'object' &&
        !Array.isArray(setting.valueJson)
          ? (setting.valueJson as Record<string, unknown>)
          : {};
      const allowMultipleCash = settings.allowMultipleCash === true;

      const existing = await tx.cashRegister.findFirst({
        where: {
          companyId,
          status: 'open',
          ...(allowMultipleCash ? { responsibleUserId } : {}),
        },
        select: { id: true, number: true, responsibleUserId: true },
      });
      if (existing) {
        throw new ConflictException(
          allowMultipleCash
            ? `Este usuário já possui o caixa #${existing.number} aberto.`
            : `O caixa #${existing.number} já está aberto. Feche-o antes de abrir outro ou habilite múltiplos caixas nas configurações financeiras.`,
        );
      }

      const last = await tx.cashRegister.findFirst({
        where: { companyId },
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      return tx.cashRegister.create({
        data: {
          companyId,
          number: (last?.number ?? 0) + 1,
          openingBalance: dto.openingBalance ?? 0,
          responsibleUserId,
          status: 'open',
        },
      });
    });
  }

  async getOpen(companyId: string, userId: string, canViewAll: boolean) {
    return this.prisma.client.cashRegister.findFirst({
      where: {
        companyId,
        status: 'open',
        ...(canViewAll ? {} : { responsibleUserId: userId }),
      },
      orderBy: { openedAt: 'desc' },
    });
  }

  /** Todos os caixas abertos, com responsável, movimentos e conferência consolidada. */
  async listOpened(companyId: string, userId: string, canViewAll: boolean) {
    const regs = await this.prisma.client.cashRegister.findMany({
      where: {
        companyId,
        status: 'open',
        ...(canViewAll ? {} : { responsibleUserId: userId }),
      },
      orderBy: { number: 'desc' },
      include: OPEN_INCLUDE,
    });
    return regs.map((r) => ({ ...r, summary: this.summarize(r) }));
  }

  /** Sangria (retirada, type 'out') ou Suprimento (reforço, type 'in'). */
  async addMovement(
    companyId: string,
    id: string,
    dto: MovementDto,
    userId: string,
    canManageAll: boolean,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT "id"
        FROM "CashRegister"
        WHERE "id" = ${id} AND "companyId" = ${companyId}
        FOR UPDATE
      `;
      const reg = await tx.cashRegister.findFirst({
        where: { id, companyId },
        select: { id: true, status: true, responsibleUserId: true },
      });
      if (!reg) throw new NotFoundException('Caixa não encontrado');
      if (!canManageAll && reg.responsibleUserId !== userId) {
        throw new ForbiddenException(
          'Você só pode movimentar o seu próprio caixa.',
        );
      }
      if (reg.status !== 'open') {
        throw new ConflictException(
          'Não é possível movimentar um caixa fechado.',
        );
      }
      return tx.cashMovement.create({
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
    });
  }

  async close(
    companyId: string,
    id: string,
    dto: CloseCashDto,
    userId: string,
    canManageAll: boolean,
  ) {
    return this.prisma.client.$transaction(async (tx) => {
      // O mesmo lock é usado pelo faturamento da comanda. Depois de adquiri-lo,
      // relê todos os movimentos para que o saldo nunca seja calculado com uma
      // fotografia anterior ao último faturamento.
      await tx.$queryRaw`
        SELECT "id"
        FROM "CashRegister"
        WHERE "id" = ${id} AND "companyId" = ${companyId}
        FOR UPDATE
      `;
      const reg = await tx.cashRegister.findFirst({
        where: { id, companyId },
        include: {
          movements: {
            include: {
              paymentMethod: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!reg) throw new NotFoundException('Caixa não encontrado');
      if (!canManageAll && reg.responsibleUserId !== userId) {
        throw new ForbiddenException('Você só pode fechar o seu próprio caixa.');
      }
      if (reg.status === 'closed') {
        throw new ConflictException('Este caixa já está fechado.');
      }

      // Data do fechamento: a informada (fechamento feito no dia seguinte) ou agora.
      // Guardas: não pode ser no futuro nem antes da abertura — senão o caixa
      // fecharia "antes de existir" e a conferência por período ficaria furada.
      let closedAt = new Date();
      if (dto.closedAt) {
        const informada = new Date(dto.closedAt);
        if (Number.isNaN(informada.getTime())) {
          throw new BadRequestException('Data de fechamento inválida.');
        }
        if (informada.getTime() > Date.now() + 60_000) {
          throw new BadRequestException('A data de fechamento não pode estar no futuro.');
        }
        if (informada < reg.openedAt) {
          throw new BadRequestException(
            'A data de fechamento não pode ser anterior à abertura do caixa.',
          );
        }
        closedAt = informada;
      }

      const summary = this.summarize(reg);
      const expectedBalance = summary.saldoEmCaixa;
      const divergence = Number(dto.countedBalance) - expectedBalance;
      const updated = await tx.cashRegister.update({
        where: { id },
        data: {
          status: 'closed',
          countedBalance: dto.countedBalance,
          expectedBalance,
          divergence,
          closedByUserId: userId,
          closedAt,
        },
      });
      return { ...updated, expectedBalance, divergence };
    });
  }

  async history(
    companyId: string,
    userId: string,
    canViewAll: boolean,
    from?: string,
    to?: string,
  ) {
    let range: { gte?: Date; lt?: Date } | undefined;
    if (from || to) {
      range = {};
      if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) {
        const nextDay = new Date(`${to}T00:00:00.000Z`);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        range.lt = nextDay;
      }
    }
    const data = await this.prisma.client.cashRegister.findMany({
      where: {
        companyId,
        ...(canViewAll ? {} : { responsibleUserId: userId }),
        ...(range
          ? {
              OR: [
                { status: 'closed', closedAt: range },
                { status: 'open', openedAt: range },
              ],
            }
          : {}),
      },
      orderBy: { number: 'desc' },
      include: { responsibleUser: { select: USER_SELECT } },
    });
    return { data, page: 1, pageSize: data.length, total: data.length };
  }

  async detail(
    companyId: string,
    id: string,
    userId: string,
    canViewAll: boolean,
  ) {
    const reg = await this.prisma.client.cashRegister.findFirst({
      where: {
        id,
        companyId,
        ...(canViewAll ? {} : { responsibleUserId: userId }),
      },
      include: OPEN_INCLUDE,
    });
    if (!reg) throw new NotFoundException('Caixa não encontrado');
    return { ...reg, summary: this.summarize(reg) };
  }
}

// RBAC: caixa:operate lê e opera somente o caixa do próprio usuário;
// caixa:view_all amplia as leituras; caixa:manage amplia também as mutações.
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('cash-registers')
export class CashRegistersController {
  constructor(
    private readonly service: CashRegistersService,
    private readonly auth: AuthService,
  ) {}

  private async access(companyId: string, userId: string) {
    const { permissions } = await this.auth.permissions(userId, companyId);
    const owner = permissions.includes('*');
    return {
      canViewAll:
        owner ||
        permissions.includes('caixa:view_all') ||
        permissions.includes('caixa:manage'),
      canManageAll: owner || permissions.includes('caixa:manage'),
    };
  }

  @Post('open')
  @RequirePermission('caixa:operate', 'caixa:manage')
  async open(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: OpenCashDto,
  ) {
    const { canManageAll } = await this.access(companyId, userId);
    return this.service.open(companyId, dto, userId, canManageAll);
  }

  @Get('open')
  @RequirePermission('caixa:operate', 'caixa:view_all', 'caixa:manage')
  async getOpen(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const { canViewAll } = await this.access(companyId, userId);
    return this.service.getOpen(companyId, userId, canViewAll);
  }

  @Get('opened')
  @RequirePermission('caixa:operate', 'caixa:view_all', 'caixa:manage')
  async listOpened(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const { canViewAll } = await this.access(companyId, userId);
    return this.service.listOpened(companyId, userId, canViewAll);
  }

  @Get()
  @RequirePermission('caixa:operate', 'caixa:view_all', 'caixa:manage')
  async history(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const { canViewAll } = await this.access(companyId, userId);
    return this.service.history(companyId, userId, canViewAll, from, to);
  }

  @Get(':id')
  @RequirePermission('caixa:operate', 'caixa:view_all', 'caixa:manage')
  async detail(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    const { canViewAll } = await this.access(companyId, userId);
    return this.service.detail(companyId, id, userId, canViewAll);
  }

  @Post(':id/movements')
  @RequirePermission('caixa:operate', 'caixa:manage')
  async addMovement(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: MovementDto,
  ) {
    const { canManageAll } = await this.access(companyId, userId);
    return this.service.addMovement(
      companyId,
      id,
      dto,
      userId,
      canManageAll,
    );
  }

  @Post(':id/close')
  @RequirePermission('caixa:operate', 'caixa:manage')
  async close(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CloseCashDto,
  ) {
    const { canManageAll } = await this.access(companyId, userId);
    return this.service.close(companyId, id, dto, userId, canManageAll);
  }
}

@Module({
  // AuthModule: fornece AuthService/PermissionGuard pro @RequirePermission
  // aplicado no CashRegistersController.
  imports: [AuthModule],
  controllers: [CashRegistersController],
  providers: [CashRegistersService],
})
export class CashRegistersModule {}
