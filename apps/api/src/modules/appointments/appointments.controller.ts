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
import { CreateAppointmentDto, UpdateAppointmentDto, StatusDto, SuggestDto } from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get('appointments')
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('professionalId') professionalId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list(companyId, { from, to, professionalId, status });
  }

  @Get('appointments/calendar')
  calendar(@CurrentUser('companyId') companyId: string, @Query('month') month?: string) {
    return this.service.calendar(companyId, month);
  }

  @Get('availability')
  availability(
    @CurrentUser('companyId') companyId: string,
    @Query('serviceId') serviceId: string,
    @Query('professionalId') professionalId?: string,
    @Query('date') date?: string,
  ) {
    return this.service.availability(companyId, serviceId, professionalId, date);
  }

  @Get('appointments/:id')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post('appointments')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateAppointmentDto) {
    return this.service.create(companyId, dto);
  }

  @Patch('appointments/:id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Patch('appointments/:id/status')
  setStatus(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: StatusDto,
  ) {
    return this.service.setStatus(companyId, id, dto, userId);
  }

  @Post('appointments/:id/suggest')
  suggest(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: SuggestDto,
  ) {
    return this.service.suggestTime(companyId, id, dto.suggestion);
  }

  @Delete('appointments/:id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
