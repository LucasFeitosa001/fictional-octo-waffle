/**
 * VoltrSignatureGuard — escopo por rota. Ver estudo 129.
 *
 * O guard tem duas defesas: assinatura HMAC (testada em `voltr.usecases.test`)
 * e escopo por rota (testado aqui). Este arquivo trava a REGRA — se alguém
 * trocar `.includes` por `.startsWith`, ou virar o default de `false` para
 * `true`, o teste falha.
 *
 * `escopoLiberado` é `private`. Acesso via `as any` — o teste é sobre a regra,
 * não sobre visibilidade.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VoltrSignatureGuard } from '../voltr/voltr-signature.guard';

const guardAcesso = () => {
  // O guard não é usado como injetável aqui; instanciamos direto e chamamos o
  // método privado.
  const g = new VoltrSignatureGuard({} as never) as unknown as {
    escopoLiberado: (schema: string, exigido: string) => boolean;
  };
  return g.escopoLiberado.bind(g);
};

function comEnv(voltrScopes: string | undefined, fn: () => void): void {
  const antes = process.env.VOLTR_SCOPES;
  if (voltrScopes === undefined) delete process.env.VOLTR_SCOPES;
  else process.env.VOLTR_SCOPES = voltrScopes;
  try {
    fn();
  } finally {
    if (antes === undefined) delete process.env.VOLTR_SCOPES;
    else process.env.VOLTR_SCOPES = antes;
  }
}

describe('VoltrSignatureGuard.escopoLiberado — regra de escopo (estudo 129)', () => {
  it('1) env VAZIA: fail-closed em qualquer escopo', () => {
    comEnv('', () => {
      assert.equal(guardAcesso()('emp_alecrim', 'agenda'), false);
      assert.equal(guardAcesso()('emp_alecrim', 'mensagem'), false);
    });
  });

  it('2) env AUSENTE: fail-closed em qualquer escopo', () => {
    comEnv(undefined, () => {
      assert.equal(guardAcesso()('emp_alecrim', 'agenda'), false);
    });
  });

  it('3) segredo de "mensagem" NÃO abre "agenda" (a regressão que temos que evitar)', () => {
    comEnv('alecrim:mensagem', () => {
      assert.equal(guardAcesso()('emp_alecrim', 'agenda'), false);
      // A mensagem funciona.
      assert.equal(guardAcesso()('emp_alecrim', 'mensagem'), true);
    });
  });

  it('4) escopos múltiplos separados por | funcionam', () => {
    comEnv('alecrim:mensagem|agenda', () => {
      assert.equal(guardAcesso()('emp_alecrim', 'mensagem'), true);
      assert.equal(guardAcesso()('emp_alecrim', 'agenda'), true);
    });
  });

  it('5) slug NÃO listado é 403 mesmo em env populada', () => {
    comEnv('alecrim:mensagem|agenda', () => {
      assert.equal(guardAcesso()('emp_designmoda', 'agenda'), false);
    });
  });

  it('6) prefixo NÃO conta: emp_alecrimdois não pega o escopo de emp_alecrim', () => {
    comEnv('alecrim:mensagem|agenda', () => {
      assert.equal(guardAcesso()('emp_alecrimdois', 'agenda'), false);
    });
  });

  it('7) vários tenants por vírgula, cada um com seus escopos', () => {
    comEnv('alecrim:mensagem|agenda,designmoda:mensagem', () => {
      assert.equal(guardAcesso()('emp_alecrim', 'agenda'), true);
      assert.equal(guardAcesso()('emp_designmoda', 'agenda'), false);
      assert.equal(guardAcesso()('emp_designmoda', 'mensagem'), true);
    });
  });

  it('8) escopo que NÃO existe (typo) é 403', () => {
    comEnv('alecrim:mensagem|agenda', () => {
      assert.equal(guardAcesso()('emp_alecrim', 'agendas'), false);
      assert.equal(guardAcesso()('emp_alecrim', 'AGENDA'), false);
    });
  });

  it('9) espaços em volta do escopo são tolerados (config amigável)', () => {
    comEnv('alecrim: mensagem | agenda ', () => {
      assert.equal(guardAcesso()('emp_alecrim', 'agenda'), true);
      assert.equal(guardAcesso()('emp_alecrim', 'mensagem'), true);
    });
  });
});
