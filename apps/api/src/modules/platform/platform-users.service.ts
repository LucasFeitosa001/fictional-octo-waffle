import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import type { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { generateTemporaryPassword } from '../users/users.module';
import { PlatformAuditService, type AtorAuditoria } from './platform-audit.service';
import { ACOES, PERSONIFICACAO_DURACAO_MS } from './platform.constants';
import type {
  AlterarEmailDto,
  AlternarAtivoDto,
  BuscarUsuariosDto,
  DesvincularOauthDto,
  PersonificarDto,
  ResetarSenhaDto,
  SoJustificativaDto,
} from './platform.dto';

/**
 * Operações do console sobre contas de salão. Ver estudo 135.
 *
 * Toda escrita segue a mesma ordem: valida a justificativa → lê o estado antes
 * → executa → audita. Auditar antes correria o risco de registrar o que não
 * aconteceu; auditar sem o "antes" tira da trilha justamente o que permite
 * julgar a mudança depois.
 */
@Injectable()
export class PlatformUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PlatformAuditService,
  ) {}

  // =====================================================================
  // Consulta
  // =====================================================================

  async buscar(filtros: BuscarUsuariosDto) {
    const pagina = Math.max(1, filtros.pagina ?? 1);
    const porPagina = Math.min(100, Math.max(1, filtros.porPagina ?? 25));

    const where: Prisma.UserWhereInput = {};
    if (filtros.companyId) {
      // Empresa principal OU qualquer vínculo — um usuário multi-conta precisa
      // aparecer na busca do salão onde ele de fato trabalha, não só na do
      // salão que por acaso está em User.companyId.
      where.OR = [
        { companyId: filtros.companyId },
        { userCompanies: { some: { companyId: filtros.companyId } } },
      ];
    }
    if (filtros.accountType) where.accountType = filtros.accountType;
    if (filtros.ativo) where.active = filtros.ativo === 'true';

    const termo = filtros.busca?.trim();
    if (termo) {
      const porTermo: Prisma.UserWhereInput[] = [
        { email: { contains: termo, mode: 'insensitive' } },
        { name: { contains: termo, mode: 'insensitive' } },
        { phone: { contains: termo } },
        { id: termo },
      ];
      // `where.OR` pode já estar ocupado pelo filtro de empresa; combinar os dois
      // com AND preserva os dois sentidos em vez de um sobrescrever o outro.
      where.AND = [...((where.AND as Prisma.UserWhereInput[]) ?? []), { OR: porTermo }];
    }

    const [data, total] = await Promise.all([
      this.prisma.client.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          active: true,
          accountType: true,
          provider: true,
          createdAt: true,
          company: { select: { id: true, name: true, active: true } },
          _count: { select: { userCompanies: true, sessions: true } },
        },
      }),
      this.prisma.client.user.count({ where }),
    ]);

    return { data, pagina, porPagina, total };
  }

  async detalhe(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        active: true,
        accountType: true,
        provider: true,
        emailVerified: true,
        image: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
        company: { select: { id: true, name: true, active: true } },
        userCompanies: {
          select: {
            companyId: true,
            permissions: true,
            createdAt: true,
            company: { select: { id: true, name: true, active: true } },
            role: { select: { id: true, code: true, name: true } },
          },
        },
        // NUNCA `password` aqui: o detalhe alimenta a tela do console, e hash de
        // senha não tem por que trafegar para o navegador de ninguém.
        accounts: {
          select: { id: true, providerId: true, accountId: true, createdAt: true },
        },
        sessions: {
          where: { expiresAt: { gt: new Date() } },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            updatedAt: true,
            expiresAt: true,
            activeCompanyId: true,
            impersonatedByStaffId: true,
          },
        },
        professional: { select: { id: true, name: true, companyId: true } },
      },
    });

    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // Últimas ações do console sobre ESTA conta — o histórico fica na própria
    // tela, sem obrigar o técnico a ir até a auditoria e filtrar na mão.
    const historico = await this.prisma.client.platformAuditLog.findMany({
      where: { targetType: 'user', targetId: userId },
      orderBy: { at: 'desc' },
      take: 20,
    });

    return { ...user, historico };
  }

  // =====================================================================
  // Trocar e-mail
  // =====================================================================

  async alterarEmail(ator: AtorAuditoria, userId: string, dto: AlterarEmailDto) {
    const motivo = this.auditoria.exigirJustificativa(ACOES.usuarioEmailAlterado, dto.reason);
    const novo = dto.email.trim().toLowerCase();

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, companyId: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (user.email.toLowerCase() === novo) {
      throw new BadRequestException('O usuário já usa este e-mail.');
    }

    const ocupado = await this.prisma.client.user.findUnique({
      where: { email: novo },
      select: { id: true },
    });
    if (ocupado) {
      throw new BadRequestException('Já existe uma conta com este e-mail.');
    }

    // Só User.email: para providerId='credential' o Account guarda o ID do
    // usuário em accountId, não o e-mail (conferido — ver estudo 135.4). Mexer
    // no Account aqui é que quebraria o login.
    //
    // As sessões caem junto: quem pede troca de e-mail pode estar recuperando
    // uma conta invadida, e manter a sessão do invasor viva esvaziaria o gesto.
    const [, sessoes] = await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id: userId }, data: { email: novo } }),
      this.prisma.client.session.deleteMany({ where: { userId } }),
    ]);

    await this.auditoria.registrar(ator, {
      action: ACOES.usuarioEmailAlterado,
      targetType: 'user',
      targetId: userId,
      targetLabel: user.email,
      companyId: user.companyId,
      reason: motivo,
      before: { email: user.email },
      after: { email: novo, sessoesEncerradas: sessoes.count },
    });

    return { id: userId, email: novo, sessoesEncerradas: sessoes.count };
  }

  // =====================================================================
  // Resetar senha
  // =====================================================================

  async resetarSenha(ator: AtorAuditoria, userId: string, dto: ResetarSenhaDto) {
    const motivo = this.auditoria.exigirJustificativa(ACOES.usuarioSenhaResetada, dto.reason);

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, companyId: true, accountType: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const gerada = !dto.senha;
    const senha = dto.senha ?? generateTemporaryPassword(16);
    const hash = await hashPassword(senha);

    // A credencial vive em Account(providerId='credential'), não em
    // User.passwordHash — ver users.module.ts:212-216. Uma conta que só entrou
    // pelo Google não tem essa linha; nesse caso criamos, senão o reset seria
    // um sucesso silencioso que não muda nada.
    const credencial = await this.prisma.client.account.findFirst({
      where: { userId, providerId: 'credential' },
      select: { id: true },
    });

    const encerrar = dto.encerrarSessoes !== false;

    await this.prisma.client.$transaction(async (tx) => {
      if (credencial) {
        await tx.account.update({ where: { id: credencial.id }, data: { password: hash } });
      } else {
        await tx.account.create({
          data: { userId, providerId: 'credential', accountId: userId, password: hash },
        });
      }
      // NÃO gravamos `User.passwordHash`. A coluna existe no schema mas ninguém
      // a lê — conferido: as duas únicas menções no repositório são comentários
      // dizendo justamente que o login usa Account (users.module.ts:212,
      // seed.ts:138). Escrever ali criaria uma segunda cópia do hash, sem
      // leitor, só aumentando a superfície exposta num vazamento de banco.
      if (encerrar) {
        await tx.session.deleteMany({ where: { userId } });
      }
    });

    await this.auditoria.registrar(ator, {
      action: ACOES.usuarioSenhaResetada,
      targetType: 'user',
      targetId: userId,
      targetLabel: user.email,
      companyId: user.companyId,
      reason: motivo,
      after: {
        senhaGeradaPelaApi: gerada,
        credencialCriada: !credencial,
        sessoesEncerradas: encerrar,
      },
    });

    // A senha só existe nesta resposta. Não é persistida em texto puro nem
    // registrada na auditoria (sanitizar() derrubaria o campo de qualquer jeito).
    return {
      id: userId,
      email: user.email,
      senhaTemporaria: gerada ? senha : undefined,
      sessoesEncerradas: encerrar,
    };
  }

  // =====================================================================
  // Sessões
  // =====================================================================

  async encerrarSessoes(ator: AtorAuditoria, userId: string, dto: SoJustificativaDto) {
    const motivo = this.auditoria.exigirJustificativa(ACOES.usuarioSessoesEncerradas, dto.reason);

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, companyId: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const { count } = await this.prisma.client.session.deleteMany({ where: { userId } });

    await this.auditoria.registrar(ator, {
      action: ACOES.usuarioSessoesEncerradas,
      targetType: 'user',
      targetId: userId,
      targetLabel: user.email,
      companyId: user.companyId,
      reason: motivo,
      after: { sessoesEncerradas: count },
    });

    return { id: userId, sessoesEncerradas: count };
  }

  // =====================================================================
  // Ativar / desativar
  // =====================================================================

  async alternarAtivo(ator: AtorAuditoria, userId: string, dto: AlternarAtivoDto) {
    const acao = dto.ativo ? ACOES.usuarioReativado : ACOES.usuarioDesativado;
    const motivo = this.auditoria.exigirJustificativa(acao, dto.reason);

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, active: true, companyId: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.active === dto.ativo) {
      throw new BadRequestException(
        dto.ativo ? 'A conta já está ativa.' : 'A conta já está desativada.',
      );
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { active: dto.ativo } });
      // Desativar sem derrubar a sessão não desativa nada: o usuário seguiria
      // trabalhando até o cookie vencer.
      if (!dto.ativo) {
        await tx.session.deleteMany({ where: { userId } });
      }
    });

    await this.auditoria.registrar(ator, {
      action: acao,
      targetType: 'user',
      targetId: userId,
      targetLabel: user.email,
      companyId: user.companyId,
      reason: motivo,
      before: { active: user.active },
      after: { active: dto.ativo },
    });

    return { id: userId, active: dto.ativo };
  }

  // =====================================================================
  // Desvincular login social
  // =====================================================================

  async desvincularOauth(ator: AtorAuditoria, userId: string, dto: DesvincularOauthDto) {
    const motivo = this.auditoria.exigirJustificativa(ACOES.usuarioOauthDesvinculado, dto.reason);

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, companyId: true },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    if (dto.providerId === 'credential') {
      throw new BadRequestException(
        'Esta rota desvincula login social. Para tirar a senha, use o reset.',
      );
    }

    const contas = await this.prisma.client.account.findMany({
      where: { userId },
      select: { id: true, providerId: true },
    });
    const alvo = contas.find((c) => c.providerId === dto.providerId);
    if (!alvo) {
      throw new BadRequestException(`O usuário não tem login vinculado com ${dto.providerId}.`);
    }
    // Tirar o último meio de entrar deixa a conta órfã. Melhor recusar e mandar
    // definir uma senha antes.
    if (contas.length <= 1) {
      throw new BadRequestException(
        'É o único meio de acesso da conta. Defina uma senha antes de desvincular.',
      );
    }

    await this.prisma.client.account.delete({ where: { id: alvo.id } });

    await this.auditoria.registrar(ator, {
      action: ACOES.usuarioOauthDesvinculado,
      targetType: 'user',
      targetId: userId,
      targetLabel: user.email,
      companyId: user.companyId,
      reason: motivo,
      before: { providers: contas.map((c) => c.providerId) },
      after: { desvinculado: dto.providerId },
    });

    return { id: userId, desvinculado: dto.providerId };
  }

  // =====================================================================
  // Entrar como (personificação)
  // =====================================================================

  /**
   * Cria uma sessão de salão em nome do usuário, marcada com o técnico.
   *
   * O token é gerado aqui em vez de sair do Better Auth porque não existe
   * caminho no Better Auth para abrir sessão de terceiro sem a senha dele. A
   * `Session` criada é idêntica à de um login normal — o que o BetterAuthGuard
   * lê (`token`, `expiresAt`, `activeCompanyId`) está tudo preenchido — exceto
   * por `impersonatedByStaffId`, que é o que permite reconhecê-la depois.
   *
   * Dura 30 min e nasce auditada. Ver estudo 135.6.
   */
  async personificar(ator: AtorAuditoria, userId: string, dto: PersonificarDto) {
    const motivo = this.auditoria.exigirJustificativa(ACOES.usuarioPersonificado, dto.reason);

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        companyId: true,
        userCompanies: { select: { companyId: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (!user.active) {
      throw new BadRequestException('Não é possível entrar como um usuário desativado.');
    }

    // A empresa precisa ser uma em que o usuário REALMENTE tem vínculo, senão a
    // sessão nasceria condenada: o BetterAuthGuard exige UserCompany e devolveria
    // 403 em toda chamada (jwt-auth.guard.ts:66-73).
    const vinculadas = new Set(user.userCompanies.map((v) => v.companyId));
    const empresa = dto.companyId ?? user.companyId;
    if (!empresa) {
      throw new BadRequestException('O usuário não tem empresa vinculada.');
    }
    if (!vinculadas.has(empresa)) {
      throw new BadRequestException('O usuário não tem vínculo com esta empresa.');
    }

    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + PERSONIFICACAO_DURACAO_MS);

    const sessao = await this.prisma.client.session.create({
      data: {
        userId,
        token,
        expiresAt: expiraEm,
        activeCompanyId: empresa,
        ipAddress: ator.ip ?? null,
        userAgent: ator.userAgent?.slice(0, 500) ?? null,
        impersonatedByStaffId: ator.staffId,
      },
      select: { id: true },
    });

    await this.auditoria.registrar(ator, {
      action: ACOES.usuarioPersonificado,
      targetType: 'user',
      targetId: userId,
      targetLabel: user.email,
      companyId: empresa,
      reason: motivo,
      after: { sessionId: sessao.id, expiraEm: expiraEm.toISOString(), empresa },
    });

    // O token vai UMA vez, para o console montar o acesso. Guardado como está
    // porque é assim que o Better Auth o procura (Session.token é @unique e a
    // busca do getSession é por igualdade) — é a mesma exposição de qualquer
    // sessão de salão, não uma concessão nova.
    return {
      token,
      expiraEm,
      sessionId: sessao.id,
      usuario: { id: user.id, nome: user.name, email: user.email },
      companyId: empresa,
    };
  }
}
