import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [AuthModule, FeatureFlagsModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
