import { Module } from '@nestjs/common';
import { Controller, Get, Injectable, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /dashboard?from&to — vendas, agendamentos, comandas (stub aggregation).
  async overview(companyId: string, from?: string, to?: string) {
    const range = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
    const hasRange = Boolean(from || to);

    const [appointments, orders, finishedOrders] = await Promise.all([
      this.prisma.client.appointment.count({
        where: { companyId, ...(hasRange ? { start: range } : {}) },
      }),
      this.prisma.client.order.count({
        where: { companyId, ...(hasRange ? { date: range } : {}) },
      }),
      this.prisma.client.order.findMany({
        where: { companyId, status: 'finished', ...(hasRange ? { date: range } : {}) },
        select: { netTotal: true },
      }),
    ]);

    const salesTotal = finishedOrders.reduce((acc, o) => acc + Number(o.netTotal), 0);

    // TODO Fase 1: comparativo período anterior, gráficos por dia, recebimentos por forma.
    return {
      period: { from: from ?? null, to: to ?? null },
      salesTotal,
      appointments,
      orders,
      finishedOrders: finishedOrders.length,
    };
  }
}

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  overview(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.overview(companyId, from, to);
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
