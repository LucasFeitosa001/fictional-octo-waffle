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
function guardCom(cfg: VoltrConfig, escopoDaRota?: string): VoltrSignatureGuard {
  const reflector = {
    getAllAndOverride: () => escopoDaRota,
  } as unknown as ConstructorParameters<typeof VoltrSignatureGuard>[0];
  const guard = new VoltrSignatureGuard(reflector);
  (guard as unknown as { config: VoltrConfig }).config = cfg;
  return guard;
}

function contexto(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as Parameters<VoltrSignatureGuard['canActivate']>[0];
}

// O guard compara com Date.now(); usar o relógio real mantém o teste dentro da
// janela sem precisar de mock de tempo.
const AGORA_MS = Date.now();
let contadorDeNonce = 0;

/**
 * Assina como a VOLTR assina: `timestamp.nonce.corpo`. Este helper assinava só o
 * corpo — ou seja, o teste certificava exatamente o formato quebrado que fazia
 * toda chamada real tomar 403. Ver estudo 88.
 */
function requisicao(
  corpo: string,
  segredo: string,
  schema = 'emp_salaozinho',
  over: { timestamp?: string; nonce?: string } = {},
) {
  const raw = Buffer.from(corpo);
  const timestamp = over.timestamp ?? String(Math.floor(AGORA_MS / 1000));
  const nonce = over.nonce ?? `nonce-${(contadorDeNonce += 1)}`;
  return {
    headers: {
      'x-tenant-schema': schema,
      'x-timestamp': timestamp,
      'x-nonce': nonce,
      'x-signature': createHmac('sha256', segredo)
        .update(`${timestamp}.${nonce}.${raw.toString('utf8')}`)
        .digest('hex'),
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

// ─────────────────── estudo 88: a assinatura precisa casar com a Voltr
//
// A ponte não estava só desligada, estava QUEBRADA: a Voltr assina
// `timestamp.nonce.corpo` e a SalonPass conferia só o corpo. Ligar dava 403 em
// toda chamada. Sem timestamp nem nonce também não havia anti-replay.
describe('Assinatura do conector da Voltr (estudo 88)', () => {
  const CFG2 = {
    embedUrl: 'http://voltr.local',
    apiUrl: 'http://voltr.local',
    clientId: 'salonpass',
    clientSecret: 'segredo-parceiro',
    tenantMap: { 'company-1': 'salaozinho' },
    ingestTokens: {},
    connectorSecrets: { salaozinho: 'hmac-do-salaozinho' },
  } as unknown as VoltrConfig;

  function guard2(escopo?: string) {
    const reflector = {
      getAllAndOverride: () => escopo,
    } as unknown as ConstructorParameters<typeof VoltrSignatureGuard>[0];
    const g = new VoltrSignatureGuard(reflector);
    (g as unknown as { config: VoltrConfig }).config = CFG2;
    return g;
  }

  it('A) assinatura no formato da Voltr é aceita', () => {
    const req = requisicao('{"ola":1}', 'hmac-do-salaozinho');
    assert.equal(guard2().canActivate(contexto(req)), true);
  });

  it('B) o formato ANTIGO (só o corpo) é recusado', () => {
    const raw = Buffer.from('{"ola":1}');
    const req = {
      headers: {
        'x-tenant-schema': 'emp_salaozinho',
        'x-timestamp': String(Math.floor(Date.now() / 1000)),
        'x-nonce': 'nonce-antigo',
        'x-signature': createHmac('sha256', 'hmac-do-salaozinho')
          .update(raw)
          .digest('hex'),
      },
      rawBody: raw,
    } as Record<string, unknown>;
    assert.throws(() => guard2().canActivate(contexto(req)), /Assinatura inválida/);
  });

  it('C) sem timestamp ou sem nonce não passa', () => {
    for (const faltando of ['x-timestamp', 'x-nonce']) {
      const req = requisicao('{"a":1}', 'hmac-do-salaozinho') as {
        headers: Record<string, string>;
      };
      delete req.headers[faltando];
      assert.throws(
        () => guard2().canActivate(contexto(req as unknown as Record<string, unknown>)),
        /anti-replay/i,
        faltando,
      );
    }
  });

  it('D) timestamp velho é recusado antes de gastar cripto', () => {
    const antigo = String(Math.floor((Date.now() - 30 * 60 * 1000) / 1000));
    const req = requisicao('{"a":1}', 'hmac-do-salaozinho', 'emp_salaozinho', {
      timestamp: antigo,
    });
    assert.throws(() => guard2().canActivate(contexto(req)), /janela de tempo/i);
  });

  it('E) REPLAY: a mesma requisição não passa duas vezes', () => {
    const req = requisicao('{"a":1}', 'hmac-do-salaozinho', 'emp_salaozinho', {
      nonce: 'nonce-repetido-do-teste',
    });
    assert.equal(guard2().canActivate(contexto(req)), true);
    assert.throws(() => guard2().canActivate(contexto(req)), /repetida/i);
  });

  it('F) ESCOPO: sem VOLTR_SCOPES, rota de agenda é recusada', () => {
    const anterior = process.env.VOLTR_SCOPES;
    delete process.env.VOLTR_SCOPES;
    try {
      const req = requisicao('{"a":1}', 'hmac-do-salaozinho');
      assert.throws(
        () => guard2('agenda').canActivate(contexto(req)),
        /permissão de agenda/i,
      );
    } finally {
      if (anterior === undefined) delete process.env.VOLTR_SCOPES;
      else process.env.VOLTR_SCOPES = anterior;
    }
  });

  it('G) ESCOPO concedido no ambiente libera; escopo de outro tenant não', () => {
    const anterior = process.env.VOLTR_SCOPES;
    process.env.VOLTR_SCOPES = 'salaozinho:mensagem|agenda,outro:mensagem';
    try {
      assert.equal(
        guard2('agenda').canActivate(
          contexto(requisicao('{"a":1}', 'hmac-do-salaozinho')),
        ),
        true,
      );
      process.env.VOLTR_SCOPES = 'outro:agenda';
      assert.throws(
        () =>
          guard2('agenda').canActivate(
            contexto(requisicao('{"a":1}', 'hmac-do-salaozinho')),
          ),
        /permissão de agenda/i,
      );
    } finally {
      if (anterior === undefined) delete process.env.VOLTR_SCOPES;
      else process.env.VOLTR_SCOPES = anterior;
    }
  });

  it('H) rota SEM escopo declarado continua passando (o /whatsapp/send de hoje)', () => {
    const anterior = process.env.VOLTR_SCOPES;
    delete process.env.VOLTR_SCOPES;
    try {
      assert.equal(
        guard2(undefined).canActivate(
          contexto(requisicao('{"a":1}', 'hmac-do-salaozinho')),
        ),
        true,
      );
    } finally {
      if (anterior !== undefined) process.env.VOLTR_SCOPES = anterior;
    }
  });
});
