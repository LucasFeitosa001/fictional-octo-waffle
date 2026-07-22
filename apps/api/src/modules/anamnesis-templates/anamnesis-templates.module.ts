import { Module } from '@nestjs/common';
import { AnamnesisTemplatesService } from './anamnesis-templates.service';
import { AnamnesisTemplatesController } from './anamnesis-templates.controller';

@Module({
  controllers: [AnamnesisTemplatesController],
  providers: [AnamnesisTemplatesService],
})
export class AnamnesisTemplatesModule {}
