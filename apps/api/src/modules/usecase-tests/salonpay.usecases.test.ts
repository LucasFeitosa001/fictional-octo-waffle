/**
 * DTO do SalonPay — mesma classe de bug do "5555555", noutro cadastro. Ver
 * estudo 125.
 *
 * O upsert antes aceitava `taxId="123"`, `phone="tel"` e gravava. Agora o
 * boundary do Nest recusa antes de o service ver.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { UpsertSalonPayAccountDto } from '../salonpay/dto';

async function passar(bruto: Record<string, unknown>) {
  const instancia = plainToInstance(UpsertSalonPayAccountDto, bruto);
  await validateOrReject(instancia);
  return instancia;
}

describe('SalonPay upsert — DTO', () => {
  it('rejeita taxId="123" (não é CPF nem CNPJ)', async () => {
    await assert.rejects(() => passar({ personType: 'company', taxId: '123' }));
  });

  it('rejeita phone="tel" com dígitos parciais', async () => {
    await assert.rejects(() => passar({ phone: '11 9' }));
  });

  it('rejeita email fora de formato', async () => {
    await assert.rejects(() => passar({ email: 'não é email' }));
  });

  it('aceita cadastro PJ válido e normaliza (dígitos)', async () => {
    const d = await passar({
      personType: 'company',
      taxId: '11.222.333/0001-81',
      phone: '(11) 3333-4444',
      email: 'contato@salao.com',
      zipCode: '01310-000',
    });
    assert.equal(d.taxId, '11222333000181');
    assert.equal(d.phone, '1133334444');
    assert.equal(d.zipCode, '01310000');
  });

  it('aceita cadastro PF válido (CPF com DV)', async () => {
    const d = await passar({
      personType: 'individual',
      taxId: '529.982.247-25',
      phone: '89981312500',
    });
    assert.equal(d.taxId, '52998224725');
    assert.equal(d.phone, '89981312500');
  });

  it('rejeita CPF fake (111...111)', async () => {
    await assert.rejects(() => passar({ personType: 'individual', taxId: '11111111111' }));
  });

  it('rejeita revenue negativo (regra que já existia — segue de pé)', async () => {
    await assert.rejects(() => passar({ revenue: -1 }));
  });

  it('rejeita zipCode com tamanho errado', async () => {
    await assert.rejects(() => passar({ zipCode: '12345' }));
  });

  it('cadastro parcial (rascunho) segue permitido — todos os campos são opcionais', async () => {
    const d = await passar({ personType: 'individual', ownerName: 'Fulana' });
    assert.equal(d.ownerName, 'Fulana');
    assert.equal(d.taxId, undefined);
  });
});
