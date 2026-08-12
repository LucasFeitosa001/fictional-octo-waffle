/**
 * Console de suporte da SalonPass — suíte de regressão (banco real, sem mock).
 * Ver estudo 135.
 *
 * POR QUE EXISTE
 * --------------
 * O console dá a um punhado de pessoas poder sobre TODOS os salões: trocar
 * e-mail, resetar senha, desativar conta, entrar como o dono. Um defeito aqui
 * não afeta um cliente, afeta a base inteira. As garantias que esta suíte prova
 * contra a aplicação de verdade:
 *
 *   1. o caminho do console é separado do caminho do salão — credencial de um
 *      não abre o outro, em nenhuma direção;
 *   2. senha temporária pendente tranca o console até ser trocada;
 *   3. papel de menor privilégio não alcança rota de maior privilégio;
 *   4. ação destrutiva sem justificativa é recusada ANTES de acontecer;
 *   5. reset de senha realmente muda o login do salão (é o que mais quebraria
 *      em silêncio: gravar o hash no lugar errado "funciona" até alguém tentar
 *      entrar);
 *   6. a personificação respeita o teto de 30 min, apesar de o Better Auth
 *      reescrever `expiresAt` na leitura (ver estudo 135.6.1);
 *   7. segredo nenhum vaza para a trilha de auditoria.
 *
 * COMO RODA
 * ---------
 *   pnpm --filter @beautypass/api test:platform
 *
 * Sobe a API em processo numa porta dedicada, cria um salão descartável e
 * técnicos descartáveis, e apaga tudo no fim. Nenhum dado existente é tocado.
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function carregarEnv() {
  for (const arquivo of ['.env', join('..', '..', 'packages', 'db', '.env')]) {
    try {
      const bruto = readFileSync(join(process.cwd(), arquivo), 'utf8');
      for (const linha of bruto.split('\n')) {
        const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        const chave = m[1];
        let valor = m[2].trim();
        if (
          (valor.startsWith('"') && valor.endsWith('"')) ||
          (valor.startsWith("'") && valor.endsWith("'"))
        ) {
          valor = valor.slice(1, -1);
        }
        if (process.env[chave] === undefined) process.env[chave] = valor;
      }
    } catch {
      /* pode não existir */
    }
  }
}
carregarEnv();

const PORTA = Number(process.env.PLATFORM_TEST_PORT ?? 4601);
process.env.BETTER_AUTH_URL = `http://localhost:${PORTA}`;
const BASE = `http://localhost:${PORTA}/api/v1`;

let passou = 0;
let falhou = 0;
const falhas: string[] = [];

function checa(rotulo: string, ok: boolean) {
  if (ok) {
    passou++;
  } else {
    falhou++;
    falhas.push(rotulo);
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${rotulo}`);
  }
}

type Resposta = { status: number; body: any; cookie: string | null };

async function chamar(
  metodo: string,
  caminho: string,
  opcoes: { cookie?: string | null; bearer?: string | null; body?: unknown } = {},
): Promise<Resposta> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: `http://localhost:${PORTA}`,
  };
  if (opcoes.cookie) headers['cookie'] = opcoes.cookie;
  if (opcoes.bearer) headers['authorization'] = `Bearer ${opcoes.bearer}`;

  const res = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers,
    body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined,
  });

  // Só o par nome=valor: o resto do Set-Cookie são atributos que o servidor
  // não espera de volta.
  const bruto = res.headers.get('set-cookie');
  const cookie = bruto ? (bruto.split(';')[0] ?? null) : null;

  let body: any = null;
  const texto = await res.text();
  if (texto) {
    try {
      body = JSON.parse(texto);
    } catch {
      body = texto;
    }
  }
  return { status: res.status, body, cookie };
}

