import { Module } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: fornece AuthService/PermissionGuard pro @RequirePermission.
  imports: [AuthModule],
  controllers: [PackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}
