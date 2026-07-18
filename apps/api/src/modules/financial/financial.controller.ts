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
import { FinancialService } from './financial.service';
import {
  CreateFinancialAccountDto,
  CreateFinancialCategoryDto,
  CreatePaymentMethodDto,
  CreateTransactionDto,
  CreateTransferDto,
  ListTransactionsQueryDto,
  SummaryQueryDto,
  UpdateFinancialAccountDto,
  UpdateFinancialCategoryDto,
  UpdatePaymentMethodDto,
  UpdateTransactionDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class FinancialController {
  constructor(private readonly service: FinancialService) {}

  // ---- summary ----
  @Get('financial/summary')
  summary(
    @CurrentUser('companyId') companyId: string,
    @Query() query: SummaryQueryDto,
  ) {
    return this.service.summary(companyId, query.from, query.to);
  }

  // ---- transactions ----
  @Get('transactions')
  listTransactions(
    @CurrentUser('companyId') companyId: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.service.listTransactions(companyId, query);
  }

  @Post('transactions')
  createTransaction(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.service.createTransaction(companyId, dto);
  }

  @Post('transactions/transfer')
  createTransfer(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateTransferDto,
  ) {
    return this.service.createTransfer(companyId, dto);
  }

  @Post('transactions/:id/reverse')
  reverseTransaction(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.reverseTransaction(companyId, id, userId);
  }

  @Patch('transactions/:id')
  updateTransaction(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.service.updateTransaction(companyId, id, dto);
  }

  @Delete('transactions/:id')
  removeTransaction(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeTransaction(companyId, id);
  }

  // ---- financial-accounts ----
  @Get('financial-accounts')
  listAccounts(@CurrentUser('companyId') companyId: string) {
    return this.service.listAccounts(companyId);
  }

  @Post('financial-accounts')
  createAccount(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateFinancialAccountDto,
  ) {
    return this.service.createAccount(companyId, dto);
  }

  @Patch('financial-accounts/:id')
  updateAccount(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialAccountDto,
  ) {
    return this.service.updateAccount(companyId, id, dto);
  }

  @Delete('financial-accounts/:id')
  removeAccount(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeAccount(companyId, id);
  }

  // ---- payment-methods ----
  @Get('payment-methods')
  listPaymentMethods(@CurrentUser('companyId') companyId: string) {
    return this.service.listPaymentMethods(companyId);
  }

  @Post('payment-methods')
  createPaymentMethod(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    return this.service.createPaymentMethod(companyId, dto);
  }

  @Patch('payment-methods/:id')
  updatePaymentMethod(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.service.updatePaymentMethod(companyId, id, dto);
  }

  @Delete('payment-methods/:id')
  removePaymentMethod(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removePaymentMethod(companyId, id);
  }

  // ---- financial-categories ----
  @Get('financial-categories')
  listCategories(@CurrentUser('companyId') companyId: string) {
    return this.service.listCategories(companyId);
  }

  @Post('financial-categories')
  createCategory(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateFinancialCategoryDto,
  ) {
    return this.service.createCategory(companyId, dto);
  }

  @Patch('financial-categories/:id')
  updateCategory(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialCategoryDto,
  ) {
    return this.service.updateCategory(companyId, id, dto);
  }

  @Delete('financial-categories/:id')
  removeCategory(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeCategory(companyId, id);
  }
}
