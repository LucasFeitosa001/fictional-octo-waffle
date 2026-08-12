import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { SalonPayService } from './salonpay.service';
import { UpsertSalonPayAccountDto } from './dto';

/**
 * SalonPay — cadastro de recebimento da empresa.
 *
 * Dado financeiro/cadastral do negócio: exige permissão de financeiro, não de
 * comissões. Quem opera comissão não precisa ver CNPJ e faturamento do salão.
 */
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('salonpay')
export class SalonPayController {
  constructor(private readonly service: SalonPayService) {}

  @Get('account')
  @RequirePermission('financeiro:view', 'financeiro:manage')
  get(@CurrentUser('companyId') companyId: string) {
    return this.service.get(companyId);
  }

  /** Quem pode receber pelo SalonPay — e quem está sem chave PIX. */
  @Get('recipients')
  @RequirePermission('comissoes:view_all', 'financeiro:view', 'financeiro:manage')
  recipients(@CurrentUser('companyId') companyId: string) {
    return this.service.recipients(companyId);
  }

  /** A tela "Transferências" do SalonPay. */
  @Get('transfers')
  @RequirePermission('financeiro:view', 'financeiro:manage')
  transfers(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.service.transfers(companyId, { from, to, status });
  }

  @Put('account')
  @RequirePermission('financeiro:manage')
  upsert(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpsertSalonPayAccountDto,
  ) {
    return this.service.upsert(companyId, dto);
  }
}
