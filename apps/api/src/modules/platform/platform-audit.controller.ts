import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformGuard, RequireCapability } from './platform.guard';
import { ConsultarAuditoriaDto } from './platform.dto';

/**
 * Trilha do console. Só leitura — não existe rota de escrita nem de exclusão,
 * de propósito: uma trilha que o próprio operador consegue apagar não serve
 * como prova de nada.
 */
@UseGuards(PlatformGuard)
@Controller('platform/auditoria')
export class PlatformAuditController {
  constructor(private readonly service: PlatformAuditService) {}

  /** Antes de `/` não é necessário, mas mantém a leitura óbvia. */
  @Get('acoes')
  @RequireCapability('auditoria:ver')
  acoes() {
    return this.service.acoesUsadas();
  }

  @Get()
  @RequireCapability('auditoria:ver')
  listar(@Query() filtros: ConsultarAuditoriaDto) {
    return this.service.listar(filtros);
  }
}
