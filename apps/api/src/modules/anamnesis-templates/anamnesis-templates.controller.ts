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
import { AnamnesisTemplatesService } from './anamnesis-templates.service';
import { CreateAnamnesisTemplateDto, UpdateAnamnesisTemplateDto } from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('anamnesis-templates')
export class AnamnesisTemplatesController {
  constructor(private readonly service: AnamnesisTemplatesService) {}

  @Get()
  @RequirePermission('anamneses:manage')
  list(@CurrentUser('companyId') companyId: string) {
    return this.service.list(companyId);
  }

  @Post()
  @RequirePermission('anamneses:manage')
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateAnamnesisTemplateDto,
  ) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  @RequirePermission('anamneses:manage')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAnamnesisTemplateDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('anamneses:manage')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
