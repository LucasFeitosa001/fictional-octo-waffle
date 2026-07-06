/**
 * Tenant-isolation regression suite (real DB, no mocks).
 *
 * WHY THIS EXISTS
 * ----------------
 * A reported bug: "changing data in one account changed it in all accounts" and
 * the sidebar showed the wrong salon. This suite proves, against the REAL Nest
 * app + REAL Postgres, that every company (tenant) is fully isolated: a tenant
 * can only ever see / read / mutate / delete its OWN rows, and cross-tenant
 * attempts fail with 404 while leaving the victim's data untouched.
 *
 * HOW IT RUNS
 * -----------
 *   pnpm --filter @beautypass/api test:isolation
 *
 * It boots the API in-process on a dedicated port, signs up 3 brand-new tenants
 * through real Better Auth (each gets its own Company via the signup hook),
 * exercises a CRUD isolation matrix across 5 domain entities, counts every
 * assertion, and finally deletes the 3 throwaway companies (cascades clean up
 * users + all their rows). Exit code is non-zero if any assertion fails.
 *
 * No production data is touched: it only creates and then removes its own
 * uniquely-named tenants.
 */
import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// --- Load apps/api/.env into process.env BEFORE importing anything that reads
//     it at module init (Prisma client, Better Auth). ---
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

const PORT = Number(process.env.ISOLATION_TEST_PORT ?? 4599);
// Point Better Auth at the test port so its origin/baseURL logic is consistent.
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
    // Better Auth rejects requests with a missing/untrusted Origin (CSRF guard).
    // The test port is configured as Better Auth's baseURL, so it is trusted.
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

interface Tenant {
  label: string;
  name: string;
  email: string;
  password: string;
  token: string;
  companyId: string;
  // entityKey -> created record ids for this tenant
  ids: Record<string, string[]>;
}

