import { Module } from '@nestjs/common';
import { ServicesService } from './services.service';
import { ServicesController } from './services.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: fornece AuthService/PermissionGuard pro @RequirePermission.
  imports: [AuthModule],
  controllers: [ServicesController],
  providers: [ServicesService],
})
export class ServicesModule {}
