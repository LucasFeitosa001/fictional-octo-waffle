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
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class MembershipsController {
  constructor(private readonly service: MembershipsService) {}

  // ---- plans ----
  @Get('membership-plans')
  listPlans(@CurrentUser('companyId') companyId: string) {
    return this.service.listPlans(companyId);
  }

  @Post('membership-plans')
  createPlan(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateMembershipPlanDto,
  ) {
    return this.service.createPlan(companyId, dto);
  }

  @Patch('membership-plans/:id')
  updatePlan(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMembershipPlanDto,
  ) {
    return this.service.updatePlan(companyId, id, dto);
  }

  @Delete('membership-plans/:id')
  removePlan(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removePlan(companyId, id);
  }

  // ---- customer memberships ----
  @Get('customer-memberships')
  listCustomerMemberships(
    @CurrentUser('companyId') companyId: string,
    @Query('status') status?: string,
  ) {
    return this.service.listCustomerMemberships(companyId, status);
  }

  @Post('customer-memberships')
  createCustomerMembership(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCustomerMembershipDto,
  ) {
    return this.service.createCustomerMembership(companyId, dto);
  }

  @Patch('customer-memberships/:id')
  updateCustomerMembership(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerMembershipDto,
  ) {
    return this.service.updateCustomerMembership(companyId, id, dto);
  }
}
