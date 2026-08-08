import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformAuthService, ipDaRequisicao, type StaffAutenticado } from './platform-auth.service';
import { COOKIE_SESSAO, type PlatformCapability } from './platform.constants';

export const CAPACIDADE_KEY = 'platform:capacidade';

/**
 * Exige uma capacidade do console. Sem o decorador a rota fica disponível a
 * qualquer técnico autenticado — use só para as que são de fato universais
 * (o próprio /me, logout, troca da própria senha).
 */
export const RequireCapability = (...capacidades: PlatformCapability[]) =>
  SetMetadata(CAPACIDADE_KEY, capacidades);

/** Marca a rota como acessível mesmo com `mustChangePassword` pendente. */
export const SENHA_PENDENTE_OK = 'platform:senha-pendente-ok';
export const PermitirSenhaPendente = () => SetMetadata(SENHA_PENDENTE_OK, true);

/** Técnico autenticado. `@CurrentStaff()` ou `@CurrentStaff('staffId')`. */
export const CurrentStaff = createParamDecorator(
  (campo: keyof StaffAutenticado | undefined, ctx: ExecutionContext) => {
    const staff = ctx.switchToHttp().getRequest().staff as StaffAutenticado | undefined;
    return campo ? staff?.[campo] : staff;
  },
);

/** IP + user-agent já normalizados, para alimentar a auditoria. */
export const CurrentContext = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return {
    ip: ipDaRequisicao(req),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
  };
});

/**
 * Lê um cookie do cabeçalho bruto.
 *
 * Feito à mão porque a API desliga o body parser do Nest e não registra
 * cookie-parser (`main.ts` monta o handler do Better Auth antes de tudo, e o
 * Better Auth lê o cabeçalho por conta própria). Uma dependência a mais só para
 * isto não se paga.
 */
export function lerCookie(cabecalho: string | undefined, nome: string): string | null {
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(';')) {
    const separador = parte.indexOf('=');
    if (separador < 0) continue;
    if (parte.slice(0, separador).trim() !== nome) continue;
    try {
      return decodeURIComponent(parte.slice(separador + 1).trim());
    } catch {
      return parte.slice(separador + 1).trim();
    }
  }
  return null;
}

/**
 * Guard do console de suporte.
 *
 * Independente do BetterAuthGuard de propósito — ver estudo 135.2. Aquele exige
 * `companyId` + `UserCompany` em toda requisição, e um técnico da SalonPass não
 * pertence a salão nenhum. São dois espaços de credencial sem interseção.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: PlatformAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Cookie no navegador; Bearer só para teste automatizado e curl de apoio.
    const doCookie = lerCookie(req.headers?.cookie, COOKIE_SESSAO);
    const cabecalho = req.headers?.authorization;
    const doBearer =
      typeof cabecalho === 'string' && cabecalho.startsWith('Bearer ')
        ? cabecalho.slice(7).trim()
        : null;

    const staff = await this.auth.validarSessao(doCookie ?? doBearer ?? '');
    if (!staff) {
      throw new UnauthorizedException('Sessão do console inválida ou expirada.');
    }

    req.staff = staff;

    // Senha temporária pendente: só as rotas marcadas respondem. Sem isto, uma
    // conta recém-criada usaria o console inteiro sem nunca trocar a senha que
    // veio pronta de outra pessoa.
    const liberadaComSenhaPendente = this.reflector.getAllAndOverride<boolean>(SENHA_PENDENTE_OK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (staff.mustChangePassword && !liberadaComSenhaPendente) {
      throw new ForbiddenException('Troque a senha temporária antes de usar o console.');
    }

    const exigidas = this.reflector.getAllAndOverride<PlatformCapability[] | undefined>(
      CAPACIDADE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!exigidas || exigidas.length === 0) return true;

    // Basta UMA das capacidades exigidas (OR), como no PermissionGuard do tenant.
    if (exigidas.some((c) => staff.capacidades.includes(c))) return true;

    throw new ForbiddenException('Seu perfil não permite esta ação.');
  }
}
