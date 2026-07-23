import { Module, forwardRef } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { QueuesModule } from '../queues/queues.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  // QueuesModule via forwardRef: CampaignsService enqueues through QueuesService,
  // and the campaigns processor (inside QueuesModule) calls back into
  // CampaignsService for the birthday sweep — a two-way dependency.
  // FeatureFlagsModule: fornece o FeatureFlagsService pro FeatureGuard
  // (@RequireFeature('messaging')) aplicado no CampaignsController.
  imports: [WhatsappModule, forwardRef(() => QueuesModule), FeatureFlagsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
