import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { VoltrSignatureGuard } from './voltr-signature.guard';
import {
  VoltrService,
  type VoltrEmbedTokenResponse,
  type VoltrScope,
} from './voltr.service';

/**
 * Embed do Chat/CRM da Voltr dentro do painel (estudo 68).
 * O painel chama esta rota logado; o segredo de parceiro fica no servidor.
 */
@UseGuards(JwtAuthGuard)
@Controller('voltr')
export class VoltrController {
  constructor(private readonly voltr: VoltrService) {}

  @Get('embed-token')
  async embedToken(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
    @Query('scope') scope?: string,
  ): Promise<VoltrEmbedTokenResponse> {
    const scopes: VoltrScope[] = scope === 'chat' ? ['chat'] : ['crm'];
    const nome = await this.voltr.resolveDisplayName(userId, email);
    return this.voltr.getEmbedToken(
      { companyId, externalUserId: userId, email, nome },
      scopes,
    );
  }
}

interface EnvioDaVoltr {
  canal?: string;
  externalUserId?: string;
  texto?: string;
  midiaDataUrl?: string;
  midiaTipo?: string;
  midiaNome?: string;
}

/**
 * Saída da ponte: a Voltr POSTa assinado e nós enviamos pelo Baileys do salão.
 *
 * A sessão do WhatsApp NUNCA sai daqui — a Voltr só fala HTTP. A resposta
 * `{ ok, externalId, acked:false }` é o contrato dela para "enfileirado, ainda
 * sem confirmação do WhatsApp"; a confirmação vai depois por
 * `POST /api/ingest/status`. Ver estudo 68.
 */
@Controller('voltr/whatsapp')
export class VoltrWhatsappController {
  private readonly logger = new Logger(VoltrWhatsappController.name);

  constructor(private readonly whatsapp: WhatsappService) {}

  @UseGuards(VoltrSignatureGuard)
  @Post('send')
  async send(
    @Req() req: Request & { voltrCompanyId?: string },
    @Body() dto: EnvioDaVoltr,
  ): Promise<{ ok: boolean; externalId: string; acked: boolean }> {
    const companyId = req.voltrCompanyId;
    if (!companyId) {
      // Guard já garante, mas não confio em invariante implícita para enviar
      // mensagem para cliente de salão.
      throw new BadRequestException('Tenant não resolvido.');
    }
    const texto = dto.texto?.trim();
    if (!texto) throw new BadRequestException('Mensagem sem texto.');

    const phone = this.phoneFromJid(dto.externalUserId ?? '');
    if (!phone) throw new BadRequestException('Destinatário inválido.');

    if (dto.midiaDataUrl) {
      // O transporte atual (outbox) é só texto — declarar em vez de fingir que
      // enviou a mídia.
      this.logger.warn(
        `Voltr enviou mídia (${dto.midiaTipo ?? '?'}) para ${phone}; o transporte atual é só texto e ela foi ignorada.`,
      );
    }

    const externalId = randomUUID();
    // `kind: 'voltr_outbound'` NÃO é automação (estudo 60): é resposta de
    // atendente/IA numa conversa viva, então não é bloqueada com o canal
    // fechado nem expira — a Voltr acompanha pelo status.
    await this.whatsapp.enqueueText(phone, texto, {
      companyId,
      kind: 'voltr_outbound',
      requestKey: externalId,
    });
    return { ok: true, externalId, acked: false };
  }

  /** `5511988887777@s.whatsapp.net` → `5511988887777`. */
  private phoneFromJid(jid: string): string {
    const digits = jid.split('@')[0]?.replace(/\D/g, '') ?? '';
    return digits.length >= 8 ? digits : '';
  }
}
