import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  readVoltrConfig,
  resolveIngestToken,
  resolveTenantSchema,
  resolveTenantSlug,
  type VoltrConfig,
} from './voltr.config';

export type VoltrScope = 'chat' | 'crm';

export interface VoltrEmbedTokenResponse {
  embedUrl: string;
  expiresIn: number;
  accessToken: string;
}

/**
 * Cliente da Voltr (estudo 68).
 *
 * O SEGREDO DE PARCEIRO NUNCA SAI DAQUI: quem chama `POST /api/embed/token` é
 * este servidor, e o painel só recebe o JWT curto já emitido. Erro da Voltr vira
 * 502 — quem falhou foi o parceiro, não o usuário.
 */
@Injectable()
export class VoltrService {
  private readonly logger = new Logger(VoltrService.name);
  private readonly config: VoltrConfig = readVoltrConfig();

  constructor(private readonly prisma: PrismaService) {}

  get configurado(): boolean {
    return Boolean(
      this.config.embedUrl && this.config.clientId && this.config.clientSecret,
    );
  }

  /** Nome de exibição do usuário, para a Voltr não criar "usuário sem nome". */
  async resolveDisplayName(userId: string, email: string): Promise<string> {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      return user?.name?.trim() || email.split('@')[0] || 'Usuário';
    } catch {
      return email.split('@')[0] || 'Usuário';
    }
  }

  async getEmbedToken(
    user: {
      companyId: string;
      externalUserId: string;
      email: string;
      nome: string;
    },
    scopes: VoltrScope[],
  ): Promise<VoltrEmbedTokenResponse> {
    if (!this.configurado) {
      throw new ServiceUnavailableException(
        'Integração com a Voltr não configurada nesta instalação.',
      );
    }
    const tenantSlug = resolveTenantSlug(user.companyId, this.config);
    if (!tenantSlug) {
      throw new ServiceUnavailableException(
        'Este salão ainda não está vinculado a um espaço na Voltr.',
      );
    }

    // Anti-replay exigido pela Voltr: timestamp em SEGUNDOS (janela ±300s) e um
    // nonce único por requisição. Sem eles a troca devolve 400.
    const ts = Math.floor(Date.now() / 1000);
    const nonce = randomUUID();

    let res: Response;
    try {
      res = await fetch(`${this.config.embedUrl}/api/embed/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-embed-client': this.config.clientId,
          'x-embed-secret': this.config.clientSecret,
          'x-embed-ts': String(ts),
          'x-embed-nonce': nonce,
        },
        body: JSON.stringify({
          tenantSlug,
          externalUserId: user.externalUserId,
          email: user.email,
          nome: user.nome,
          scopes,
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      this.logger.error(`Voltr indisponível: ${(err as Error).message}`);
      throw new BadGatewayException('A Voltr não respondeu. Tente de novo.');
    }

    const corpo = (await res.json().catch(() => null)) as {
      accessToken?: string;
      expiresIn?: number;
      embedUrl?: string;
      message?: string;
    } | null;

    if (!res.ok || !corpo?.accessToken || !corpo.embedUrl) {
      const motivo = corpo?.message ?? `HTTP ${res.status}`;
      this.logger.warn(
        `Troca de token da Voltr recusada (tenant=${tenantSlug}): ${motivo}`,
      );
      throw new BadGatewayException(`A Voltr recusou o acesso: ${motivo}`);
    }

    return {
      accessToken: corpo.accessToken,
      expiresIn: corpo.expiresIn ?? 900,
      embedUrl: corpo.embedUrl,
    };
  }

  /** Encaminha uma mensagem recebida no Baileys para o inbox da Voltr. */
  async encaminharInbound(msg: {
    companyId: string;
    fromDigits: string;
    text: string;
    externalId?: string;
    nomeCliente?: string;
  }): Promise<void> {
    const token = resolveIngestToken(msg.companyId, this.config);
    const schema = resolveTenantSchema(msg.companyId, this.config);
    if (!this.config.apiUrl || !token || !schema) return; // integração desligada

    await fetch(`${this.config.apiUrl}/api/ingest/mensagem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-ingest-token': token,
        'x-tenant-schema': schema,
      },
      body: JSON.stringify({
        canal: 'whatsapp',
        externalUserId: `${msg.fromDigits}@s.whatsapp.net`,
        texto: msg.text,
        direcao: 'entrada',
        autor: 'cliente',
        ...(msg.externalId ? { externalId: msg.externalId } : {}),
        ...(msg.nomeCliente ? { nomeCliente: msg.nomeCliente } : {}),
        ts: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  }

  /** Avisa a Voltr do ACK tardio (entregue/lida/falha), casado por externalId. */
  async enviarStatus(
    companyId: string,
    externalId: string,
    status: 'enviada' | 'entregue' | 'lida' | 'falha',
  ): Promise<void> {
    const token = resolveIngestToken(companyId, this.config);
    const schema = resolveTenantSchema(companyId, this.config);
    if (!this.config.apiUrl || !token || !schema) return;
    await fetch(`${this.config.apiUrl}/api/ingest/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ingest-token': token,
        'x-tenant-schema': schema,
      },
      body: JSON.stringify({ externalId, status }),
      signal: AbortSignal.timeout(10_000),
    });
  }
}
