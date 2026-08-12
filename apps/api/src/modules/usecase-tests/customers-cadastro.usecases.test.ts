/**
 * Criar e editar cliente — as travas do estudo 141.
 *
 * Cada teste aqui FALHA com o código anterior:
 *  - apagar campo: o `@Transform` engolia o `null` e o PATCH virava "não mexa",
 *    então o telefone de outra pessoa ficava preso no cadastro para sempre
 *    enquanto a tela dizia "Cliente salvo";
 *  - busca: o WHERE só tinha `name`, e quem procurava pelo TELEFONE não achava
 *    ninguém — foi assim que a base ganhou fichas duplicadas;
 *  - duplicata: `create` gravava sem olhar se já existia o mesmo número;
 *  - aniversário: `new Date(iso)` num ISO com hora e sem fuso escorrega um dia
 *    quando o container não está em UTC.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { CustomersService } from '../customers/customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from '../customers/dto';

type Registro = Record<string, any>;

function servico(client: Registro) {
  return new CustomersService({ client } as never);
}

// `whitelist: true` é a mesma opção do ValidationPipe de produção
// (main.ts:152-156). Sem ela o teste não provaria que o `null` sobrevive à
// passagem pelo pipe, que é onde ele poderia ser descartado.
const COMO_O_PIPE = { whitelist: true };

async function comoUpdateDto(bruto: Registro): Promise<UpdateCustomerDto> {
  const instancia = plainToInstance(UpdateCustomerDto, bruto);
  await validateOrReject(instancia, COMO_O_PIPE);
  return instancia;
}

async function comoCreateDto(bruto: Registro): Promise<CreateCustomerDto> {
  const instancia = plainToInstance(CreateCustomerDto, bruto);
  await validateOrReject(instancia, COMO_O_PIPE);
  return instancia;
}

// ─────────────────────────────────────────────── apagar campo do cadastro

describe('PATCH /customers/:id — campo vazio APAGA (estudo 141)', () => {
  it('null atravessa o @Transform e chega no Prisma como null', async () => {
    // O caminho de dor: o cadastro ficou com o telefone de outra pessoa, a
    // recepcionista apaga o campo, salva, e o número antigo volta.
    const dto = await comoUpdateDto({
      phone: null,
      secondaryPhone: null,
      cpf: null,
      cnpj: null,
      cep: null,
      email: null,
      observations: null,
      birthday: null,
    });

    const gravados: Registro[] = [];
    const service = servico({
      customer: {
        findFirst: async () => ({ id: 'cus-1', companyId: 'company-1' }),
        update: async ({ data }: { data: Registro }) => {
          gravados.push(data);
          return { id: 'cus-1', ...data };
        },
      },
    });

    await service.update('company-1', 'cus-1', dto);

    assert.equal(gravados.length, 1);
    const salvo = gravados[0];
    // `null` explícito, não `undefined`: undefined é "não mexa" no Prisma e era
    // exatamente o que fazia o campo voltar preenchido.
    assert.equal(salvo.phone, null);
    assert.equal(salvo.secondaryPhone, null);
    assert.equal(salvo.cpf, null);
    assert.equal(salvo.cnpj, null);
    assert.equal(salvo.cep, null);
    assert.equal(salvo.email, null);
    assert.equal(salvo.observations, null);
    assert.equal(salvo.birthday, null);
  });

  it('chave AUSENTE continua sendo "não mexa" — PATCH parcial não zera o resto', async () => {
    const dto = await comoUpdateDto({ name: 'Maria Silva' });
    const gravados: Registro[] = [];
    const service = servico({
      customer: {
        findFirst: async () => ({ id: 'cus-1', companyId: 'company-1' }),
        update: async ({ data }: { data: Registro }) => {
          gravados.push(data);
          return { id: 'cus-1', ...data };
        },
      },
    });

    await service.update('company-1', 'cus-1', dto);

    const salvo = gravados[0];
    assert.equal(salvo.name, 'Maria Silva');
    assert.equal(salvo.phone, undefined);
    assert.equal(salvo.email, undefined);
    assert.equal('birthday' in salvo, false);
  });

  it('texto sem dígito ("") segue como "não informado", não como "apague"', async () => {
    // Importadores e SalonPay mandam '' querendo dizer ausência. Só `null` apaga.
    const dto = await comoUpdateDto({ phone: '' });
    assert.equal(dto.phone, undefined);
  });
});

// ─────────────────────────────────────────────────────── busca de cliente

describe('GET /customers?search — acha pelo TELEFONE, não só pelo nome', () => {
  async function buscar(termo: string, idsPorDigitos: string[] = []) {
    let whereUsado: Registro | undefined;
    const service = servico({
      $queryRaw: async () => idsPorDigitos.map((id) => ({ id })),
      customer: {
        findMany: async ({ where }: { where: Registro }) => {
          whereUsado = where;
          return [];
        },
        count: async () => 0,
      },
    });
    await service.list('company-1', termo);
    return whereUsado!;
  }

  it('procura por nome, apelido, e-mail e telefone — não só name', async () => {
    const where = await buscar('98129-1426');
    const alvos = (where.OR as Registro[]).map((c) => Object.keys(c)[0]);
    assert.ok(alvos.includes('name'));
    assert.ok(alvos.includes('nickname'));
    assert.ok(alvos.includes('email'));
    assert.ok(alvos.includes('phone'), 'a busca precisa alcançar o telefone');
    assert.ok(alvos.includes('cpf'));
    // O WHERE antigo era `{ name: { contains } }` na raiz — se voltar, não há OR.
    assert.equal(where.name, undefined);
  });

  it('compara telefone POR DÍGITOS: "(89) 98129-1426" e "89981291426" são a mesma pessoa', async () => {
    // A base legada tem os dois formatos gravados. O `contains` do Prisma
    // compara a string, então quem casa os dois é a consulta normalizada.
    const where = await buscar('89981291426', ['cus-mascarado']);
    const porId = (where.OR as Registro[]).find((c) => c.id);
    assert.deepEqual(porId, { id: { in: ['cus-mascarado'] } });
  });

  it('termo curto não dispara a busca por dígitos (casaria com meia base)', async () => {
    const where = await buscar('11');
    assert.equal(
      (where.OR as Registro[]).some((c) => c.cpf),
      false,
    );
  });

  it('sem termo, nenhum OR entra no WHERE', async () => {
    const where = await buscar('   ');
    assert.equal(where.OR, undefined);
    assert.equal(where.companyId, 'company-1');
    assert.equal(where.deletedAt, null);
  });
});

// ────────────────────────────────────────────── duplicata na criação

describe('POST /customers — avisa da duplicata, mas NÃO bloqueia', () => {
  function prismaComDuplicata(nomes: string[]) {
    const gravados: Registro[] = [];
    const client = {
      $queryRaw: async () => nomes.map((_, i) => ({ id: `cus-${i}` })),
      customer: {
        findFirst: async () => null,
        findMany: async () => nomes.map((name) => ({ name })),
        create: async ({ data }: { data: Registro }) => {
          gravados.push(data);
          return { id: 'cus-novo', ...data };
        },
      },
    };
    return { client, gravados };
  }

  it('cria o cliente e devolve o aviso quando o telefone já existe', async () => {
    const dto = await comoCreateDto({ name: 'Amanda Dias', phone: '(89) 99457-2834' });
    const { client, gravados } = prismaComDuplicata(['Amanda Dias']);
    const criado = (await servico(client).create('company-1', dto)) as Registro;

    // Não bloqueou: mãe e filha dividindo celular é caso legítimo, e travar
    // deixaria a recepção sem saída na criação em linha do agendamento.
    assert.equal(gravados.length, 1);
    assert.equal(gravados[0].phone, '89994572834');
    assert.match(criado.avisoDuplicidade, /já existe cadastro com este telefone/i);
    assert.match(criado.avisoDuplicidade, /Amanda Dias/);
  });

  it('sem duplicata, a resposta NÃO ganha chave morta', async () => {
    const dto = await comoCreateDto({ name: 'Maria Nova', phone: '(11) 99999-9999' });
    const { client } = prismaComDuplicata([]);
    const criado = (await servico(client).create('company-1', dto)) as Registro;
    assert.equal('avisoDuplicidade' in criado, false);
  });
});

// ─────────────────────────────────────────────────────────── aniversário

describe('Aniversário grava o dia escolhido, dê no que der o fuso do servidor', () => {
  async function gravarAniversario(iso: string): Promise<Date> {
    const dto = await comoCreateDto({ name: 'Fulana', birthday: iso });
    const gravados: Registro[] = [];
    const service = servico({
      customer: {
        findFirst: async () => null,
        create: async ({ data }: { data: Registro }) => {
          gravados.push(data);
          return { id: 'cus-1', ...data };
        },
      },
    });
    await service.create('company-1', dto);
    return gravados[0].birthday as Date;
  }

  it('data pura "1990-05-10" vira meia-noite UTC (convenção do painel)', async () => {
    const gravado = await gravarAniversario('1990-05-10');
    assert.equal(gravado.toISOString(), '1990-05-10T00:00:00.000Z');
  });

  it('ISO com hora e SEM fuso não escorrega um dia num container fora de UTC', async () => {
    // `new Date('1990-05-10T00:00:00')` é lido no fuso da MÁQUINA. Em Berlim
    // (UTC+2 em maio) o código antigo gravava 1990-05-09T22:00Z — a cliente
    // nasceu dia 10 e o cadastro passava a dizer 9, para sempre.
    const fusoOriginal = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
    try {
      const gravado = await gravarAniversario('1990-05-10T00:00:00');
      assert.equal(gravado.getUTCFullYear(), 1990);
      assert.equal(gravado.getUTCMonth(), 4);
      assert.equal(gravado.getUTCDate(), 10);
    } finally {
      if (fusoOriginal === undefined) delete process.env.TZ;
      else process.env.TZ = fusoOriginal;
    }
  });
});
