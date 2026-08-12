import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { UazapiClient } from './uazapi.client';
import { UazapiWebhookController } from './uazapi-webhook.controller';
import { UazapiWebhookService } from './uazapi-webhook.service';
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
    UazapiWebhookController,
  ],
  providers: [WhatsappService, UazapiClient, UazapiWebhookService],
  exports: [WhatsappService, UazapiClient],
})
export class WhatsappModule {}
