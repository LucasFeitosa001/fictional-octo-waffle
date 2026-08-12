/**
 * UploadsController — permissão POR KIND. Ver estudo 131.
 *
 * O decorator faz OR das 5 keys — qualquer uma passa no guard. O que este
 * teste trava é a segunda camada: `assertPermissaoDoKind` no handler exige a
 * permissão CORRESPONDENTE ao kind. Sem esta camada, `marketing:manage` sobe
 * arquivo `kind=customer` e ele fica no storage.
 *
 * Testamos o método privado (via `as any`) porque o objetivo é a REGRA, não a
 * plumbing do controller (multer, req, etc). O helper é puro.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { UploadsController } from '../uploads/uploads.controller';

function controllerCom(keysDoUsuario: string[]) {
  const auth = {
    permissions: async () => ({ permissions: keysDoUsuario }),
  };
  const service = {};
  const ctl = new UploadsController(service as never, auth as never) as unknown as {
    assertPermissaoDoKind: (
      userId: string,
      companyId: string,
      kind: string | undefined,
    ) => Promise<void>;
  };
  return ctl.assertPermissaoDoKind.bind(ctl);
}

describe('UploadsController — permissão por kind (estudo 131)', () => {
  it('1) DONO (*) sobe qualquer kind', async () => {
    const assertar = controllerCom(['*']);
    await assertar('u', 'X', 'customer');
    await assertar('u', 'X', 'professional');
    await assertar('u', 'X', 'logo');
    await assertar('u', 'X', 'whatsapp');
  });

  it('2) clientes:manage sobe kind=customer', async () => {
    const assertar = controllerCom(['clientes:manage']);
    await assertar('u', 'X', 'customer');
  });

  it('3) clientes:manage NÃO sobe kind=professional (era o furo)', async () => {
    const assertar = controllerCom(['clientes:manage']);
    await assert.rejects(() => assertar('u', 'X', 'professional'), ForbiddenException);
  });

  it('4) marketing:manage NÃO sobe kind=customer (o caso do relatório)', async () => {
    const assertar = controllerCom(['marketing:manage']);
    await assert.rejects(() => assertar('u', 'X', 'customer'), ForbiddenException);
    // Mas sobe o dele.
    await assertar('u', 'X', 'whatsapp');
  });

  it('5) equipe:manage sobe kind=professional, não sobe kind=service', async () => {
    const assertar = controllerCom(['equipe:manage']);
    await assertar('u', 'X', 'professional');
    await assert.rejects(() => assertar('u', 'X', 'service'), ForbiddenException);
  });

  it('6) catalogo:manage cobre product E service', async () => {
    const assertar = controllerCom(['catalogo:manage']);
    await assertar('u', 'X', 'product');
    await assertar('u', 'X', 'service');
  });

  it('7) config:manage sobe kind=logo', async () => {
    const assertar = controllerCom(['config:manage']);
    await assertar('u', 'X', 'logo');
    await assert.rejects(() => assertar('u', 'X', 'customer'), ForbiddenException);
  });

  it('8) kind=misc mantém OR das 5 (comportamento antigo, fallback)', async () => {
    // Qualquer uma das 5 keys passa em misc.
    for (const k of [
      'clientes:manage',
      'equipe:manage',
      'catalogo:manage',
      'config:manage',
      'marketing:manage',
    ]) {
      await controllerCom([k])('u', 'X', 'misc');
    }
    // Sem nenhuma delas: 403.
    await assert.rejects(
      () => controllerCom(['agenda:view'])('u', 'X', 'misc'),
      ForbiddenException,
    );
  });

  it('9) kind desconhecido cai em misc (não expande superfície de ataque)', async () => {
    const assertar = controllerCom(['marketing:manage']);
    // "customer.jpg" fake tentando burlar — "customer.jpg" não está no mapa e
    // vira misc, que permite marketing:manage.
    await assertar('u', 'X', 'customer.jpg');
  });

  it('10) usuário sem nenhuma das permissões é rejeitado em qualquer kind', async () => {
    const assertar = controllerCom(['agenda:view_own']);
    for (const k of ['customer', 'professional', 'product', 'logo', 'whatsapp', 'misc']) {
      await assert.rejects(() => assertar('u', 'X', k), ForbiddenException);
    }
  });
});
