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

  @Delete(':id/items/:itemId')
  removeItem(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.removeItem(companyId, id, itemId);
  }

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
