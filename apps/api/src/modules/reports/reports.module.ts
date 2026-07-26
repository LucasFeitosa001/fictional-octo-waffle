import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  // AuthModule: fornece AuthService pro PermissionGuard resolver as permissões
  // efetivas do usuário (@RequirePermission nas rotas do ReportsController).
  imports: [AuthModule, FeatureFlagsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
