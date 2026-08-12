import { Module } from '@nestjs/common';
import { SalonPayController } from './salonpay.controller';
import { SalonPayService } from './salonpay.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SalonPayController],
  providers: [SalonPayService],
  exports: [SalonPayService],
})
export class SalonPayModule {}
