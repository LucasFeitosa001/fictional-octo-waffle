import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import {
  readVoltrConfig,
  resolveCompanyIdBySchema,
  resolveConnectorSecretBySlug,
  type VoltrConfig,
} from './voltr.config';

/** Request com o buffer cru guardado pelo `verify` do express.json (main.ts). */
type RequisicaoAssinada = Request & {
  rawBody?: Buffer;
  voltrCompanyId?: string;
};

/**
 * Valida a assinatura HMAC-SHA256 do webhook da Voltr (estudo 68).
 *
 * FAIL-CLOSED em tudo: sem header, sem raw body, sem tenant conhecido ou sem
 * segredo configurado, recusa. A comparação é em tempo constante — comparar
 * string com `===` vaza o segredo por tempo de resposta.
 */
@Injectable()
export class VoltrSignatureGuard implements CanActivate {
  private readonly logger = new Logger(VoltrSignatureGuard.name);
  private readonly config: VoltrConfig = readVoltrConfig();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequisicaoAssinada>();

    const schema = String(req.headers['x-tenant-schema'] ?? '').trim();
    const assinatura = String(req.headers['x-signature'] ?? '').trim();
    if (!schema || !assinatura) {
      throw new ForbiddenException('Requisição sem tenant ou sem assinatura.');
    }
    if (!/^emp_[a-z0-9_]+$/.test(schema)) {
      throw new ForbiddenException('Tenant inválido.');
    }

    const companyId = resolveCompanyIdBySchema(schema, this.config);
    if (!companyId) {
      this.logger.warn(`Webhook da Voltr para tenant desconhecido: ${schema}`);
      throw new ForbiddenException('Tenant não vinculado a nenhum salão.');
    }

    const segredo = resolveConnectorSecretBySlug(
      schema.replace(/^emp_/, ''),
      this.config,
    );
    if (!segredo) {
      this.logger.error(`Sem connectorSecret configurado para ${schema}.`);
      throw new ForbiddenException('Integração sem segredo configurado.');
    }

    const raw = req.rawBody;
    if (!raw?.length) {
      // Sem o corpo cru não há o que assinar — provavelmente o middleware do
      // main.ts não cobriu esta rota.
      this.logger.error('Webhook da Voltr sem rawBody — verifique o main.ts.');
      throw new ForbiddenException('Corpo da requisição não verificável.');
    }

    const esperada = createHmac('sha256', segredo).update(raw).digest('hex');
    if (!this.assinaturasBatem(esperada, assinatura)) {
      throw new ForbiddenException('Assinatura inválida');
    }

    req.voltrCompanyId = companyId;
    return true;
  }

  /** Aceita `sha256=<hex>` ou hex puro; compara em tempo constante. */
  private assinaturasBatem(esperada: string, recebida: string): boolean {
    const limpa = recebida.replace(/^sha256=/i, '');
    if (!/^[0-9a-f]+$/i.test(limpa)) return false;
    const a = Buffer.from(esperada, 'hex');
    const b = Buffer.from(limpa.toLowerCase(), 'hex');
    return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  }
}
