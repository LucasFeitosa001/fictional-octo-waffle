import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { QueuesModule } from '../queues/queues.module';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [AuthModule, FeatureFlagsModule, QueuesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
