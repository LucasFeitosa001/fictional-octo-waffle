const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out';
const EMAIL = 'contato@fatimacabelos.com.br';
const PASSWORD = 'fatima@2026';

// A) Routes to check with h1 assertions
const ROUTES = [
  { n: 1, path: '/pacotes', check: (h1) => /pacotes/i.test(h1), expect: "h1 contém 'Pacotes'" },
  { n: 2, path: '/assinaturas?tab=subscribers', check: (h1) => /assinantes|assinaturas/i.test(h1), expect: "h1 contém 'Assinantes' ou 'Assinaturas'" },
  { n: 3, path: '/assinaturas?tab=plans', check: (h1) => /assinaturas/i.test(h1), expect: "h1 contém 'Assinaturas'" },
  { n: 4, path: '/vendas-por-assinatura', check: (h1) => /assinaturas|assinantes/i.test(h1), expect: "alias" },
  { n: 5, path: '/financeiro/transacoes', check: (h1) => /transa[cç][oõ]es/i.test(h1), expect: "h1 Transações" },
  { n: 6, path: '/financeiro/contas', check: (h1) => /contas/i.test(h1), expect: "h1 Contas" },
  { n: 7, path: '/financeiro/contas?tab=formas', check: (h1, body) => /contas/i.test(h1) && /formas/i.test(body), expect: "h1 Contas + aba formas" },
  { n: 8, path: '/financeiro/cadastros/categorias', check: (h1) => /categorias/i.test(h1), expect: "h1 Categorias" },
  { n: 9, path: '/financeiro/cadastros/formas-pagamento', check: (h1, body) => /contas/i.test(h1) && /formas/i.test(body), expect: "h1 Contas + aba formas" },
  { n: 10, path: '/financeiro/cadastros/contas', check: (h1, body) => /contas/i.test(h1), expect: "h1 Contas + aba contas" },
  { n: 11, path: '/financeiro/belasis-pay', check: (h1) => /belasis\s*pay/i.test(h1), expect: "h1 Belasis Pay" },
  { n: 12, path: '/financeiro/notas-fiscais', check: (h1, body) => /não contratada|nao contratada/i.test(body), expect: "UpsellModal" },
  { n: 13, path: '/financeiro/caixas-abertos', check: (h1, body) => /caixas/i.test(h1) && /\bResumo\b/.test(body) && !/Resumido/.test(body), expect: "h1 Caixas + aba Resumo (não Resumido)" },
  { n: 14, path: '/financeiro/historico-caixa', check: (h1) => /hist[oó]rico/i.test(h1), expect: "h1 Histórico" },
  { n: 15, path: '/agenda', check: async (h1, body, page) => {
      if (!/agenda/i.test(h1)) return false;
      const fab = await page.locator('button.rounded-full.fixed.bottom-24').count();
      return fab > 0;
    }, expect: "h1 Agenda + FAB azul" },
  { n: 16, path: '/comissoes/resumo', check: (h1, body) => /comiss[oõ]es/i.test(h1) && /Em aberto/i.test(body) && /Pagas/i.test(body), expect: "h1 Comissões + tabs curtos" },
];

// B) Drawers to check for slide-from-bottom (translate-y-0, NOT translate-x-0)
const DRAWERS = [
  {
    n: 1,
    scenario: '/comandas → 1º card mobile',
    route: '/comandas',
    action: async (page) => {
      // Click first mobile card
      const card = page.locator('ul.md\\:hidden > li').first();
      await card.waitFor({ timeout: 10000 });
      await card.click();
    },
  },
  {
    n: 2,
    scenario: '/agenda → 1º evento',
    route: '/agenda',
    action: async (page) => {
      // Try FullCalendar event
      const ev = page.locator('.fc-event, [class*="event"]').first();
      await ev.waitFor({ timeout: 8000 });
      await ev.click();
    },
  },
  {
    n: 3,
    scenario: '/clientes → 1º card mobile',
    route: '/clientes',
    action: async (page) => {
      const card = page.locator('ul.md\\:hidden > li').first();
      await card.waitFor({ timeout: 10000 });
      await card.click();
    },
  },
  {
    n: 4,
    scenario: '/pacotes → 1º card mobile',
    route: '/pacotes',
    action: async (page) => {
      const card = page.locator('ul.md\\:hidden > li').first();
      await card.waitFor({ timeout: 10000 });
      await card.click();
    },
  },
  {
    n: 5,
    scenario: '/financeiro/transacoes → Filtros (BottomNav)',
    route: '/financeiro/transacoes',
    action: async (page) => {
      const btn = page.getByRole('button', { name: /filtros/i }).last();
      await btn.waitFor({ timeout: 10000 });
      await btn.click();
    },
  },
  {
    n: 6,
    scenario: '/financeiro/contas → Novo',
    route: '/financeiro/contas',
    action: async (page) => {
      const btn = page.getByRole('button', { name: /^novo|nova/i }).last();
      await btn.waitFor({ timeout: 10000 });
      await btn.click();
    },
  },
  {
    n: 7,
    scenario: '/financeiro/cadastros/categorias → Nova',
    route: '/financeiro/cadastros/categorias',
    action: async (page) => {
      const btn = page.getByRole('button', { name: /^nova|novo/i }).last();
      await btn.waitFor({ timeout: 10000 });
      await btn.click();
    },
  },
  {
    n: 8,
    scenario: '/financeiro/caixas-abertos → 1º caixa',
    route: '/financeiro/caixas-abertos',
    action: async (page) => {
      const card = page.locator('ul.md\\:hidden > li, [class*="card"]').first();
      await card.waitFor({ timeout: 10000 });
      await card.click();
    },
  },
];

