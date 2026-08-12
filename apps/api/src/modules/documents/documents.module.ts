import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { FeatureFlagsModule } from '../feature-flags';
import { AuthModule } from '../auth/auth.module';

/**
 * Módulo "Gerador de documentos" (`documents`) — ver estudo 124.
 *
 * `AuthModule` não é enfeite: o `PermissionGuard` do controller injeta
 * `AuthService`, e sem este import o Nest derruba a aplicação inteira no boot
 * ("Nest can't resolve dependencies of the PermissionGuard"). O `tsc` passa —
 * é erro de injeção, não de tipo —, então o App Runner só descobre em produção
 * e faz rollback. Todo módulo com `PermissionGuard` importa os dois (ver
 * `uploads.module.ts` e `whatsapp.module.ts`).
 */
@Module({
  imports: [FeatureFlagsModule, AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
