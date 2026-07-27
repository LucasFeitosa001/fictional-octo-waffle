import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import {
  CreateProfessionalDto,
  UpdateProfessionalDto,
  ScheduleDto,
  SetServicesDto,
  CommissionRuleDto,
} from './dto';
import { InvitesService } from '../invites/invites.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly service: ProfessionalsService,
    private readonly invites: InvitesService,
  ) {}

  @Get()
  @RequirePermission('equipe:view', 'equipe:manage', 'agenda:view', 'agenda:manage')
  list(
    @CurrentUser('companyId') companyId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('active') active?: string,
  ) {
    // Sem `active` → só ativos. 'all' traz inativos junto (tela de gestão);
    // 'false'/'inactive' traz só os desativados.
    const status =
      active === 'all'
        ? 'all'
        : active === 'false' || active === 'inactive'
          ? 'inactive'
          : 'active';
    return this.service.list(companyId, Number(page) || 1, Number(pageSize) || 20, status);
  }

  @Get(':id')
  @RequirePermission('equipe:view', 'equipe:manage', 'agenda:view', 'agenda:manage')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.findOne(companyId, id);
  }

  @Post()
  @RequirePermission('equipe:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateProfessionalDto) {
    return this.service.create(companyId, dto);
  }

  @Patch(':id')
  @RequirePermission('equipe:manage')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalDto,
  ) {
    return this.service.update(companyId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('equipe:manage')
  remove(@CurrentUser('companyId') companyId: string, @Param('id') id: string) {
    return this.service.remove(companyId, id);
  }

  @Put(':id/schedules')
  @RequirePermission('equipe:manage')
  setSchedules(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() schedules: ScheduleDto[],
  ) {
    return this.service.setSchedules(companyId, id, schedules);
  }

  @Put(':id/services')
  @RequirePermission('equipe:manage')
  setServices(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: SetServicesDto,
  ) {
    return this.service.setServices(companyId, id, dto);
  }

  @Post(':id/commission-rules')
  @RequirePermission('comissoes:config')
  addCommissionRule(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: CommissionRuleDto,
  ) {
    return this.service.addCommissionRule(companyId, id, dto);
  }

  @Put(':id/commission-rules')
  @RequirePermission('comissoes:config')
  setCommissionRules(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() rules: CommissionRuleDto[],
  ) {
    return this.service.setCommissionRules(companyId, id, rules);
  }

  // Gera um convite de acesso para o profissional (onboarding de staff). Retorna
  // o token/link. Protegido por gestão de equipe/usuários. Por padrão APENAS gera
  // o link (nada é enviado). O envio por WhatsApp só ocorre com body
  // `{ sendWhatsapp: true }` — opt-in explícito.
  @Post(':id/invite')
  @RequirePermission('equipe:manage', 'usuarios:manage')
  invite(
    @CurrentUser('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body?: { sendWhatsapp?: boolean },
  ) {
    const sendWhatsapp = body?.sendWhatsapp === true;
    return this.invites.createForProfessional(companyId, id, sendWhatsapp);
  }
}
