import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import {
  CreateProfessionalDto,
  UpdateProfessionalDto,
  ScheduleDto,
  SetServicesDto,
  CommissionRuleDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('professionals')
export class ProfessionalsController {
  constructor(private readonly service: ProfessionalsService) {}

  @Get()
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list(companyId, Number(page) || 1, Number(pageSize) || 20);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateProfessionalDto) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }

  @Put(':id/schedules')
  setSchedules(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() schedules: ScheduleDto[],
  ) {
    return this.service.setSchedules(companyId, id, schedules);
  }

  @Put(':id/services')
  setServices(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: SetServicesDto,
  ) {
    return this.service.setServices(companyId, id, dto);
  }

  @Post(':id/commission-rules')
  addCommissionRule(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: CommissionRuleDto,
  ) {
    return this.service.addCommissionRule(companyId, id, dto);
  }
}
