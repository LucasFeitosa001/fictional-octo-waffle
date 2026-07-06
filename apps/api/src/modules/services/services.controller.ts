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
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto, CreateServiceCategoryDto } from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  // ---- service-categories ----
  @Get('service-categories')
  listCategories(@CurrentUser('companyId') companyId: string) {
    return this.service.listCategories(companyId);
  }

  @Post('service-categories')
  createCategory(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateServiceCategoryDto,
  ) {
    return this.service.createCategory(companyId, dto);
  }

  // ---- services ----
  @Get('services')
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.service.list(companyId, categoryId);
  }

  @Get('services/:id')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post('services')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateServiceDto) {
    return this.service.create(companyId, dto);
  }

  @Patch('services/:id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete('services/:id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