async function inspectDrawer(page) {
  // Look for any element with translate-y-0 class that is a panel (visible dialog-ish)
  return await page.evaluate(() => {
    const results = [];
    const els = document.querySelectorAll('[class*="translate-y-0"], [class*="translate-x-0"]');
    for (const el of els) {
      const cls = el.className || '';
      const clsStr = typeof cls === 'string' ? cls : String(cls);
      const rect = el.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) continue;
      results.push({
        classes: clsStr.slice(0, 400),
        hasTransY0: /\btranslate-y-0\b/.test(clsStr),
        hasTransX0: /\btranslate-x-0\b/.test(clsStr),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        top: Math.round(rect.top),
        tag: el.tagName,
        role: el.getAttribute('role') || '',
      });
    }
    return results;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const iphone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iphone,
    ignoreHTTPSErrors: true,
  });

  // Login via API
  const loginRes = await context.request.post(`${BASE}/api/v1/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  console.log('login status', loginRes.status());

  // ---------- A) ROUTES ----------
  const routeResults = [];
  for (const r of ROUTES) {
    const page = await context.newPage();
    let ok = false, note = '', h1 = '', body = '';
    const shot = path.join(OUT, `final-route-${r.n}.png`);
    try {
      const resp = await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}
      await page.waitForTimeout(2500);
      try { h1 = (await page.locator('h1').first().textContent({ timeout: 2000 }))?.trim() || ''; } catch {}
      try { body = (await page.locator('body').textContent({ timeout: 3000 })) || ''; } catch {}
      await page.screenshot({ path: shot, fullPage: false });

      const isPainelFallback = h1 === 'Painel' && !/painel/i.test(r.path);
      let check = false;
      try {
        const res = r.check(h1, body, page);
        check = (res instanceof Promise) ? await res : res;
      } catch (e) { note = 'check-err: ' + String(e).slice(0, 200); }
      ok = !isPainelFallback && check;
      note = `h1="${h1.slice(0, 80)}" fallback=${isPainelFallback} check=${check} http=${resp?.status()}`;
    } catch (e) {
      note = 'exception: ' + String(e).slice(0, 200);
    }
    routeResults.push({ route: r.path, ok, note });
    console.log(`ROUTE ${r.n} ${r.path} => ${ok ? 'OK' : 'FAIL'} :: ${note}`);
    await page.close();
  }

  // ---------- B) DRAWERS ----------
  const drawerResults = [];
  for (const d of DRAWERS) {
    const page = await context.newPage();
    let ok = false, note = '';
    const shot = path.join(OUT, `final-drawer-${d.n}.png`);
    try {
      await page.goto(`${BASE}${d.route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}
      await page.waitForTimeout(2500);

      try {
        await d.action(page);
      } catch (e) {
        note = 'action-err: ' + String(e.message || e).slice(0, 200);
      }
      await page.waitForTimeout(1500);
      const panels = await inspectDrawer(page);
      await page.screenshot({ path: shot, fullPage: false });

      // Pass if at least one panel has translate-y-0 without translate-x-0
      const winner = panels.find(p => p.hasTransY0 && !p.hasTransX0);
      ok = !!winner;
      note = (note ? note + ' | ' : '') + `panels=${panels.length} winner=${winner ? `y0-only w=${winner.w} h=${winner.h}` : 'none'} all=${JSON.stringify(panels.map(p => ({ y0: p.hasTransY0, x0: p.hasTransX0, w: p.w, h: p.h })))}`;
    } catch (e) {
      note = 'exception: ' + String(e.message || e).slice(0, 300);
    }
    drawerResults.push({ scenario: d.scenario, subiu: ok, note });
    console.log(`DRAWER ${d.n} ${d.scenario} => ${ok ? 'SUBIU' : 'FAIL'} :: ${note.slice(0, 250)}`);
    await page.close();
  }

  await browser.close();

  const passed = routeResults.filter(r => r.ok).length + drawerResults.filter(d => d.subiu).length;
  const failed = (routeResults.length + drawerResults.length) - passed;
  const out = { baseUrl: BASE, routes: routeResults, drawers: drawerResults, passed, failed };
  fs.writeFileSync(path.join(OUT, 'final-verify.json'), JSON.stringify(out, null, 2));
  console.log(`\nPASSED=${passed} FAILED=${failed}`);
})().catch(e => { console.error(e); process.exit(1); });
