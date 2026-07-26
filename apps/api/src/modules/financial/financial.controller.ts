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
  UpdateFinanceSettingsDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

// RBAC: leitura exige financeiro:view; toda mutação exige financeiro:manage.
// Owner (curinga '*') passa em tudo.
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class FinancialController {
  constructor(private readonly service: FinancialService) {}

  @Get('financial/settings')
  @RequirePermission('financeiro:view')
  settings(@CurrentUser('companyId') companyId: string) {
    return this.service.getSettings(companyId);
  }

  @Patch('financial/settings')
  @RequirePermission('financeiro:manage')
  updateSettings(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: UpdateFinanceSettingsDto,
  ) {
    return this.service.updateSettings(companyId, dto);
  }

  // ---- summary ----
  @Get('financial/summary')
  @RequirePermission('financeiro:view')
  summary(
    @CurrentUser('companyId') companyId: string,
    @Query() query: SummaryQueryDto,
  ) {
    return this.service.summary(companyId, query.from, query.to);
  }

  // ---- transactions ----
  @Get('transactions')
  @RequirePermission('financeiro:view')
  listTransactions(
    @CurrentUser('companyId') companyId: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.service.listTransactions(companyId, query);
  }

  @Post('transactions')
  @RequirePermission('financeiro:manage')
  createTransaction(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.service.createTransaction(companyId, dto);
  }

  @Post('transactions/transfer')
  @RequirePermission('financeiro:manage')
  createTransfer(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateTransferDto,
  ) {
    return this.service.createTransfer(companyId, dto);
  }

  @Post('transactions/:id/reverse')
  @RequirePermission('financeiro:manage')
  reverseTransaction(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.service.reverseTransaction(companyId, id, userId);
  }

  @Patch('transactions/:id')
  @RequirePermission('financeiro:manage')
  updateTransaction(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.service.updateTransaction(companyId, id, dto);
  }

  @Delete('transactions/:id')
  @RequirePermission('financeiro:manage')
  removeTransaction(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeTransaction(companyId, id);
  }

  // ---- financial-accounts ----
  @Get('financial-accounts')
  @RequirePermission('financeiro:view')
  listAccounts(@CurrentUser('companyId') companyId: string) {
    return this.service.listAccounts(companyId);
  }

  @Post('financial-accounts')
  @RequirePermission('financeiro:manage')
  createAccount(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateFinancialAccountDto,
  ) {
    return this.service.createAccount(companyId, dto);
  }

  @Patch('financial-accounts/:id')
  @RequirePermission('financeiro:manage')
  updateAccount(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialAccountDto,
  ) {
    return this.service.updateAccount(companyId, id, dto);
  }

  @Delete('financial-accounts/:id')
  @RequirePermission('financeiro:manage')
  removeAccount(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeAccount(companyId, id);
  }

  // ---- payment-methods ----
  @Get('payment-methods')
  @RequirePermission('financeiro:view')
  listPaymentMethods(@CurrentUser('companyId') companyId: string) {
    return this.service.listPaymentMethods(companyId);
  }

  @Post('payment-methods')
  @RequirePermission('financeiro:manage')
  createPaymentMethod(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    return this.service.createPaymentMethod(companyId, dto);
  }

  @Patch('payment-methods/:id')
  @RequirePermission('financeiro:manage')
  updatePaymentMethod(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.service.updatePaymentMethod(companyId, id, dto);
  }

  @Delete('payment-methods/:id')
  @RequirePermission('financeiro:manage')
  removePaymentMethod(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removePaymentMethod(companyId, id);
  }

  // ---- financial-categories ----
  @Get('financial-categories')
  @RequirePermission('financeiro:view')
  listCategories(@CurrentUser('companyId') companyId: string) {
    return this.service.listCategories(companyId);
  }

  @Post('financial-categories')
  @RequirePermission('financeiro:manage')
  createCategory(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: CreateFinancialCategoryDto,
  ) {
    return this.service.createCategory(companyId, dto);
  }

  @Patch('financial-categories/:id')
  @RequirePermission('financeiro:manage')
  updateCategory(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFinancialCategoryDto,
  ) {
    return this.service.updateCategory(companyId, id, dto);
  }

  @Delete('financial-categories/:id')
  @RequirePermission('financeiro:manage')
  removeCategory(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeCategory(companyId, id);
  }
}
