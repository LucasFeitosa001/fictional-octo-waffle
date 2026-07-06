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
  CreateCustomerPackageDto,
  CreatePackageTemplateDto,
  UpdatePackageTemplateDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class PackagesController {
  constructor(private readonly service: PackagesService) {}

  // ---- templates ----
  @Get('package-templates')
  listTemplates(@CurrentUser('companyId') companyId: string) {
    return this.service.listTemplates(companyId);
  }

  @Post('package-templates')
  createTemplate(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreatePackageTemplateDto,
  ) {
    return this.service.createTemplate(companyId, dto);
  }

  @Patch('package-templates/:id')
  updateTemplate(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePackageTemplateDto,
  ) {
    return this.service.updateTemplate(companyId, id, dto);
  }

  @Delete('package-templates/:id')
  removeTemplate(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeTemplate(companyId, id);
  }

  // ---- customer packages ----
  @Get('customer-packages')
  listCustomerPackages(
    @CurrentUser('companyId') companyId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
  ) {
    return this.service.listCustomerPackages(companyId, status, customerId);
  }

  @Get('customer-packages/:id')
  findCustomerPackage(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.findCustomerPackage(companyId, id);
  }

  @Post('customer-packages')
  createCustomerPackage(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateCustomerPackageDto,
  ) {
    return this.service.createCustomerPackage(companyId, dto);
  }

  @Delete('customer-packages/:id')
  removeCustomerPackage(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeCustomerPackage(companyId, id);
  }
}
