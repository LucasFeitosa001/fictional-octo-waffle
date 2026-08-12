import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';
import { CurrentUser } from '../../common/current-user.decorator';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { VoltrSignatureGuard } from './voltr-signature.guard';
import {
  VoltrService,
  type VoltrEmbedTokenResponse,
  type VoltrEstadoIa,
  type VoltrMetricasIa,
  type VoltrScope,
  type VoltrSyncClientesResultado,
} from './voltr.service';

class PausaIaDto {
  // Sem o decorator o ValidationPipe (whitelist) descarta o campo e o PATCH
  // vira um no-op silencioso — a família exata do defeito que consertamos.
  @IsBoolean() envioAutomatico!: boolean;
}

/**
 * Embed do Chat/CRM da Voltr dentro do painel (estudo 68).
 * O painel chama esta rota logado; o segredo de parceiro fica no servidor.
 */
// PermissionGuard só cobra onde há @RequirePermission — `embed-token` e
// `sync-clientes` seguem com a mesma porta de antes (JwtAuthGuard).
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('voltr')
export class VoltrController {
  constructor(
    private readonly voltr: VoltrService,
    private readonly auth: AuthService,
  ) {}

  @Get('embed-token')
  async embedToken(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
    @Req() req: Request,
    @Query('scope') scope?: string,
  ): Promise<VoltrEmbedTokenResponse> {
    // Os DOIS escopos, sempre. O `scope` da query decide qual tela abre (é ele
    // que monta o embedUrl), não o que o token alcança: dentro do CRM, abrir a
    // conversa de um contato é fluxo legítimo e precisa de `chat` — com um
    // escopo só isso devolvia "este token de embed não tem o escopo". A trava
    // que importa não é esta: o módulo pago continua sendo conferido por escopo
    // do lado da Voltr, então tenant sem `atendimento` segue sem chat.
    // Ver estudo 71.
    // O escopo PEDIDO vem primeiro: a Voltr monta a URL do iframe com scopes[0]
    // (embed.service.ts:247), então com a ordem fixa a aba CRM abria o inbox.
    // Os dois continuam concedidos — abrir a conversa a partir do contato é
    // fluxo legítimo e precisa de 'chat'. Ver estudo 75.
    // O pedido vem primeiro (a Voltr monta a URL com scopes[0]); os outros vão
    // junto porque navegar entre as telas dela por dentro — do contato para a
    // conversa, do card do Kanban para o contato — é fluxo legítimo, e cada
    // superfície exige o seu escopo.
    const TELAS: VoltrScope[] = ['chat', 'crm', 'boards', 'tarefas', 'ia'];
    const pedido: VoltrScope = TELAS.includes(scope as VoltrScope)
      ? (scope as VoltrScope)
      : 'crm';
    const scopes: VoltrScope[] = [
      pedido,
      ...TELAS.filter((s) => s !== pedido),
    ];
    // `crm_admin` é o que autoriza APAGAR board e coluna do outro lado. Ele não
    // abre tela e não vem de graça: a Voltr provisiona todo mundo do embed como
    // `atendente`, então o cargo real de quem está aqui não viaja no token — sem
    // este recorte, qualquer pessoa com `marketing:view` (leitura) podia apagar
    // o funil inteiro do salão em cascata. Quem confere é o par
    // @Cargos + @EscopoDeEmbed('crm_admin') no CrmController da Voltr.
    if (await this.podeGerirMarketing(req, userId, companyId)) {
      scopes.push('crm_admin');
    }
    const nome = await this.voltr.resolveDisplayName(userId, email);
    return this.voltr.getEmbedToken(
      { companyId, externalUserId: userId, email, nome },
      scopes,
    );
  }

  /**
   * `marketing:manage` — a MESMA permissão que governa a pausa da IA e a
   * recepcionista nativa. Owner (curinga `*`) satisfaz.
   *
   * Reaproveita o cache por-requisição que o PermissionGuard grava, para não
   * bater no banco duas vezes na mesma chamada.
   */
  private async podeGerirMarketing(
    req: Request & { __permissionKeys?: string[] },
    userId: string,
    companyId: string,
  ): Promise<boolean> {
    try {
      let keys = req.__permissionKeys;
      if (!keys) {
        keys = (await this.auth.permissions(userId, companyId)).permissions;
        req.__permissionKeys = keys;
      }
      return keys.includes('*') || keys.includes('marketing:manage');
    } catch {
      // Fail-closed: na dúvida, o token sai SEM o poder de destruir. Perder a
      // ação de excluir é recuperável; conceder por engano, não.
      return false;
    }
  }

