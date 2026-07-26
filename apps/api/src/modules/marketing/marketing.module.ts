import { Module } from '@nestjs/common';
import { MarketingService } from './marketing.service';
import { MarketingController } from './marketing.controller';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  // AuthModule: fornece AuthService pro PermissionGuard resolver as permissões
  // efetivas do usuário (@RequirePermission nas rotas do MarketingController).
  imports: [AuthModule, FeatureFlagsModule],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
