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
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto, UpdatePurchaseDto } from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

// RBAC: compras alimentam o estoque. Leitura usa catalogo:view; entradas/edições
// de compra (que mexem no estoque) exigem estoque:manage.
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly service: PurchasesService) {}

  @Get()
  @RequirePermission('catalogo:view')
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('search') search?: string,
  ) {
    return this.service.list(companyId, search);
  }

  /**
   * Aba "XMLs Importados": lista os ImportedXml reais da empresa (Onda 7).
   * Fica antes de :id para não ser capturada pela rota de detalhe.
   */
  @Get('xmls')
  @RequirePermission('catalogo:view')
  listXmls(@CurrentUser('companyId') companyId: string) {
    return this.service.listXmls(companyId);
  }

  @Get(':id')
  @RequirePermission('catalogo:view')
  findOne(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  @RequirePermission('estoque:manage')
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  @RequirePermission('estoque:manage')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('estoque:manage')
  remove(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(companyId, id);
  }
}
