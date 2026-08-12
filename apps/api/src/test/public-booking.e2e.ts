/**
 * Public-booking portal regression suite (real DB, no mocks).
 *
 * WHY THIS EXISTS
 * ----------------
 * The customer-facing home ("início") is powered entirely by the public booking
 * endpoints (portal / services / professionals / availability / agenda / my-*).
 * The home was reported as slow/janky, and the fix touched how those queries are
 * consumed on the client. This suite locks the *server* contract those screens
 * depend on: response shapes, visibility/ordering rules, the privacy guarantee of
 * the public agenda, booking + cancel flows, and the auth gating of the "my-*"
 * customer feeds — proven against the REAL Nest app + REAL Postgres.
 *
 * HOW IT RUNS
 * -----------
 *   pnpm --filter @beautypass/api test:booking
 *
 * It boots the API in-process on a dedicated port, signs up one throwaway salon
 * tenant (staff) + one throwaway customer through real Better Auth, provisions a
 * realistic catalog (services with mixed visibility, professionals with/without
 * the service + schedules), exercises every public endpoint with 100+ assertions,
 * and finally deletes the throwaway company + customer (cascades clean up). Exit
 * code is non-zero if any assertion fails. No production data is touched.
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// --- Load env BEFORE importing anything that reads it at module init. ---
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
      /* file may not exist; ignore */
    }
  }
}
loadEnv();

const PORT = Number(process.env.BOOKING_TEST_PORT ?? 4600);
process.env.BETTER_AUTH_URL = `http://localhost:${PORT}`;
const BASE = `http://localhost:${PORT}/api/v1`;

