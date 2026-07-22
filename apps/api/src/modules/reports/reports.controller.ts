import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ReportRangeQueryDto } from './dto';

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('overview')
  overview(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.overview(companyId, from, to);
  }

  @Get('dre')
  dre(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.dre(companyId, from, to);
  }

  @Get('inventory-suggestion')
  inventorySuggestion(@CurrentUser('companyId') companyId: string) {
    return this.service.inventorySuggestion(companyId);
  }

  @Get('messages')
  messages(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.messages(companyId, from, to);
  }

  @Get('birthdays')
  birthdays(
    @CurrentUser('companyId') companyId: string,
    @Query('month') month?: string,
  ) {
    return this.service.birthdays(companyId, month);
  }

  @Get('sales')
  sales(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.sales(companyId, from, to);
  }

  // ---------------- FINANCEIRO ----------------

  @Get('service-revenue')
  serviceRevenue(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.serviceRevenue(companyId, q.from, q.to);
  }

  @Get('product-revenue')
  productRevenue(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.productRevenue(companyId, q.from, q.to);
  }

  @Get('billing-projection')
  billingProjection(@CurrentUser('companyId') companyId: string) {
    return this.service.billingProjection(companyId);
  }

  @Get('receivables')
  receivables(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.receivables(companyId, q.from, q.to);
  }

  @Get('expenses')
  expenses(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.expenses(companyId, q.from, q.to);
  }

  // ---------------- AGENDA ----------------

  @Get('appointments-deleted')
  appointmentsDeleted(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.appointmentsDeleted(companyId, q.from, q.to);
  }

  @Get('appointments-origin')
  appointmentsOrigin(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.appointmentsOrigin(companyId, q.from, q.to);
  }

  @Get('appointments-creation')
  appointmentsCreation(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.appointmentsCreation(companyId, q.from, q.to);
  }

  @Get('care-today')
  careToday(@CurrentUser('companyId') companyId: string) {
    return this.service.careToday(companyId);
  }

  // ---------------- ESTOQUE ----------------

  @Get('inventory-movements')
  inventoryMovements(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.inventoryMovements(companyId, q.from, q.to);
  }

  @Get('purchases')
  purchases(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.purchases(companyId, q.from, q.to);
  }

  @Get('consumed-products')
  consumedProducts(
    @CurrentUser('companyId') companyId: string,
    @Query() q: ReportRangeQueryDto,
  ) {
    return this.service.consumedProducts(companyId, q.from, q.to);
  }
}
