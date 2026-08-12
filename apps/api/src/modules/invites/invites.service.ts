import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { InviteStatus } from '@beautypass/db';
import { seedCompanyRoles } from '@beautypass/db/rbac';
import { PrismaService } from '../../prisma/prisma.service';
import { auth } from '../../auth/better-auth';
import { WhatsappService } from '../whatsapp/whatsapp.service';

/**
 * Convites de profissional (onboarding de staff). Fluxo:
 *   1. Gestor chama POST /professionals/:id/invite → cria ProfessionalInvite com
 *      token e (opcional) validade; retorna o link para compartilhar. Por padrão
 *      NADA é enviado por WhatsApp — só quando o gestor pede explicitamente
 *      (body `sendWhatsapp: true`, botão "Enviar por WhatsApp"), e desde que o
 *      profissional tenha telefone e o WhatsApp do salão esteja conectado.
 *   2. A tela pública lê GET /invites/:token para mostrar salão + profissional.
 *   3. O profissional chama POST /invites/:token/accept { name?, password } →
 *      cria um User staff (Better Auth), liga como UserCompany (papel
 *      'professional' da empresa do convite), seta Professional.userId e marca o
 *      convite como aceito.
 *
 * O link vai SEMPRE na resposta (para copiar/compartilhar manualmente), mesmo
 * quando o disparo por WhatsApp acontece.
 */
