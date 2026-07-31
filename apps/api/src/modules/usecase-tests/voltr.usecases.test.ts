/**
 * Certificação da integração com a Voltr (estudo 68).
 *
 * O que estes testes travam:
 *  - o mapa de tenant resolve nos DOIS sentidos (Company.id ↔ emp_<slug>), que é
 *    o que decide em qual salão uma mensagem entra e de qual salão ela sai;
 *  - a assinatura HMAC do webhook é validada sobre o corpo CRU e recusa
 *    qualquer desvio (fail-closed): sem header, sem raw, tenant desconhecido,
 *    segredo ausente, assinatura de outro segredo ou corpo alterado;
 *  - `voltr_outbound` NÃO é automação — não pode cair nas travas de envio do
 *    estudo 60, senão a resposta do atendente nunca sairia com o canal
 *    reconectando.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createHmac } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';
import {
  resolveCompanyIdBySchema,
  resolveConnectorSecretBySlug,
  resolveIngestToken,
  resolveTenantSchema,
  resolveTenantSlug,
  type VoltrConfig,
} from '../voltr/voltr.config';
import { VoltrSignatureGuard } from '../voltr/voltr-signature.guard';
import { isAutomationKind, podeEnfileirar, expirouNaFila } from '../whatsapp/outbox-policy';

const CFG: VoltrConfig = {
  embedUrl: 'http://voltr.local',
  apiUrl: 'http://voltr.local',
  clientId: 'salonpass',
  clientSecret: 'segredo-parceiro',
  tenantMap: { 'company-1': 'salaozinho', 'company-2': 'outro' },
  defaultTenantSlug: 'salaozinho',
  ingestTokens: { salaozinho: 'ingest-do-salaozinho' },
  ingestTokenGlobal: 'ingest-global',
  connectorSecrets: { salaozinho: 'hmac-do-salaozinho' },
  connectorSecretGlobal: 'hmac-global',
};

/** Guard com a config injetada — o construtor lê env, então sobrescrevo. */
function guardCom(cfg: VoltrConfig): VoltrSignatureGuard {
  const guard = new VoltrSignatureGuard();
  (guard as unknown as { config: VoltrConfig }).config = cfg;
  return guard;
}

function contexto(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as Parameters<VoltrSignatureGuard['canActivate']>[0];
}

function requisicao(corpo: string, segredo: string, schema = 'emp_salaozinho') {
  const raw = Buffer.from(corpo);
  return {
    headers: {
      'x-tenant-schema': schema,
      'x-signature': createHmac('sha256', segredo).update(raw).digest('hex'),
    },
    rawBody: raw,
  } as Record<string, unknown>;
}

