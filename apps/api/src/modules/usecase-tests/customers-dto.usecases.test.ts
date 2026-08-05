/**
 * DTOs de cliente/documento — travas que existem para o boundary do Nest não
 * gravar lixo. Ver estudo 125.
 *
 * A ausência destes testes era o furo #1 da auditoria de 05/08 (o "5555555").
 * Cada validador tem cenários de:
 *  - entrada suja rejeitada (o bug real);
 *  - entrada válida aceita (o caminho feliz não pode ter sido morto);
 *  - forma persistida = só dígitos (dois cadastros do mesmo documento não
 *    podem ser lidos como diferentes por causa de espaço/máscara).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import {
  normalizarCep,
  normalizarChavePix,
  normalizarCnpj,
  normalizarCpf,
  normalizarDocumento,
  normalizarTelefone,
} from '../customers/dto-helpers';

// ------------------------------------------------------------------ telefone

describe('normalizarTelefone (o bug de 05/08)', () => {
  it('rejeita "5555555" — o telefone que o dono viu gravado', () => {
    assert.throws(() => normalizarTelefone('5555555'), BadRequestException);
  });

  it('rejeita string vazia com máscara ("(  )   -")', () => {
    // Sem dígitos == não informado (opcional). Não é erro, é ausência.
    assert.equal(normalizarTelefone('(  )   -'), undefined);
  });

  it('rejeita menos que 10 dígitos, mesmo com máscara', () => {
    assert.throws(() => normalizarTelefone('(11) 9 9'), BadRequestException);
    assert.throws(() => normalizarTelefone('123456789'), BadRequestException);
  });

  it('aceita celular BR (11 dígitos) e devolve só dígitos', () => {
    assert.equal(normalizarTelefone('(89) 98131-2500'), '89981312500');
  });

  it('aceita fixo BR (10 dígitos)', () => {
    assert.equal(normalizarTelefone('11 3333-4444'), '1133334444');
  });

  it('aceita E.164 (+55…) e devolve DDI+nacional', () => {
    assert.equal(normalizarTelefone('+55 (11) 99999-9999'), '5511999999999');
  });

  it('rejeita ruído extremo (>15 dígitos)', () => {
    assert.throws(() => normalizarTelefone('1234567890123456'), BadRequestException);
  });

  it('undefined e null passam como ausência (campo opcional)', () => {
    assert.equal(normalizarTelefone(undefined), undefined);
    assert.equal(normalizarTelefone(null), undefined);
  });

  it('não-string é 400 (o pipe do Nest não deveria mandar isto, mas trava aqui)', () => {
    assert.throws(() => normalizarTelefone(5555555 as unknown), BadRequestException);
  });
});

// ------------------------------------------------------------------------ CPF

describe('normalizarCpf', () => {
  it('trata texto sem dígitos como ausência (mesma semântica do telefone)', () => {
    // "abc" não gera dígito nenhum → não é lixo persistido, é campo vazio.
    assert.equal(normalizarCpf('abc'), undefined);
  });
  it('rejeita texto que gera dígitos parciais', () => {
    assert.throws(() => normalizarCpf('111'), BadRequestException);
    assert.throws(() => normalizarCpf('111.222.333'), BadRequestException);
  });

  it('rejeita 11 dígitos todos iguais (algoritmo passa, mas Receita não emite)', () => {
    for (const n of ['11111111111', '22222222222', '00000000000']) {
      assert.throws(() => normalizarCpf(n), BadRequestException);
    }
  });

  it('rejeita CPF com DV errado', () => {
    // Mesmos 9 primeiros do "válido", DVs diferentes → erro.
    assert.throws(() => normalizarCpf('529.982.247-00'), BadRequestException);
  });

  it('aceita CPF válido e devolve só dígitos', () => {
    assert.equal(normalizarCpf('529.982.247-25'), '52998224725');
    assert.equal(normalizarCpf('52998224725'), '52998224725');
  });

  it('ausência (undefined/null/vazio) volta como undefined', () => {
    assert.equal(normalizarCpf(undefined), undefined);
    assert.equal(normalizarCpf(''), undefined);
    assert.equal(normalizarCpf('   '), undefined);
  });
});

// ----------------------------------------------------------------------- CNPJ

describe('normalizarCnpj', () => {
  it('trata texto sem dígitos como ausência', () => {
    assert.equal(normalizarCnpj('abc'), undefined);
  });
  it('rejeita texto que gera dígitos parciais', () => {
    assert.throws(() => normalizarCnpj('11.111.111/0001'), BadRequestException);
    assert.throws(() => normalizarCnpj('12345'), BadRequestException);
  });

  it('rejeita repetição óbvia', () => {
    assert.throws(() => normalizarCnpj('11111111111111'), BadRequestException);
  });

  it('rejeita CNPJ com DV errado', () => {
    assert.throws(() => normalizarCnpj('11.222.333/0001-00'), BadRequestException);
  });

  it('aceita CNPJ válido e devolve só dígitos', () => {
    assert.equal(normalizarCnpj('11.222.333/0001-81'), '11222333000181');
    assert.equal(normalizarCnpj('11222333000181'), '11222333000181');
  });
});

// -------------------------------------------------------------- documento PJ/PF

describe('normalizarDocumento', () => {
  it('aceita CPF válido', () => {
    assert.equal(normalizarDocumento('529.982.247-25'), '52998224725');
  });
  it('aceita CNPJ válido', () => {
    assert.equal(normalizarDocumento('11.222.333/0001-81'), '11222333000181');
  });
  it('rejeita tamanho intermediário (não é PF nem PJ)', () => {
    assert.throws(() => normalizarDocumento('123456789012'), BadRequestException);
  });
});

// ------------------------------------------------------------------------- CEP

describe('normalizarCep', () => {
  it('aceita CEP com ou sem hífen, devolve só dígitos', () => {
    assert.equal(normalizarCep('01310-000'), '01310000');
    assert.equal(normalizarCep('01310000'), '01310000');
  });
  it('rejeita tamanho errado', () => {
    assert.throws(() => normalizarCep('12345'), BadRequestException);
    assert.throws(() => normalizarCep('123456789'), BadRequestException);
  });
});

// -------------------------------------------------------------------- PIX

describe('normalizarChavePix', () => {
  it('aceita e-mail (normaliza para minúsculas)', () => {
    assert.equal(normalizarChavePix('Fulana@Exemplo.COM'), 'fulana@exemplo.com');
  });
  it('aceita UUID (chave aleatória do BC)', () => {
    assert.equal(
      normalizarChavePix('550E8400-E29B-41D4-A716-446655440000'),
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });
  it('aceita telefone +55…', () => {
    assert.equal(normalizarChavePix('+55 (11) 99999-9999'), '+5511999999999');
  });
  it('aceita CPF/CNPJ como chave', () => {
    assert.equal(normalizarChavePix('529.982.247-25'), '52998224725');
    assert.equal(normalizarChavePix('11.222.333/0001-81'), '11222333000181');
  });
  it('rejeita "não é uma chave"', () => {
    assert.throws(() => normalizarChavePix('minha chave'), BadRequestException);
  });
});

// ============================================================================
// Integração fina — Prisma FALSO grava o que o service manda gravar. O objetivo
// é provar que, mesmo passando pelo DTO cheio, o service NÃO consegue gravar
// lixo. Se um `@Transform` for removido, o teste falha.
// ============================================================================

import { CustomersService } from '../customers/customers.service';
import { CreateCustomerDto } from '../customers/dto';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';

async function passarPeloDto(bruto: Record<string, unknown>): Promise<CreateCustomerDto> {
  const instancia = plainToInstance(CreateCustomerDto, bruto);
  await validateOrReject(instancia);
  return instancia;
}

function prismaComRegistro() {
  const gravados: Record<string, unknown>[] = [];
  const client = {
    customer: {
      findFirst: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        gravados.push(args.data);
        return { id: 'cus-1', ...args.data };
      },
    },
  };
  return { client, gravados };
}

describe('CustomersService.create + DTO (integração)', () => {
  it('barrar "5555555" ANTES do service — não chega no banco', async () => {
    await assert.rejects(
      () => passarPeloDto({ name: 'Fulana', phone: '5555555' }),
      /Telefone inválido/,
    );
  });

  it('barrar CPF fake "111.111.111-11" ANTES do service', async () => {
    await assert.rejects(
      () => passarPeloDto({ name: 'Fulana', cpf: '111.111.111-11' }),
      /CPF inválido/,
    );
  });

  it('caminho feliz: telefone e CPF válidos chegam SÓ COM DÍGITOS no banco', async () => {
    const dto = await passarPeloDto({
      name: 'Fulana',
      phone: '(89) 98131-2500',
      cpf: '529.982.247-25',
      cep: '01310-000',
    });
    const { client, gravados } = prismaComRegistro();
    const service = new CustomersService({ client } as never);
    await service.create('company-1', dto);

    assert.equal(gravados.length, 1);
    const salvo = gravados[0];
    assert.equal(salvo.phone, '89981312500');
    assert.equal(salvo.cpf, '52998224725');
    assert.equal(salvo.cep, '01310000');
    assert.equal(salvo.companyId, 'company-1');
  });

  it('name < 2 caracteres é rejeitado pelo DTO', async () => {
    await assert.rejects(() => passarPeloDto({ name: 'F' }));
  });
});
