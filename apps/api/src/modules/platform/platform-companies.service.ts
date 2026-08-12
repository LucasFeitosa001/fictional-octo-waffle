import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@beautypass/db';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformAuditService, type AtorAuditoria } from './platform-audit.service';
import { ACOES } from './platform.constants';
import type { AlternarAtivoDto, BuscarSaloesDto } from './platform.dto';

/** Visão de plataforma sobre os salões. Ver estudo 135. */
@Injectable()
export class PlatformCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: PlatformAuditService,
  ) {}

  async buscar(filtros: BuscarSaloesDto) {
    const pagina = Math.max(1, filtros.pagina ?? 1);
    const porPagina = Math.min(100, Math.max(1, filtros.porPagina ?? 25));

    const where: Prisma.CompanyWhereInput = {};
    if (filtros.ativo) where.active = filtros.ativo === 'true';

    const termo = filtros.busca?.trim();
    if (termo) {
      where.OR = [
        { name: { contains: termo, mode: 'insensitive' } },
        { legalName: { contains: termo, mode: 'insensitive' } },
        { cnpj: { contains: termo } },
        { id: termo },
        // Achar o salão pelo e-mail de quem trabalha nele é o caminho mais comum
        // no atendimento: o cliente liga e se identifica pelo próprio login.
        { users: { some: { email: { contains: termo, mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.client.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pagina - 1) * porPagina,
        take: porPagina,
        select: {
          id: true,
          name: true,
          legalName: true,
          cnpj: true,
          active: true,
          createdAt: true,
          _count: { select: { users: true, customers: true, professionals: true } },
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              status: true,
              currentPeriodEnd: true,
              plan: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.client.company.count({ where }),
    ]);

    return { data, pagina, porPagina, total };
  }

  async detalhe(companyId: string) {
    const company = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        legalName: true,
        cnpj: true,
        active: true,
        timezone: true,
        currency: true,
        addressJson: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            customers: true,
            professionals: true,
            services: true,
            branches: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          // Subscription não tem `currentPeriodStart` (schema.prisma:499-512);
          // o início do ciclo é inferido do createdAt.
          select: {
            id: true,
            status: true,
            currentPeriodEnd: true,
            createdAt: true,
            plan: { select: { id: true, name: true, priceMonthly: true } },
          },
        },
        featureFlags: { select: { key: true, enabled: true } },
      },
    });

    if (!company) throw new NotFoundException('Salão não encontrado.');

    // Quem tem acesso: vem de UserCompany, não de User.companyId — um usuário
    // pode trabalhar aqui e ter outra empresa como principal.
    const membros = await this.prisma.client.userCompany.findMany({
      where: { companyId },
      select: {
        createdAt: true,
        permissions: true,
        role: { select: { code: true, name: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            active: true,
            accountType: true,
            provider: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const historico = await this.prisma.client.platformAuditLog.findMany({
      where: { OR: [{ targetType: 'company', targetId: companyId }, { companyId }] },
      orderBy: { at: 'desc' },
      take: 20,
    });

    return { ...company, membros, historico };
  }

  async alternarAtivo(ator: AtorAuditoria, companyId: string, dto: AlternarAtivoDto) {
    const acao = dto.ativo ? ACOES.salaoReativado : ACOES.salaoDesativado;
    const motivo = this.auditoria.exigirJustificativa(acao, dto.reason);

    const company = await this.prisma.client.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, active: true },
    });
    if (!company) throw new NotFoundException('Salão não encontrado.');
    if (company.active === dto.ativo) {
      throw new BadRequestException(
        dto.ativo ? 'O salão já está ativo.' : 'O salão já está desativado.',
      );
    }

    let sessoesEncerradas = 0;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.company.update({ where: { id: companyId }, data: { active: dto.ativo } });
      if (!dto.ativo) {
        // Derruba quem está dentro AGORA. Sem isto, desativar um salão só teria
        // efeito no próximo login — o time inteiro continuaria trabalhando.
        const membros = await tx.userCompany.findMany({
          where: { companyId },
          select: { userId: true },
        });
        const { count } = await tx.session.deleteMany({
          where: { userId: { in: membros.map((m) => m.userId) } },
        });
        sessoesEncerradas = count;
      }
    });

    await this.auditoria.registrar(ator, {
      action: acao,
      targetType: 'company',
      targetId: companyId,
      targetLabel: company.name,
      companyId,
      reason: motivo,
      before: { active: company.active },
      after: { active: dto.ativo, sessoesEncerradas },
    });

    return { id: companyId, active: dto.ativo, sessoesEncerradas };
  }

  /** Números do topo do console. */
  async resumo() {
    const agora = new Date();
    const seteDias = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [saloes, saloesAtivos, usuarios, usuariosAtivos, novosSaloes, acoesRecentes] =
      await Promise.all([
        this.prisma.client.company.count(),
        this.prisma.client.company.count({ where: { active: true } }),
        this.prisma.client.user.count(),
        this.prisma.client.user.count({ where: { active: true } }),
        this.prisma.client.company.count({ where: { createdAt: { gte: seteDias } } }),
        this.prisma.client.platformAuditLog.count({ where: { at: { gte: seteDias } } }),
      ]);

    return {
      saloes,
      saloesAtivos,
      saloesInativos: saloes - saloesAtivos,
      usuarios,
      usuariosAtivos,
      usuariosInativos: usuarios - usuariosAtivos,
      novosSaloes7d: novosSaloes,
      acoesConsole7d: acoesRecentes,
    };
  }
}
