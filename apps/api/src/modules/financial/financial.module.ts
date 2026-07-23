import { Module } from '@nestjs/common';
import { FinancialService } from './financial.service';
import { FinancialController } from './financial.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: fornece AuthService/PermissionGuard pro @RequirePermission
  // aplicado no FinancialController (espelha professionals/users).
  imports: [AuthModule],
  controllers: [FinancialController],
  providers: [FinancialService],
})
export class FinancialModule {}
