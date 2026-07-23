import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { ReportRangeQueryDto } from './dto';

// Relatórios são leitura pura (GET). Cada rota exige a permissão do seu tipo:
// relatorios:operacional (agenda/estoque/mensagens) ou relatorios:financeiro
// (DRE, faturamento, recebíveis, despesas). Owner ('*') passa em tudo.
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // Panorama agrega dados operacionais e financeiros — basta ter uma das duas.
  @RequirePermission('relatorios:operacional', 'relatorios:financeiro')
  @Get('overview')
  overview(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.overview(companyId, from, to);
  }

  @RequirePermission('relatorios:financeiro')
  @Get('dre')
  dre(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.dre(companyId, from, to);
  }

  @RequirePermission('relatorios:operacional')
  @Get('inventory-suggestion')
  inventorySuggestion(@CurrentUser('companyId') companyId: string) {
    return this.service.inventorySuggestion(companyId);
  }

  @RequirePermission('relatorios:operacional')
  @Get('messages')
  messages(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.messages(companyId, from, to);
  }

  // Linhas por mensagem (detalhe do relatório de mensagens).
  @RequirePermission('relatorios:operacional')
  @Get('messages/rows')
  messagesRows(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.messagesRows(companyId, {
      from,
      to,
      status,
      kind,
      limit: Number(limit) || undefined,
      offset: Number(offset) || undefined,
    });
  }

  @RequirePermission('relatorios:operacional')
  @Get('birthdays')
  birthdays(
    @CurrentUser('companyId') companyId: string,
    @Query('month') month?: string,
  ) {
    return this.service.birthdays(companyId, month);
  }

  @RequirePermission('relatorios:financeiro')
  @Get('sales')
  sales(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.sales(companyId, from, to);
  }

  // ---------------- FINANCEIRO ----------------

  @RequirePermission('relatorios:financeiro')
  @Get('service-revenue')
  serviceRevenue(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.serviceRevenue(companyId, q.from, q.to);
  }

  @RequirePermission('relatorios:financeiro')
  @Get('product-revenue')
  productRevenue(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.productRevenue(companyId, q.from, q.to);
  }

  @RequirePermission('relatorios:financeiro')
  @Get('billing-projection')
  billingProjection(@CurrentUser('companyId') companyId: string) {
    return this.service.billingProjection(companyId);
  }

  @RequirePermission('relatorios:financeiro')
  @Get('receivables')
  receivables(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.receivables(companyId, q.from, q.to);
  }

  @RequirePermission('relatorios:financeiro')
  @Get('expenses')
  expenses(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.expenses(companyId, q.from, q.to);
  }

  // ---------------- AGENDA ----------------

  @RequirePermission('relatorios:operacional')
  @Get('appointments-deleted')
  appointmentsDeleted(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.appointmentsDeleted(companyId, q.from, q.to);
  }

  @RequirePermission('relatorios:operacional')
  @Get('appointments-origin')
  appointmentsOrigin(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.appointmentsOrigin(companyId, q.from, q.to);
  }

  @RequirePermission('relatorios:operacional')
  @Get('appointments-creation')
  appointmentsCreation(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.appointmentsCreation(companyId, q.from, q.to);
  }

  @RequirePermission('relatorios:operacional')
  @Get('care-today')
  careToday(@CurrentUser('companyId') companyId: string) {
    return this.service.careToday(companyId);
  }

  // ---------------- ESTOQUE ----------------

  @RequirePermission('relatorios:operacional')
  @Get('inventory-movements')
  inventoryMovements(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.inventoryMovements(companyId, q.from, q.to);
  }

  @RequirePermission('relatorios:operacional')
  @Get('purchases')
  purchases(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.purchases(companyId, q.from, q.to);
  }

  @RequirePermission('relatorios:operacional')
  @Get('consumed-products')
  consumedProducts(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.consumedProducts(companyId, q.from, q.to);
  }
}
