import {
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
import { IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { WhatsappService } from './whatsapp.service';

/**
 * Admin-only endpoints to link / inspect the salon's WhatsApp account. Gated by
 * a shared secret in the query string (WHATSAPP_ADMIN_TOKEN) — whoever can open
 * the QR could otherwise link an arbitrary phone to our session, so it must not
 * be public.
 */
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  private assertToken(token?: string): void {
    const expected = process.env.WHATSAPP_ADMIN_TOKEN;
    if (!expected || token !== expected) throw new ForbiddenException('Token inválido');
  }

  @Get('status')
  status(@Query('token') token?: string) {
    this.assertToken(token);
    return this.whatsapp.getStatus();
  }

  // PNG of the current pairing QR (204 when already connected / none pending).
  @Get('qr.png')
  async qrPng(@Res() res: Response, @Query('token') token?: string) {
    this.assertToken(token);
    const dataUrl = await this.whatsapp.getQrDataUrl();
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
  qrPage(@Query('token') token?: string): string {
    this.assertToken(token);
    const t = encodeURIComponent(token ?? '');
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
  async function tick(){
    try{
      var s=await fetch("status?token="+TOKEN).then(r=>r.json());
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
        img.src="qr.png?token="+TOKEN+"&t="+Date.now();
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
  async pair(@Query('token') token?: string, @Query('phone') phone?: string) {
    this.assertToken(token);
    const code = await this.whatsapp.requestPairingCode(phone ?? '');
    return { code };
  }

  @Post('logout')
  async logout(@Query('token') token?: string) {
    this.assertToken(token);
    await this.whatsapp.logout();
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
 * instead of the ops-only token flow. Same single global session under the hood
 * (App Runner stays at one instance), just gated by the normal session guard so
 * no shared secret is needed in the UI.
 */
@UseGuards(JwtAuthGuard)
@Controller('whatsapp/connection')
export class WhatsappConnectionController {
  constructor(private readonly whatsapp: WhatsappService) {}

  @Get('status')
  status() {
    return this.whatsapp.getStatus();
  }

  @Get('qr.png')
  async qrPng(@Res() res: Response) {
    const dataUrl = await this.whatsapp.getQrDataUrl();
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
  async pair(@Body() dto: PairWhatsappDto) {
    const code = await this.whatsapp.requestPairingCode(dto.phone ?? '');
    return { code };
  }

  @Post('logout')
  async logout() {
    await this.whatsapp.logout();
    return { ok: true };
  }

  // Manager/reception number that RECEIVES the "confirm this booking?" prompt and
  // whose replies (1/2/3) drive the confirmation flow. Scoped to the logged-in
  // company, so each salon sets its own.
  @Get('manager')
  async getManager(@CurrentUser('companyId') companyId: string) {
    const phone = await this.whatsapp.getManagerPhone(companyId);
    return { phone };
  }

  @Post('manager')
  async setManager(
    @CurrentUser('companyId') companyId: string,
    @Body() dto: ManagerPhoneDto,
  ) {
    await this.whatsapp.setManagerPhone(companyId, dto.phone ?? '');
    const phone = await this.whatsapp.getManagerPhone(companyId);
    return { phone };
  }
}
