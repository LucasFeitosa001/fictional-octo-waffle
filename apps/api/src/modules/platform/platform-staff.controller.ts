import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlatformStaffService } from './platform-staff.service';
import type { StaffAutenticado } from './platform-auth.service';
import { CurrentContext, CurrentStaff, PlatformGuard, RequireCapability } from './platform.guard';
import {
  AlterarTecnicoDto,
  AlternarTecnicoAtivoDto,
  CriarTecnicoDto,
  SoJustificativaDto,
} from './platform.dto';
import { CAPACIDADES_POR_PAPEL, ROTULO_PAPEL } from './platform.constants';

type Ctx = { ip: string | null; userAgent: string | null };

/** Técnicos da SalonPass. Só administração chega aqui. Ver estudo 135. */
@UseGuards(PlatformGuard)
@Controller('platform/tecnicos')
export class PlatformStaffController {
  constructor(private readonly service: PlatformStaffService) {}

  /**
   * Catálogo de papéis e o que cada um pode. Alimenta o formulário sem que o
   * frontend precise repetir a matriz — repetir é como os dois lados divergem.
   * Declarada antes de `:id` para "papeis" não ser lido como identificador.
   */
  @Get('papeis')
  @RequireCapability('tecnicos:ver')
  papeis() {
    return Object.entries(CAPACIDADES_POR_PAPEL).map(([codigo, capacidades]) => ({
      codigo,
      rotulo: ROTULO_PAPEL[codigo as keyof typeof ROTULO_PAPEL],
      capacidades,
    }));
  }

  @Get()
  @RequireCapability('tecnicos:ver')
  listar() {
    return this.service.listar();
  }

  @Get(':id')
  @RequireCapability('tecnicos:ver')
  detalhe(@Param('id') id: string) {
    return this.service.detalhe(id);
  }

  @Post()
  @RequireCapability('tecnicos:gerir')
  criar(
    @Body() dto: CriarTecnicoDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.criar(PlatformStaffService.ator(staff, ctx), dto);
  }

  @Patch(':id')
  @RequireCapability('tecnicos:gerir')
  alterar(
    @Param('id') id: string,
    @Body() dto: AlterarTecnicoDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.alterar(PlatformStaffService.ator(staff, ctx), id, dto);
  }

  @Post(':id/ativo')
  @HttpCode(200)
  @RequireCapability('tecnicos:gerir')
  alternarAtivo(
    @Param('id') id: string,
    @Body() dto: AlternarTecnicoAtivoDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.alternarAtivo(PlatformStaffService.ator(staff, ctx), id, dto);
  }

  @Post(':id/senha')
  @HttpCode(200)
  @RequireCapability('tecnicos:gerir')
  resetarSenha(
    @Param('id') id: string,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.resetarSenha(PlatformStaffService.ator(staff, ctx), id);
  }

  @Post(':id/encerrar-sessoes')
  @HttpCode(200)
  @RequireCapability('tecnicos:gerir')
  encerrarSessoes(
    @Param('id') id: string,
    @Body() dto: SoJustificativaDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.encerrarSessoes(PlatformStaffService.ator(staff, ctx), id, dto);
  }
}
