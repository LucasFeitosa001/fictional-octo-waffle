/**
 * Encaixe de agendamento — "Encaixar agendamento" (banco real, sem mocks).
 *
 * POR QUE EXISTE
 * --------------
 * Pedido da Fátima: *"Teria como selecionar o mesmo horário que já estava
 * agendado com a mesma profissional? Mudando só a cliente"*. É o caso real do
 * salão — a mesma profissional atende duas clientes no mesmo horário (uma com a
 * tinta agindo).
 *
 * Passou por um toggle "Encaixar agendamento" que ninguém achava e que precisava
 * ser ligado ANTES de escolher o horário. Não servia: no painel, sobrepor agora é
 * o padrão. Quem está atrás do balcão vê a agenda inteira e decide.
 *
 * O que esta suíte fixa:
 *   - criar e REAGENDAR em cima de horário ocupado funcionam, sem ligar nada;
 *   - a grade do painel OFERECE o horário ocupado, marcado com `busy`;
 *   - o expediente do profissional continua valendo (encaixe ≠ vale-tudo);
 *   - o agendamento ONLINE do cliente continua protegido contra dupla marcação.
 *
 * COMO RODA
 * ---------
 *   pnpm --filter @beautypass/api test:squeeze-in
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv() {
  for (const file of ['.env', join('..', '..', 'packages', 'db', '.env')]) {
    try {
      const raw = readFileSync(join(process.cwd(), file), 'utf8');
      for (const line of raw.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        const key = m[1];
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      /* arquivo pode não existir */
    }
  }
}
loadEnv();

const PORT = Number(process.env.SQUEEZE_IN_TEST_PORT ?? 4623);
process.env.BETTER_AUTH_URL = `http://localhost:${PORT}`;
const BASE = `http://localhost:${PORT}/api/v1`;

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(label + (detail ? ` (${detail})` : ''));
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

type ApiResp = { status: number; body: any; token: string | null };

async function api(
  method: string,
  path: string,
  opts: { token?: string | null; body?: unknown } = {},
): Promise<ApiResp> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: `http://localhost:${PORT}`,
  };
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const token = res.headers.get('set-auth-token');
  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body, token };
}

