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
import { CustomersService } from './customers.service';
import {
  AdjustCashbackDto,
  CreateCustomerAnamnesisDto,
  CreateCustomerDebtDto,
  CreateCustomerDebtPaymentDto,
  CreateCustomerDto,
  CreateCustomerFileDto,
  CreateCustomerNoteDto,
  RedeemCashbackDto,
  UpdateCustomerAnamnesisDto,
  UpdateCustomerDto,
} from './dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list(companyId, search, Number(page) || 1, Number(pageSize) || 20);
  }

  @Get(':id')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Get(':id/panel')
  panel(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.panel(companyId, id);
  }

  @Get(':id/debts')
  listDebts(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.listDebts(companyId, id);
  }

  @Post(':id/debts')
  createDebt(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: CreateCustomerDebtDto,
  ) {
    return this.service.createDebt(companyId, id, dto);
  }

  @Post(':id/debts/:debtId/payments')
  addDebtPayment(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('debtId') debtId: string,
    @Body() dto: CreateCustomerDebtPaymentDto,
  ) {
    return this.service.addDebtPayment(companyId, id, debtId, dto);
  }

  @Get(':id/balance')
  balance(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.balance(companyId, id);
  }

  @Get(':id/credits')
  listCredits(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.listCredits(companyId, id);
  }

  @Get(':id/cashback')
  listCashback(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.listCashback(companyId, id);
  }

  @Post(':id/cashback/redeem')
  redeemCashback(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: RedeemCashbackDto,
  ) {
    return this.service.redeemCashback(companyId, id, dto);
  }

  @Post(':id/cashback/adjust')
  adjustCashback(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: AdjustCashbackDto,
  ) {
    return this.service.adjustCashback(companyId, id, dto);
  }

  @Get(':id/appointments')
  listAppointments(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.listAppointments(companyId, id);
  }

  @Get(':id/orders')
  listOrders(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.listOrders(companyId, id);
  }

  @Get(':id/packages')
  listPackages(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.listPackages(companyId, id);
  }

  @Get(':id/notes')
  listNotes(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.listNotes(companyId, id);
  }

  @Post(':id/notes')
  createNote(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateCustomerNoteDto,
  ) {
    return this.service.createNote(companyId, id, userId, dto);
  }

  @Get(':id/files')
  listFiles(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.listFiles(companyId, id);
  }

  @Post(':id/files')
  addFile(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: CreateCustomerFileDto,
  ) {
    return this.service.addFile(companyId, id, dto);
  }

  @Delete(':id/files/:fileId')
  removeFile(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.service.removeFile(companyId, id, fileId);
  }

  @Get(':id/anamneses')
  listAnamneses(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.service.listAnamneses(companyId, id);
  }

  @Post(':id/anamneses')
  createAnamnesis(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: CreateCustomerAnamnesisDto,
  ) {
    return this.service.createAnamnesis(companyId, id, dto);
  }

  @Patch(':id/anamneses/:anamId')
  updateAnamnesis(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('anamId') anamId: string,
    @Body() dto: UpdateCustomerAnamnesisDto,
  ) {
    return this.service.updateAnamnesis(companyId, id, anamId, dto);
  }

  @Delete(':id/anamneses/:anamId')
  removeAnamnesis(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Param('anamId') anamId: string,
  ) {
    return this.service.removeAnamnesis(companyId, id, anamId);
  }

  @Post()
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateCustomerDto) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }
}
