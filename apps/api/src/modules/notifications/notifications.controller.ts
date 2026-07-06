import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listForCompany(companyId, {
      unreadOnly: unread === '1' || unread === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser('companyId') companyId: string) {
    return this.service.unreadCount(companyId);
  }

  @Post(':id/read')
  markRead(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.markRead(companyId, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser('companyId') companyId: string) {
    return this.service.markAllRead(companyId);
  }
}
