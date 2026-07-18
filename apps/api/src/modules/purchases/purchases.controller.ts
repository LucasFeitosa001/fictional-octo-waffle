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
   * Não existe model ImportedXml no schema. Mantemos a rota para o front tratar
   * a aba "XMLs Importados" com um estado honesto de "em breve" (204 sem dados),
   * sem inventar persistência inexistente.
   */
  @Get('xmls')
  listXmls() {
    return { data: [], available: false as const };
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
