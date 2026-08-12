import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { PlatformAuthService, ipDaRequisicao, type StaffAutenticado } from './platform-auth.service';
import {
  CurrentContext,
  CurrentStaff,
  PermitirSenhaPendente,
  PlatformGuard,
} from './platform.guard';
import { COOKIE_SESSAO, ROTULO_PAPEL, type PlatformRole } from './platform.constants';
import { LoginDto, TrocarPropriaSenhaDto } from './platform.dto';

/**
 * Sessão do console de suporte. Ver estudo 135.
 *
 * O cookie é HOST-ONLY de propósito: nada de atributo `Domain`. O Better Auth
 * compartilha o dele em `.salonpass.com.br` (better-auth.ts:208-213) porque o
 * clube precisa enxergar a sessão do painel; repetir isso aqui espalharia o
 * cookie do suporte por `app.` e `agenda.`, que é justamente o que não pode.
 */
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly auth: PlatformAuthService) {}

  private cookieOptions(maxAgeMs: number) {
    // `Secure` fora de desenvolvimento: em produção o console só existe em
    // HTTPS, e sem a flag o cookie viaja em claro num downgrade.
    const producao = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: producao,
      sameSite: 'lax' as const,
      // Escopo mínimo: o cookie não é enviado para nenhuma outra rota da API.
      path: '/api/v1/platform',
      maxAge: maxAgeMs,
    };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const contexto = {
      ip: ipDaRequisicao(req as never),
      userAgent: req.headers['user-agent'] ?? null,
    };

    const { token, expiraEm, staff } = await this.auth.login(dto.email, dto.senha, contexto);

    // Faxina oportunista: o login é frequente o bastante e não exige um
    // processo de fundo só para isso.
    void this.auth.limparSessoesVencidas();

    res.cookie(COOKIE_SESSAO, token, this.cookieOptions(expiraEm.getTime() - Date.now()));

    return {
      staff: this.publico(staff),
      expiraEm,
      // Sinaliza para o console mandar direto à tela de troca.
      trocarSenha: staff.mustChangePassword,
    };
  }

  @UseGuards(PlatformGuard)
  @PermitirSenhaPendente()
  @Get('me')
  me(@CurrentStaff() staff: StaffAutenticado) {
    return this.publico(staff);
  }

  @UseGuards(PlatformGuard)
  @PermitirSenhaPendente()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @CurrentStaff() staff: StaffAutenticado,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.encerrarSessao(staff.sessionId);
    res.clearCookie(COOKIE_SESSAO, { path: '/api/v1/platform' });
    return { ok: true };
  }

  /**
   * Troca da própria senha. Liberada com `mustChangePassword` pendente — é
   * exatamente a rota que precisa responder nesse estado.
   */
  @UseGuards(PlatformGuard)
  @PermitirSenhaPendente()
  @Post('senha')
  @HttpCode(200)
  async trocarSenha(
    @CurrentStaff() staff: StaffAutenticado,
    @Body() dto: TrocarPropriaSenhaDto,
    @CurrentContext() ctx: { ip: string | null; userAgent: string | null },
  ) {
    await this.auth.trocarPropriaSenha(staff, dto.senhaAtual, dto.senhaNova, ctx);
    return { ok: true };
  }

  /** Sessões abertas do próprio técnico. */
  @UseGuards(PlatformGuard)
  @Get('sessoes')
  sessoes(@CurrentStaff('staffId') staffId: string) {
    return this.auth.sessoesAtivas(staffId);
  }

  /** Derruba as OUTRAS sessões do próprio técnico ("saí em outro computador"). */
  @UseGuards(PlatformGuard)
  @Post('sessoes/encerrar-outras')
  @HttpCode(200)
  async encerrarOutras(@CurrentStaff() staff: StaffAutenticado) {
    const count = await this.auth.encerrarSessoesDoStaff(staff.staffId, staff.sessionId);
    return { sessoesEncerradas: count };
  }

  /**
   * Forma pública do técnico. `capacidades` vai junto para o console esconder o
   * que ele não pode fazer — o guard continua sendo quem decide de verdade.
   */
  private publico(staff: StaffAutenticado) {
    return {
      id: staff.staffId,
      nome: staff.nome,
      email: staff.email,
      papel: staff.papel,
      rotuloPapel: ROTULO_PAPEL[staff.papel as PlatformRole],
      capacidades: staff.capacidades,
      mustChangePassword: staff.mustChangePassword,
    };
  }
}
