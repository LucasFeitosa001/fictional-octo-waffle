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
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly service: PurchasesService) {}

  @Get()
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
  listXmls(@CurrentUser('companyId') companyId: string) {
    return this.service.listXmls(companyId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  create(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(companyId, id);
  }
}
