import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import {
  CreateCampaignDto,
  PreviewSegmentDto,
  UpdateCampaignDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { FeatureGuard, RequireFeature } from '../feature-flags';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';

// Módulo pago: todos os endpoints de campanha exigem a feature 'messaging'.
// O FeatureGuard retorna 402 (Payment Required) se o plano da empresa não a
// inclui — é assim que "o módulo de mensagens só ativa pra quem paga".
@UseGuards(JwtAuthGuard, PermissionGuard, FeatureGuard)
@RequirePermission('marketing:view', 'marketing:manage')
@RequireFeature('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.service.list(companyId);
  }

  @Post()
  @RequirePermission('marketing:manage')
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.service.create(companyId, dto);
  }

  /** Preview how many customers a segment matches, without persisting anything. */
  @Post('preview-segment')
  @RequirePermission('marketing:manage')
  preview(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: PreviewSegmentDto,
  ) {
    return this.service.previewSegment(companyId, {
      kind: dto.kind,
      inactiveDays: dto.inactiveDays,
    });
  }

  @Get(':id')
  get(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.get(companyId, id);
  }

  @Patch(':id')
  @RequirePermission('marketing:manage')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('marketing:manage')
  remove(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(companyId, id);
  }

  /** Materializes CampaignMessage rows for the segment and enqueues sends. */
  @Post(':id/dispatch')
  @RequirePermission('marketing:manage')
  dispatch(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.dispatch(companyId, id);
  }
}
