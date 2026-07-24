import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import {
  SendWhatsappInboxMessageDto,
  UpdateAiAttendantDto,
  UpdateWhatsappConversationDto,
} from './dto';
import { WhatsappInboxService } from './whatsapp-inbox.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('whatsapp/inbox')
export class WhatsappInboxController {
  constructor(private readonly service: WhatsappInboxService) {}

  @RequirePermission('marketing:view')
  @Get('config')
  config(@CurrentUser('companyId') companyId: string) {
    return this.service.getConfig(companyId);
  }

  @RequirePermission('marketing:manage')
  @Patch('config')
  updateConfig(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateAiAttendantDto,
  ) {
    return this.service.updateConfig(companyId, dto);
  }

  @RequirePermission('marketing:view')
  @Get('stats')
  stats(@CurrentUser('companyId') companyId: string) {
    return this.service.stats(companyId);
  }

  @RequirePermission('marketing:view')
  @Get('conversations')
  conversations(
    @CurrentUser('companyId') companyId: string,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listConversations(companyId, { q, status });
  }

  @RequirePermission('marketing:view')
  @Get('conversations/:id/messages')
  messages(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.listMessages(companyId, id);
  }

  @RequirePermission('marketing:view')
  @Patch('conversations/:id')
  updateConversation(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWhatsappConversationDto,
  ) {
    return this.service.updateConversation(companyId, id, dto);
  }

  @RequirePermission('marketing:view')
  @Post('conversations/:id/messages')
  send(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: SendWhatsappInboxMessageDto,
  ) {
    return this.service.sendAgentMessage(companyId, id, dto.text);
  }
}
