import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { PermissionGuard } from '../../common/permission.guard';
import { RequirePermission } from '../../common/require-permission.decorator';
import { CurrentUser } from '../../common/current-user.decorator';
import { FeatureGuard, RequireFeature } from '../feature-flags';
import { WhatsappService } from './whatsapp.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Corpo do envio de mídia — ver `WhatsappMediaController`. */
export class EnviarMidiaDto {
  @IsString()
  customerId!: string;

  /** Só o que o WhatsApp sabe mandar por este caminho. */
  @IsIn(['image', 'document'])
  type!: 'image' | 'document';

  /** URL do arquivo já subido por `POST /uploads`. */
  @IsUrl({ require_tld: false })
  url!: string;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fileName?: string;

  /** Recado que vai junto do arquivo. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;

  /** UUID da ação: reenviar o mesmo clique não duplica o envio. */
  @IsOptional()
  @IsString()
  requestKey?: string;
}

/**
 * Admin/ops endpoints to link / inspect a salon's WhatsApp account. Gated by a
 * shared secret in the query string (WHATSAPP_ADMIN_TOKEN) — whoever can open the
 * QR could otherwise link an arbitrary phone to a session, so it must not be
 * public.
 *
 * MULTI-TENANT: cada salão (company) tem seu PRÓPRIO número/socket. Como este
 * fluxo não carrega sessão de usuário, a empresa-alvo vem por `?companyId=`. Se
 * omitido, o service tenta resolver automaticamente quando há uma única empresa
 * (ver resolveOpsCompanyId); quando ambíguo, responde 403 pedindo o companyId.
 */
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  private assertToken(token?: string): void {
    const expected = process.env.WHATSAPP_ADMIN_TOKEN;
    if (!expected || token !== expected) throw new ForbiddenException('Token inválido');
  }

  // Resolve a empresa-alvo do fluxo de ops (após validar o token).
  private async resolveCompany(companyId?: string): Promise<string> {
    const resolved = await this.whatsapp.resolveOpsCompanyId(companyId);
    if (!resolved) {
      throw new ForbiddenException(
        'Informe ?companyId= (há mais de um salão; o número é por empresa).',
      );
    }
    return resolved;
  }

  @Get('status')
  async status(@Query('token') token?: string, @Query('companyId') companyId?: string) {
    this.assertToken(token);
    const company = await this.resolveCompany(companyId);
    return this.whatsapp.getStatus(company);
  }

  // PNG of the current pairing QR (204 when already connected / none pending).
  @Get('qr.png')
  async qrPng(
    @Res() res: Response,
    @Query('token') token?: string,
    @Query('companyId') companyId?: string,
  ) {
    this.assertToken(token);
    const company = await this.resolveCompany(companyId);
    const dataUrl = await this.whatsapp.getQrDataUrl(company);
    if (!dataUrl) {
      res.status(204).end();
      return;
    }
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.end(Buffer.from(base64, 'base64'));
  }

  // Tiny self-refreshing page that shows the QR and flips to "Conectado!".
  @Get('qr')
  @Header('Content-Type', 'text/html; charset=utf-8')
  qrPage(@Query('token') token?: string, @Query('companyId') companyId?: string): string {
    this.assertToken(token);
    const t = encodeURIComponent(token ?? '');
    const c = encodeURIComponent(companyId ?? '');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar WhatsApp — Salonpass</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#faf6f4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a1a}
  .card{background:#fff;border-radius:20px;padding:32px;max-width:380px;text-align:center;
    box-shadow:0 8px 30px rgba(0,0,0,.08)}
  h1{font-size:20px;margin:0 0 6px}
  p{color:#6b6b6b;font-size:14px;line-height:1.5;margin:0 0 18px}
  img{width:280px;height:280px;border-radius:12px;background:#f3eeea}
  .ok{font-size:18px;font-weight:600;color:#16a34a}
  .muted{font-size:12px;color:#b3aba7;margin-top:16px}
</style></head><body>
<div class="card">
  <h1>Conectar WhatsApp</h1>
  <p>No celular do salão: WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b> e aponte para o código.</p>
  <div id="content"><img id="qr" alt="QR Code"></div>
  <div class="muted" id="state">Carregando…</div>
</div>
<script>
  var TOKEN="${t}";
  var COMPANY="${c}";
  var Q=COMPANY?("&companyId="+COMPANY):"";
  async function tick(){
    try{
      var s=await fetch("status?token="+TOKEN+Q).then(r=>r.json());
      var state=document.getElementById("state");
      var content=document.getElementById("content");
      if(s.status==="open"){
        content.innerHTML='<div class="ok">✓ Conectado!</div>';
        state.textContent="Sua conta está conectada. Pode fechar esta página.";
        return;
      }
      if(s.hasQr){
        var img=document.getElementById("qr")||document.createElement("img");
        img.id="qr";
        img.src="qr.png?token="+TOKEN+Q+"&t="+Date.now();
        if(!document.getElementById("qr")) content.appendChild(img);
        state.textContent="Escaneie o código acima.";
      }else{
        state.textContent="Aguardando código… ("+s.status+")";
      }
    }catch(e){ document.getElementById("state").textContent="Erro ao consultar status."; }
    setTimeout(tick,3000);
  }
  tick();
</script>
</body></html>`;
  }

  // Mints an 8-char "link with phone number" code as an alternative to the QR.
  // Pass the salon's full WhatsApp number, e.g. ?phone=5511999999999.
  @Get('pair')
  async pair(
    @Query('token') token?: string,
    @Query('phone') phone?: string,
    @Query('companyId') companyId?: string,
  ) {
    this.assertToken(token);
    const company = await this.resolveCompany(companyId);
    const code = await this.whatsapp.requestPairingCode(company, phone ?? '');
    return { code };
  }

  @Post('logout')
  async logout(@Query('token') token?: string, @Query('companyId') companyId?: string) {
    this.assertToken(token);
    const company = await this.resolveCompany(companyId);
    await this.whatsapp.logout(company);
    return { ok: true };
  }
}

class PairWhatsappDto {
  @IsOptional() @IsString() phone?: string;
}

class ManagerPhoneDto {
  @IsOptional() @IsString() phone?: string;
}

/**
 * Authenticated counterpart of the controller above: lets a logged-in salon
 * owner connect their WhatsApp straight from the admin panel (Configurações),
 * instead of the ops-only token flow.
 *
 * MULTI-TENANT: cada endpoint é escopado por `request.user.companyId` (a empresa
 * ATIVA da sessão). O salão conecta e envia do SEU PRÓPRIO número — o socket, o
 * QR e o status são todos por empresa.
 */
@UseGuards(JwtAuthGuard, PermissionGuard, FeatureGuard)
@RequireFeature('whatsapp_api')
@Controller('whatsapp/connection')
export class WhatsappConnectionController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get('status')
  @RequirePermission('config:view', 'config:manage', 'marketing:view', 'marketing:manage')
  status(@CurrentUser('companyId') companyId: string) {
    // Abrir a tela de status já sobe a conexão desta empresa sob demanda.
    this.whatsapp.ensureConnecting(companyId);
    return this.whatsapp.getStatus(companyId);
  }

  @Get('qr.png')
  @RequirePermission('config:manage')
  async qrPng(@CurrentUser('companyId') companyId: string, @Res() res: Response) {
    const dataUrl = await this.whatsapp.getQrDataUrl(companyId);
    if (!dataUrl) {
      res.status(204).end();
      return;
    }
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.end(Buffer.from(base64, 'base64'));
  }

  // Generates the 8-char "link with phone number" code for the salon's number.
  @Post('pair')
  @RequirePermission('config:manage')
  async pair(@CurrentUser('companyId') companyId: string, @Body() dto: PairWhatsappDto) {
    const code = await this.whatsapp.requestPairingCode(companyId, dto.phone ?? '');
    return { code };
  }

  @Post('logout')
  @RequirePermission('config:manage')
  async logout(@CurrentUser('companyId') companyId: string) {
    await this.whatsapp.logout(companyId);
    return { ok: true };
  }

  // Manager/reception number that RECEIVES the "confirm this booking?" prompt and
  // whose replies (1/2/3) drive the confirmation flow. Scoped to the logged-in
  // company, so each salon sets its own.
  @Get('manager')
  @RequirePermission('config:view', 'config:manage', 'marketing:view', 'marketing:manage')
  async getManager(@CurrentUser('companyId') companyId: string) {
    const phone = await this.whatsapp.getManagerPhone(companyId);
    return { phone };
  }

  @Post('manager')
  @RequirePermission('config:manage', 'marketing:manage')
  async setManager(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: ManagerPhoneDto,
  ) {
    await this.whatsapp.setManagerPhone(companyId, dto.phone ?? '');
    const phone = await this.whatsapp.getManagerPhone(companyId);
    return { phone };
  }
}

/**
 * MÓDULO "ENVIO DE IMAGENS E ARQUIVOS" (`media_messages`).
 *
 * Manda para a cliente, pelo WhatsApp do salão, uma foto de referência ou um
 * documento — junto de um recado opcional. Pedido do dono em 05/08; o texto que
 * ele publicou na tela de Adicionais é "mandar fotos de referência e documentos
 * para a cliente junto das mensagens do salão", e é isso que este endpoint faz.
 *
 * O envio é sempre de UMA PESSOA, nunca automático: quem chama é alguém que
 * clicou no painel, com o arquivo já escolhido. Por isso `authorized: true` —
 * é a mesma isenção do botão "Enviar confirmação" (estudo 60), e continua
 * respeitando a regra permanente do projeto: nada dispara sozinho.
 *
 * O gate é o do adicional (`media_messages`). O `whatsapp_api` não entra como
 * segunda trava porque `RequireFeature` aceita uma chave só — e não faria falta:
 * sem número conectado, `enqueueText` já recusa por conta própria (trava 1 do
 * estudo 60) e a resposta diz isso.
 */
@UseGuards(JwtAuthGuard, PermissionGuard, FeatureGuard)
@RequireFeature('media_messages')
@Controller('whatsapp/media')
export class WhatsappMediaController {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @RequirePermission('clientes:manage', 'marketing:manage', 'agenda:manage')
  async enviar(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: EnviarMidiaDto,
  ) {
    // O telefone vem do CADASTRO, nunca do corpo da requisição: aceitar número
    // solto do front abriria envio para qualquer destinatário a partir de uma
    // sessão válida — e o número da cliente já está no banco.
    const cliente = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, companyId },
      select: { id: true, phone: true, name: true },
    });
    if (!cliente) throw new BadRequestException('Cliente não encontrado nesta empresa.');
    if (!cliente.phone?.trim()) {
      throw new BadRequestException(`${cliente.name || 'A cliente'} não tem telefone no cadastro.`);
    }

    const enfileirado = await this.whatsapp.enqueueText(cliente.phone, dto.caption?.trim() || '', {
      companyId,
      customerId: cliente.id,
      kind: 'media',
      requestKey: dto.requestKey,
      authorized: true,
      media: {
        type: dto.type,
        url: dto.url,
        mimeType: dto.mimeType,
        ...(dto.fileName ? { fileName: dto.fileName } : {}),
      },
    });
    if (!enfileirado) {
      throw new BadRequestException('Não foi possível enfileirar o envio. Confira o número.');
    }
    // Status honesto: "na fila" não é "entregue". Quem chamou mostra isso na
    // tela e o histórico do outbox conta o resto (regra permanente do projeto).
    return enfileirado;
  }
}
