import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import {
  readVoltrConfig,
  resolveCompanyIdBySchema,
  resolveConnectorSecretBySlug,
  type VoltrConfig,
} from './voltr.config';
import { VOLTR_ESCOPO_KEY, type VoltrEscopo } from './voltr-escopo.decorator';

/** Request com o buffer cru guardado pelo `verify` do express.json (main.ts). */
type RequisicaoAssinada = Request & {
  rawBody?: Buffer;
  voltrCompanyId?: string;
};

/** Quanto tempo um timestamp assinado continua aceitável. */
const JANELA_MS = Number(process.env.VOLTR_SIGNATURE_WINDOW_MS ?? 5 * 60 * 1000);

/**
 * Nonces já vistos, para que uma requisição capturada não possa ser reenviada.
 *
 * Em memória de propósito: a janela é de minutos e o processo é um só. Se um dia
 * houver mais de uma instância, isto precisa virar Redis/banco — anotado aqui
 * para não passar despercebido.
 */
const NONCES_VISTOS = new Map<string, number>();

function nonceJaUsado(nonce: string, agora: number): boolean {
  // Limpeza preguiçosa: só quando o mapa cresce, e só o que já expirou.
  if (NONCES_VISTOS.size > 5_000) {
    for (const [k, quando] of NONCES_VISTOS) {
      if (agora - quando > JANELA_MS) NONCES_VISTOS.delete(k);
    }
  }
  const anterior = NONCES_VISTOS.get(nonce);
  if (anterior !== undefined && agora - anterior <= JANELA_MS) return true;
  NONCES_VISTOS.set(nonce, agora);
  return false;
}

/**
 * Valida a assinatura HMAC-SHA256 do webhook da Voltr (estudos 68 e 88).
 *
 * FAIL-CLOSED em tudo: sem header, sem raw body, sem tenant conhecido, sem
 * segredo, fora da janela de tempo ou com nonce repetido, recusa. A comparação é
 * em tempo constante — comparar string com `===` vaza o segredo por tempo.
 *
 * A assinatura cobre `timestamp.nonce.corpo`, que é o que a Voltr assina
 * (`mensageria.service.ts`). Antes daqui se conferia só o corpo: a ponte não
 * estava apenas desligada, estava QUEBRADA — ligá-la dava 403 em toda chamada —
 * e sem timestamp nem nonce não havia anti-replay nenhum. Ver estudo 88.
 */
@Injectable()
export class VoltrSignatureGuard implements CanActivate {
  private readonly logger = new Logger(VoltrSignatureGuard.name);
  private readonly config: VoltrConfig = readVoltrConfig();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequisicaoAssinada>();

    const schema = String(req.headers['x-tenant-schema'] ?? '').trim();
    const assinatura = String(req.headers['x-signature'] ?? '').trim();
    const timestamp = String(req.headers['x-timestamp'] ?? '').trim();
    const nonce = String(req.headers['x-nonce'] ?? '').trim();
    if (!schema || !assinatura || !timestamp || !nonce) {
      throw new ForbiddenException('Requisição sem tenant, assinatura ou anti-replay.');
    }
    if (!/^emp_[a-z0-9_]+$/.test(schema)) {
      throw new ForbiddenException('Tenant inválido.');
    }

    // Janela de tempo ANTES do HMAC: descarta réplica velha sem gastar cripto.
    const agora = Date.now();
    const emSegundos = Number(timestamp);
    if (!Number.isFinite(emSegundos)) {
      throw new ForbiddenException('Timestamp inválido.');
    }
    if (Math.abs(agora - emSegundos * 1000) > JANELA_MS) {
      throw new ForbiddenException('Requisição fora da janela de tempo.');
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

    const esperada = createHmac('sha256', segredo)
      .update(`${timestamp}.${nonce}.${raw.toString('utf8')}`)
      .digest('hex');
    if (!this.assinaturasBatem(esperada, assinatura)) {
      throw new ForbiddenException('Assinatura inválida');
    }

    // Só depois de provar que a assinatura vale: senão qualquer um queimaria
    // nonces alheios mandando lixo assinado errado.
    if (nonceJaUsado(nonce, agora)) {
      throw new ForbiddenException('Requisição repetida (nonce já usado).');
    }

    // ESCOPO POR ROTA. Sem isto o segredo do tenant é passe livre: quem pode
    // mandar mensagem poderia criar agendamento. Rota sem escopo declarado
    // continua valendo (é o caso do /whatsapp/send, que já existia).
    const exigido = this.reflector.getAllAndOverride<VoltrEscopo | undefined>(
      VOLTR_ESCOPO_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (exigido && !this.escopoLiberado(schema, exigido)) {
      this.logger.warn(`Tenant ${schema} sem escopo "${exigido}".`);
      throw new ForbiddenException(`Integração sem permissão de ${exigido}.`);
    }

    req.voltrCompanyId = companyId;
    return true;
  }

  /**
   * Escopos concedidos por tenant, via env:
   * `VOLTR_SCOPES=designmoda:mensagem|agenda,alecrim:mensagem`
   * Ausente na lista = só o que não exige escopo. Fail-closed.
   */
  private escopoLiberado(schema: string, exigido: VoltrEscopo): boolean {
    const slug = schema.replace(/^emp_/, '');
    const bruto = process.env.VOLTR_SCOPES ?? '';
    for (const parte of bruto.split(',')) {
      const [quem, escopos] = parte.split(':');
      if (quem?.trim() !== slug) continue;
      return (escopos ?? '')
        .split('|')
        .map((e) => e.trim())
        .includes(exigido);
    }
    return false;
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
