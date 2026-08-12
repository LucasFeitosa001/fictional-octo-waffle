import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import type { PlatformStaff } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAuditService } from './platform-audit.service';
import {
  ACOES,
  BLOQUEIO_LOGIN_MS,
  MAX_TENTATIVAS_LOGIN,
  SENHA_MINIMA,
  SESSAO_DURACAO_MS,
  SESSAO_OCIOSA_MS,
  SESSAO_TOQUE_MINIMO_MS,
  capacidadesDe,
  type PlatformCapability,
  type PlatformRole,
} from './platform.constants';

/** Contexto do técnico autenticado, anexado ao request pelo guard. */
export type StaffAutenticado = {
  staffId: string;
  email: string;
  nome: string;
  papel: PlatformRole;
  capacidades: PlatformCapability[];
  sessionId: string;
  mustChangePassword: boolean;
};

/**
 * Hash do token de sessão. SHA-256 puro basta: o token é 32 bytes aleatórios,
 * não uma senha escolhida por gente — não há dicionário a proteger, e um KDF
 * lento aqui só encareceria CADA requisição do console.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** IP real considerando o proxy do App Runner. */
export function ipDaRequisicao(req: {
  headers: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): string | null {
  const encaminhado = req.headers['x-forwarded-for'];
  if (typeof encaminhado === 'string' && encaminhado.trim()) {
    // O primeiro da lista é o cliente; o resto são os proxies do caminho.
    return encaminhado.split(',')[0]!.trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? null;
}

@Injectable()
export class PlatformAuthService {
  private readonly log = new Logger('PlatformAuth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PlatformAuditService,
  ) {}

  // =====================================================================
  // Senha
  // =====================================================================

  /** Mesmo hasher do login de salão (scrypt do Better Auth). Ver estudo 135.3. */
  async gerarHash(senha: string): Promise<string> {
    return hashPassword(senha);
  }

  async conferirSenha(hash: string, senha: string): Promise<boolean> {
    try {
      return await verifyPassword({ hash, password: senha });
    } catch {
      // Hash corrompido ou em formato desconhecido: recusa, não explode.
      return false;
    }
  }

  /**
   * Política de senha do console. Mais dura que a do salão (12 caracteres, três
   * classes) porque uma conta aqui alcança todos os salões.
   */
  validarForcaDaSenha(senha: string): void {
    if (senha.length < SENHA_MINIMA) {
      throw new BadRequestException(
        `A senha do console precisa de pelo menos ${SENHA_MINIMA} caracteres.`,
      );
    }
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(senha)).length;
    if (classes < 3) {
      throw new BadRequestException(
        'Use pelo menos três tipos de caractere entre minúscula, maiúscula, número e símbolo.',
      );
    }
  }

  // =====================================================================
  // Login
  // =====================================================================

  /**
   * Autentica e abre sessão.
   *
   * Sempre devolve a MESMA mensagem para e-mail inexistente, senha errada e
   * conta desativada. Diferenciar transformaria a tela de login num verificador
   * de quem trabalha aqui — e a lista de técnicos é justamente o alvo de quem
   * quer o console.
   */
  async login(
    email: string,
    senha: string,
    contexto: { ip: string | null; userAgent: string | null },
  ): Promise<{ token: string; expiraEm: Date; staff: StaffAutenticado }> {
    const normalizado = email.trim().toLowerCase();
    const generico = new UnauthorizedException('E-mail ou senha inválidos.');

    const staff = await this.prisma.client.platformStaff.findUnique({
      where: { email: normalizado },
    });

    if (!staff) {
      // Gasta trabalho equivalente ao de uma verificação real para o TEMPO de
      // resposta não denunciar quais e-mails existem.
      //
      // `hashPassword` e não `conferirSenha` com um hash inventado: aquele
      // formato inválido faz o verificador lançar de imediato, e o catch
      // devolve em microssegundos — ou seja, a versão anterior disto não
      // protegia nada. Derivar a chave custa o mesmo scrypt do caminho certo.
      await hashPassword(senha).catch(() => undefined);
      await this.auditoria.registrar(
        { staffId: null, staffEmail: normalizado, ip: contexto.ip, userAgent: contexto.userAgent },
        {
          action: ACOES.loginRecusado,
          targetType: 'platform_staff',
          targetLabel: normalizado,
          after: { motivo: 'conta inexistente' },
        },
      );
      throw generico;
    }

    const agora = new Date();
    if (staff.lockedUntil && staff.lockedUntil > agora) {
      const minutos = Math.ceil((staff.lockedUntil.getTime() - agora.getTime()) / 60000);
      throw new UnauthorizedException(
        `Conta temporariamente bloqueada por tentativas seguidas. Tente de novo em ${minutos} min.`,
      );
    }

    const senhaConfere = await this.conferirSenha(staff.passwordHash, senha);

    if (!senhaConfere || !staff.active) {
      await this.registrarFalha(staff, contexto, senhaConfere ? 'conta desativada' : 'senha inválida');
      throw generico;
    }

    // Acerto: zera a trava e abre a sessão.
    await this.prisma.client.platformStaff.update({
      where: { id: staff.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: agora },
    });

    const { token, expiraEm, sessionId } = await this.abrirSessao(staff.id, contexto);

    await this.auditoria.registrar(
      { staffId: staff.id, staffEmail: staff.email, ip: contexto.ip, userAgent: contexto.userAgent },
      { action: ACOES.loginOk, targetType: 'platform_staff', targetId: staff.id, targetLabel: staff.email },
    );

    return {
      token,
      expiraEm,
      staff: this.montarContexto(staff, sessionId),
    };
  }

  private async registrarFalha(
    staff: PlatformStaff,
    contexto: { ip: string | null; userAgent: string | null },
    motivo: string,
  ): Promise<void> {
    const tentativas = staff.failedLoginCount + 1;
    const bloquear = tentativas >= MAX_TENTATIVAS_LOGIN;

    await this.prisma.client.platformStaff.update({
      where: { id: staff.id },
      data: {
        failedLoginCount: bloquear ? 0 : tentativas,
        lockedUntil: bloquear ? new Date(Date.now() + BLOQUEIO_LOGIN_MS) : staff.lockedUntil,
      },
    });

    if (bloquear) {
      this.log.warn(`conta ${staff.email} bloqueada após ${MAX_TENTATIVAS_LOGIN} tentativas`);
    }

    await this.auditoria.registrar(
      { staffId: staff.id, staffEmail: staff.email, ip: contexto.ip, userAgent: contexto.userAgent },
      {
        action: ACOES.loginRecusado,
        targetType: 'platform_staff',
        targetId: staff.id,
        targetLabel: staff.email,
        after: { motivo, tentativas, bloqueada: bloquear },
      },
    );
  }

  // =====================================================================
  // Sessão
  // =====================================================================

  private async abrirSessao(
    staffId: string,
    contexto: { ip: string | null; userAgent: string | null },
  ): Promise<{ token: string; expiraEm: Date; sessionId: string }> {
    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + SESSAO_DURACAO_MS);

    const sessao = await this.prisma.client.platformSession.create({
      data: {
        staffId,
        tokenHash: hashToken(token),
        expiresAt: expiraEm,
        ipAddress: contexto.ip,
        userAgent: contexto.userAgent?.slice(0, 500) ?? null,
      },
      select: { id: true },
    });

    return { token, expiraEm, sessionId: sessao.id };
  }

  /**
   * Valida o token e devolve o contexto do técnico. Usado pelo guard em toda
   * requisição.
   *
   * Devolve null (em vez de lançar) para o guard decidir a mensagem — e para
   * nunca distinguir "token inexistente" de "expirado" para quem chama.
   */
  async validarSessao(token: string): Promise<StaffAutenticado | null> {
    if (!token) return null;

    const sessao = await this.prisma.client.platformSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { staff: true },
    });

    if (!sessao || sessao.revokedAt) return null;

    const agora = Date.now();

    // Prazo absoluto.
    if (sessao.expiresAt.getTime() <= agora) return null;

    // Prazo ocioso.
    if (agora - sessao.lastSeenAt.getTime() > SESSAO_OCIOSA_MS) {
      await this.prisma.client.platformSession.update({
        where: { id: sessao.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    // Conta desativada no meio da sessão derruba na hora — sem esperar o prazo.
    if (!sessao.staff.active) {
      await this.prisma.client.platformSession.update({
        where: { id: sessao.id },
        data: { revokedAt: new Date() },
      });
      return null;
    }

    // Toque com folga: evita um UPDATE por requisição.
    if (agora - sessao.lastSeenAt.getTime() > SESSAO_TOQUE_MINIMO_MS) {
      await this.prisma.client.platformSession
        .update({ where: { id: sessao.id }, data: { lastSeenAt: new Date() } })
        .catch(() => undefined);
    }

    return this.montarContexto(sessao.staff, sessao.id);
  }

  private montarContexto(staff: PlatformStaff, sessionId: string): StaffAutenticado {
    const papel = staff.role as PlatformRole;
    return {
      staffId: staff.id,
      email: staff.email,
      nome: staff.name,
      papel,
      capacidades: capacidadesDe(papel),
      sessionId,
      mustChangePassword: staff.mustChangePassword,
    };
  }

  async encerrarSessao(sessionId: string): Promise<void> {
    await this.prisma.client.platformSession
      .updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  /** Derruba TODAS as sessões de um técnico (desativação, troca de senha). */
  async encerrarSessoesDoStaff(staffId: string, exceto?: string): Promise<number> {
    const { count } = await this.prisma.client.platformSession.updateMany({
      where: { staffId, revokedAt: null, ...(exceto ? { id: { not: exceto } } : {}) },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  async sessoesAtivas(staffId: string) {
    return this.prisma.client.platformSession.findMany({
      where: { staffId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });
  }

  // =====================================================================
  // Troca da própria senha
  // =====================================================================

  async trocarPropriaSenha(
    staff: StaffAutenticado,
    senhaAtual: string,
    senhaNova: string,
    contexto: { ip: string | null; userAgent: string | null },
  ): Promise<void> {
    const linha = await this.prisma.client.platformStaff.findUnique({
      where: { id: staff.staffId },
    });
    if (!linha) throw new UnauthorizedException('Sessão inválida.');

    const confere = await this.conferirSenha(linha.passwordHash, senhaAtual);
    if (!confere) throw new BadRequestException('A senha atual não confere.');

    // Comparação em tempo constante só para não vazar, por tempo, se a nova é
    // igual à atual — detalhe pequeno, mas de graça.
    const iguais =
      senhaAtual.length === senhaNova.length &&
      timingSafeEqual(Buffer.from(senhaAtual), Buffer.from(senhaNova));
    if (iguais) {
      throw new BadRequestException('A senha nova precisa ser diferente da atual.');
    }

    this.validarForcaDaSenha(senhaNova);

    await this.prisma.client.platformStaff.update({
      where: { id: staff.staffId },
      data: { passwordHash: await this.gerarHash(senhaNova), mustChangePassword: false },
    });

    // Trocar a senha invalida as OUTRAS sessões: se a troca foi por suspeita de
    // vazamento, deixar as demais vivas anula o gesto. A atual sobrevive para o
    // técnico não ser expulso da própria tela.
    await this.encerrarSessoesDoStaff(staff.staffId, staff.sessionId);

    await this.auditoria.registrar(
      { staffId: staff.staffId, staffEmail: staff.email, ip: contexto.ip, userAgent: contexto.userAgent },
      { action: ACOES.senhaPropriaAlterada, targetType: 'platform_staff', targetId: staff.staffId, targetLabel: staff.email },
    );
  }

  /**
   * Faxina de sessões vencidas. Não roda sozinha — é chamada no login, que é
   * frequente o bastante e não acrescenta processo de fundo nenhum.
   */
  async limparSessoesVencidas(): Promise<void> {
    await this.prisma.client.platformSession
      .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } })
      .catch(() => undefined);
  }
}
