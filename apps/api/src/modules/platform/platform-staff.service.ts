import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { generateTemporaryPassword } from '../users/users.module';
import { PlatformAuditService, type AtorAuditoria } from './platform-audit.service';
import { PlatformAuthService, type StaffAutenticado } from './platform-auth.service';
import { ACOES, ROTULO_PAPEL, type PlatformRole } from './platform.constants';
import type {
  AlterarTecnicoDto,
  AlternarTecnicoAtivoDto,
  CriarTecnicoDto,
  SoJustificativaDto,
} from './platform.dto';

/**
 * Gestão dos próprios técnicos da SalonPass. Só `owner` chega aqui — ver a
 * matriz em platform.constants.ts.
 */
@Injectable()
export class PlatformStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PlatformAuditService,
    private readonly auth: PlatformAuthService,
  ) {}

  private readonly campos = {
    id: true,
    name: true,
    email: true,
    role: true,
    active: true,
    mustChangePassword: true,
    lastLoginAt: true,
    lockedUntil: true,
    failedLoginCount: true,
    createdAt: true,
    updatedAt: true,
    createdBy: { select: { id: true, name: true, email: true } },
  } as const;

  async listar() {
    const data = await this.prisma.client.platformStaff.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: this.campos,
    });

    // Sessões vivas por técnico: quem está com o console aberto agora.
    const vivas = await this.prisma.client.platformSession.groupBy({
      by: ['staffId'],
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      _count: { _all: true },
    });
    const porStaff = new Map(vivas.map((v) => [v.staffId, v._count._all]));

    return {
      data: data.map((t) => ({
        ...t,
        rotuloPapel: ROTULO_PAPEL[t.role as PlatformRole],
        sessoesAtivas: porStaff.get(t.id) ?? 0,
      })),
    };
  }

  async detalhe(staffId: string) {
    const staff = await this.prisma.client.platformStaff.findUnique({
      where: { id: staffId },
      select: this.campos,
    });
    if (!staff) throw new NotFoundException('Técnico não encontrado.');

    const [sessoes, historico] = await Promise.all([
      this.auth.sessoesAtivas(staffId),
      this.prisma.client.platformAuditLog.findMany({
        where: { staffId },
        orderBy: { at: 'desc' },
        take: 30,
      }),
    ]);

    return { ...staff, rotuloPapel: ROTULO_PAPEL[staff.role as PlatformRole], sessoes, historico };
  }

  async criar(ator: AtorAuditoria, dto: CriarTecnicoDto) {
    const email = dto.email.trim().toLowerCase();

    const existente = await this.prisma.client.platformStaff.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existente) throw new BadRequestException('Já existe um técnico com este e-mail.');

    const gerada = !dto.senha;
    const senha = dto.senha ?? generateTemporaryPassword(16);
    // Senha escolhida por quem cria passa pela mesma política; a gerada já nasce
    // forte, mas validar as duas evita depender do formato do gerador.
    this.auth.validarForcaDaSenha(senha);

    const criado = await this.prisma.client.platformStaff.create({
      data: {
        name: dto.nome.trim(),
        email,
        role: dto.papel,
        passwordHash: await this.auth.gerarHash(senha),
        // Conta criada por terceiro nasce com a troca pendente: enquanto não
        // trocar, o guard só libera a rota de troca.
        mustChangePassword: true,
        createdById: ator.staffId,
      },
      select: this.campos,
    });

    await this.auditoria.registrar(ator, {
      action: ACOES.tecnicoCriado,
      targetType: 'platform_staff',
      targetId: criado.id,
      targetLabel: criado.email,
      after: { nome: criado.name, email: criado.email, papel: criado.role },
    });

    // A senha temporária só existe nesta resposta.
    return { ...criado, senhaTemporaria: gerada ? senha : undefined };
  }

  async alterar(ator: AtorAuditoria, staffId: string, dto: AlterarTecnicoDto) {
    const antes = await this.prisma.client.platformStaff.findUnique({
      where: { id: staffId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!antes) throw new NotFoundException('Técnico não encontrado.');

    // Rebaixar a si mesmo pode deixar a plataforma sem nenhum administrador —
    // a checagem de "último owner" abaixo cobre o caso geral, mas recusar aqui
    // dá uma mensagem muito mais clara.
    if (staffId === ator.staffId && dto.papel && dto.papel !== antes.role) {
      throw new BadRequestException('Você não pode alterar o próprio papel.');
    }

    const depois = await this.comTravaDeAdministrador(
      (tx) =>
        tx.platformStaff.update({
          where: { id: staffId },
          data: {
            ...(dto.nome !== undefined ? { name: dto.nome.trim() } : {}),
            ...(dto.papel !== undefined ? { role: dto.papel } : {}),
          },
          select: this.campos,
        }),
      antes.role === 'owner' && dto.papel !== undefined && dto.papel !== 'owner',
    );

    await this.auditoria.registrar(ator, {
      action: ACOES.tecnicoAlterado,
      targetType: 'platform_staff',
      targetId: staffId,
      targetLabel: antes.email,
      before: { nome: antes.name, papel: antes.role },
      after: { nome: depois.name, papel: depois.role },
    });

    return depois;
  }

  async alternarAtivo(ator: AtorAuditoria, staffId: string, dto: AlternarTecnicoAtivoDto) {
    const staff = await this.prisma.client.platformStaff.findUnique({
      where: { id: staffId },
      select: { id: true, email: true, name: true, active: true, role: true },
    });
    if (!staff) throw new NotFoundException('Técnico não encontrado.');

    if (staffId === ator.staffId) {
      throw new BadRequestException('Você não pode desativar a própria conta.');
    }
    if (staff.active === dto.ativo) {
      throw new BadRequestException(
        dto.ativo ? 'A conta já está ativa.' : 'A conta já está desativada.',
      );
    }
    await this.comTravaDeAdministrador(
      (tx) => tx.platformStaff.update({ where: { id: staffId }, data: { active: dto.ativo } }),
      !dto.ativo && staff.role === 'owner',
    );

    // Desativar derruba o console na cara de quem está usando. (validarSessao
    // também recusa conta inativa, mas revogar aqui deixa o estado limpo.)
    const sessoes = dto.ativo ? 0 : await this.auth.encerrarSessoesDoStaff(staffId);

    await this.auditoria.registrar(ator, {
      action: dto.ativo ? ACOES.tecnicoReativado : ACOES.tecnicoDesativado,
      targetType: 'platform_staff',
      targetId: staffId,
      targetLabel: staff.email,
      reason: dto.reason?.trim() || null,
      before: { active: staff.active },
      after: { active: dto.ativo, sessoesEncerradas: sessoes },
    });

    return { id: staffId, active: dto.ativo, sessoesEncerradas: sessoes };
  }

  async resetarSenha(ator: AtorAuditoria, staffId: string) {
    const staff = await this.prisma.client.platformStaff.findUnique({
      where: { id: staffId },
      select: { id: true, email: true },
    });
    if (!staff) throw new NotFoundException('Técnico não encontrado.');

    const senha = generateTemporaryPassword(16);
    await this.prisma.client.platformStaff.update({
      where: { id: staffId },
      data: {
        passwordHash: await this.auth.gerarHash(senha),
        // Volta a exigir troca no primeiro login, e destrava a conta de uma vez
        // — reset de senha costuma ser a resposta a um bloqueio.
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    const sessoes = await this.auth.encerrarSessoesDoStaff(staffId);

    await this.auditoria.registrar(ator, {
      action: ACOES.tecnicoSenhaResetada,
      targetType: 'platform_staff',
      targetId: staffId,
      targetLabel: staff.email,
      after: { sessoesEncerradas: sessoes },
    });

    return { id: staffId, senhaTemporaria: senha, sessoesEncerradas: sessoes };
  }

  async encerrarSessoes(ator: AtorAuditoria, staffId: string, dto: SoJustificativaDto) {
    const staff = await this.prisma.client.platformStaff.findUnique({
      where: { id: staffId },
      select: { id: true, email: true },
    });
    if (!staff) throw new NotFoundException('Técnico não encontrado.');

    const sessoes = await this.auth.encerrarSessoesDoStaff(staffId);

    await this.auditoria.registrar(ator, {
      action: ACOES.tecnicoSessoesEncerradas,
      targetType: 'platform_staff',
      targetId: staffId,
      targetLabel: staff.email,
      reason: dto.reason?.trim() || null,
      after: { sessoesEncerradas: sessoes },
    });

    return { id: staffId, sessoesEncerradas: sessoes };
  }

  /**
   * Executa a escrita e desfaz tudo se ela deixaria a plataforma sem nenhum
   * administrador ativo.
   *
   * A contagem roda DEPOIS da escrita, dentro da mesma transação — não antes.
   * Conferir antes deixa uma janela clássica: dois donos se rebaixando ao mesmo
   * tempo, cada um enxergando o outro ainda ativo, os dois passando na
   * checagem, e o console terminando sem ninguém que consiga entrar. A
   * recuperação disso exige acesso direto ao banco (ou o seed
   * `seed:platform-staff`, que é idempotente justamente por isso).
   *
   * `Serializable` porque READ COMMITTED não fecha a janela sozinho: cada
   * transação continuaria sem ver a escrita não confirmada da outra. Sob
   * disputa o Postgres aborta uma delas, e isso vira uma mensagem legível em
   * vez de 500.
   */
  private async comTravaDeAdministrador<T>(
    escrita: (tx: Prisma.TransactionClient) => Promise<T>,
    podeRemoverAdministrador: boolean,
  ): Promise<T> {
    if (!podeRemoverAdministrador) {
      return escrita(this.prisma.client as unknown as Prisma.TransactionClient);
    }

    try {
      return await this.prisma.client.$transaction(
        async (tx) => {
          const resultado = await escrita(tx);
          const restantes = await tx.platformStaff.count({
            where: { role: 'owner', active: true },
          });
          if (restantes === 0) {
            throw new BadRequestException(
              'É o último administrador ativo. Promova outro técnico antes desta mudança.',
            );
          }
          return resultado;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (erro) {
      // P2034: o Postgres abortou por conflito de escrita. Duas pessoas mexendo
      // no quadro de administradores no mesmo instante — tentar de novo resolve.
      if ((erro as { code?: string })?.code === 'P2034') {
        throw new BadRequestException(
          'Outra alteração de administrador aconteceu ao mesmo tempo. Tente de novo.',
        );
      }
      throw erro;
    }
  }

  /** Contexto de auditoria a partir do técnico autenticado. */
  static ator(staff: StaffAutenticado, ctx: { ip: string | null; userAgent: string | null }): AtorAuditoria {
    return { staffId: staff.staffId, staffEmail: staff.email, ip: ctx.ip, userAgent: ctx.userAgent };
  }
}
