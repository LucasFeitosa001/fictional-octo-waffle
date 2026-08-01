import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { VoltrSignatureGuard } from './voltr-signature.guard';
import { EscopoVoltr } from './voltr-escopo.decorator';
import { VoltrAgendaService } from './voltr-agenda.service';

type ReqVoltr = Request & { voltrCompanyId?: string };

/**
 * A agenda que a IA da Voltr enxerga. Ver estudo 88.
 *
 * Tudo POST porque a assinatura do conector é sobre o CORPO — um GET não teria o
 * que assinar. Tudo com `@EscopoVoltr('agenda')`: o segredo do tenant sozinho
 * autoriza mandar mensagem, não mexer na agenda de um profissional.
 *
 * `companyId` NUNCA vem do corpo: vem do `voltrCompanyId` que o guard escreve
 * depois de provar a assinatura. Aceitá-lo do payload deixaria a IA (ou quem
 * tivesse o segredo de um tenant) agendar em outro salão.
 */
@UseGuards(VoltrSignatureGuard)
@Controller('voltr/agenda')
export class VoltrAgendaController {
  constructor(private readonly service: VoltrAgendaService) {}

  @Post('servicos')
  @EscopoVoltr('agenda')
  async servicos(@Req() req: ReqVoltr) {
    return this.service.servicos(req.voltrCompanyId!);
  }

  @Post('profissionais')
  @EscopoVoltr('agenda')
  async profissionais(
    @Req() req: ReqVoltr,
    @Body() body: { serviceId?: string },
  ) {
    return this.service.profissionais(req.voltrCompanyId!, body?.serviceId ?? '');
  }

  @Post('horarios')
  @EscopoVoltr('agenda')
  async horarios(
    @Req() req: ReqVoltr,
    @Body() body: { serviceId?: string; professionalId?: string; date?: string },
  ) {
    return this.service.horarios(
      req.voltrCompanyId!,
      String(req.headers['x-tenant-schema'] ?? ''),
      {
        serviceId: body?.serviceId ?? '',
        professionalId: body?.professionalId ?? '',
        date: body?.date ?? '',
      },
    );
  }

  @Post('meus')
  @EscopoVoltr('agenda')
  async meus(@Req() req: ReqVoltr, @Body() body: { telefone?: string }) {
    return this.service.proximos(req.voltrCompanyId!, body?.telefone ?? '');
  }

  @Post('cancelar')
  @EscopoVoltr('agenda')
  async cancelar(
    @Req() req: ReqVoltr,
    @Body() body: { agendamentoId?: string; telefone?: string; motivo?: string },
  ) {
    return this.service.cancelar(req.voltrCompanyId!, {
      agendamentoId: body?.agendamentoId ?? '',
      telefone: body?.telefone ?? '',
      motivo: body?.motivo,
    });
  }

  @Post('criar')
  @EscopoVoltr('agenda')
  async criar(
    @Req() req: ReqVoltr,
    @Body()
    body: { oferta?: string; inicio?: string; telefone?: string; nomeCliente?: string },
  ) {
    return this.service.criar(
      req.voltrCompanyId!,
      String(req.headers['x-tenant-schema'] ?? ''),
      {
        oferta: body?.oferta ?? '',
        inicio: body?.inicio ?? '',
        telefone: body?.telefone ?? '',
        nomeCliente: body?.nomeCliente,
      },
    );
  }
}
