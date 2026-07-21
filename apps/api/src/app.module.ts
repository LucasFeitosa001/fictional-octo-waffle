import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ProfessionalsModule } from './modules/professionals/professionals.module';
import { ServicesModule } from './modules/services/services.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { PublicBookingModule } from './modules/public-booking/public-booking.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CashRegistersModule } from './modules/cash-registers/cash-registers.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { FinancialModule } from './modules/financial/financial.module';
import { ProductsModule } from './modules/products/products.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { PackagesModule } from './modules/packages/packages.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { ReportsModule } from './modules/reports/reports.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { GoalsModule } from './modules/goals/goals.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { HelpModule } from './modules/help/help.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CompaniesModule,
    UsersModule,
    CustomersModule,
    ProfessionalsModule,
    ServicesModule,
    AppointmentsModule,
    PublicBookingModule,
    OrdersModule,
    CashRegistersModule,
    DashboardModule,
    FinancialModule,
    ProductsModule,
    SuppliersModule,
    PurchasesModule,
    CommissionsModule,
    PackagesModule,
    MembershipsModule,
    ReportsModule,
    MarketingModule,
    GoalsModule,
    UploadsModule,
    WhatsappModule,
    HelpModule,
  ],
})
export class AppModule {}
