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
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('anamnesis-templates')
export class AnamnesisTemplatesController {
  constructor(private readonly service: AnamnesisTemplatesService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string) {
    return this.service.list(companyId);
  }

  @Post()
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateAnamnesisTemplateDto,
  ) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAnamnesisTemplateDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