async function signUpTenant(label: string, name: string): Promise<Tenant> {
  const email = `iso-${Date.now()}-${label.toLowerCase()}-${Math.floor(
    Math.random() * 1e6,
  )}@isolation.test`;
  const password = 'isolation-test-pw-123';

  let res = await api('POST', '/auth/sign-up/email', {
    body: { name, email, password },
  });
  let token = res.token;
  // Some configs don't emit the bearer token on sign-up; sign in to get it.
  if (!token) {
    const signin = await api('POST', '/auth/sign-in/email', {
      body: { email, password },
    });
    token = signin.token;
  }
  if (!token) {
    throw new Error(
      `[${label}] could not obtain bearer token from auth. ` +
        `signup=${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  // The signup database hook provisions the Company asynchronously; poll until
  // /companies/current resolves with a companyId.
  let companyId = '';
  for (let i = 0; i < 10 && !companyId; i++) {
    const cur = await api('GET', '/companies/current', { token });
    if (cur.status === 200 && cur.body?.id) {
      companyId = cur.body.id;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!companyId) throw new Error(`[${label}] company was never provisioned`);

  return { label, name, email, password, token, companyId, ids: {} };
}

// ---------------------------------------------------------------------------
// Entity matrix — each domain resource that is company-scoped CRUD.
// ---------------------------------------------------------------------------
interface EntityCfg {
  key: string;
  list: string; // GET list path
  create: string; // POST path
  item: (id: string) => string; // GET/PATCH/DELETE path
  make: (i: number) => Record<string, unknown>; // valid create body
}

const ENTITIES: EntityCfg[] = [
  {
    key: 'services',
    list: '/services',
    create: '/services',
    item: (id) => `/services/${id}`,
    make: (i) => ({ name: `Serviço ${i}`, price: 50 + i, durationMin: 30 }),
  },
  {
    key: 'customers',
    list: '/customers',
    create: '/customers',
    item: (id) => `/customers/${id}`,
    make: (i) => ({ name: `Cliente ${i}` }),
  },
  {
    key: 'professionals',
    list: '/professionals',
    create: '/professionals',
    item: (id) => `/professionals/${id}`,
    make: (i) => ({ name: `Profissional ${i}` }),
  },
  {
    key: 'suppliers',
    list: '/suppliers',
    create: '/suppliers',
    item: (id) => `/suppliers/${id}`,
    make: (i) => ({ name: `Fornecedor ${i}` }),
  },
  {
    key: 'products',
    list: '/products',
    create: '/products',
    item: (id) => `/products/${id}`,
    make: (i) => ({ name: `Produto ${i}`, salePrice: 20 + i }),
  },
];

function listItems(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.data)) return body.data;
  return [];
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
  console.log(`\n▶ Tenant-isolation suite running against ${BASE}\n`);

  const createdCompanyIds: string[] = [];

  try {
    // --- 1. Provision 3 isolated tenants via real signup ---
    const tenants: Tenant[] = [];
    for (const [label, name] of [
      ['A', 'Estúdio Borboletas'],
      ['B', 'Studio Salonpass'],
      ['C', 'Salão da Bela'],
    ] as const) {
      const t = await signUpTenant(label, name);
      tenants.push(t);
      createdCompanyIds.push(t.companyId);
    }

    // Distinct companies?
    const uniqueCompanies = new Set(tenants.map((t) => t.companyId));
    check('3 signups produced 3 distinct companies', uniqueCompanies.size === 3);

    // --- 2. Each tenant creates 2 records per entity (with companyId injection
    //        attempt on the first record) ---
    for (const ent of ENTITIES) {
      for (const t of tenants) {
        t.ids[ent.key] = [];
        const foreign = tenants.find((x) => x !== t)!;
        for (let i = 0; i < 2; i++) {
          const body: Record<string, unknown> = ent.make(
            // make names unique per tenant for later integrity checks
            Number(`${tenants.indexOf(t)}${i}`),
          );
          // Attempt to inject another tenant's companyId on the first record.
          if (i === 0) body.companyId = foreign.companyId;
          const res = await api('POST', ent.create, { token: t.token, body });
          check(
            `[${ent.key}] ${t.label} create #${i} ok (got ${res.status})`,
            res.status >= 200 && res.status < 300 && !!res.body?.id,
          );
          if (res.body?.id) t.ids[ent.key].push(res.body.id);
          if (i === 0) {
            check(
              `[${ent.key}] ${t.label} create ignored injected companyId`,
              res.body?.companyId === t.companyId,
            );
          }
        }
      }
    }

    // --- 3. LIST isolation: each tenant sees own ids, never foreign ids ---
    for (const ent of ENTITIES) {
      for (const t of tenants) {
        const res = await api('GET', ent.list, { token: t.token });
        const ids = new Set(listItems(res.body).map((r: any) => r.id));
        for (const own of t.ids[ent.key]) {
          check(`[${ent.key}] ${t.label} list includes own ${own}`, ids.has(own));
        }
        for (const other of tenants.filter((x) => x !== t)) {
          for (const fid of other.ids[ent.key]) {
            check(
              `[${ent.key}] ${t.label} list EXCLUDES ${other.label}'s ${fid}`,
              !ids.has(fid),
            );
          }
        }
      }
    }

    // --- 4. Cross-tenant GET / PATCH / DELETE → 404 (and no mutation) ---
    for (const ent of ENTITIES) {
      for (const attacker of tenants) {
        for (const victim of tenants.filter((x) => x !== attacker)) {
          for (const fid of victim.ids[ent.key]) {
            const get = await api('GET', ent.item(fid), { token: attacker.token });
            check(
              `[${ent.key}] ${attacker.label} GET ${victim.label}'s row → 404`,
              get.status === 404,
            );
            const patch = await api('PATCH', ent.item(fid), {
              token: attacker.token,
              body: { name: 'HACKED' },
            });
            check(
              `[${ent.key}] ${attacker.label} PATCH ${victim.label}'s row → 404`,
              patch.status === 404,
            );
            const del = await api('DELETE', ent.item(fid), { token: attacker.token });
            check(
              `[${ent.key}] ${attacker.label} DELETE ${victim.label}'s row → 404`,
              del.status === 404,
            );
          }
        }
      }
    }

    // --- 5. Data integrity after attacks: victim's rows still exist & names
    //        were NOT changed to "HACKED" ---
    for (const ent of ENTITIES) {
      for (const t of tenants) {
        for (const id of t.ids[ent.key]) {
          const res = await api('GET', ent.item(id), { token: t.token });
          check(
            `[${ent.key}] ${t.label} own row ${id} still readable + intact`,
            res.status === 200 && res.body?.name !== 'HACKED',
          );
        }
      }
    }

    // --- 6. /companies/current returns the caller's own company only ---
    for (const t of tenants) {
      const res = await api('GET', '/companies/current', { token: t.token });
      check(`[company] ${t.label} current id === own`, res.body?.id === t.companyId);
      for (const other of tenants.filter((x) => x !== t)) {
        check(
          `[company] ${t.label} current id !== ${other.label}'s`,
          res.body?.id !== other.companyId,
        );
      }
      check(
        `[company] ${t.label} current name === "Salão de ${t.name}"`,
        res.body?.name === `Salão de ${t.name}`,
      );
    }

    // --- 7. Auth required: no token / bad token → 401 ---
    for (const path of [...ENTITIES.map((e) => e.list), '/companies/current']) {
      const none = await api('GET', path);
      check(`[auth] GET ${path} without token → 401`, none.status === 401);
      const bad = await api('GET', path, { token: 'not-a-real-token' });
      check(`[auth] GET ${path} with bad token → 401`, bad.status === 401);
    }
  } finally {
    // --- Cleanup: delete the throwaway companies (cascades users + all rows) ---
    for (const id of createdCompanyIds) {
      await prisma.company.delete({ where: { id } }).catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
    await app.close();
  }

  // --- Summary ---
  const total = passed + failed;
  // eslint-disable-next-line no-console
  console.log(
    `\n──────────────────────────────────────────────\n` +
      `Tenant isolation: ${passed}/${total} assertions passed` +
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
