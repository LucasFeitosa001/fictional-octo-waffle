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
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  AddItemDto,
  AddDiscountDto,
  AddPaymentDto,
  UpdateOrderDto,
  UpdateOrderItemDto,
  AddAuxiliaryDto,
  AddConsumedProductDto,
  UseBalanceDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  list(@CurrentUser('companyId') companyId: string, @Query('status') status?: string) {
    return this.service.list(companyId, status);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateOrderDto) {
    return this.service.create(companyId, dto);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AddItemDto,
  ) {
    return this.service.addItem(companyId, id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.service.updateItem(companyId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeItem(companyId, id, itemId);
  }

  // ---- auxiliaries (rateio de comissão do item de serviço) ----
  @Post(':id/items/:itemId/auxiliaries')
  addAuxiliary(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: AddAuxiliaryDto,
  ) {
    return this.service.addAuxiliary(companyId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId/auxiliaries/:auxId')
  removeAuxiliary(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('auxId') auxId: string,
  ) {
    return this.service.removeAuxiliary(companyId, id, itemId, auxId);
  }

  // ---- produtos consumidos (baixa de estoque, fora do total) ----
  @Post(':id/items/:itemId/consumed-products')
  addConsumedProduct(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: AddConsumedProductDto,
  ) {
    return this.service.addConsumedProduct(companyId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId/consumed-products/:consumedId')
  removeConsumedProduct(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Param('consumedId') consumedId: string,
  ) {
    return this.service.removeConsumedProduct(companyId, id, itemId, consumedId);
  }

  // ---- crédito / cashback ----
  @Post(':id/credit')
  applyCredit(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UseBalanceDto,
  ) {
    return this.service.applyCredit(companyId, id, dto);
  }

  @Delete(':id/credit')
  removeCredit(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.removeCredit(companyId, id);
  }

  @Post(':id/cashback')
  applyCashback(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UseBalanceDto,
  ) {
    return this.service.applyCashback(companyId, id, dto);
  }

  @Delete(':id/cashback')
  removeCashback(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.removeCashback(companyId, id);
  }

  // ---- discounts / payments ----
  @Post(':id/discounts')
  addDiscount(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AddDiscountDto,
  ) {
    return this.service.addDiscount(companyId, id, dto);
  }

  @Post(':id/payments')
  addPayment(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
  ) {
    return this.service.addPayment(companyId, id, dto);
  }

  @Post(':id/payments/:pid/reverse')
  reversePayment(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('pid') pid: string,
  ) {
    return this.service.reversePayment(companyId, id, pid);
  }

  @Post(':id/finish')
  finish(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.finish(companyId, id, userId);
  }

  @Post(':id/reopen')
  reopen(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.reopen(companyId, id, userId);
  }

  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