async function signUpStaff(): Promise<{ token: string }> {
  const email = `squeeze-${Date.now()}-${Math.floor(Math.random() * 1e6)}@agenda.test`;
  const password = 'squeeze-in-pw-123';
  const res = await api('POST', '/auth/sign-up/email', {
    body: { name: 'Studio Encaixe', email, password },
  });
  let token = res.token;
  if (!token) {
    const signin = await api('POST', '/auth/sign-in/email', { body: { email, password } });
    token = signin.token;
  }
  if (!token) throw new Error(`could not obtain token: ${res.status} ${JSON.stringify(res.body)}`);
  return { token };
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

  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['error', 'warn'] });
  app.setGlobalPrefix('api/v1');
  const instance = app.getHttpAdapter().getInstance();
  instance.all(/^\/api\/v1\/auth\/.*/, toNodeHandler(auth));
  instance.use(express.json());
  instance.use(express.urlencoded({ extended: true }));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  await app.listen(PORT);
  // eslint-disable-next-line no-console
  console.log(`\n▶ Encaixe de agendamento rodando contra ${BASE}\n`);

  let companyId = '';

  try {
    const salon = await signUpStaff();
    for (let i = 0; i < 15 && !companyId; i++) {
      const cur = await api('GET', '/companies/current', { token: salon.token });
      if (cur.status === 200 && cur.body?.id) companyId = cur.body.id;
      else await new Promise((r) => setTimeout(r, 200));
    }
    check('salão provisionado', !!companyId);

    const pro = await prisma.professional.create({
      data: { companyId, name: 'Fátima Encaixe', active: true },
    });
    // Expediente largo nos 7 dias: o que está sob teste é a colisão entre
    // agendamentos, não a janela de trabalho (essa é outra regra, e continua
    // valendo mesmo com encaixe ligado — ver o último caso).
    await prisma.professionalSchedule.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        professionalId: pro.id,
        weekday,
        startTime: '00:00',
        endTime: '23:59',
      })),
    });
    const service = await prisma.service.create({
      data: { companyId, name: 'Escova', price: 80, durationMin: 60 },
    });
    const clienteA = await prisma.customer.create({
      data: { companyId, name: 'Cliente A' },
    });
    const clienteB = await prisma.customer.create({
      data: { companyId, name: 'Cliente B' },
    });

    // Horário no FUTURO (amanhã, meio-dia UTC) — a agenda recusa passado.
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    start.setUTCHours(12, 0, 0, 0);
    const startIso = start.toISOString();

    const bodyFor = (customerId: string) => ({
      customerId,
      professionalId: pro.id,
      start: startIso,
      items: [{ serviceId: service.id }],
    });

    // ---------- 1) primeiro agendamento ocupa o horário ----------
    const first = await api('POST', '/appointments', {
      token: salon.token,
      body: bodyFor(clienteA.id),
    });
    check('1) primeiro agendamento → 201', first.status === 201, `status ${first.status}`);

    // ---------- 2) MESMO horário, MESMA profissional, só trocando a cliente ----
    // É literalmente o pedido da Fátima, e tem que funcionar SEM ligar nada.
    const mesmoHorario = await api('POST', '/appointments', {
      token: salon.token,
      body: bodyFor(clienteB.id),
    });
    check(
      '2) mesmo horário/profissional trocando só a cliente → 201, sem toggle',
      mesmoHorario.status === 201,
      `status ${mesmoHorario.status} ${JSON.stringify(mesmoHorario.body?.message ?? '')}`,
    );

    // ---------- 3) um terceiro no mesmo horário também entra ----------
    const terceiro = await api('POST', '/appointments', {
      token: salon.token,
      body: bodyFor(clienteA.id),
    });
    check(
      '3) um terceiro no mesmo horário também entra',
      terceiro.status === 201,
      `status ${terceiro.status}`,
    );

    // ---------- 4) os dois convivem na agenda, com clientes diferentes ----------
    const both = await prisma.appointment.findMany({
      where: { companyId, professionalId: pro.id, start },
      select: { id: true, customerId: true },
    });
    check(
      '4) os três convivem no mesmo horário e profissional',
      both.length === 3,
      `${both.length} encontrados`,
    );
    check(
      '4) clientes diferentes (era só isso que a Fátima queria trocar)',
      new Set(both.map((a) => a.customerId)).size === 2,
    );

    // ---------- 5) encaixe NÃO fura o expediente ----------
    // Encaixe autoriza sobrepor OUTRO AGENDAMENTO. Não autoriza marcar num dia
    // em que a profissional não atende — se isso passasse, o toggle viraria um
    // "ignore todas as regras" e ninguém confiaria mais na agenda.
    const semExpediente = await prisma.professional.create({
      data: { companyId, name: 'Sem Expediente', active: true },
    });
    const foraDoExpediente = await api('POST', '/appointments', {
      token: salon.token,
      body: {
        customerId: clienteA.id,
        professionalId: semExpediente.id,
        start: startIso,
        items: [{ serviceId: service.id }],
      },
    });
    check(
      '5) sobrepor é livre, mas o EXPEDIENTE continua valendo → 400',
      foraDoExpediente.status === 400,
      `status ${foraDoExpediente.status}`,
    );

    // ---------- 6) a GRADE precisa oferecer o horário ocupado ----------
    // Descoberta do dono: mesmo com o encaixe ligado, o seletor de horário não
    // mostrava 10:30 porque estava ocupado — então não havia o que encaixar.
    // O encaixe só existe de verdade se o horário aparecer para ser escolhido.
    await prisma.professionalService.create({
      data: { professionalId: pro.id, serviceId: service.id },
    });
    const dia = startIso.slice(0, 10);
    const grade = await api(
      'GET',
      `/availability?serviceId=${service.id}&professionalId=${pro.id}&date=${dia}`,
      { token: salon.token },
    );
    check('6) grade do painel → 200', grade.status === 200, `status ${grade.status}`);

    const slotOcupado = (grade.body?.slots ?? []).find((s: any) => s.start === startIso);
    check(
      '6) o horário OCUPADO aparece na grade do painel',
      !!slotOcupado,
      'era isto que impedia o encaixe: o horário nem era oferecido',
    );
    check(
      '6) e vem MARCADO como ocupado (busy)',
      slotOcupado?.busy === true,
      'sem a marca, alguém marca em cima sem perceber',
    );

    // ---------- 7) REAGENDAR para um horário ocupado ----------
    // Caso do dono: mover o Daniel para 10:30, onde já está o Paulo.
    const clienteC = await prisma.customer.create({
      data: { companyId, name: 'Cliente C' },
    });
    const outroHorario = new Date(start.getTime() + 2 * 60 * 60 * 1000).toISOString();
    const paraMover = await api('POST', '/appointments', {
      token: salon.token,
      body: {
        customerId: clienteC.id,
        professionalId: pro.id,
        start: outroHorario,
        items: [{ serviceId: service.id }],
      },
    });
    check('7) agendamento de origem criado', paraMover.status === 201, `status ${paraMover.status}`);

    const moverEncaixado = await api('PATCH', `/appointments/${paraMover.body?.id}`, {
      token: salon.token,
      body: { start: startIso },
    });
    check(
      '7) reagendar PARA horário ocupado → 200, sem toggle nenhum',
      moverEncaixado.status >= 200 && moverEncaixado.status < 300,
      `status ${moverEncaixado.status} ${JSON.stringify(moverEncaixado.body?.message ?? '')}`,
    );
    const movido = await prisma.appointment.findUnique({
      where: { id: paraMover.body?.id },
      select: { start: true },
    });
    check(
      '7) o agendamento realmente mudou de horário',
      movido?.start.toISOString() === startIso,
      `ficou em ${movido?.start.toISOString()}`,
    );

    // ---------- 8) reagendar com encaixe ainda respeita o expediente ----------
    const foraDaJanela = await api('PATCH', `/appointments/${paraMover.body?.id}`, {
      token: salon.token,
      body: { start: startIso, professionalId: semExpediente.id },
    });
    check(
      '8) reagendar também não fura o expediente → 400',
      foraDaJanela.status === 400,
      `status ${foraDaJanela.status}`,
    );

    // ---------- 9) o AGENDAMENTO ONLINE continua protegido ----------
    // A liberação vale para o PAINEL, onde a recepção vê a agenda e decide.
    // O cliente marcando sozinho no link público não pode furar horário cheio —
    // se esta verificação cair, viramos um sistema que aceita dupla marcação
    // silenciosa vinda de fora, e ninguém no salão fica sabendo.
    // O link público mora no módulo de marketing, que é gated por plano
    // (`online_booking`). Sem ligar, `GET /booking-link` volta 402 e o teste
    // "passaria" sem provar nada.
    await prisma.featureFlag.create({
      data: { companyId, key: 'online_booking', enabled: true },
    });
    const link = await api('GET', '/booking-link', { token: salon.token });
    const slug = link.body?.slug;
    check('9) link público existe', typeof slug === 'string' && slug.length > 0);

    if (slug) {
      const gradePublica = await api(
        'GET',
        `/public/booking/${slug}/availability?serviceId=${service.id}&professionalId=${pro.id}&date=${dia}`,
      );
      const ofereceOcupado = (gradePublica.body?.slots ?? []).some(
        (s: any) => s.start === startIso,
      );
      check(
        '9) a grade PÚBLICA não oferece o horário ocupado',
        !ofereceOcupado,
        `status ${gradePublica.status}`,
      );

      const bookOnline = await api('POST', `/public/booking/${slug}/appointments`, {
        body: {
          serviceId: service.id,
          professionalId: pro.id,
          start: startIso,
          customer: { name: 'Cliente Online', phone: '5589900000000' },
        },
      });
      check(
        '9) marcar online em horário ocupado continua sendo recusado',
        bookOnline.status >= 400,
        `status ${bookOnline.status}`,
      );
    }
  } finally {
    const { prisma } = await import('@beautypass/db');
    if (companyId) {
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  }

  const total = passed + failed;
  // eslint-disable-next-line no-console
  console.log(
    `\n──────────────────────────────────────────────\n` +
      `Encaixe de agendamento: ${passed}/${total} verificações passaram` +
      (failed ? `, ${failed} FALHARAM` : '') +
      `\n──────────────────────────────────────────────`,
  );
  if (failed) {
    // eslint-disable-next-line no-console
    console.error(`\nFalhas:\n - ${failures.join('\n - ')}`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Suite crashed:', e);
  process.exit(1);
});
