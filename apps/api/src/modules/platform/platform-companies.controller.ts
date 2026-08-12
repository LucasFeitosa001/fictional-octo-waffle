import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PlatformCompaniesService } from './platform-companies.service';
import { PlatformStaffService } from './platform-staff.service';
import type { StaffAutenticado } from './platform-auth.service';
import { CurrentContext, CurrentStaff, PlatformGuard, RequireCapability } from './platform.guard';
import { AlternarAtivoDto, BuscarSaloesDto } from './platform.dto';

/** Salões, vistos pelo console de suporte. Ver estudo 135. */
@UseGuards(PlatformGuard)
@Controller('platform/saloes')
export class PlatformCompaniesController {
  constructor(private readonly service: PlatformCompaniesService) {}

  @Get()
  @RequireCapability('saloes:ver')
  buscar(@Query() filtros: BuscarSaloesDto) {
    return this.service.buscar(filtros);
  }

  @Get(':id')
  @RequireCapability('saloes:ver')
  detalhe(@Param('id') id: string) {
    return this.service.detalhe(id);
  }

  @Post(':id/ativo')
  @HttpCode(200)
  @RequireCapability('saloes:ativar')
  alternarAtivo(
    @Param('id') id: string,
    @Body() dto: AlternarAtivoDto,
    @CurrentStaff() staff: StaffAutenticado,
    @CurrentContext() ctx: { ip: string | null; userAgent: string | null },
  ) {
    return this.service.alternarAtivo(PlatformStaffService.ator(staff, ctx), id, dto);
  }
}

/** Números do topo. Separado para não virar `/platform/saloes/resumo`. */
@UseGuards(PlatformGuard)
@Controller('platform/resumo')
export class PlatformResumoController {
  constructor(private readonly service: PlatformCompaniesService) {}

  @Get()
  @RequireCapability('saloes:ver')
  resumo() {
    return this.service.resumo();
  }
}
