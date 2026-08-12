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
import { PackagesService } from './packages.service';
import {
  ConsumePackageItemDto,
  CreateCustomerPackageDto,
  CreatePackageTemplateDto,
  UpdatePackageTemplateDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { FeatureGuard, RequireFeature } from '../feature-flags';

// RBAC: pacotes (templates e pacotes de cliente) fazem parte do catálogo.
@UseGuards(JwtAuthGuard, PermissionGuard, FeatureGuard)
@RequireFeature('packages')
@Controller()
export class PackagesController {
  constructor(private readonly service: PackagesService) {}

  // ---- templates ----
  @Get('package-templates')
  @RequirePermission('catalogo:view')
  listTemplates(@CurrentUser('companyId') companyId: string) {
    return this.service.listTemplates(companyId);
  }

  @Post('package-templates')
  @RequirePermission('catalogo:manage')
  createTemplate(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreatePackageTemplateDto,
  ) {
    return this.service.createTemplate(companyId, dto);
  }

  @Patch('package-templates/:id')
  @RequirePermission('catalogo:manage')
  updateTemplate(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePackageTemplateDto,
  ) {
    return this.service.updateTemplate(companyId, id, dto);
  }

  @Delete('package-templates/:id')
  @RequirePermission('catalogo:manage')
  removeTemplate(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeTemplate(companyId, id);
  }

  // ---- customer packages ----
  @Get('customer-packages')
  @RequirePermission('catalogo:view')
  listCustomerPackages(
    @CurrentUser('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.service.listCustomerPackages(companyId, status, customerId);
  }

  @Get('customer-packages/:id')
  @RequirePermission('catalogo:view')
  findCustomerPackage(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.findCustomerPackage(companyId, id);
  }

  @Post('customer-packages')
  @RequirePermission('catalogo:manage')
  createCustomerPackage(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCustomerPackageDto,
  ) {
    return this.service.createCustomerPackage(companyId, dto);
  }

  @Post('customer-packages/:id/items/:itemId/consume')
  @RequirePermission('catalogo:manage')
  consumePackageItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: ConsumePackageItemDto,
  ) {
    return this.service.consumePackageItem(companyId, id, itemId, dto);
  }

  @Delete('customer-packages/:id/usages/:usageId')
  @RequirePermission('catalogo:manage')
  removePackageUsage(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('usageId') usageId: string,
  ) {
    return this.service.removePackageUsage(companyId, id, usageId);
  }

  @Delete('customer-packages/:id')
  @RequirePermission('catalogo:manage')
  removeCustomerPackage(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeCustomerPackage(companyId, id);
  }
}