async function run() {
  const { NestFactory } = await import('@nestjs/core');
  const { ValidationPipe } = await import('@nestjs/common');
  const expressMod = await import('express');
  const express = (expressMod as any).default ?? expressMod;
  const { toNodeHandler } = await import('better-auth/node');
  const { AppModule } = await import('../app.module.js');
  const { auth } = await import('../auth/better-auth.js');
  const { prisma } = await import('@beautypass/db');
  const { hashPassword } = await import('better-auth/crypto');
  const { seedCompanyRoles } = await import('@beautypass/db/rbac');

  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });
  const instancia = (app.getHttpAdapter() as any).getInstance();
  instancia.all(/^\/api\/v1\/auth\/.*/, toNodeHandler(auth));
  instancia.use(express.json());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(PORTA);

  const marca = `plat-${Date.now()}`;
  const criados = { staff: [] as string[], company: '' as string, user: '' as string };

  try {
    // ── Preparo: um salão descartável com um usuário ────────────────────────
    const empresa = await prisma.company.create({ data: { name: `Salão ${marca}` } });
    criados.company = empresa.id;
    const { ownerRoleId } = await seedCompanyRoles(prisma, empresa.id);

    const senhaSalao = 'salao-teste-pw-123';
    const usuario = await prisma.user.create({
      data: {
        name: 'Dona do Salão',
        email: `dona-${marca}@teste.local`,
        companyId: empresa.id,
        accountType: 'staff',
      },
    });
    criados.user = usuario.id;
    await prisma.account.create({
      data: {
        userId: usuario.id,
        providerId: 'credential',
        accountId: usuario.id,
        password: await hashPassword(senhaSalao),
      },
    });
    await prisma.userCompany.create({
      data: { userId: usuario.id, companyId: empresa.id, roleId: ownerRoleId },
    });

    // ── Preparo: técnicos do console ────────────────────────────────────────
    const senhaDono = 'Console#Dono2026';
    const senhaSuporte = 'Console#Suporte2026';

    const dono = await prisma.platformStaff.create({
      data: {
        name: 'Dono Console',
        email: `dono-${marca}@salonpass.local`,
        role: 'owner',
        passwordHash: await hashPassword(senhaDono),
        mustChangePassword: false,
      },
    });
    criados.staff.push(dono.id);

    const suporte = await prisma.platformStaff.create({
      data: {
        name: 'Suporte Console',
        email: `suporte-${marca}@salonpass.local`,
        role: 'support',
        passwordHash: await hashPassword(senhaSuporte),
        mustChangePassword: false,
      },
    });
    criados.staff.push(suporte.id);

    const novato = await prisma.platformStaff.create({
      data: {
        name: 'Novato Console',
        email: `novato-${marca}@salonpass.local`,
        role: 'owner',
        passwordHash: await hashPassword('Console#Novato2026'),
        mustChangePassword: true,
      },
    });
    criados.staff.push(novato.id);

    // ── 1. Separação entre os dois mundos ───────────────────────────────────
    const cruzado1 = await chamar('POST', '/platform/auth/login', {
      body: { email: usuario.email, senha: senhaSalao },
    });
    checa('[separação] credencial de salão NÃO entra no console', cruzado1.status === 401);

    const cruzado2 = await chamar('POST', '/auth/sign-in/email', {
      body: { email: dono.email, password: senhaDono },
    });
    checa(
      '[separação] credencial do console NÃO entra no painel do salão',
      cruzado2.status >= 400,
    );

    const semSessao = await chamar('GET', '/platform/usuarios');
    checa('[separação] rota do console sem sessão → 401', semSessao.status === 401);

    const tokenFalso = await chamar('GET', '/platform/usuarios', { bearer: 'token-inventado' });
    checa('[separação] token inválido → 401', tokenFalso.status === 401);

    // ── 2. Senha temporária tranca o console ────────────────────────────────
    const loginNovato = await chamar('POST', '/platform/auth/login', {
      body: { email: novato.email, senha: 'Console#Novato2026' },
    });
    checa('[senha pendente] login funciona', loginNovato.status === 200);
    checa('[senha pendente] resposta sinaliza a troca', loginNovato.body?.trocarSenha === true);

    const novatoTentaUsar = await chamar('GET', '/platform/usuarios', {
      cookie: loginNovato.cookie,
    });
    checa('[senha pendente] rota comum bloqueada → 403', novatoTentaUsar.status === 403);

    const novatoVeMe = await chamar('GET', '/platform/auth/me', { cookie: loginNovato.cookie });
    checa('[senha pendente] /me continua respondendo', novatoVeMe.status === 200);

    const senhaFraca = await chamar('POST', '/platform/auth/senha', {
      cookie: loginNovato.cookie,
      body: { senhaAtual: 'Console#Novato2026', senhaNova: 'todaminuscula1' },
    });
    checa('[política] senha sem variedade recusada', senhaFraca.status === 400);

    const senhaCurta = await chamar('POST', '/platform/auth/senha', {
      cookie: loginNovato.cookie,
      body: { senhaAtual: 'Console#Novato2026', senhaNova: 'Ab1!xy' },
    });
    checa('[política] senha curta recusada', senhaCurta.status === 400);

    const trocaOk = await chamar('POST', '/platform/auth/senha', {
      cookie: loginNovato.cookie,
      body: { senhaAtual: 'Console#Novato2026', senhaNova: 'Console#Trocada2026' },
    });
    checa('[senha pendente] troca aceita', trocaOk.status === 200);

    const novatoDepois = await chamar('GET', '/platform/usuarios', { cookie: loginNovato.cookie });
    checa('[senha pendente] console liberado depois da troca', novatoDepois.status === 200);

    // ── 3. Papéis ───────────────────────────────────────────────────────────
    const sessaoDono = (
      await chamar('POST', '/platform/auth/login', {
        body: { email: dono.email, senha: senhaDono },
      })
    ).cookie;
    const sessaoSuporte = (
      await chamar('POST', '/platform/auth/login', {
        body: { email: suporte.email, senha: senhaSuporte },
      })
    ).cookie;
    checa('[login] dono autenticou', Boolean(sessaoDono));
    checa('[login] suporte autenticou', Boolean(sessaoSuporte));

    const suporteVeUsuarios = await chamar('GET', '/platform/usuarios', { cookie: sessaoSuporte });
    checa('[papel] suporte lê usuários', suporteVeUsuarios.status === 200);

    const suporteVeTecnicos = await chamar('GET', '/platform/tecnicos', { cookie: sessaoSuporte });
    checa('[papel] suporte NÃO lista técnicos → 403', suporteVeTecnicos.status === 403);

    const suporteDesativa = await chamar('POST', `/platform/usuarios/${usuario.id}/ativo`, {
      cookie: sessaoSuporte,
      body: { ativo: false, reason: 'tentativa que deve ser barrada pelo papel' },
    });
    checa('[papel] suporte NÃO desativa conta → 403', suporteDesativa.status === 403);

    const suportePersonifica = await chamar('POST', `/platform/usuarios/${usuario.id}/personificar`, {
      cookie: sessaoSuporte,
      body: { reason: 'tentativa que deve ser barrada pelo papel' },
    });
    checa('[papel] suporte NÃO personifica → 403', suportePersonifica.status === 403);

    const donoVeTecnicos = await chamar('GET', '/platform/tecnicos', { cookie: sessaoDono });
    checa('[papel] dono lista técnicos', donoVeTecnicos.status === 200);

    // ── 4. Justificativa obrigatória ────────────────────────────────────────
    const semMotivo = await chamar('POST', `/platform/usuarios/${usuario.id}/senha`, {
      cookie: sessaoDono,
      body: {},
    });
    checa('[justificativa] reset sem motivo recusado', semMotivo.status === 400);

    const motivoCurto = await chamar('POST', `/platform/usuarios/${usuario.id}/senha`, {
      cookie: sessaoDono,
      body: { reason: 'curto' },
    });
    checa('[justificativa] motivo curto recusado', motivoCurto.status === 400);

    // A recusa tem que acontecer ANTES do efeito: a senha antiga precisa
    // continuar valendo depois das duas tentativas acima.
    const aindaEntra = await chamar('POST', '/auth/sign-in/email', {
      body: { email: usuario.email, password: senhaSalao },
    });
    checa('[justificativa] recusa não deixou efeito colateral', aindaEntra.status === 200);

    // ── 5. Reset de senha muda o login de verdade ───────────────────────────
    const reset = await chamar('POST', `/platform/usuarios/${usuario.id}/senha`, {
      cookie: sessaoDono,
      body: { reason: 'suite automatizada do console, reset de senha' },
    });
    checa('[reset] aceito', reset.status === 200);
    const senhaNova: string | undefined = reset.body?.senhaTemporaria;
    checa('[reset] devolveu senha temporária', typeof senhaNova === 'string' && senhaNova.length > 8);

    const entraComNova = await chamar('POST', '/auth/sign-in/email', {
      body: { email: usuario.email, password: senhaNova },
    });
    checa('[reset] login do salão aceita a senha nova', entraComNova.status === 200);

    const entraComVelha = await chamar('POST', '/auth/sign-in/email', {
      body: { email: usuario.email, password: senhaSalao },
    });
    checa('[reset] senha antiga deixou de valer', entraComVelha.status >= 400);

    // ── 6. Troca de e-mail ──────────────────────────────────────────────────
    const emailNovo = `renomeada-${marca}@teste.local`;
    const trocaEmail = await chamar('POST', `/platform/usuarios/${usuario.id}/email`, {
      cookie: sessaoDono,
      body: { email: emailNovo, reason: 'suite automatizada do console, troca de email' },
    });
    checa('[email] troca aceita', trocaEmail.status === 200);

    const entraComEmailNovo = await chamar('POST', '/auth/sign-in/email', {
      body: { email: emailNovo, password: senhaNova },
    });
    checa('[email] login com o endereço novo funciona', entraComEmailNovo.status === 200);

    const emailDuplicado = await chamar('POST', `/platform/usuarios/${usuario.id}/email`, {
      cookie: sessaoDono,
      body: { email: emailNovo, reason: 'tentativa de repetir o mesmo endereco' },
    });
    checa('[email] endereço repetido recusado', emailDuplicado.status === 400);

    // ── 7. Personificação e seu teto ────────────────────────────────────────
    const personifica = await chamar('POST', `/platform/usuarios/${usuario.id}/personificar`, {
      cookie: sessaoDono,
      body: { reason: 'suite automatizada do console, personificacao' },
    });
    checa('[personificação] aceita', personifica.status === 200);
    const tokenPersona: string | undefined = personifica.body?.token;

    const usaPersona = await chamar('GET', '/companies/current', { bearer: tokenPersona });
    checa('[personificação] token abre o painel do salão', usaPersona.status === 200);

    const sessaoPersona = await prisma.session.findUnique({ where: { token: tokenPersona! } });
    checa(
      '[personificação] sessão fica marcada com o técnico',
      sessaoPersona?.impersonatedByStaffId === dono.id,
    );

    // O teto é medido sobre createdAt porque o Better Auth reescreve expiresAt
    // na leitura da sessão — ver estudo 135.6.1. Envelhecer createdAt em 31 min
    // é exatamente o cenário que o guard precisa recusar.
    await prisma.session.update({
      where: { token: tokenPersona! },
      data: { createdAt: new Date(Date.now() - 31 * 60 * 1000) },
    });
    const personaVencida = await chamar('GET', '/companies/current', { bearer: tokenPersona });
    checa('[personificação] recusada depois de 30 min', personaVencida.status === 401);

    // ── 8. Desativar derruba o acesso ───────────────────────────────────────
    const desativa = await chamar('POST', `/platform/usuarios/${usuario.id}/ativo`, {
      cookie: sessaoDono,
      body: { ativo: false, reason: 'suite automatizada do console, desativacao' },
    });
    checa('[desativar] aceito', desativa.status === 200);

    const jaDesativada = await chamar('POST', `/platform/usuarios/${usuario.id}/ativo`, {
      cookie: sessaoDono,
      body: { ativo: false, reason: 'repetindo a mesma desativacao' },
    });
    checa('[desativar] repetir é recusado', jaDesativada.status === 400);

    await chamar('POST', `/platform/usuarios/${usuario.id}/ativo`, {
      cookie: sessaoDono,
      body: { ativo: true, reason: 'suite automatizada do console, reativacao' },
    });

    // ── 9. Trava de força bruta ─────────────────────────────────────────────
    for (let i = 0; i < 5; i++) {
      await chamar('POST', '/platform/auth/login', {
        body: { email: suporte.email, senha: 'senha-errada-de-proposito' },
      });
    }
    const bloqueado = await chamar('POST', '/platform/auth/login', {
      body: { email: suporte.email, senha: senhaSuporte },
    });
    checa(
      '[força bruta] conta trava mesmo com a senha certa',
      bloqueado.status === 401 && String(bloqueado.body?.message ?? '').includes('bloqueada'),
    );

    // ── 10. A trilha não guarda segredo ─────────────────────────────────────
    const trilha = await chamar(
      'GET',
      `/platform/auditoria?targetId=${usuario.id}&porPagina=50`,
      { cookie: sessaoDono },
    );
    checa('[auditoria] consulta responde', trilha.status === 200);
    const bruto = JSON.stringify(trilha.body);
    checa(
      '[auditoria] senha temporária NÃO aparece na trilha',
      Boolean(senhaNova) && !bruto.includes(senhaNova!),
    );
    checa(
      '[auditoria] token de personificação NÃO aparece na trilha',
      Boolean(tokenPersona) && !bruto.includes(tokenPersona!),
    );
    checa(
      '[auditoria] registrou o reset com a justificativa',
      bruto.includes('usuario.senha_resetada') && bruto.includes('suite automatizada'),
    );

    const detalhe = await chamar('GET', `/platform/usuarios/${usuario.id}`, { cookie: sessaoDono });
    checa(
      '[vazamento] detalhe do usuário não traz hash de senha',
      detalhe.status === 200 && !JSON.stringify(detalhe.body).includes('passwordHash'),
    );

    // ── 11. Logout encerra de fato ──────────────────────────────────────────
    const saida = await chamar('POST', '/platform/auth/logout', { cookie: sessaoDono });
    checa('[logout] aceito', saida.status === 200);
    const depoisDoLogout = await chamar('GET', '/platform/usuarios', { cookie: sessaoDono });
    checa('[logout] a sessão morre de verdade', depoisDoLogout.status === 401);
  } finally {
    // Limpeza. A empresa cascateia usuário, sessões e vínculos.
    await prisma.platformAuditLog
      .deleteMany({ where: { staffId: { in: criados.staff } } })
      .catch(() => undefined);
    await prisma.platformStaff
      .deleteMany({ where: { id: { in: criados.staff } } })
      .catch(() => undefined);
    if (criados.company) {
      await prisma.company.delete({ where: { id: criados.company } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  }

  const total = passou + falhou;
  // eslint-disable-next-line no-console
  console.log(
    `\n──────────────────────────────────────────────\n` +
      `Console de suporte: ${passou}/${total} verificações passaram` +
      (falhou ? `, ${falhou} FALHARAM` : '') +
      `\n──────────────────────────────────────────────`,
  );
  if (falhou) {
    // eslint-disable-next-line no-console
    console.error(`\nFalhas:\n - ${falhas.join('\n - ')}`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Suíte quebrou:', e);
  process.exit(1);
});
