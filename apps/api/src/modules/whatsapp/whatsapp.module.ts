import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController, WhatsappConnectionController } from './whatsapp.controller';

@Module({
  controllers: [WhatsappController, WhatsappConnectionController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