describe('Integração com a Voltr (estudo 68)', () => {
  // ───────────────────────────── mapa de tenant

  it('1) resolve slug e schema a partir do Company.id', () => {
    assert.equal(resolveTenantSlug('company-1', CFG), 'salaozinho');
    assert.equal(resolveTenantSchema('company-1', CFG), 'emp_salaozinho');
    assert.equal(resolveTenantSchema('company-2', CFG), 'emp_outro');
  });

  it('2) company desconhecida NÃO recebe tenant — nem com padrão configurado', () => {
    // Contrato mudou no estudo 75: cair no padrão fazia salão não mapeado
    // enxergar o espaço de outro. Agora é fail-closed, e o embed recusa com 503.
    assert.equal(resolveTenantSlug('company-nova', CFG), '');
    assert.equal(
      resolveTenantSlug('company-nova', { ...CFG, defaultTenantSlug: '' }),
      '',
    );
  });

  it('3) o caminho REVERSO acha o salão pelo schema', () => {
    assert.equal(resolveCompanyIdBySchema('emp_salaozinho', CFG), 'company-1');
    assert.equal(resolveCompanyIdBySchema('emp_outro', CFG), 'company-2');
    assert.equal(resolveCompanyIdBySchema('emp_desconhecido', CFG), null);
  });

  it('4) token e segredo por tenant vencem o global', () => {
    assert.equal(resolveIngestToken('company-1', CFG), 'ingest-do-salaozinho');
    assert.equal(resolveIngestToken('company-2', CFG), 'ingest-global');
    assert.equal(resolveConnectorSecretBySlug('salaozinho', CFG), 'hmac-do-salaozinho');
    assert.equal(resolveConnectorSecretBySlug('outro', CFG), 'hmac-global');
  });

  // ───────────────────────────── assinatura do webhook

  it('5) assinatura correta passa e marca o salão na requisição', () => {
    const corpo = JSON.stringify({ canal: 'whatsapp', texto: 'oi' });
    const req = requisicao(corpo, 'hmac-do-salaozinho');
    assert.equal(guardCom(CFG).canActivate(contexto(req)), true);
    assert.equal(req.voltrCompanyId, 'company-1');
  });

  it('6) aceita o formato "sha256=<hex>"', () => {
    const corpo = '{"texto":"oi"}';
    const req = requisicao(corpo, 'hmac-do-salaozinho');
    req.headers = {
      ...(req.headers as Record<string, string>),
      'x-signature': `sha256=${(req.headers as Record<string, string>)['x-signature']}`,
    };
    assert.equal(guardCom(CFG).canActivate(contexto(req)), true);
  });

  it('7) corpo alterado depois de assinado é recusado', () => {
    const req = requisicao('{"texto":"oi"}', 'hmac-do-salaozinho');
    req.rawBody = Buffer.from('{"texto":"transferir 5000"}');
    assert.throws(() => guardCom(CFG).canActivate(contexto(req)), ForbiddenException);
  });

  it('8) assinatura de outro segredo é recusada', () => {
    const req = requisicao('{"texto":"oi"}', 'segredo-errado');
    assert.throws(() => guardCom(CFG).canActivate(contexto(req)), ForbiddenException);
  });

  it('9) fail-closed: sem header, sem raw, tenant inválido ou sem segredo', () => {
    const corpo = '{"texto":"oi"}';
    const bom = requisicao(corpo, 'hmac-do-salaozinho');

    assert.throws(
      () => guardCom(CFG).canActivate(contexto({ headers: {}, rawBody: Buffer.from(corpo) })),
      ForbiddenException,
      'sem cabeçalhos',
    );
    assert.throws(
      () => guardCom(CFG).canActivate(contexto({ ...bom, rawBody: undefined })),
      ForbiddenException,
      'sem corpo cru',
    );
    assert.throws(
      () =>
        guardCom(CFG).canActivate(
          contexto({ ...bom, headers: { ...(bom.headers as object), 'x-tenant-schema': 'salaozinho' } }),
        ),
      ForbiddenException,
      'schema fora do formato emp_*',
    );
    const semSegredo: VoltrConfig = {
      ...CFG,
      connectorSecrets: {},
      connectorSecretGlobal: '',
    };
    assert.throws(
      () => guardCom(semSegredo).canActivate(contexto(requisicao(corpo, 'qualquer'))),
      ForbiddenException,
      'sem segredo configurado',
    );
  });

  it('10) tenant que não é de nenhum salão é recusado', () => {
    const req = requisicao('{"texto":"oi"}', 'hmac-global', 'emp_fantasma');
    assert.throws(() => guardCom(CFG).canActivate(contexto(req)), ForbiddenException);
  });

  // ───────────────────────────── convivência com as travas do estudo 60

  it('11) voltr_outbound não é automação: não é barrado nem expira', () => {
    assert.equal(isAutomationKind('voltr_outbound'), false);
    assert.equal(
      podeEnfileirar('voltr_outbound', false).ok,
      true,
      'resposta de atendente/IA precisa entrar mesmo com o canal reconectando',
    );
    const antiga = new Date(Date.now() - 48 * 3_600_000);
    assert.equal(expirouNaFila('voltr_outbound', antiga, new Date()).ok, true);
  });

  it('12) empresa fora do mapa NÃO cai no tenant padrão (estudo 75)', () => {
    // Fail-open aqui fazia salão não mapeado enxergar o espaço de outro.
    const comPadrao: VoltrConfig = { ...CFG, defaultTenantSlug: 'salaozinho' };
    assert.equal(
      resolveTenantSlug('company-que-ninguem-mapeou', comPadrao),
      '',
      'sem entrada no mapa, sem tenant — nem com padrão preenchido',
    );
    assert.equal(
      resolveTenantSchema('company-que-ninguem-mapeou', comPadrao),
      '',
      'e sem schema, para o embed recusar',
    );
    assert.equal(
      resolveTenantSlug('company-1', comPadrao),
      'salaozinho',
      'quem ESTÁ no mapa segue resolvendo',
    );
  });
});
