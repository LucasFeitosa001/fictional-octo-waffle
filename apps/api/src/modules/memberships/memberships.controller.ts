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
import { MembershipsService } from './memberships.service';
import {
  CreateCustomerMembershipDto,
  CreateMembershipPlanDto,
  UpdateCustomerMembershipDto,
  UpdateMembershipPlanDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { FeatureGuard, RequireFeature } from '../feature-flags';

@UseGuards(JwtAuthGuard, PermissionGuard, FeatureGuard)
@RequireFeature('memberships')
@Controller()
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  // ---- plans ----
  @Get('membership-plans')
  @RequirePermission('catalogo:view', 'catalogo:manage')
  listPlans(@CurrentUser('companyId') companyId: string) {
    return this.service.listPlans(companyId);
  }

  @Post('membership-plans')
  @RequirePermission('catalogo:manage')
  createPlan(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateMembershipPlanDto,
  ) {
    return this.service.createPlan(companyId, dto);
  }

  @Patch('membership-plans/:id')
  @RequirePermission('catalogo:manage')
  updatePlan(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMembershipPlanDto,
  ) {
    return this.service.updatePlan(companyId, id, dto);
  }

  @Delete('membership-plans/:id')
  @RequirePermission('catalogo:manage')
  removePlan(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removePlan(companyId, id);
  }

  // ---- customer memberships ----
  @Get('customer-memberships')
  @RequirePermission('catalogo:view', 'catalogo:manage')
  listCustomerMemberships(
    @CurrentUser('companyId') companyId: string,
    @Query('status') status?: string,
  ) {
    return this.service.listCustomerMemberships(companyId, status);
  }

  @Post('customer-memberships')
  @RequirePermission('catalogo:manage')
  createCustomerMembership(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCustomerMembershipDto,
  ) {
    return this.service.createCustomerMembership(companyId, dto);
  }

  @Patch('customer-memberships/:id')
  @RequirePermission('catalogo:manage')
  updateCustomerMembership(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerMembershipDto,
  ) {
    return this.service.updateCustomerMembership(companyId, id, dto);
  }
}
