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
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

// RBAC: serviços e suas categorias fazem parte do catálogo.
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  // ---- service-categories ----
  @Get('service-categories')
  @RequirePermission('catalogo:view')
  listCategories(@CurrentUser('companyId') companyId: string) {
    return this.service.listCategories(companyId);
  }

  @Post('service-categories')
  @RequirePermission('catalogo:manage')
  createCategory(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateServiceCategoryDto,
  ) {
    return this.service.createCategory(companyId, dto);
  }

  // ---- services ----
  @Get('services')
  @RequirePermission('catalogo:view')
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.service.list(companyId, categoryId);
  }

  @Get('services/:id')
  @RequirePermission('catalogo:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post('services')
  @RequirePermission('catalogo:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateServiceDto) {
    return this.service.create(companyId, dto);
  }

  @Patch('services/:id')
  @RequirePermission('catalogo:manage')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete('services/:id')
  @RequirePermission('catalogo:manage')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
