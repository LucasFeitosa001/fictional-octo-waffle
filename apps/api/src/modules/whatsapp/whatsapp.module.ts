import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController, WhatsappConnectionController } from './whatsapp.controller';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [AuthModule, FeatureFlagsModule],
  controllers: [WhatsappController, WhatsappConnectionController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
