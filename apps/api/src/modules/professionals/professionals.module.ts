import { Module } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { ProfessionalsController } from './professionals.controller';
import { AuthModule } from '../auth/auth.module';
import { InvitesModule } from '../invites/invites.module';

@Module({
  imports: [AuthModule, InvitesModule],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
})
export class ProfessionalsModule {}
