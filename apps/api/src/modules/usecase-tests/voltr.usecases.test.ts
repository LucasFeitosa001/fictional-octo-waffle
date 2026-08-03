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
import { VoltrAgendaService, _internoAgenda } from '../voltr/voltr-agenda.service';
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

// ────────── estudo 88: a IA não pode inventar horário (trava server-side)
//
// O cérebro que decide roda em OUTRO processo, em outro repositório, e conversa
// com o CLIENTE. Se a regra vivesse no prompt, uma alucinação ou uma injeção
// bastaria para furá-la. Aqui ela é uma oferta assinada: o pior que a IA
// consegue é pedir horário fora dela e levar 400.
describe('Oferta assinada da agenda (estudo 88)', () => {
  const SEGREDO = 'hmac-do-salaozinho';
  const CFG3 = {
    embedUrl: 'http://voltr.local',
    apiUrl: 'http://voltr.local',
    clientId: 'salonpass',
    clientSecret: 'x',
    tenantMap: { 'company-1': 'salaozinho' },
    ingestTokens: {},
    connectorSecrets: { salaozinho: SEGREDO },
  } as unknown as VoltrConfig;

  function servico() {
    const s = new VoltrAgendaService(
      {} as never,
      {} as never,
    );
    (s as unknown as { config: VoltrConfig }).config = CFG3;
    return s;
  }

  type Interno = {
    assinarOferta: (o: unknown, schema: string) => string;
    conferirOferta: (t: string, schema: string) => Record<string, unknown>;
  };

  // Datas RELATIVAS a agora: `criar` recusa horário no passado (estudo 99), e
  // uma data fixa transformaria estes testes numa bomba-relógio — passariam até
  // o dia da oferta e quebrariam sozinhos depois.
  const DIA = new Date(Date.now() + 7 * 24 * 3_600_000);
  const emDias = (hora: number) => {
    const d = new Date(DIA);
    d.setUTCHours(hora, 0, 0, 0);
    return d.toISOString();
  };
  const OFERTA = {
    companyId: 'company-1',
    serviceId: 'svc-1',
    professionalId: 'prof-1',
    date: DIA.toISOString().slice(0, 10),
    slots: [emDias(13), emDias(14)],
    exp: Date.now() + 30 * 60 * 1000,
  };

  it('I) a oferta que ela mesma assinou volta íntegra', () => {
    const s = servico() as unknown as Interno;
    const token = s.assinarOferta(OFERTA, 'emp_salaozinho');
    const volta = s.conferirOferta(token, 'emp_salaozinho');
    assert.equal(volta.serviceId, 'svc-1');
    assert.deepEqual(volta.slots, OFERTA.slots);
  });

  it('J) token adulterado é recusado', () => {
    const s = servico() as unknown as Interno;
    const token = s.assinarOferta(OFERTA, 'emp_salaozinho');
    const [corpo, mac] = token.split('.');
    // troca o corpo mantendo a assinatura: é o ataque óbvio — pedir um horário
    // que o servidor nunca ofereceu.
    const outro = Buffer.from(
      JSON.stringify({ ...OFERTA, slots: ['2026-08-10T23:00:00.000Z'] }),
      'utf8',
    ).toString('base64url');
    assert.throws(
      () => s.conferirOferta(`${outro}.${mac}`, 'emp_salaozinho'),
      /assinatura inválida/i,
    );
    assert.throws(
      () => s.conferirOferta(`${corpo}.deadbeef`, 'emp_salaozinho'),
      /assinatura inválida/i,
    );
    assert.throws(() => s.conferirOferta('sem-ponto', 'emp_salaozinho'), /inválida/i);
  });

  it('K) oferta assinada por OUTRO tenant não vale', () => {
    const cfg = {
      ...CFG3,
      connectorSecrets: { salaozinho: SEGREDO, outro: 'segredo-do-outro' },
    } as unknown as VoltrConfig;
    const s = new VoltrAgendaService({} as never, {} as never);
    (s as unknown as { config: VoltrConfig }).config = cfg;
    const i = s as unknown as Interno;
    const token = i.assinarOferta(OFERTA, 'emp_outro');
    assert.throws(
      () => i.conferirOferta(token, 'emp_salaozinho'),
      /assinatura inválida/i,
    );
  });

  function tokenDoServico(s: VoltrAgendaService): string {
    return (s as unknown as Interno).assinarOferta(OFERTA, 'emp_salaozinho');
  }

  it('L) criar é idempotente: retry devolve o agendamento existente', async () => {
    let chamadasCreate = 0;
    const prisma = {
      client: {
        customer: {
          findMany: async () => [
            { id: 'customer-1', name: 'Ana Antiga', phone: '+55 85 99999-0000' },
          ],
        },
        appointment: {
          findFirst: async () => ({ id: 'appt-existente' }),
        },
      },
    };
    const appointments = {
      create: async () => {
        chamadasCreate += 1;
        return { id: 'nao-deveria-criar' };
      },
    };
    const s = new VoltrAgendaService(prisma as never, appointments as never);
    (s as unknown as { config: VoltrConfig }).config = CFG3;

    const r = await s.criar('company-1', 'emp_salaozinho', {
      oferta: tokenDoServico(s),
      inicio: OFERTA.slots[0],
      telefone: '+55 85 99999-0000',
      nomeCliente: 'Paulo',
    });

    assert.deepEqual(r, {
      ok: true,
      agendamentoId: 'appt-existente',
      inicio: OFERTA.slots[0],
      jaExistia: true,
      // A identidade volta também no caminho idempotente: a ponte precisa dela
      // mesmo quando nada foi gravado agora.
      customerId: 'customer-1',
      customerName: 'Ana Antiga',
      customerCreated: false,
    });
    assert.equal(chamadasCreate, 0, 'retry não pode criar uma segunda reserva');
  });

  it('M) corrida concorrente relê a identidade após conflito e devolve o mesmo id', async () => {
    let consultas = 0;
    const prisma = {
      client: {
        customer: {
          findMany: async () => [
            { id: 'customer-1', name: 'Ana Antiga', phone: '+55 85 99999-0000' },
          ],
        },
        appointment: {
          findFirst: async () => {
            consultas += 1;
            return consultas === 1 ? null : { id: 'appt-do-outro-request' };
          },
        },
      },
    };
    const appointments = {
      create: async () => {
        throw new Error('conflito de sobreposição');
      },
    };
    const s = new VoltrAgendaService(prisma as never, appointments as never);
    (s as unknown as { config: VoltrConfig }).config = CFG3;

    const r = await s.criar('company-1', 'emp_salaozinho', {
      oferta: tokenDoServico(s),
      inicio: OFERTA.slots[0],
      telefone: '+55 85 99999-0000',
    });

    assert.equal(r.agendamentoId, 'appt-do-outro-request');
    assert.equal(r.jaExistia, true);
    assert.equal(consultas, 2);
  });

  // ─────────── estudo 99: identidade do cliente, nome e horário no passado
  //
  // O banco de produção tem 22% dos telefones COM máscara e o payload da IA
  // chega cru com DDI. O casamento por `contains` na string crua falhava —
  // `(89) 98121-7434` não contém "81217434", a máscara corta bem no meio — e
  // cada agendamento pela IA nascia com um cliente DUPLICADO.

  /**
   * Banco de mentira que imita o `LIKE '%x%'` do Postgres na string CRUA: se o
   * pré-filtro não for compatível com máscara, o cliente não aparece — que é
   * exatamente o que acontecia em produção.
   */
  function bancoCom(
    phoneNoBanco: string,
    guardados: Record<
      string,
      { id: string; name: string; phone: string; companyId: string }
    > = {},
  ) {
    const consultas: { contains: string }[] = [];
    const criados: { name: string; phone: string }[] = [];
    const criadosAppt: any[] = [];
    const prisma = {
      client: {
        customer: {
          // Busca por id: o WHERE precisa carregar o companyId, senão a IA de um
          // salão puxaria a cliente de outro. O mock só devolve quando bate.
          findFirst: async (args: any) => {
            const alvo = guardados[String(args?.where?.id ?? '')];
            if (!alvo || alvo.companyId !== args?.where?.companyId) return null;
            return { id: alvo.id, name: alvo.name, phone: alvo.phone };
          },
          findMany: async (args: any) => {
            const alvo = String(args?.where?.phone?.contains ?? '');
            consultas.push({ contains: alvo });
            return phoneNoBanco.includes(alvo)
              ? [
                  {
                    id: 'customer-existente',
                    name: 'Cliente De Casa',
                    phone: phoneNoBanco,
                  },
                ]
              : [];
          },
          create: async (args: any) => {
            criados.push(args.data);
            return { id: 'customer-novo' };
          },
        },
        appointment: { findFirst: async () => null },
      },
    };
    const appointments = {
      create: async (_companyId: string, dto: any, opts: any) => {
        criadosAppt.push({ dto, opts });
        return { id: 'appt-novo' };
      },
    };
    const s = new VoltrAgendaService(prisma as never, appointments as never);
    (s as unknown as { config: VoltrConfig }).config = CFG3;
    return { s, consultas, criados, criadosAppt };
  }

  /** Oferta viva, com um horário sempre no futuro. */
  function ofertaFutura(s: VoltrAgendaService) {
    const inicio = new Date(Date.now() + 3 * 24 * 3_600_000);
    inicio.setUTCMinutes(0, 0, 0);
    const iso = inicio.toISOString();
    const token = (s as unknown as Interno).assinarOferta(
      { ...OFERTA, slots: [iso], exp: Date.now() + 30 * 60 * 1000 },
      'emp_salaozinho',
    );
    return { token, inicio: iso };
  }

  it('O) telefone COM máscara no banco casa com o número CRU com DDI da IA', async () => {
    // Produção: cadastro "(89) 98121-7434", payload da IA "558981217434".
    const { s, criados, consultas } = bancoCom('(89) 98121-7434');
    const { token, inicio } = ofertaFutura(s);

    const r = await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
      nomeCliente: 'Paulo',
    });

    assert.equal(r.ok, true);
    assert.deepEqual(criados, [], 'não pode nascer cliente duplicado');
    assert.ok(
      consultas.every((c) => '(89) 98121-7434'.includes(c.contains)),
      'o pré-filtro precisa achar telefone mascarado',
    );
    // A ponte precisa levar a identidade embora — é o que impede a próxima
    // conversa de re-resolver do zero e cadastrar de novo.
    assert.equal(r.customerCreated, false, 'reaproveitou o cadastro que já havia');
    assert.equal(r.customerId, 'customer-existente');
    assert.equal(r.customerName, 'Cliente De Casa', 'o nome canônico, não o pushName');
  });

  it('P) o número cru no banco também casa com o cru da IA', async () => {
    const { s, criados } = bancoCom('89981217434');
    const { token, inicio } = ofertaFutura(s);

    await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
    });

    assert.deepEqual(criados, [], 'o caminho que já funcionava não pode quebrar');
  });

  it('Q) telefone de OUTRA pessoa com os mesmos 4 dígitos finais não casa', async () => {
    // O pré-filtro por 4 dígitos é largo de propósito; quem decide é a
    // conferência dos 8 dígitos em memória.
    const { s, criados } = bancoCom('(11) 3333-7434');
    const { token, inicio } = ofertaFutura(s);

    await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
    });

    assert.equal(criados.length, 1, 'é outra pessoa: cadastra a certa');
    assert.equal(criados[0].phone, '558981217434');
  });

  it('R) nome: tira emoji, preserva acento e cai no fallback quando não há nome', () => {
    const { limparNome } = _internoAgenda;
    assert.equal(limparNome('Paulo 🔥'), 'Paulo');
    assert.equal(limparNome('  Maria   Conceição  '), 'Maria Conceição');
    assert.equal(limparNome("D'Ávila Ana-Clara"), "D'Ávila Ana-Clara");
    assert.equal(limparNome('José'), 'José');
    assert.equal(limparNome('🔥🔥'), '', 'só emoji não é nome');
    assert.equal(limparNome('   '), '');
    assert.equal(limparNome(undefined), '');
    assert.equal(limparNome('12345'), '', 'número não é nome');
  });

  it('S) cliente novo: nome informado à IA vence o pushName, e emoji não entra', async () => {
    const { s, criados } = bancoCom('(11) 90000-0000');
    const { token, inicio } = ofertaFutura(s);

    await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
      nomeCliente: 'Paulo 🔥',
      nomeInformado: 'Paulo Ricardo',
    });

    assert.equal(criados[0].name, 'Paulo Ricardo');
  });

  it('T) sem nome utilizável, o fallback "Cliente XXXX" continua', async () => {
    const { s, criados } = bancoCom('(11) 90000-0000');
    const { token, inicio } = ofertaFutura(s);

    await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
      nomeCliente: '🔥',
    });

    assert.equal(criados[0].name, 'Cliente 7434', 'não inventa nome');
  });

  it('U) horário no passado é recusado mesmo dentro da oferta assinada', async () => {
    const { s, criadosAppt } = bancoCom('558981217434');
    const passado = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const token = (s as unknown as Interno).assinarOferta(
      { ...OFERTA, slots: [passado], exp: Date.now() + 30 * 60 * 1000 },
      'emp_salaozinho',
    );

    await assert.rejects(
      () =>
        s.criar('company-1', 'emp_salaozinho', {
          oferta: token,
          inicio: passado,
          telefone: '558981217434',
        }),
      /já passou/i,
    );
    assert.deepEqual(criadosAppt, [], 'nada pode ser gravado no passado');
  });

  it('V) o agendamento da IA fica marcado como tal, e SEM confirmação automática', async () => {
    const { s, criadosAppt } = bancoCom('558981217434');
    const { token, inicio } = ofertaFutura(s);

    await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
    });

    assert.equal(criadosAppt.length, 1);
    assert.equal(criadosAppt[0].opts.source, 'online');
    assert.equal(criadosAppt[0].opts.originTag, 'voltr-ia');
    assert.equal(
      criadosAppt[0].dto.notifyConfirmation,
      false,
      'a trava de WhatsApp automático não pode afrouxar',
    );
  });

  // ─── a identidade resolvida volta para a ponte, e o id dela é conferido
  //
  // Regra do dono: "se o cliente já existe, ela não vai criar um novo caso seja
  // o mesmo número; e ela tem que guardar no banco dela essa informação".

  it('W) cliente novo volta marcado como novo — é o contador de duplicata', async () => {
    const { s, criados } = bancoCom('(11) 90000-0000');
    const { token, inicio } = ofertaFutura(s);

    const r = await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
      nomeInformado: 'Joana Silva',
    });

    assert.equal(criados.length, 1);
    assert.equal(r.customerCreated, true);
    assert.equal(r.customerId, 'customer-novo');
    assert.equal(r.customerName, 'Joana Silva');
  });

  it('X) customerId guardado pela Voltr é usado sem procurar por telefone', async () => {
    const { s, consultas, criados } = bancoCom('(89) 98121-7434', {
      'cli-guardado': {
        id: 'cli-guardado',
        name: 'Marta Souza',
        phone: '(89) 98121-7434',
        companyId: 'company-1',
      },
    });
    const { token, inicio } = ofertaFutura(s);

    const r = await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
      customerId: 'cli-guardado',
    });

    assert.equal(r.customerId, 'cli-guardado');
    assert.equal(r.customerName, 'Marta Souza');
    assert.equal(r.customerCreated, false);
    assert.deepEqual(consultas, [], 'com id conferido não precisa varrer telefone');
    assert.deepEqual(criados, []);
  });

  it('Y) customerId de OUTRA empresa é ignorado — não vaza entre salões', async () => {
    const { s, consultas } = bancoCom('(89) 98121-7434', {
      'cli-de-outro-salao': {
        id: 'cli-de-outro-salao',
        name: 'Cliente Alheia',
        phone: '(89) 98121-7434',
        companyId: 'company-2',
      },
    });
    const { token, inicio } = ofertaFutura(s);

    const r = await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
      customerId: 'cli-de-outro-salao',
    });

    assert.notEqual(r.customerId, 'cli-de-outro-salao', 'id de outro tenant não vale');
    assert.equal(r.customerId, 'customer-existente', 'caiu na busca por telefone');
    assert.ok(consultas.length > 0, 'a busca por telefone precisa ter acontecido');
  });

  it('Z) customerId válido mas de OUTRO telefone perde para o telefone', async () => {
    // O telefone é quem provou a conversa no WhatsApp; o id só veio no payload.
    const { s } = bancoCom('(89) 98121-7434', {
      'cli-trocado': {
        id: 'cli-trocado',
        name: 'Pessoa Errada',
        phone: '(11) 3333-1111',
        companyId: 'company-1',
      },
    });
    const { token, inicio } = ofertaFutura(s);

    const r = await s.criar('company-1', 'emp_salaozinho', {
      oferta: token,
      inicio,
      telefone: '558981217434',
      customerId: 'cli-trocado',
    });

    assert.equal(r.customerId, 'customer-existente');
    assert.equal(r.customerName, 'Cliente De Casa');
  });

  it('N) cancelar repetido é idempotente e não dispara nova mudança de status', async () => {
    let updates = 0;
    let statusChanges = 0;
    const prisma = {
      client: {
        customer: {
          findMany: async () => [
            { id: 'customer-1', name: 'Ana Antiga', phone: '+55 85 99999-0000' },
          ],
        },
        appointment: {
          findFirst: async () => ({ id: 'appt-1', status: 'canceled' }),
          update: async () => {
            updates += 1;
          },
        },
      },
    };
    const appointments = {
      setStatus: async () => {
        statusChanges += 1;
      },
    };
    const s = new VoltrAgendaService(prisma as never, appointments as never);
    const r = await s.cancelar('company-1', {
      agendamentoId: 'appt-1',
      telefone: '+55 85 99999-0000',
    });

    assert.deepEqual(r, { ok: true, jaEstavaCancelado: true });
    assert.equal(updates, 0);
    assert.equal(statusChanges, 0);
  });
});