  /**
   * Empurra o cadastro de clientes do salão para a agenda do CRM da Voltr.
   *
   * MESMA porta do embed (`JwtAuthGuard` da classe): quem pode abrir o CRM pode
   * mandar a própria carteira para ele. O tenant vem do token, nunca do corpo —
   * não há como sincronizar o cadastro de outro salão por aqui.
   *
   * Idempotente do outro lado (casa por telefone e marca a tag `salonpass`), e
   * não dispara nenhuma mensagem: é cadastro, não automação.
   */
  @Post('sync-clientes')
  async syncClientes(
    @CurrentUser('companyId') companyId: string,
  ): Promise<VoltrSyncClientesResultado> {
    return this.voltr.sincronizarClientes(companyId);
  }

  /**
   * Estado da IA da VOLTR (a que atende no WhatsApp deste salão).
   *
   * Existe separado de `/whatsapp/inbox/config` de propósito: aquele é a
   * recepcionista NATIVA do SalonPass, outro produto, outro banco. Ler um e
   * mostrar o outro foi o defeito que fez o botão de pausa não pausar nada.
   */
  @RequirePermission('marketing:view')
  @Get('ia')
  async estadoIa(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
  ): Promise<VoltrEstadoIa> {
    return this.voltr.estadoIa({ companyId, userId, email });
  }

  /**
   * Os números da IA que REALMENTE atende neste salão.
   *
   * Existe separado de `/whatsapp/inbox/stats` pela MESMA razão de `/voltr/ia`
   * existir separado de `/whatsapp/inbox/config`: aquele mede a recepcionista
   * NATIVA do SalonPass (`sender:'ai'`), que não atende ninguém nos salões em
   * que quem responde é a Mariana, da Voltr. Ler um e mostrar o outro fazia os
   * cartões do /voltr-chat tenderem a ZERO.
   *
   * Mesma permissão de leitura do inbox (`marketing:view`). O tenant vem do
   * token, nunca do corpo — não há como ler o desempenho de outro salão aqui.
   * Só leitura agregada: nada é enviado nem enfileirado.
   */
  @RequirePermission('marketing:view')
  @Get('metricas')
  async metricasIa(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
  ): Promise<VoltrMetricasIa> {
    return this.voltr.metricasIa({ companyId, userId, email });
  }

  /**
   * PAUSA / RETOMA a IA da Voltr — o botão do dono, com o cargo REAL dele.
   *
   * A permissão é conferida AQUI (`marketing:manage`, a mesma que governa a
   * recepcionista nativa), com o usuário logado no SalonPass. Do outro lado a
   * chamada chega como sessão de embed, que a Voltr aceita justamente porque o
   * parceiro já validou a permissão antes de pedir o token.
   *
   * Não envia nem enfileira mensagem: só muda quem pode responder daqui para a
   * frente. O tenant vem do token, nunca do corpo — não há como pausar a IA de
   * outro salão por aqui.
   */
  @RequirePermission('marketing:manage')
  @Patch('ia')
  async pausarIa(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('email') email: string,
    @Body() dto: PausaIaDto,
  ): Promise<VoltrEstadoIa> {
    return this.voltr.definirPausaIa(
      { companyId, userId, email },
      dto.envioAutomatico,
    );
  }
}

interface EnvioDaVoltr {
  canal?: string;
  externalUserId?: string;
  texto?: string;
  /**
   * Id que a Voltr deu à mensagem. É a chave de deduplicação: sem respeitá-lo,
   * uma retentativa dela vira mensagem REPETIDA no celular do cliente, porque a
   * fila dedupa por `requestKey` e nós gerávamos um uuid novo a cada chamada.
   * Também é por ele que a Voltr casa o recibo de entrega que devolvemos.
   */
  externalId?: string;
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

    // O id da VOLTR quando ele vem; uuid nosso só quando ela não mandar. Gerar
    // um novo a cada chamada anulava a deduplicação da fila — a retentativa dela
    // não era reconhecida como repetida e o cliente recebia duas vezes.
    const externalId = dto.externalId?.trim() || randomUUID();
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
