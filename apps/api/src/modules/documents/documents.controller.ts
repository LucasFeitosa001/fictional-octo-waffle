import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { FeatureGuard, RequireFeature } from '../feature-flags';
import {
  DocumentsService,
  VARIAVEIS_DE_DOCUMENTO,
  type TipoDeDocumento,
} from './documents.service';

class ModeloDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsIn(['contrato', 'termo', 'recibo', 'outro'])
  tipo!: TipoDeDocumento;

  @IsString()
  @MaxLength(20_000)
  corpo!: string;
}

class SalvarModelosDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModeloDto)
  modelos!: ModeloDto[];
}

class GerarDto {
  @IsString()
  modeloId!: string;

  @IsString()
  customerId!: string;

  /** Opcional: contrato/termo costumam sair antes de existir atendimento. */
  @IsOptional()
  @IsString()
  appointmentId?: string;
}

/**
 * MÓDULO "GERADOR DE DOCUMENTOS" (`documents`) — ver estudo 124.
 *
 * Só lê e monta texto: nenhuma rota daqui grava documento, envia mensagem ou
 * mexe em agendamento.
 *
 * `PUT /modelos` pede `config:manage` (e não `clientes:manage`) de propósito:
 * mudar o texto de um contrato é decisão de quem manda no salão, não da
 * recepção que o imprime.
 */
@UseGuards(JwtAuthGuard, PermissionGuard, FeatureGuard)
@RequireFeature('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get('variaveis')
  @RequirePermission('clientes:view', 'clientes:manage', 'config:manage')
  variaveis() {
    return { variaveis: VARIAVEIS_DE_DOCUMENTO };
  }

  @Get('modelos')
  @RequirePermission('clientes:view', 'clientes:manage', 'config:manage')
  async modelos(@CurrentUser('companyId') companyId: string) {
    return { modelos: await this.service.listar(companyId) };
  }

  @Put('modelos')
  @RequirePermission('config:manage')
  async salvar(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: SalvarModelosDto,
  ) {
    const modelos = await this.service.salvar(
      companyId,
      dto.modelos.map((m) => ({
        id: m.id ?? '',
        nome: m.nome,
        tipo: m.tipo,
        corpo: m.corpo,
      })),
    );
    return { modelos };
  }

  @Post('gerar')
  @RequirePermission('clientes:view', 'clientes:manage', 'config:manage')
  async gerar(@CurrentUser('companyId') companyId: string, @Body() dto: GerarDto) {
    return this.service.gerar(companyId, {
      modeloId: dto.modeloId,
      customerId: dto.customerId,
      ...(dto.appointmentId ? { appointmentId: dto.appointmentId } : {}),
    });
  }
}
