import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

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
}
