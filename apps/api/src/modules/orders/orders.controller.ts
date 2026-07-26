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
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { FeatureGuard, RequireFeature } from '../feature-flags';

@UseGuards(JwtAuthGuard, PermissionGuard, FeatureGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly service: OrdersService) {}

  @Get()
  @RequirePermission('comandas:view')
  list(@CurrentUser('companyId') companyId: string, @Query('status') status?: string) {
    return this.service.list(companyId, status);
  }

  @Get(':id')
  @RequirePermission('comandas:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  @RequirePermission('comandas:create')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateOrderDto) {
    return this.service.create(companyId, dto);
  }

  @Post(':id/items')
  @RequirePermission('comandas:edit')
  addItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AddItemDto,
  ) {
    return this.service.addItem(companyId, id, dto);
  }

  @Patch(':id/items/:itemId')
  @RequirePermission('comandas:edit')
  updateItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateOrderItemDto,
  ) {
    return this.service.updateItem(companyId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission('comandas:edit')
  removeItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeItem(companyId, id, itemId);
  }

  // ---- auxiliaries (rateio de comissão do item de serviço) ----
  @Post(':id/items/:itemId/auxiliaries')
  @RequirePermission('comandas:edit')
  addAuxiliary(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: AddAuxiliaryDto,
  ) {
    return this.service.addAuxiliary(companyId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId/auxiliaries/:auxId')
  @RequirePermission('comandas:edit')
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
  @RequirePermission('comandas:edit')
  addConsumedProduct(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: AddConsumedProductDto,
  ) {
    return this.service.addConsumedProduct(companyId, id, itemId, dto);
  }

  @Delete(':id/items/:itemId/consumed-products/:consumedId')
  @RequirePermission('comandas:edit')
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
  @RequirePermission('comandas:edit')
  applyCredit(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UseBalanceDto,
  ) {
    return this.service.applyCredit(companyId, id, dto);
  }

  @Delete(':id/credit')
  @RequirePermission('comandas:edit')
  removeCredit(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.removeCredit(companyId, id);
  }

  @Post(':id/cashback')
  @RequirePermission('comandas:edit')
  @RequireFeature('cashback')
  applyCashback(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UseBalanceDto,
  ) {
    return this.service.applyCashback(companyId, id, dto);
  }

  @Delete(':id/cashback')
  @RequirePermission('comandas:edit')
  @RequireFeature('cashback')
  removeCashback(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.removeCashback(companyId, id);
  }

  // ---- discounts / payments ----
  @Post(':id/discounts')
  @RequirePermission('comandas:edit')
  addDiscount(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AddDiscountDto,
  ) {
    return this.service.addDiscount(companyId, id, dto);
  }

  @Post(':id/payments')
  @RequirePermission('comandas:checkout')
  addPayment(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
  ) {
    return this.service.addPayment(companyId, id, dto);
  }

  @Post(':id/payments/:pid/reverse')
  @RequirePermission('comandas:checkout')
  reversePayment(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('pid') pid: string,
  ) {
    return this.service.reversePayment(companyId, id, pid);
  }

  @Post(':id/finish')
  @RequirePermission('comandas:checkout')
  finish(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.finish(companyId, id, userId);
  }

  @Post(':id/reopen')
  @RequirePermission('comandas:checkout')
  reopen(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.reopen(companyId, id, userId);
  }

  @Patch(':id')
  @RequirePermission('comandas:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('comandas:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