// ---------------------------------------------------------------------------
// Tiny assertion harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean) {
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(label);
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${label}`);
  }
}

// Assert an object exposes exactly the expected keys (no leak, no missing).
function checkKeys(label: string, obj: unknown, keys: string[]) {
  const present = obj && typeof obj === 'object' ? Object.keys(obj as object).sort() : [];
  const want = [...keys].sort();
  check(
    `${label} has keys [${want.join(', ')}] (got [${present.join(', ')}])`,
    present.length === want.length && want.every((k) => present.includes(k)),
  );
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
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

async function signUp(
  name: string,
  accountType: 'staff' | 'customer',
): Promise<{ email: string; password: string; token: string; userId: string }> {
  const email = `book-${Date.now()}-${accountType}-${Math.floor(Math.random() * 1e6)}@booking.test`;
  const password = 'booking-test-pw-123';
  const signupBody: Record<string, unknown> = { name, email, password };
  if (accountType === 'customer') signupBody.accountType = 'customer';
  let res = await api('POST', '/auth/sign-up/email', { body: signupBody });
  let token = res.token;
  let userId = res.body?.user?.id ?? '';
  if (!token) {
    const signin = await api('POST', '/auth/sign-in/email', { body: { email, password } });
    token = signin.token;
    userId = userId || signin.body?.user?.id || '';
  }
  if (!token) {
    throw new Error(
      `[${name}] could not obtain bearer token. signup=${res.status} ${JSON.stringify(res.body)}`,
    );
  }
  return { email, password, token, userId };
}

function listItems(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  const { NestFactory } = await import('@nestjs/core');
  const { ValidationPipe } = await import('@nestjs/common');
  const expressMod = await import('express');
  const express = (expressMod as any).default ?? expressMod;
  const { toNodeHandler } = await import('better-auth/node');
  const { AppModule } = await import('../app.module.js');
  const { auth } = await import('../auth/better-auth.js');
  const { prisma } = await import('@beautypass/db');

  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: ['error', 'warn'],
  });
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
  console.log(`\n▶ Public-booking suite running against ${BASE}\n`);

  let companyId = '';
  let customerUserId = '';

  try {
    // ====================================================================
    // 0. Provision a throwaway salon + a throwaway customer
    // ====================================================================
    const salon = await signUp('Studio Borboletas', 'staff');
    const customer = await signUp('Maria Cliente', 'customer');
    customerUserId = customer.userId;

    // Resolve the salon's companyId (signup hook provisions it async).
    for (let i = 0; i < 15 && !companyId; i++) {
      const cur = await api('GET', '/companies/current', { token: salon.token });
      if (cur.status === 200 && cur.body?.id) companyId = cur.body.id;
      else await new Promise((r) => setTimeout(r, 200));
    }
    check('salon company provisioned', !!companyId);
    check('customer account got a token (no company needed)', !!customer.token);

    // Este tenant propositalmente não cria Subscription para continuar
    // cobrindo os fallbacks de plano do portal. Habilita apenas o add-on que a
    // suíte exercita, como faria um override comercial real.
    await prisma.featureFlag.upsert({
      where: {
        companyId_key: { companyId, key: 'online_booking' },
      },
      create: { companyId, key: 'online_booking', enabled: true },
      update: { enabled: true },
    });

    // The public portal is addressed by the BookingLink slug; GET auto-creates it.
    const linkRes = await api('GET', '/booking-link', { token: salon.token });
    const slug: string = linkRes.body?.slug;
    check('GET /booking-link returns a slug', typeof slug === 'string' && slug.length > 0);
    check('GET /booking-link is active by default', linkRes.body?.active === true);

    // Configure a manager WhatsApp number (owner/manager are the same) so we can
    // assert a client-initiated cancellation is enqueued to the salon. WhatsApp is
    // disabled in tests (WHATSAPP_ENABLED !== 'true'), so nothing is actually sent
    // — but enqueueText persists to WhatsappOutbox, which we inspect. Mirrors
    // WhatsappService.setManagerPhone's storage shape.
    const MANAGER_PHONE = '5511900000000';
    await prisma.whatsappAuthState.upsert({
      where: {
        sessionId_category_itemId: { sessionId: 'config', category: 'owner', itemId: companyId },
      },
      create: {
        sessionId: 'config',
        category: 'owner',
        itemId: companyId,
        data: { managerPhone: MANAGER_PHONE },
      },
      update: { data: { managerPhone: MANAGER_PHONE } },
    });

    // Two identical enqueue calls racing each other must result in ONE durable
    // outbox row. This protects every producer (booking, cancellation, queues,
    // campaigns) from accidental double dispatch.
    const { WhatsappService } = await import(
      '../modules/whatsapp/whatsapp.service.js'
    );
    const whatsapp = app.get(WhatsappService);
    const dedupProbe = `probe-dedup-${Date.now()}`;
    await Promise.all([
      whatsapp.enqueueText(MANAGER_PHONE, dedupProbe, {
        companyId,
        kind: 'manager',
      }),
      whatsapp.enqueueText(MANAGER_PHONE, dedupProbe, {
        companyId,
        kind: 'manager',
      }),
    ]);
    const dedupRows = await prisma.whatsappOutbox.count({
      where: { companyId, toPhone: MANAGER_PHONE, text: dedupProbe },
    });
    check('WhatsApp outbox discards concurrent duplicate message', dedupRows === 1);

    // Automatic WhatsApp is OPT-IN (everything OFF by default). This suite asserts
    // that the client confirmation and the manager heads-ups ARE enqueued, so we
    // explicitly opt this throwaway salon in. Without this the sends are correctly
    // suppressed and those assertions would (rightly) fail.
    const optIn = await api('PATCH', '/notification-settings', {
      token: salon.token,
      body: { confirmation: true, cancellation: true, notifyProfessional: true },
    });
    check('opt-in notification toggles (confirmation + notifyProfessional)', optIn.status === 200);

    // ====================================================================
    // 1. Catalog: services with mixed visibility + a category
    // ====================================================================
    const catRes = await api('POST', '/product-categories', {
      token: salon.token,
      body: { name: 'Cabelo' },
    });
    const categoryId: string = catRes.body?.id;
    check('product-category created', !!categoryId);

    async function mkService(body: Record<string, unknown>): Promise<string> {
      const r = await api('POST', '/services', { token: salon.token, body });
      check(`create service "${body.name}" ok`, r.status >= 200 && r.status < 300 && !!r.body?.id);
      return r.body?.id;
    }

    // Visible/online/active (defaults). Two images → imageUrls passthrough.
    const sVisible = await mkService({
      name: 'Corte Feminino',
      price: 80,
      durationMin: 30,
      categoryId,
      imageUrls: ['a.jpg', 'b.jpg'],
    });
    // Favorite + single imageUrl (no imageUrls) → imageUrls falls back to [imageUrl].
    const sFav = await mkService({
      name: 'Escova',
      price: 50,
      durationMin: 30,
      favorite: true,
      imageUrl: 'solo.jpg',
    });
    // Excluded from the public list, each for a different reason.
    const sOffline = await mkService({
      name: 'Oculto Online',
      price: 10,
      durationMin: 15,
      onlineBookable: false,
    });
    const sHidden = await mkService({
      name: 'Invisivel',
      price: 10,
      durationMin: 15,
      visible: false,
    });
    const sInactive = await mkService({
      name: 'Inativo',
      price: 10,
      durationMin: 15,
      active: false,
    });

    // ====================================================================
    // 2. Professionals + schedules + service links
    // ====================================================================
    async function mkPro(body: Record<string, unknown>): Promise<string> {
      const r = await api('POST', '/professionals', { token: salon.token, body });
      check(`create professional "${body.name}" ok`, r.status >= 200 && r.status < 300 && !!r.body?.id);
      return r.body?.id;
    }
    // Bookable, performs sVisible, works every day all day.
    const pMain = await mkPro({ name: 'Ana Estilista', profession: 'Cabeleireira' });
    // Bookable, but does NOT perform sVisible.
    const pOther = await mkPro({ name: 'Bia Sem Servico' });
    // Performs sVisible but is offline (not bookable online).
    const pOffline = await mkPro({ name: 'Carla Offline', onlineBookable: false });

    // All-day schedule on every weekday so "open now" + availability are stable.
    const allWeek = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      startTime: '00:00',
      endTime: '23:59',
    }));
    const schedMain = await api('PUT', `/professionals/${pMain}/schedules`, {
      token: salon.token,
      body: allWeek,
    });
    check('set schedules on main professional ok', schedMain.status >= 200 && schedMain.status < 300);
    await api('PUT', `/professionals/${pOffline}/schedules`, { token: salon.token, body: allWeek });

    // Link services to professionals.
    const linkMain = await api('PUT', `/professionals/${pMain}/services`, {
      token: salon.token,
      body: { serviceIds: [sVisible, sFav] },
    });
    check('link services to main professional ok', linkMain.status >= 200 && linkMain.status < 300);
    await api('PUT', `/professionals/${pOffline}/services`, {
      token: salon.token,
      body: { serviceIds: [sVisible] },
    });
    // pOther intentionally has no services.

    // ====================================================================
    // 3. PORTAL — GET /public/booking/:slug
    // ====================================================================
    const portal = await api('GET', `/public/booking/${slug}`);
    check('portal 200', portal.status === 200);
    checkKeys('portal', portal.body, [
      'slug',
      'name',
      'logoUrl',
      'timezone',
      'open',
      'todayHours',
      'rating',
      'location',
      'plan',
      'whatsapp',
      'googleEnabled',
      'accentColor',
      'appearance',
    ]);
    check('portal slug echoes request', portal.body?.slug === slug);
    check('portal name === "Salão de Studio Borboletas"', portal.body?.name === 'Salão de Studio Borboletas');
    check('portal timezone is a string', typeof portal.body?.timezone === 'string');
    check('portal logoUrl null (none set)', portal.body?.logoUrl === null);
    check('portal rating null (no reviews)', portal.body?.rating === null);
    check('portal plan null (no subscription)', portal.body?.plan === null);
    check('portal whatsapp null (no address)', portal.body?.whatsapp === null);
    check('portal googleEnabled is boolean', typeof portal.body?.googleEnabled === 'boolean');
    check('portal accentColor null (not customized)', portal.body?.accentColor === null);
    // Appearance always present with sensible defaults when the salon has no
    // booking.appearance Setting (never breaks salons without config).
    check(
      'portal appearance defaults (no Setting)',
      portal.body?.appearance?.hideNavbar === false &&
        portal.body?.appearance?.primaryColor === null &&
        portal.body?.appearance?.accentColor === null &&
        portal.body?.appearance?.backgroundColor === null,
    );
    check('portal open === true (all-day schedule)', portal.body?.open === true);
    check('portal todayHours.start === 00:00', portal.body?.todayHours?.start === '00:00');

    const savedAppearance = await api('PUT', '/booking-link/appearance', {
      token: salon.token,
      body: {
        hideNavbar: true,
        primaryColor: '#123456',
        accentColor: '#ABCDEF',
        backgroundColor: '#F4F1EC',
      },
    });
    check('admin salva personalização do agendamento online', savedAppearance.status === 200);
    check(
      'personalização normaliza e devolve todas as opções',
      savedAppearance.body?.hideNavbar === true &&
        savedAppearance.body?.primaryColor === '#123456' &&
        savedAppearance.body?.accentColor === '#ABCDEF' &&
        savedAppearance.body?.backgroundColor === '#F4F1EC',
    );
    const customizedPortal = await api('GET', `/public/booking/${slug}`);
    check(
      'portal público recebe personalização do salão',
      customizedPortal.body?.appearance?.hideNavbar === true &&
        customizedPortal.body?.appearance?.primaryColor === '#123456' &&
        customizedPortal.body?.appearance?.accentColor === '#ABCDEF' &&
        customizedPortal.body?.appearance?.backgroundColor === '#F4F1EC',
    );

    // Unknown slug → 404 on every public GET.
    const unknown = await api('GET', `/public/booking/nao-existe-${Date.now()}`);
    check('portal unknown slug → 404', unknown.status === 404);

    // ====================================================================
    // 4. SERVICES — GET /:slug/services
    // ====================================================================
    const svcRes = await api('GET', `/public/booking/${slug}/services`);
    check('services 200', svcRes.status === 200);
    const svc = listItems(svcRes.body);
    const svcIds = new Set(svc.map((s) => s.id));
    check('services includes visible service', svcIds.has(sVisible));
    check('services includes favorite service', svcIds.has(sFav));
    check('services EXCLUDES offline service', !svcIds.has(sOffline));
    check('services EXCLUDES hidden service', !svcIds.has(sHidden));
    check('services EXCLUDES inactive service', !svcIds.has(sInactive));
    check('services count === 2 bookable', svc.length === 2);

    const visibleItem = svc.find((s) => s.id === sVisible);
    checkKeys('service item', visibleItem, [
      'id',
      'name',
      'price',
      'durationMin',
      'description',
      'imageUrl',
      'imageUrls',
      'categoryId',
      'categoryName',
      'favorite',
      'isNew',
    ]);
    check('service name correct', visibleItem?.name === 'Corte Feminino');
    check('service durationMin correct', visibleItem?.durationMin === 30);
    check('service isNew true (just created)', visibleItem?.isNew === true);
    check('service favorite false', visibleItem?.favorite === false);
    check('service categoryName === Cabelo', visibleItem?.categoryName === 'Cabelo');
    check(
      'service imageUrls passthrough [a,b]',
      Array.isArray(visibleItem?.imageUrls) &&
        visibleItem.imageUrls.length === 2 &&
        visibleItem.imageUrls[0] === 'a.jpg',
    );

    const favItem = svc.find((s) => s.id === sFav);
    check('favorite service favorite=true', favItem?.favorite === true);
    check('favorite service categoryName null (no category)', favItem?.categoryName === null);
    check(
      'imageUrls falls back to [imageUrl] when only imageUrl set',
      Array.isArray(favItem?.imageUrls) &&
        favItem.imageUrls.length === 1 &&
        favItem.imageUrls[0] === 'solo.jpg',
    );

    // services on unknown slug → 404
    const svc404 = await api('GET', `/public/booking/nope-${Date.now()}/services`);
    check('services unknown slug → 404', svc404.status === 404);

    // ====================================================================
    // 5. PROFESSIONALS — GET /:slug/professionals?serviceId=
    // ====================================================================
    const proMissing = await api('GET', `/public/booking/${slug}/professionals`);
    check('professionals without serviceId → 400', proMissing.status === 400);

    const proRes = await api('GET', `/public/booking/${slug}/professionals?serviceId=${sVisible}`);
    check('professionals 200', proRes.status === 200);
    const pros = listItems(proRes.body);
    const proIds = new Set(pros.map((p) => p.id));
    check('professionals includes main (linked + bookable)', proIds.has(pMain));
    check('professionals EXCLUDES unlinked professional', !proIds.has(pOther));
    check('professionals EXCLUDES offline professional', !proIds.has(pOffline));
    check('professionals count === 1', pros.length === 1);
    checkKeys('professional item', pros[0], [
      'id',
      'name',
      'nickname',
      'avatarUrl',
      'profession',
    ]);
    check('professional name correct', pros[0]?.name === 'Ana Estilista');
    check('professional profession correct', pros[0]?.profession === 'Cabeleireira');

    const proUnknownSvc = await api(
      'GET',
      `/public/booking/${slug}/professionals?serviceId=does-not-exist`,
    );
    check('professionals for unknown service → empty', listItems(proUnknownSvc.body).length === 0);

    // ====================================================================
    // 6. AVAILABILITY — GET /:slug/availability
    // ====================================================================
    const tomorrow = ymd(new Date(Date.now() + 24 * 60 * 60000));

    const availNoPro = await api(
      'GET',
      `/public/booking/${slug}/availability?serviceId=${sVisible}&date=${tomorrow}`,
    );
    check('availability without professionalId → empty slots', listItems(availNoPro.body?.slots ?? availNoPro.body).length === 0 && Array.isArray(availNoPro.body?.slots));

    const availUnknownSvc = await api(
      'GET',
      `/public/booking/${slug}/availability?serviceId=nope&professionalId=${pMain}&date=${tomorrow}`,
    );
    check('availability unknown service → empty slots', (availUnknownSvc.body?.slots ?? []).length === 0);

    const availWrongPro = await api(
      'GET',
      `/public/booking/${slug}/availability?serviceId=${sVisible}&professionalId=${pOther}&date=${tomorrow}`,
    );
    check(
      'availability for professional who does not perform service → empty',
      (availWrongPro.body?.slots ?? []).length === 0,
    );

    const avail = await api(
      'GET',
      `/public/booking/${slug}/availability?serviceId=${sVisible}&professionalId=${pMain}&date=${tomorrow}`,
    );
    check('availability 200', avail.status === 200);
    checkKeys('availability', avail.body, ['date', 'serviceId', 'professionalId', 'slots']);
    check('availability date echoes', avail.body?.date === tomorrow);
    check('availability serviceId echoes', avail.body?.serviceId === sVisible);
    check('availability professionalId echoes', avail.body?.professionalId === pMain);
    const slots = avail.body?.slots ?? [];
    check('availability returns slots', Array.isArray(slots) && slots.length > 0);
    if (slots.length) {
      const s0 = slots[0];
      checkKeys('availability slot', s0, ['start', 'end']);
      const durMin = (new Date(s0.end).getTime() - new Date(s0.start).getTime()) / 60000;
      check('slot duration === service durationMin (30)', durMin === 30);
      check('slot start is a valid ISO date', !Number.isNaN(new Date(s0.start).getTime()));
      check('slot start is in the future', new Date(s0.start).getTime() > Date.now());
    }

    // ====================================================================
    // 7. AGENDA — GET /:slug/agenda (privacy: free/busy only)
    // ====================================================================
    const from = ymd(new Date());
    const to = ymd(new Date(Date.now() + 7 * 24 * 60 * 60000));
    const agenda = await api('GET', `/public/booking/${slug}/agenda?from=${from}&to=${to}`);
    check('agenda 200', agenda.status === 200);
    checkKeys('agenda', agenda.body, ['professionals', 'busy', 'schedules']);
    const agProIds = new Set((agenda.body?.professionals ?? []).map((p: any) => p.id));
    check('agenda lists bookable professionals', agProIds.has(pMain));
    check('agenda excludes offline professional', !agProIds.has(pOffline));
    check('agenda busy initially empty', Array.isArray(agenda.body?.busy) && agenda.body.busy.length === 0);
    check('agenda schedules present', Array.isArray(agenda.body?.schedules) && agenda.body.schedules.length > 0);

    // ====================================================================
    // 8. AUTH GATING — my-* feeds require a customer session
    // ====================================================================
    for (const ep of ['my-appointments', 'my-notifications', 'my-profile']) {
      const noTok = await api('GET', `/public/booking/${slug}/${ep}`);
      check(`GET ${ep} without token → 401`, noTok.status === 401);
      const badTok = await api('GET', `/public/booking/${slug}/${ep}`, { token: 'not-a-token' });
      check(`GET ${ep} with bad token → 401`, badTok.status === 401);
    }
    const cancelNoTok = await api('POST', `/public/booking/${slug}/my-appointments/x/cancel`);
    check('POST cancel without token → 401', cancelNoTok.status === 401);
    const readNoTok = await api('POST', `/public/booking/${slug}/my-notifications/x/read`);
    check('POST notification read without token → 401', readNoTok.status === 401);
    const readAllNoTok = await api('POST', `/public/booking/${slug}/my-notifications/read-all`);
    check('POST read-all without token → 401', readAllNoTok.status === 401);

    // Conta de SALÃO agenda como qualquer pessoa — ver estudo 136.
    //
    // Este caso exigia 401: o portal barrava `accountType !== 'customer'`. A
    // trava existia porque painel e portal dividiam UM cookie, então o dono
    // logado na Gestão aparecia logado no portal sem nunca ter entrado ali.
    // Agora o portal tem sessão própria e a trava só atrapalhava — o e-mail é
    // único no sistema, então staff de um salão não agendava em NENHUM outro.
    const staffOnMine = await api('GET', `/public/booking/${slug}/my-appointments`, {
      token: salon.token,
    });
    check('conta de salão acessa my-appointments (estudo 136)', staffOnMine.status === 200);

    // ====================================================================
    // 9. BOOKING — POST /:slug/appointments (validation + guest + customer)
    // ====================================================================
    const startISO = `${tomorrow}T14:00:00-03:00`;

    // Validation failures (whitelisted ValidationPipe → 400).
    const missingSvc = await api('POST', `/public/booking/${slug}/appointments`, {
      body: { professionalId: pMain, start: startISO },
    });
    check('book missing serviceId → 400', missingSvc.status === 400);
    const missingPro = await api('POST', `/public/booking/${slug}/appointments`, {
      body: { serviceId: sVisible, start: startISO },
    });
    check('book missing professionalId → 400', missingPro.status === 400);
    const badStart = await api('POST', `/public/booking/${slug}/appointments`, {
      body: { serviceId: sVisible, professionalId: pMain, start: 'not-a-date' },
    });
    check('book invalid start → 400', badStart.status === 400);

    // Unknown slug → 404.
    const bookUnknownSlug = await api('POST', `/public/booking/nope-${Date.now()}/appointments`, {
      body: { serviceId: sVisible, professionalId: pMain, start: startISO, guest: { name: 'Visitante', phone: '11999990000' } },
    });
    check('book unknown slug → 404', bookUnknownSlug.status === 404);

    // Booking a NON-bookable service → 404 (service unavailable).
    const bookOffline = await api('POST', `/public/booking/${slug}/appointments`, {
      body: { serviceId: sOffline, professionalId: pMain, start: startISO, guest: { name: 'Visitante', phone: '11999990001' } },
    });
    check('book offline service → 404', bookOffline.status === 404);

    // Guest booking missing contact → 400.
    const guestNoContact = await api('POST', `/public/booking/${slug}/appointments`, {
      body: { serviceId: sVisible, professionalId: pMain, start: startISO, guest: { name: 'Sem Contato' } },
    });
    check('guest booking without phone/email → 400', guestNoContact.status === 400);

    // Valid GUEST booking.
    const guestBook = await api('POST', `/public/booking/${slug}/appointments`, {
      body: {
        serviceId: sVisible,
        professionalId: pMain,
        start: `${tomorrow}T16:00:00-03:00`,
        guest: { name: 'Joana Guest', phone: '11988887777' },
      },
    });
    check('guest booking → 2xx', guestBook.status >= 200 && guestBook.status < 300);
    checkKeys('booking result', guestBook.body, ['id', 'status', 'payment']);
    check('booking payment === pay_at_salon', guestBook.body?.payment === 'pay_at_salon');
    check('booking returns an id', typeof guestBook.body?.id === 'string');

    // A disponibilidade precisa excluir a janela recém-ocupada. Esta regressão
    // também protege o agendamento via IA, que usa o mesmo serviço.
    const availabilityAfterGuest = await api(
      'GET',
      `/public/booking/${slug}/availability?serviceId=${sVisible}&professionalId=${pMain}&date=${tomorrow}`,
    );
    const slotsAfterGuest = availabilityAfterGuest.body?.slots ?? [];
    const guestStartMs = new Date(`${tomorrow}T16:00:00-03:00`).getTime();
    const guestEndMs = guestStartMs + 30 * 60_000;
    check(
      'availability excludes slot occupied by existing appointment',
      !slotsAfterGuest.some(
        (slot: { start: string; end: string }) =>
          new Date(slot.start).getTime() < guestEndMs &&
          new Date(slot.end).getTime() > guestStartMs,
      ),
    );

    // Confirmation/cancellation are company defaults SNAPSHOTTED into each new
    // appointment. This lets the salon change one appointment without changing
    // every other appointment. This tenant opted both defaults in above.
    const guestNotificationPrefs = await prisma.appointment.findUnique({
      where: { id: guestBook.body?.id },
      select: {
        notifyConfirmation: true,
        notifyCancellation: true,
      },
    });
    check(
      'new booking inherits confirmation notification default',
      guestNotificationPrefs?.notifyConfirmation === true,
    );
    check(
      'new booking inherits cancellation notification default',
      guestNotificationPrefs?.notifyCancellation === true,
    );

    // A single appointment can override both defaults through the regular
    // appointment PATCH used by the agenda drawer.
    const notificationOverride = await api(
      'PATCH',
      `/appointments/${guestBook.body?.id}`,
      {
        token: salon.token,
        body: {
          notifyConfirmation: false,
          notifyCancellation: false,
        },
      },
    );
    check('per-booking notification override → 200', notificationOverride.status === 200);
    check(
      'per-booking confirmation override persisted',
      notificationOverride.body?.notifyConfirmation === false,
    );
    check(
      'per-booking cancellation override persisted',
      notificationOverride.body?.notifyCancellation === false,
    );

    // Guest booking now occupies the public agenda (privacy-safe block).
    const agenda2 = await api('GET', `/public/booking/${slug}/agenda?from=${from}&to=${to}`);
    const busy = agenda2.body?.busy ?? [];
    check('agenda busy now has the guest booking', busy.length === 1);
    if (busy.length) {
      checkKeys('agenda busy block (privacy: time + professional only)', busy[0], [
        'professionalId',
        'start',
        'end',
      ]);
      check('busy block is for the main professional', busy[0]?.professionalId === pMain);
    }

    // Valid CUSTOMER (logged-in) booking.
    const custBook = await api('POST', `/public/booking/${slug}/appointments`, {
      token: customer.token,
      body: {
        serviceId: sVisible,
        professionalId: pMain,
        start: `${tomorrow}T18:00:00-03:00`,
        phone: '11955554444',
      },
    });
    check('customer booking → 2xx', custBook.status >= 200 && custBook.status < 300);
    const custApptId: string = custBook.body?.id;
    check('customer booking returns id', typeof custApptId === 'string');

    // ====================================================================
    // 10. MY-APPOINTMENTS / MY-NOTIFICATIONS (customer session)
    // ====================================================================
    const mine = await api('GET', `/public/booking/${slug}/my-appointments`, {
      token: customer.token,
    });
    check('my-appointments 200', mine.status === 200);
    const mineData = listItems(mine.body);
    check('my-appointments includes the booking', mineData.some((a) => a.id === custApptId));
    const myAppt = mineData.find((a) => a.id === custApptId);
    if (myAppt) {
      checkKeys('my-appointment item', myAppt, [
        'id',
        'start',
        'end',
        'status',
        'professionalName',
        'serviceNames',
        'canCancel',
        'canReview',
        'reviewed',
        'rating',
      ]);
      check('my-appointment professionalName correct', myAppt.professionalName === 'Ana Estilista');
      check('my-appointment serviceNames includes Corte', myAppt.serviceNames?.includes('Corte Feminino'));
      check('my-appointment canCancel true (future)', myAppt.canCancel === true);
    }

    const notifs = await api('GET', `/public/booking/${slug}/my-notifications`, {
      token: customer.token,
    });
    check('my-notifications 200', notifs.status === 200);
    checkKeys('my-notifications envelope', notifs.body, ['data', 'unreadCount']);
    check('my-notifications data is array', Array.isArray(notifs.body?.data));
    check('my-notifications unreadCount is number', typeof notifs.body?.unreadCount === 'number');

    // Mark-all-read is idempotent and always returns { ok: true }.
    const readAll = await api('POST', `/public/booking/${slug}/my-notifications/read-all`, {
      token: customer.token,
    });
    check('mark all notifications read → ok', readAll.status >= 200 && readAll.status < 300 && readAll.body?.ok === true);
    const notifs2 = await api('GET', `/public/booking/${slug}/my-notifications`, {
      token: customer.token,
    });
    check('after read-all, unreadCount === 0', notifs2.body?.unreadCount === 0);

    // ====================================================================
    // 11. CANCEL — POST /:slug/my-appointments/:id/cancel
    // ====================================================================
    // Cancelling someone else's / unknown appointment → 404.
    const cancelUnknown = await api(
      'POST',
      `/public/booking/${slug}/my-appointments/does-not-exist/cancel`,
      { token: customer.token },
    );
    check('cancel unknown appointment → 404', cancelUnknown.status === 404);

    const cancel = await api(
      'POST',
      `/public/booking/${slug}/my-appointments/${custApptId}/cancel`,
      { token: customer.token },
    );
    check('cancel own appointment → 2xx', cancel.status >= 200 && cancel.status < 300);
    check('cancel returns canceled status', cancel.body?.status === 'canceled');

    // The cancel notifies the salon's WhatsApp (enqueued to the outbox). The send
    // is fire-and-forget, so poll briefly for the row.
    let cancelMsg: { text: string } | null = null;
    for (let i = 0; i < 25 && !cancelMsg; i++) {
      cancelMsg = await prisma.whatsappOutbox.findFirst({
        where: { toPhone: MANAGER_PHONE, text: { contains: 'cancelado pelo cliente' } },
        orderBy: { createdAt: 'desc' },
        select: { text: true },
      });
      if (!cancelMsg) await new Promise((r) => setTimeout(r, 100));
    }
    check('cancel enqueues a WhatsApp to the salon manager', !!cancelMsg);
    check(
      'manager WhatsApp names the client + the freed slot',
      !!cancelMsg &&
        cancelMsg.text.includes('Maria Cliente') &&
        cancelMsg.text.includes('liberado'),
    );

    // After cancel, it is no longer cancelable and the slot frees up in agenda.
    const mineAfter = await api('GET', `/public/booking/${slug}/my-appointments`, {
      token: customer.token,
    });
    const canceledAppt = listItems(mineAfter.body).find((a) => a.id === custApptId);
    check('canceled appointment status === canceled', canceledAppt?.status === 'canceled');
    check('canceled appointment canCancel === false', canceledAppt?.canCancel === false);

    const agenda3 = await api('GET', `/public/booking/${slug}/agenda?from=${from}&to=${to}`);
    const busy3Ids = (agenda3.body?.busy ?? []).map((b: any) => `${b.start}`);
    check(
      'canceled customer booking no longer occupies agenda (only the guest one remains)',
      (agenda3.body?.busy ?? []).length === 1,
    );

    // Double-cancel → 400 (already terminal).
    const cancelAgain = await api(
      'POST',
      `/public/booking/${slug}/my-appointments/${custApptId}/cancel`,
      { token: customer.token },
    );
    check('double cancel → 400', cancelAgain.status === 400);

    // ====================================================================
    // 11b. MY-PROFILE — view + edit the logged-in customer's name/WhatsApp
    // ====================================================================
    const prof0 = await api('GET', `/public/booking/${slug}/my-profile`, {
      token: customer.token,
    });
    check('my-profile 200', prof0.status === 200);
    checkKeys('my-profile shape', prof0.body, ['name', 'phone', 'email']);
    check('my-profile name is the signup name', prof0.body?.name === 'Maria Cliente');

    // Edit name + phone — persisted to the auth User AND this salon's Customer.
    const newPhone = '5511955551234';
    const prof1 = await api('PATCH', `/public/booking/${slug}/my-profile`, {
      token: customer.token,
      body: { name: 'Maria Editada', phone: newPhone },
    });
    check('update profile → 200', prof1.status === 200);
    check('update profile returns new name', prof1.body?.name === 'Maria Editada');
    check('update profile returns new phone', prof1.body?.phone === newPhone);

    // Re-fetch confirms it stuck.
    const prof2 = await api('GET', `/public/booking/${slug}/my-profile`, {
      token: customer.token,
    });
    check('profile persisted (name)', prof2.body?.name === 'Maria Editada');
    check('profile persisted (phone)', prof2.body?.phone === newPhone);

    // It also reaches the salon's Customer record (so the salon sees it).
    const syncedCustomer = await prisma.customer.findFirst({
      where: { companyId, userId: customerUserId },
      select: { name: true, phone: true },
    });
    check('customer record name synced', syncedCustomer?.name === 'Maria Editada');
    check('customer record phone synced', syncedCustomer?.phone === newPhone);

    // The auth User (global identity, what pre-fills the next booking) is updated.
    const syncedUser = await prisma.user.findUnique({
      where: { id: customerUserId },
      select: { name: true, phone: true },
    });
    check('auth user name synced', syncedUser?.name === 'Maria Editada');
    check('auth user phone synced', syncedUser?.phone === newPhone);

    // A name shorter than 2 chars is rejected by validation (400), no data lost.
    const profBad = await api('PATCH', `/public/booking/${slug}/my-profile`, {
      token: customer.token,
      body: { name: 'X' },
    });
    check('update profile with 1-char name → 400', profBad.status === 400);

    // Conta de salão tem o próprio perfil de cliente NESTE salão — estudo 136.
    // `Customer` é por empresa (`{ companyId, userId }`), então ser staff em uma
    // não vira acesso a outra: o que ela enxerga aqui é só o cadastro dela.
    const profStaff = await api('GET', `/public/booking/${slug}/my-profile`, {
      token: salon.token,
    });
    check('conta de salão acessa my-profile (estudo 136)', profStaff.status === 200);

    // ====================================================================
    // 11c. REVIEW — customer rates a FINISHED appointment
    // ====================================================================
    // Seed a finished appointment for the logged-in customer (the public flow
    // never produces a finished one synchronously).
    const custCustomer = await prisma.customer.findFirst({
      where: { companyId, userId: customerUserId },
      select: { id: true },
    });
    const past = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const finished = await prisma.appointment.create({
      data: {
        companyId,
        customerId: custCustomer!.id,
        professionalId: pMain,
        status: 'finished',
        start: past,
        end: new Date(past.getTime() + 30 * 60 * 1000),
        source: 'online',
        items: { create: [{ serviceId: sVisible, durationMin: 30, price: 0 }] },
      },
      select: { id: true },
    });

    // It shows up as reviewable.
    const mineRev = await api('GET', `/public/booking/${slug}/my-appointments`, {
      token: customer.token,
    });
    const revAppt = listItems(mineRev.body).find((a) => a.id === finished.id);
    check('finished appointment present', !!revAppt);
    checkKeys('my-appointment review keys', revAppt, [
      'id',
      'start',
      'end',
      'status',
      'professionalName',
      'serviceNames',
      'canCancel',
      'canReview',
      'reviewed',
      'rating',
    ]);
    check('finished appointment canReview true', revAppt?.canReview === true);
    check('finished appointment reviewed false', revAppt?.reviewed === false);
    check('finished appointment rating null', revAppt?.rating === null);
    check('finished appointment canCancel false', revAppt?.canCancel === false);

    // Bad ratings rejected (0 and 6 are out of 1–5).
    for (const bad of [0, 6]) {
      const r = await api('POST', `/public/booking/${slug}/my-appointments/${finished.id}/review`, {
        token: customer.token,
        body: { rating: bad },
      });
      check(`review rating ${bad} → 400`, r.status === 400);
    }

    // Reviewing a non-finished appointment → 400 (custApptId was canceled).
    const revCanceled = await api('POST', `/public/booking/${slug}/my-appointments/${custApptId}/review`, {
      token: customer.token,
      body: { rating: 5 },
    });
    check('review a non-finished appointment → 400', revCanceled.status === 400);

    // Unknown appointment → 404.
    const revUnknown = await api('POST', `/public/booking/${slug}/my-appointments/does-not-exist/review`, {
      token: customer.token,
      body: { rating: 5 },
    });
    check('review unknown appointment → 404', revUnknown.status === 404);

    // Without a token → 401.
    const revNoTok = await api('POST', `/public/booking/${slug}/my-appointments/${finished.id}/review`, {
      body: { rating: 5 },
    });
    check('review without token → 401', revNoTok.status === 401);

    // Happy path: rate 5 with a comment.
    const revOk = await api('POST', `/public/booking/${slug}/my-appointments/${finished.id}/review`, {
      token: customer.token,
      body: { rating: 5, comment: 'Atendimento impecável!' },
    });
    check('review finished appointment → 2xx', revOk.status >= 200 && revOk.status < 300);
    check('review returns rating 5', revOk.body?.rating === 5);
    check('review returns reviewed true', revOk.body?.reviewed === true);

    // The Review row persisted with the appointment link + service/professional.
    const savedReview = await prisma.review.findUnique({
      where: { appointmentId: finished.id },
      select: { rating: true, comment: true, serviceId: true, professionalId: true, customerId: true },
    });
    check('review persisted with rating 5', savedReview?.rating === 5);
    check('review persisted with comment', savedReview?.comment === 'Atendimento impecável!');
    check('review linked to the service', savedReview?.serviceId === sVisible);
    check('review linked to the professional', savedReview?.professionalId === pMain);
    check('review linked to the customer', savedReview?.customerId === custCustomer!.id);

    // After reviewing, the appointment is no longer reviewable and echoes the rating.
    const mineRev2 = await api('GET', `/public/booking/${slug}/my-appointments`, {
      token: customer.token,
    });
    const revAppt2 = listItems(mineRev2.body).find((a) => a.id === finished.id);
    check('after review canReview false', revAppt2?.canReview === false);
    check('after review reviewed true', revAppt2?.reviewed === true);
    check('after review rating echoes 5', revAppt2?.rating === 5);

    // Double review → 400 (already reviewed).
    const revAgain = await api('POST', `/public/booking/${slug}/my-appointments/${finished.id}/review`, {
      token: customer.token,
      body: { rating: 3 },
    });
    check('double review → 400', revAgain.status === 400);

    // The salon's portal rating aggregate now reflects the new review.
    const portalRated = await api('GET', `/public/booking/${slug}`);
    check('portal exposes a rating after review', !!portalRated.body?.rating);

    // ====================================================================
    // 11d. AUTO-CONFIRM — system confirms unanswered online bookings
    // ====================================================================
    // The salon-confirms-first flow leaves a booking `unconfirmed` until the
    // manager replies 1/2/3. If they never do, a periodic sweep confirms it once
    // it has waited too long (>5d) OR is about to happen (<24h) — so the customer
    // is never stranded on a silent salon. We seed three and run the sweep
    // directly (the WhatsApp timer that drives it is too slow for a test).
    const acCustomer = custCustomer!.id;
    const acSoon = new Date(Date.now() + 2 * 3600 * 1000); // 2h away → imminent rule
    const acFar = new Date(Date.now() + 10 * 24 * 3600 * 1000); // 10d away
    const acOld = new Date(Date.now() - 6 * 24 * 3600 * 1000); // created 6d ago → age rule
    const seedUnconfirmed = (start: Date, createdAt?: Date) =>
      prisma.appointment.create({
        data: {
          companyId,
          customerId: acCustomer,
          professionalId: pMain,
          status: 'unconfirmed',
          start,
          end: new Date(start.getTime() + 30 * 60 * 1000),
          source: 'online',
          ...(createdAt ? { createdAt } : {}),
          items: { create: [{ serviceId: sVisible, durationMin: 30, price: 0 }] },
        },
        select: { id: true },
      });
    const acImminent = await seedUnconfirmed(acSoon);
    const acStale = await seedUnconfirmed(acFar, acOld);
    const acControl = await seedUnconfirmed(acFar); // fresh + far → must stay pending

    // Count the manager auto-confirm heads-up before/after so leaked rows from a
    // previous run can't satisfy the assertion.
    const autoMsg = { toPhone: '5511900000000', text: { contains: 'automaticamente' } };
    const mgrBefore = await prisma.whatsappOutbox.count({ where: autoMsg });

    const { PublicBookingService } = await import(
      '../modules/public-booking/public-booking.service.js'
    );
    const bookingSvc = app.get(PublicBookingService);
    await (bookingSvc as any).autoConfirmStaleBookings();

    const statusOf = async (id: string) =>
      (await prisma.appointment.findUnique({ where: { id }, select: { status: true } }))?.status;
    check('auto-confirm: imminent (<24h) booking → confirmed', (await statusOf(acImminent.id)) === 'confirmed');
    check('auto-confirm: stale (>5d) booking → confirmed', (await statusOf(acStale.id)) === 'confirmed');
    check('auto-confirm: fresh far-future booking stays unconfirmed', (await statusOf(acControl.id)) === 'unconfirmed');

    const mgrAfter = await prisma.whatsappOutbox.count({ where: autoMsg });
    check('auto-confirm: manager notified of each auto-confirmation', mgrAfter - mgrBefore >= 2);

    // Idempotent: a second sweep leaves already-confirmed bookings (and the
    // still-pending control) untouched.
    await (bookingSvc as any).autoConfirmStaleBookings();
    check('auto-confirm: second sweep keeps control pending', (await statusOf(acControl.id)) === 'unconfirmed');
    const mgrAfter2 = await prisma.whatsappOutbox.count({ where: autoMsg });
    check('auto-confirm: second sweep sends no new heads-up', mgrAfter2 === mgrAfter);

    // ====================================================================
    // 12. DISABLED LINK — inactive booking link 404s the public portal
    // ====================================================================
    await api('PATCH', '/booking-link', { token: salon.token, body: { active: false } });
    const portalDisabled = await api('GET', `/public/booking/${slug}`);
    check('portal on disabled link → 404', portalDisabled.status === 404);
    const svcDisabled = await api('GET', `/public/booking/${slug}/services`);
    check('services on disabled link → 404', svcDisabled.status === 404);
    // Restore (not strictly needed, the tenant is deleted below).
    await api('PATCH', '/booking-link', { token: salon.token, body: { active: true } });
    void busy3Ids;
  } finally {
    // --- Cleanup: delete throwaway company (cascades) + customer user ---
    const { prisma } = await import('@beautypass/db');
    if (companyId) {
      // WhatsApp tables key off companyId/phone (no FK) — clear them explicitly.
      await prisma.whatsappOutbox
        .deleteMany({ where: { toPhone: '5511900000000' } })
        .catch(() => undefined);
      await prisma.whatsappAuthState
        .deleteMany({ where: { itemId: companyId } })
        .catch(() => undefined);
      // Bookings created during the suite leave AppointmentItem rows whose
      // serviceId FK is RESTRICT — clear them before the cascading company delete.
      await prisma.appointmentItem
        .deleteMany({ where: { appointment: { companyId } } })
        .catch(() => undefined);
      await prisma.appointment.deleteMany({ where: { companyId } }).catch(() => undefined);
      await prisma.company.delete({ where: { id: companyId } }).catch(() => undefined);
    }
    if (customerUserId) {
      await prisma.user.delete({ where: { id: customerUserId } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  }

  // --- Summary ---
  const total = passed + failed;
  // eslint-disable-next-line no-console
  console.log(
    `\n──────────────────────────────────────────────\n` +
      `Public booking: ${passed}/${total} assertions passed` +
      (failed ? `, ${failed} FAILED` : '') +
      `\n──────────────────────────────────────────────`,
  );
  if (failed) {
    // eslint-disable-next-line no-console
    console.error(`\nFailed assertions:\n - ${failures.join('\n - ')}`);
    process.exit(1);
  }
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Suite crashed:', e);
  process.exit(1);
});
