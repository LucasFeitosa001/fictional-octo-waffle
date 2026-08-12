import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { AuthService } from '../auth/auth.service';

function authService(client: any) {
  return new AuthService({ client } as any);
}

describe('UC-06 — autorização multiempresa implementada', () => {
  it('owner recebe o curinga de permissões', async () => {
    const service = authService({
      userCompany: {
        findFirst: async () => ({
          role: { code: 'owner', rolePermissions: [] },
          permissions: [],
        }),
      },
    });

    assert.deepEqual(await service.permissions('user-1', 'company-a'), {
      permissions: ['*'],
    });
  });

  it('troca de empresa rejeita destino sem membership', async () => {
    const service = authService({
      userCompany: {
        findUnique: async () => null,
      },
    });

    await assert.rejects(
      service.switchCompany('user-1', 'session-1', 'company-b'),
      /Sem acesso a esta empresa/,
    );
  });
});

describe('GAP: UC-PLT-003/006 — tenant precisa ser da sessão', () => {
  it('rejeita troca quando não há sessionId para persistir o tenant por sessão', async () => {
    let globalUserChanged = false;
    const service = authService({
      userCompany: {
        findUnique: async () => ({
          companyId: 'company-b',
          company: { id: 'company-b', name: 'Empresa B', logoUrl: null },
          role: { code: 'manager', name: 'Gerente' },
        }),
      },
      session: {
        update: async () => ({ id: 'session-1' }),
      },
      user: {
        update: async () => {
          globalUserChanged = true;
          return { id: 'user-1' };
        },
      },
    });

    await assert.rejects(
      service.switchCompany('user-1', null, 'company-b'),
      /sessão/i,
      'sem Session ativa a operação não pode mudar apenas User.companyId global',
    );
    assert.equal(globalUserChanged, false);
  });

  it('/session/me devolve a empresa ativa da sessão, não a última empresa global', async () => {
    const service = authService({
      user: {
        findUnique: async () => ({
          id: 'user-1',
          companyId: 'company-b',
          name: 'Usuário multiempresa',
          email: 'multi@example.test',
          phone: null,
          avatarUrl: null,
          image: null,
          provider: 'local',
        }),
      },
    });

    const me = await (service as any).me('user-1', 'company-a');

    assert.equal(
      me.companyId,
      'company-a',
      'a resposta da sessão em A não pode mudar quando outra sessão seleciona B',
    );
  });
});

describe('GAP: UC-PLT-001/019 — segurança fail-closed', () => {
  it('não contém segredo Better Auth conhecido como fallback', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'auth', 'better-auth.ts'),
      'utf8',
    );

    assert.doesNotMatch(
      source,
      /dev-better-auth-secret-change-me-32chars/,
      'a aplicação deve falhar em produção sem BETTER_AUTH_SECRET',
    );
  });

  it('protege a leitura de upload com autenticação e contexto de tenant', () => {
    const source = readFileSync(
      join(process.cwd(), 'src', 'modules', 'uploads', 'uploads.controller.ts'),
      'utf8',
    );
    const routeAt = source.indexOf("@Get('file/:name')");
    const previousMethodEnd = source.lastIndexOf('\n  }', routeAt);
    const routeBlock = source.slice(previousMethodEnd, routeAt);

    assert.match(
      routeBlock,
      /@UseGuards\(JwtAuthGuard/,
      'arquivo de cliente não deve permanecer público depois do logout ou troca de empresa',
    );
  });
});

describe('GAP: UC-PLT-016/017 — ciclo de assinatura da plataforma', () => {
  const source = readFileSync(
    join(
      process.cwd(),
      'src',
      'modules',
      'feature-flags',
      'feature-flags.controller.ts',
    ),
    'utf8',
  );

  it('expõe mutação real para alterar ou cancelar o plano', () => {
    assert.match(
      source,
      /@(Post|Patch|Delete)\('subscription\/(change|cancel|plan)/,
      'o controller hoje só consulta a assinatura',
    );
  });

  it('expõe mutação real para contratar ou remover adicionais', () => {
    assert.match(
      source,
      /@(Post|Patch|Delete)\('subscription\/(addons|add-ons)/,
      'adicionais não podem ser apenas catálogo/placeholder',
    );
  });
});
