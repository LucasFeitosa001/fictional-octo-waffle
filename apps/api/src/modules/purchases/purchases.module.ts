import { Module } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: fornece AuthService/PermissionGuard pro @RequirePermission.
  imports: [AuthModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
