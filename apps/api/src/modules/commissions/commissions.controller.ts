import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import {
  BulkCommissionPaymentDto,
  CreateCommissionAdvanceDto,
  CreateCommissionPaymentDto,
  CreateCommissionRuleDto,
  DeleteCommissionPaymentDto,
  UpdateCommissionEntryDto,
  UpdateCommissionRuleDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

// RBAC: leitura exige comissoes:view_all; ajustar/pagar lançamentos exige
// comissoes:close; regras (config) exigem comissoes:config. Owner ('*') passa.
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class CommissionsController {
  constructor(private readonly service: CommissionsService) {}

  @Get('commissions/summary')
  @RequirePermission('comissoes:view_all')
  summary(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.summary(companyId, { from, to, professionalId, status });
  }

  @Get('commissions/overview')
  @RequirePermission('comissoes:view_all')
  overview(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.service.overview(companyId, { from, to, professionalId });
  }

  @Get('commissions/detail')
  @RequirePermission('comissoes:view_all')
  detail(
    @CurrentUser('companyId') companyId: string,
    @Query('professionalId') professionalId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.detail(companyId, professionalId, { from, to, status });
  }

  @Get('commissions')
  @RequirePermission('comissoes:view_all')
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.service.listEntries(companyId, status, professionalId);
  }

  @Patch('commissions/:id')
  @RequirePermission('comissoes:close')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCommissionEntryDto,
  ) {
    return this.service.updateEntry(companyId, id, dto);
  }

  @Post('commission-payments')
  @RequirePermission('comissoes:close')
  pay(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateCommissionPaymentDto,
  ) {
    return this.service.createPayment(companyId, dto, userId);
  }

  @Post('commission-payments/bulk')
  @RequirePermission('comissoes:close')
  payBulk(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: BulkCommissionPaymentDto,
  ) {
    return this.service.payBulk(companyId, dto, userId);
  }

  @Get('commission-payments')
  @RequirePermission('comissoes:view_all')
  listPayments(
    @CurrentUser('companyId') companyId: string,
    @Query('professionalId') professionalId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.listPayments(companyId, { professionalId, from, to });
  }

  @Delete('commission-payments/:id')
  @RequirePermission('comissoes:close')
  deletePayment(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: DeleteCommissionPaymentDto,
  ) {
    return this.service.deletePayment(companyId, id, dto.justification, userId);
  }

  // ---- Vales (adiantamentos) ----
  @Post('commission-advances')
  @RequirePermission('comissoes:close')
  createAdvance(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCommissionAdvanceDto,
  ) {
    return this.service.createAdvance(companyId, dto);
  }

  @Get('commission-advances')
  @RequirePermission('comissoes:view_all')
  listAdvances(
    @CurrentUser('companyId') companyId: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listAdvances(companyId, { professionalId, status });
  }

  @Delete('commission-advances/:id')
  @RequirePermission('comissoes:close')
  deleteAdvance(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.deleteAdvance(companyId, id);
  }

  @Get('commission-rules')
  @RequirePermission('comissoes:view_all', 'comissoes:config')
  listRules(@CurrentUser('companyId') companyId: string) {
    return this.service.listRules(companyId);
  }

  @Post('commission-rules')
  @RequirePermission('comissoes:config')
  createRule(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCommissionRuleDto,
  ) {
    return this.service.createRule(companyId, dto);
  }

  @Patch('commission-rules/:id')
  @RequirePermission('comissoes:config')
  updateRule(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCommissionRuleDto,
  ) {
    return this.service.updateRule(companyId, id, dto);
  }

  @Delete('commission-rules/:id')
  @RequirePermission('comissoes:config')
  removeRule(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeRule(companyId, id);
  }
}
