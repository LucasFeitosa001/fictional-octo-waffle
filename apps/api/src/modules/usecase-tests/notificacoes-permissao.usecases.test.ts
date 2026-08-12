/**
 * Sino do painel — permissões. Ver estudo 128.
 *
 * Antes o controller só tinha `JwtAuthGuard`. Qualquer profissional logado
 * podia ler o sino inteiro e clicar "marcar todas como lidas", apagando o feed
 * do dono. Agora tem `PermissionGuard` + `@RequirePermission`.
 *
 * Este teste NÃO monta HTTP — testa direto o `PermissionGuard.canActivate`,
 * que é o que decide 403. Fixture minimalista: um Reflector que devolve as
 * keys do handler simulado, um AuthService que devolve as keys do usuário.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from '../../common/permission.guard';

function ctx(handler: () => unknown, req: Record<string, unknown>) {
  return {
    getHandler: () => handler,
    getClass: () => class Ctrl {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as never;
}

function guardCom(keysDoUsuario: string[], keysDoHandler: string[]) {
  const reflector = {
    getAllAndOverride: () => keysDoHandler,
  };
  // AuthService.permissions(userId, companyId) devolve { permissions: [...] }.
  const auth = {
    permissions: async () => ({ permissions: keysDoUsuario }),
  };
  return new PermissionGuard(reflector as never, auth as never);
}

const handlerFalso = () => undefined;
// PermissionGuard escreve `request.__permissionKeys` como cache por-request.
// Cada teste precisa de req NOVO, senão a resolução do teste anterior fica
// pendurada e falseia a próxima checagem. Uma função em vez de constante.
const novaReq = () => ({ user: { userId: 'u1', companyId: 'X' } });

describe('Sino do painel — @RequirePermission (estudo 128)', () => {
  it('1) DONO (com "*") lê a lista', async () => {
    const guard = guardCom(['*'], ['agenda:view', 'agenda:view_all', 'config:view', 'config:manage']);
    assert.equal(await guard.canActivate(ctx(handlerFalso, novaReq())), true);
  });

  it('2) recepção com "agenda:view" lê a lista', async () => {
    const guard = guardCom(['agenda:view'], ['agenda:view', 'agenda:view_all', 'config:view', 'config:manage']);
    assert.equal(await guard.canActivate(ctx(handlerFalso, novaReq())), true);
  });

  it('3) profissional só com "agenda:view_own" NÃO lê a lista', async () => {
    const guard = guardCom(['agenda:view_own'], ['agenda:view', 'agenda:view_all', 'config:view', 'config:manage']);
    await assert.rejects(() => guard.canActivate(ctx(handlerFalso, novaReq())), ForbiddenException);
  });

  it('4) profissional com "agenda:view" NÃO consegue MARCAR-TODAS-COMO-LIDA', async () => {
    // read-all exige `agenda:manage` OU `config:manage` — só "view" não basta.
    const guard = guardCom(['agenda:view'], ['agenda:manage', 'config:manage']);
    await assert.rejects(() => guard.canActivate(ctx(handlerFalso, novaReq())), ForbiddenException);
  });

  it('5) recepção com "agenda:manage" MARCA todas como lidas', async () => {
    const guard = guardCom(['agenda:manage'], ['agenda:manage', 'config:manage']);
    assert.equal(await guard.canActivate(ctx(handlerFalso, novaReq())), true);
  });

  it('6) usuário sem userId/companyId no request é bloqueado', async () => {
    const guard = guardCom(['*'], ['agenda:view']);
    await assert.rejects(
      () => guard.canActivate(ctx(handlerFalso, { user: {} })),
      ForbiddenException,
    );
  });
});
