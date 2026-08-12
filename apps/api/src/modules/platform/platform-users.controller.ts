import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PlatformUsersService } from './platform-users.service';
import { PlatformStaffService } from './platform-staff.service';
import type { StaffAutenticado } from './platform-auth.service';
import { CurrentContext, CurrentStaff, PlatformGuard, RequireCapability } from './platform.guard';
import {
  AlterarEmailDto,
  AlternarAtivoDto,
  BuscarUsuariosDto,
  DesvincularOauthDto,
  PersonificarDto,
  ResetarSenhaDto,
  SoJustificativaDto,
} from './platform.dto';

type Ctx = { ip: string | null; userAgent: string | null };

/** Contas de salão, vistas pelo console de suporte. Ver estudo 135. */
@UseGuards(PlatformGuard)
@Controller('platform/usuarios')
export class PlatformUsersController {
  constructor(private readonly service: PlatformUsersService) {}

  @Get()
  @RequireCapability('usuarios:ver')
  buscar(@Query() filtros: BuscarUsuariosDto) {
    return this.service.buscar(filtros);
  }

  @Get(':id')
  @RequireCapability('usuarios:ver')
  detalhe(@Param('id') id: string) {
    return this.service.detalhe(id);
  }

  @Post(':id/email')
  @HttpCode(200)
  @RequireCapability('usuarios:email')
  alterarEmail(
    @Param('id') id: string,
    @Body() dto: AlterarEmailDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.alterarEmail(PlatformStaffService.ator(staff, ctx), id, dto);
  }

  @Post(':id/senha')
  @HttpCode(200)
  @RequireCapability('usuarios:senha')
  resetarSenha(
    @Param('id') id: string,
    @Body() dto: ResetarSenhaDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.resetarSenha(PlatformStaffService.ator(staff, ctx), id, dto);
  }

  @Post(':id/encerrar-sessoes')
  @HttpCode(200)
  @RequireCapability('usuarios:sessoes')
  encerrarSessoes(
    @Param('id') id: string,
    @Body() dto: SoJustificativaDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.encerrarSessoes(PlatformStaffService.ator(staff, ctx), id, dto);
  }

  @Post(':id/ativo')
  @HttpCode(200)
  @RequireCapability('usuarios:ativar')
  alternarAtivo(
    @Param('id') id: string,
    @Body() dto: AlternarAtivoDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.alternarAtivo(PlatformStaffService.ator(staff, ctx), id, dto);
  }

  @Post(':id/desvincular-oauth')
  @HttpCode(200)
  @RequireCapability('usuarios:desvincular-oauth')
  desvincularOauth(
    @Param('id') id: string,
    @Body() dto: DesvincularOauthDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.desvincularOauth(PlatformStaffService.ator(staff, ctx), id, dto);
  }

  /**
   * "Entrar como". Devolve um token de sessão de SALÃO, válido por 30 min e
   * marcado com o técnico que o pediu. Exige engenharia — ver a matriz de
   * capacidades.
   */
  @Post(':id/personificar')
  @HttpCode(200)
  @RequireCapability('usuarios:personificar')
  personificar(
    @Param('id') id: string,
    @Body() dto: PersonificarDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: Ctx,
  ) {
    return this.service.personificar(PlatformStaffService.ator(staff, ctx), id, dto);
  }
}
