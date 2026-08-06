/**
 * DTOs de Professional — normalização + limites. Ver estudo 133.
 *
 * Antes: `phone`/`document`/`zip` eram `@IsString` sem transform, e
 * `CommissionRuleDto.value` era `@IsNumber()` sem Min/Max. Agora todos passam
 * pelo mesmo pipeline do Customer (estudo 125) e a comissão exige valor ≥ 0
 * (o `<= 100` para percent é do service, não do DTO — o DTO não conhece o
 * type na ordem de validação).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import {
  CommissionRuleDto,
  CreateProfessionalDto,
  UpdateProfessionalDto,
} from '../professionals/dto';

async function passar<T extends object>(cls: new () => T, bruto: Record<string, unknown>): Promise<T> {
  const inst = plainToInstance(cls, bruto);
  await validateOrReject(inst);
  return inst;
}

describe('ProfessionalsDto — normalização (estudo 133)', () => {
  it('1) rejeita phone "5555555" (mesmo bug do Customer)', async () => {
    await assert.rejects(() => passar(CreateProfessionalDto, { name: 'Diego', phone: '5555555' }));
  });

  it('2) aceita phone válido e devolve só dígitos', async () => {
    const d = await passar(CreateProfessionalDto, { name: 'Diego', phone: '(89) 98131-2500' });
    assert.equal(d.phone, '89981312500');
  });

  it('3) rejeita document com DV errado (não passa como CPF/CNPJ)', async () => {
    await assert.rejects(() => passar(CreateProfessionalDto, { name: 'Diego', document: '111.222.333-44' }));
  });

  it('4) aceita CPF válido no document, devolve só dígitos', async () => {
    const d = await passar(CreateProfessionalDto, { name: 'Diego', document: '529.982.247-25' });
    assert.equal(d.document, '52998224725');
  });

  it('5) aceita CNPJ válido no document (profissional PJ)', async () => {
    const d = await passar(CreateProfessionalDto, { name: 'Diego', document: '11.222.333/0001-81' });
    assert.equal(d.document, '11222333000181');
  });

  it('6) rejeita zip com tamanho errado', async () => {
    await assert.rejects(() => passar(CreateProfessionalDto, { name: 'Diego', zip: '12345' }));
  });

  it('7) aceita zip com hífen, devolve só dígitos', async () => {
    const d = await passar(CreateProfessionalDto, { name: 'Diego', zip: '01310-000' });
    assert.equal(d.zip, '01310000');
  });

  it('8) mesmo pipeline no UpdateProfessionalDto', async () => {
    const d = await passar(UpdateProfessionalDto, {
      phone: '11 99999-9999',
      document: '529.982.247-25',
      zip: '01310-000',
    });
    assert.equal(d.phone, '11999999999');
    assert.equal(d.document, '52998224725');
    assert.equal(d.zip, '01310000');
  });
});

describe('CommissionRuleDto — limites (estudo 133)', () => {
  it('9) rejeita value negativo', async () => {
    await assert.rejects(() =>
      passar(CommissionRuleDto, { scopeType: 'all', type: 'percent', value: -1 }),
    );
  });

  it('10) aceita value=0 (isento em algum item)', async () => {
    const d = await passar(CommissionRuleDto, { scopeType: 'all', type: 'fixed', value: 0 });
    assert.equal(d.value, 0);
  });

  it('11) aceita 999 em fixed (comissão de R$ 999 — extravagante mas válida)', async () => {
    // A checagem `<=100 para percent` é do service. O DTO só barra negativo.
    const d = await passar(CommissionRuleDto, { scopeType: 'all', type: 'fixed', value: 999 });
    assert.equal(d.value, 999);
  });

  it('12) rejeita type inválido (typo)', async () => {
    await assert.rejects(() =>
      passar(CommissionRuleDto, { scopeType: 'all', type: 'porcento' as never, value: 10 }),
    );
  });
});
