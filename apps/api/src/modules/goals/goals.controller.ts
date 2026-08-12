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
import { GoalsService } from './goals.service';
import { CreateGoalDto, UpdateGoalDto } from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { FeatureGuard, RequireFeature } from '../feature-flags';

@UseGuards(JwtAuthGuard, PermissionGuard, FeatureGuard)
@RequireFeature('goals')
@Controller('goals')
export class GoalsController {
  constructor(private readonly service: GoalsService) {}

  @Get()
  @RequirePermission('relatorios:operacional')
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('period') period?: string,
  ) {
    return this.service.list(companyId, period);
  }

  @Post()
  @RequirePermission('relatorios:operacional')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateGoalDto) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  @RequirePermission('relatorios:operacional')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('relatorios:operacional')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
