import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { FeatureFlagsModule } from '../feature-flags';

/** Módulo "Gerador de documentos" (`documents`) — ver estudo 124. */
@Module({
  imports: [FeatureFlagsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
