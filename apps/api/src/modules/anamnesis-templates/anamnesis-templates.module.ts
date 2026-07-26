import { Module } from '@nestjs/common';
import { AnamnesisTemplatesService } from './anamnesis-templates.service';
import { AnamnesisTemplatesController } from './anamnesis-templates.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AnamnesisTemplatesController],
  providers: [AnamnesisTemplatesService],
})
export class AnamnesisTemplatesModule {}
