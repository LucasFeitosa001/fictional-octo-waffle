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
  CreateCommissionPaymentDto,
  CreateCommissionRuleDto,
  UpdateCommissionEntryDto,
  UpdateCommissionRuleDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class CommissionsController {
  constructor(private readonly service: CommissionsService) {}

  @Get('commissions/summary')
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
  overview(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.service.overview(companyId, { from, to, professionalId });
  }

  @Get('commissions/detail')
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
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.service.listEntries(companyId, status, professionalId);
  }

  @Patch('commissions/:id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCommissionEntryDto,
  ) {
    return this.service.updateEntry(companyId, id, dto);
  }

  @Post('commission-payments')
  pay(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCommissionPaymentDto,
  ) {
    return this.service.createPayment(companyId, dto);
  }

  @Get('commission-rules')
  listRules(@CurrentUser('companyId') companyId: string) {
    return this.service.listRules(companyId);
  }

  @Post('commission-rules')
  createRule(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCommissionRuleDto,
  ) {
    return this.service.createRule(companyId, dto);
  }

  @Patch('commission-rules/:id')
  updateRule(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCommissionRuleDto,
  ) {
    return this.service.updateRule(companyId, id, dto);
  }

  @Delete('commission-rules/:id')
  removeRule(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeRule(companyId, id);
  }
}
