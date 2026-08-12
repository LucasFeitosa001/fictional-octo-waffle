import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { FeatureGuard, RequireFeature } from '../feature-flags';
import { AuthService } from '../auth/auth.service';

// RBAC: leitura exige comissoes:view_all; ajustar/pagar lançamentos exige
// comissoes:close; regras (config) exigem comissoes:config. Owner ('*') passa.
@UseGuards(JwtAuthGuard, PermissionGuard, FeatureGuard)
@RequireFeature('commissions')
@Controller()
export class CommissionsController {
  constructor(
    private readonly service: CommissionsService,
    private readonly auth: AuthService,
  ) {}

  private async readableProfessionalId(
    companyId: string,
    userId: string,
    requested?: string,
  ): Promise<string | undefined> {
    const { permissions } = await this.auth.permissions(userId, companyId);
    if (
      permissions.includes('*') ||
      permissions.includes('comissoes:view_all')
    ) {
      return requested;
    }

    const ownId = await this.service.ownProfessionalId(companyId, userId);
    if (requested && requested !== ownId) {
      throw new ForbiddenException(
        'Você só pode consultar as próprias comissões.',
      );
    }
    return ownId;
  }

  @Get('commissions/summary')
  @RequirePermission('comissoes:view_own', 'comissoes:view_all')
  async summary(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
  ) {
    const scopedId = await this.readableProfessionalId(
      companyId,
      userId,
      professionalId,
    );
    return this.service.summary(companyId, {
      from,
      to,
      professionalId: scopedId,
      status,
    });
  }

  @Get('commissions/overview')
  @RequirePermission('comissoes:view_own', 'comissoes:view_all')
  async overview(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    const scopedId = await this.readableProfessionalId(
      companyId,
      userId,
      professionalId,
    );
    return this.service.overview(companyId, {
      from,
      to,
      professionalId: scopedId,
    });
  }

  @Get('commissions/detail')
  @RequirePermission('comissoes:view_own', 'comissoes:view_all')
  async detail(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('professionalId') professionalId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    const scopedId = await this.readableProfessionalId(
      companyId,
      userId,
      professionalId,
    );
    return this.service.detail(companyId, scopedId!, { from, to, status });
  }

  @Get('commissions')
  @RequirePermission('comissoes:view_own', 'comissoes:view_all')
  async list(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('status') status?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    const scopedId = await this.readableProfessionalId(
      companyId,
      userId,
      professionalId,
    );
    return this.service.listEntries(companyId, status, scopedId);
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
  @RequirePermission('comissoes:view_own', 'comissoes:view_all')
  async listPayments(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('professionalId') professionalId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const scopedId = await this.readableProfessionalId(
      companyId,
      userId,
      professionalId,
    );
    return this.service.listPayments(companyId, {
      professionalId: scopedId,
      from,
      to,
    });
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
  @RequirePermission('comissoes:view_own', 'comissoes:view_all')
  async listAdvances(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
  ) {
    const scopedId = await this.readableProfessionalId(
      companyId,
      userId,
      professionalId,
    );
    return this.service.listAdvances(companyId, {
      professionalId: scopedId,
      status,
    });
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
