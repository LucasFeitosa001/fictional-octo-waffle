const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out';
const EMAIL = 'contato@fatimacabelos.com.br';
const PASSWORD = 'fatima@2026';
const VIEWPORT_H = 812;

const DRAWERS = [
  {
    n: 1,
    scenario: '/comandas → 1º card mobile → drawer ver comanda',
    route: '/comandas',
    action: async (page) => {
      const card = page.locator('ul.md\\:hidden > li').first();
      await card.waitFor({ timeout: 10000 });
      await card.click();
    },
  },
  {
    n: 2,
    scenario: '/comandas → BottomNav "Novo" → drawer nova comanda',
    route: '/comandas',
    action: async (page) => {
      // BottomNav lives at bottom; find button/link named Novo
      const btn = page.getByRole('button', { name: /^novo|nova/i }).last();
      await btn.waitFor({ timeout: 10000 });
      await btn.click();
    },
  },
  {
    n: 3,
    scenario: '/clientes → 1º card mobile → drawer cliente',
    route: '/clientes',
    action: async (page) => {
      const card = page.locator('ul.md\\:hidden > li').first();
      await card.waitFor({ timeout: 10000 });
      await card.click();
    },
  },
  {
    n: 4,
    scenario: '/pacotes → 1º card mobile → drawer PacotePerfilModal',
    route: '/pacotes',
    action: async (page) => {
      const card = page.locator('ul.md\\:hidden > li').first();
      await card.waitFor({ timeout: 10000 });
      await card.click();
    },
  },
  {
    n: 5,
    scenario: '/financeiro/transacoes → BottomNav Filtros → drawer filtros',
    route: '/financeiro/transacoes',
    action: async (page) => {
      const btn = page.getByRole('button', { name: /filtros/i }).last();
      await btn.waitFor({ timeout: 10000 });
      await btn.click();
    },
  },
  {
    n: 6,
    scenario: '/financeiro/cadastros/categorias → BottomNav Nova → drawer categoria',
    route: '/financeiro/cadastros/categorias',
    action: async (page) => {
      const btn = page.getByRole('button', { name: /^nova|novo/i }).last();
      await btn.waitFor({ timeout: 10000 });
      await btn.click();
    },
  },
];

async function inspectDrawer(page) {
  return await page.evaluate(() => {
    const results = [];
    const els = document.querySelectorAll('[class*="translate-y-0"], [class*="translate-x-0"]');
    for (const el of els) {
      const cls = typeof el.className === 'string' ? el.className : String(el.className);
      const rect = el.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) continue;
      const hasTransY0 = /\btranslate-y-0\b/.test(cls);
      const hasTransX0 = /\btranslate-x-0\b/.test(cls);
      // Look for a grip inside: span h-1.5 w-10 rounded-full bg-black/20
      const grip = el.querySelector('span.h-1\\.5.w-10.rounded-full') ||
                   el.querySelector('span[class*="h-1.5"][class*="w-10"][class*="rounded-full"]');
      const gripVisible = !!grip && grip.getBoundingClientRect().height > 0;
      results.push({
        classes: cls.slice(0, 300),
        hasTransY0, hasTransX0,
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        top: Math.round(rect.top),
        gripVisible,
        tag: el.tagName,
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

  const loginRes = await context.request.post(`${BASE}/api/v1/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  console.log('login status', loginRes.status());

  // ---------- A) DRAWERS ----------
  const drawerResults = [];
  for (const d of DRAWERS) {
    const page = await context.newPage();
    let ok = false, note = '';
    const shot = path.join(OUT, `polish-${d.n}.png`);
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

      // Winner: translate-y-0 (not translate-x-0), not fullscreen (h < 700 < viewport 812)
      const yPanels = panels.filter(p => p.hasTransY0 && !p.hasTransX0);
      const winner = yPanels.find(p => p.h < 700 && p.gripVisible) ||
                     yPanels.find(p => p.h < 700) ||
                     yPanels[0];
      const heightOk = winner ? winner.h < 700 : false;
      const notFullscreen = winner ? winner.h < (VIEWPORT_H - 50) : false;
      const gripOk = winner ? winner.gripVisible : false;
      const transY0 = !!winner;
      ok = transY0 && heightOk && notFullscreen && gripOk;
      note = (note ? note + ' | ' : '') + `panels=${panels.length} winner=${winner ? `h=${winner.h} w=${winner.w} top=${winner.top} grip=${winner.gripVisible} y0=${winner.hasTransY0}` : 'none'} heightOk=${heightOk} gripOk=${gripOk} transY0=${transY0}`;
    } catch (e) {
      note = 'exception: ' + String(e.message || e).slice(0, 300);
    }
    drawerResults.push({
      scenario: d.scenario,
      ok,
      note,
      height: 0,
    });
    // fill height from note
    const m = note.match(/h=(\d+)/);
    if (m) drawerResults[drawerResults.length - 1].height = parseInt(m[1], 10);
    console.log(`DRAWER ${d.n} ${d.scenario} => ${ok ? 'OK' : 'FAIL'} :: ${note.slice(0, 300)}`);
    await page.close();
  }

  // ---------- B) Cliente Select in NewAppointmentModal ----------
  let clienteSelect = { ok: false, note: '' };
  {
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/agenda?new=1`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      try { await page.waitForLoadState('networkidle', { timeout: 12000 }); } catch {}
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(OUT, 'polish-cliente-1-modal.png'), fullPage: false });

      // Find selector button/input by placeholder or text
      let clicked = false;
      const candidates = [
        page.getByPlaceholder(/cliente/i).first(),
        page.getByRole('button', { name: /selecionar cliente|escolher cliente|cliente/i }).first(),
        page.getByText(/selecionar cliente|escolher cliente/i).first(),
      ];
      for (const c of candidates) {
        try {
          if (await c.count() > 0) {
            await c.click({ timeout: 3000 });
            clicked = true;
            break;
          }
        } catch {}
      }
      if (!clicked) {
        clienteSelect.note = 'no cliente selector found';
      }
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, 'polish-cliente-2-drawer.png'), fullPage: false });

      // Look for search input or list
      const searchInput = await page.locator('input[placeholder*="buscar" i], input[placeholder*="Digite" i]').count();
      const hasList = await page.locator('[role="listbox"], ul li button, [class*="list"]').count();
      const drawerPanels = await inspectDrawer(page);
      const anyDrawer = drawerPanels.some(p => p.hasTransY0);

      clienteSelect.ok = clicked && (searchInput > 0 || anyDrawer);
      clienteSelect.note = `clicked=${clicked} searchInput=${searchInput} listCount=${hasList} anyDrawerY0=${anyDrawer}`;
    } catch (e) {
      clienteSelect.note = 'exception: ' + String(e.message || e).slice(0, 300);
    }
    console.log(`CLIENTE-SELECT => ${clienteSelect.ok ? 'OK' : 'FAIL'} :: ${clienteSelect.note}`);
    await page.close();
  }

  await browser.close();

  const passed = drawerResults.filter(d => d.ok).length + (clienteSelect.ok ? 1 : 0);
  const failed = drawerResults.length + 1 - passed;
  const out = { drawers: drawerResults, clienteSelect, passed, failed };
  fs.writeFileSync(path.join(OUT, 'polish-verify.json'), JSON.stringify(out, null, 2));
  console.log(`\nPASSED=${passed} FAILED=${failed}`);
})().catch(e => { console.error(e); process.exit(1); });
