import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import {
  WhatsappController,
  WhatsappConnectionController,
  WhatsappMediaController,
} from './whatsapp.controller';
import { AuthModule } from '../auth/auth.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [AuthModule, FeatureFlagsModule, UploadsModule],
  controllers: [
    WhatsappController,
    WhatsappConnectionController,
    WhatsappMediaController,
  ],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
