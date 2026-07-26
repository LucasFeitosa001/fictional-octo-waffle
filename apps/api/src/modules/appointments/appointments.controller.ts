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
import { AppointmentsService } from './appointments.service';
import {
  CreateAppointmentDto,
  CreateAppointmentSeriesDto,
  UpdateAppointmentDto,
  StatusDto,
  SuggestDto,
  BlockTimeDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { AuthService } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class AppointmentsController {
  constructor(
    private readonly service: AppointmentsService,
    private readonly auth: AuthService,
  ) {}

  private async professionalScope(companyId: string, userId: string) {
    const { permissions } = await this.auth.permissions(userId, companyId);
    if (
      permissions.includes('*') ||
      permissions.includes('agenda:view_all')
    ) {
      return undefined;
    }
    return this.service.professionalForUser(companyId, userId);
  }

  @Get('appointments')
  @RequirePermission('agenda:view', 'agenda:view_all')
  async list(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
    @Query('serviceId') serviceId?: string,
    @Query('q') q?: string,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.list(
      companyId,
      { from, to, professionalId, status, serviceId, q },
      scope,
    );
  }

  @Get('appointments/calendar')
  @RequirePermission('agenda:view', 'agenda:view_all')
  async calendar(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('month') month?: string,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.calendar(companyId, month, scope);
  }

  @Get('availability')
  @RequirePermission('agenda:view', 'agenda:view_all', 'agenda:manage')
  async availability(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Query('serviceId') serviceId: string,
    @Query('professionalId') professionalId?: string,
    @Query('date') date?: string,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.availability(
      companyId,
      serviceId,
      scope ?? professionalId,
      date,
    );
  }

  @Get('appointments/:id')
  @RequirePermission('agenda:view', 'agenda:view_all')
  async findOne(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.findOne(companyId, id, scope);
  }

  @Post('appointments')
  @RequirePermission('agenda:manage')
  async create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateAppointmentDto,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.create(companyId, dto, undefined, scope);
  }

  @Post('appointments/series')
  @RequirePermission('agenda:manage')
  async createSeries(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateAppointmentSeriesDto,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.createSeries(companyId, dto, scope);
  }

  // "Ocupar horários": cria um bloqueio de agenda (indisponibilidade) que ocupa
  // o horário do profissional sem cliente/serviços associados.
  @Post('appointments/block')
  @RequirePermission('agenda:manage')
  async block(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: BlockTimeDto,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.block(companyId, dto, scope);
  }

  @Patch('appointments/:id')
  @RequirePermission('agenda:manage')
  async update(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.update(companyId, id, dto, scope);
  }

  @Patch('appointments/:id/status')
  @RequirePermission('agenda:manage')
  async setStatus(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: StatusDto,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.setStatus(companyId, id, dto, userId, scope);
  }

  @Post('appointments/:id/suggest')
  @RequirePermission('agenda:manage')
  async suggest(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: SuggestDto,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.suggestTime(companyId, id, dto.suggestion, scope);
  }

  @Delete('appointments/:id')
  @RequirePermission('agenda:manage')
  async remove(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    const scope = await this.professionalScope(companyId, userId);
    return this.service.remove(companyId, id, scope);
  }
}