@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  /**
   * Cria um convite para um profissional específico e retorna token + link.
   *
   * OPT-IN: por padrão APENAS gera o link (whatsappSent=false) — nenhuma mensagem
   * de WhatsApp é disparada. O envio automático pelo WhatsApp conectado do salão
   * só acontece quando o chamador passa `sendWhatsapp: true` (botão explícito
   * "Enviar por WhatsApp"). Isso evita que "Gerar link" dispare mensagem indevida.
   * O link vai SEMPRE na resposta para copiar/compartilhar manualmente.
   */
  async createForProfessional(
    companyId: string,
    professionalId: string,
    sendWhatsapp = false,
  ) {
    const professional = await this.prisma.client.professional.findFirst({
      where: { id: professionalId, companyId, deletedAt: null },
      select: {
        id: true,
        name: true,
        userId: true,
        phone: true,
        company: { select: { name: true } },
      },
    });
    if (!professional) throw new NotFoundException('Profissional não encontrado');
    if (professional.userId) {
      throw new BadRequestException('Este profissional já tem acesso vinculado');
    }

    const token = randomBytes(24).toString('base64url');
    // Convite expira em 7 dias.
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invite = await this.prisma.client.professionalInvite.create({
      data: {
        companyId,
        professionalId,
        phone: professional.phone ?? undefined,
        token,
        status: InviteStatus.pending,
        expiresAt,
      },
      select: { id: true, token: true, expiresAt: true },
    });

    const link = `${this.webAppBaseUrl()}/convite/${token}`;

    // OPT-IN: só dispara o convite pelo WhatsApp conectado do salão quando o
    // chamador pediu explicitamente (`sendWhatsapp: true`). Por padrão apenas
    // gera/retorna o link (whatsappSent=false) — nada é enviado.
    const whatsappSent = sendWhatsapp
      ? await this.sendInviteWhatsapp(
          professional.phone,
          professional.company?.name ?? 'seu salão',
          link,
          companyId,
        )
      : false;

    return {
      id: invite.id,
      token: invite.token,
      link,
      expiresAt: invite.expiresAt,
      // true → mensagem enfileirada no outbox do WhatsApp do salão;
      // false → sem telefone ou WhatsApp desconectado/desativado (só o link).
      whatsappSent,
    };
  }

  /**
   * Envia o convite pela conexão de WhatsApp do salão (o MESMO socket/outbox que
   * os follow-ups automáticos usam — WhatsappService.enqueueText). Faz fallback
   * silencioso (retorna false, apenas loga o link) quando:
   *   - o profissional não tem telefone;
   *   - o WhatsApp do salão não está conectado (status != 'open') ou desativado;
   *   - o enfileiramento no outbox falha.
   * Nunca lança — a criação do convite não pode quebrar por causa do envio.
   */
  private async sendInviteWhatsapp(
    phone: string | null | undefined,
    salonName: string,
    link: string,
    companyId?: string,
  ): Promise<boolean> {
    if (!phone || !phone.trim()) {
      // eslint-disable-next-line no-console
      console.log(`[invite] Sem telefone — link para compartilhar manualmente: ${link}`);
      return false;
    }

    // Só dispara quando o WhatsApp DESTE salão está de fato conectado ('open').
    // Sem companyId não há socket para consultar → trata como desconectado.
    const { status } = companyId
      ? this.whatsapp.getStatus(companyId)
      : { status: 'closed' as const };
    if (status !== 'open') {
      // eslint-disable-next-line no-console
      console.log(
        `[invite] WhatsApp do salão não conectado (status=${status}) — link para compartilhar: ${link}`,
      );
      return false;
    }

    const text =
      `Olá! Você foi convidado(a) a acessar o ${salonName} no SalonPass. ` +
      `Crie seu acesso por aqui: ${link}`;

    try {
      // enqueueText persiste no outbox e o drain loop entrega via Baileys assim
      // que o socket está aberto (idêntico ao caminho dos follow-ups).
      // Interações: convite ao profissional — sem customerId (não é cliente).
      await this.whatsapp.enqueueText(phone, text, { companyId, kind: 'invite' });
      this.logger.log(`Convite enfileirado no WhatsApp do salão para ${phone}.`);
      return true;
    } catch (err) {
      this.logger.error(
        `Falha ao enfileirar convite no WhatsApp (${phone}): ${(err as Error).message}`,
      );
      // Fallback: mantém o link disponível na resposta mesmo se o envio falhar.
      return false;
    }
  }

  /** Dados públicos do convite para a tela renderizar (salão, profissional, validade). */
  async publicView(token: string) {
    const invite = await this.prisma.client.professionalInvite.findUnique({
      where: { token },
      include: {
        company: { select: { name: true, logoUrl: true } },
        professional: { select: { name: true } },
      },
    });
    if (!invite) throw new NotFoundException('Convite não encontrado');

    const expired = this.isExpired(invite.expiresAt) || invite.status === InviteStatus.expired;
    const valid = invite.status === InviteStatus.pending && !expired;

    return {
      salonName: invite.company.name,
      salonLogoUrl: invite.company.logoUrl,
      professionalName: invite.professional?.name ?? null,
      status: invite.status,
      valid,
      expired,
    };
  }

  /**
   * Aceita o convite: cria/associa o User staff (Better Auth), cria a UserCompany
   * com o papel 'professional' da empresa e liga Professional.userId.
   */
  async accept(token: string, dto: { name?: string; password: string; email?: string }) {
    const invite = await this.prisma.client.professionalInvite.findUnique({
      where: { token },
      include: { professional: { select: { id: true, name: true, userId: true } } },
    });
    if (!invite) throw new NotFoundException('Convite não encontrado');
    if (invite.status !== InviteStatus.pending) {
      throw new BadRequestException('Convite já utilizado ou inválido');
    }
    if (this.isExpired(invite.expiresAt)) {
      // Marca como expirado para refletir o estado no banco.
      await this.prisma.client.professionalInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.expired },
      });
      throw new BadRequestException('Convite expirado');
    }

    // Email: do corpo, ou do convite. Obrigatório para criar credencial.
    const email = (dto.email ?? invite.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Informe um e-mail para criar o acesso');
    }

    const name = dto.name?.trim() || invite.professional?.name || 'Profissional';

    // Cria o User staff via Better Auth. `accountType: 'staff'` dispara o hook
    // que provisiona uma Company throwaway; abaixo re-apontamos para a empresa do
    // convite e removemos a company auto-criada (mesmo padrão do seed-admin).
    const existing = await this.prisma.client.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Já existe uma conta com este e-mail');
    }

    const signUp = await auth.api.signUpEmail({
      body: { name, email, password: dto.password, accountType: 'staff' },
    });
    const userId = signUp.user.id;

    // Garante os papéis padrão na empresa do convite e pega a role 'professional'.
    const { roleIdByCode } = await seedCompanyRoles(this.prisma.client, invite.companyId);
    const professionalRoleId = roleIdByCode.professional;

    // Company throwaway criada pelo hook (se houver): remover e re-apontar o User.
    const created = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    const throwawayCompanyId =
      created?.companyId && created.companyId !== invite.companyId ? created.companyId : null;

    await this.prisma.client.$transaction(async (tx) => {
      // Remove a UserCompany auto-provisionada (da company throwaway).
      await tx.userCompany.deleteMany({ where: { userId } });

      // Aponta o User para a empresa do convite.
      await tx.user.update({
        where: { id: userId },
        data: { companyId: invite.companyId },
      });

      // Liga o User à empresa como 'professional'.
      await tx.userCompany.create({
        data: { userId, companyId: invite.companyId, roleId: professionalRoleId },
      });

      // Liga o perfil Professional ao novo User (se o convite tem profissional alvo).
      if (invite.professionalId) {
        await tx.professional.update({
          where: { id: invite.professionalId },
          data: { userId },
        });
      }

      // Marca o convite como aceito.
      await tx.professionalInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.accepted, email },
      });

      // Remove a company throwaway (cascata seus papéis/links).
      if (throwawayCompanyId) {
        await tx.company.delete({ where: { id: throwawayCompanyId } }).catch(() => undefined);
      }
    });

    return {
      userId,
      companyId: invite.companyId,
      professionalId: invite.professionalId,
    };
  }

  /** Base URL do painel, onde vive a tela pública de aceite do profissional. */
  private webAppBaseUrl(): string {
    const configured = process.env.WEB_APP_URL ?? process.env.ADMIN_BASE_URL;
    if (configured?.trim()) return configured.trim().replace(/\/$/, '');
    return process.env.NODE_ENV === 'production'
      ? 'https://app.salonpass.com.br'
      : 'http://localhost:5173';
  }

  private isExpired(expiresAt: Date | null): boolean {
    return Boolean(expiresAt && expiresAt.getTime() < Date.now());
  }
}
