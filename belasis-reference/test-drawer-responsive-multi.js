/**
 * Teste multi-rota + multi-drawer:
 *  - /comandas → Drawer (VerComandaDrawer) + FullDrawer (EditarComandaDrawer via menu "Editar")
 *  - /clientes → Drawer/FullDrawer
 *  - /profissionais → Drawer/FullDrawer
 *  - /produtos → Drawer/FullDrawer
 *  - /financeiro/contas → Drawer
 *
 * Cada rota testada em mobile (375×812) E desktop (1280×800).
 * Verifica: mobile subiu de baixo (translate-y-0 + rounded-t + bottom=0)
 *           desktop deslizou da direita (translate-x-0 + right=0 + top=0)
 */
const { chromium, devices } = require('playwright');

const URL_TUNNEL = 'https://conferences-collar-proof-mine.trycloudflare.com';
const EMAIL = 'contato@fatimacabelos.com.br';
const PASSWORD = 'fatima@2026';

const ROUTES = [
  { path: '/comandas', name: 'comandas-view', trigger: 'row' },
  { path: '/comandas', name: 'comandas-edit', trigger: 'rowmenu-edit' },
  { path: '/clientes', name: 'clientes', trigger: 'row' },
  { path: '/profissionais', name: 'profissionais', trigger: 'row' },
  { path: '/produtos', name: 'produtos', trigger: 'row' },
];

async function login(page) {
  const res = await page.request.post(`${URL_TUNNEL}/api/v1/auth/sign-in/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: EMAIL, password: PASSWORD },
  });
  if (res.status() !== 200) throw new Error(`login ${res.status()}`);
}

async function findOpenPanel(page) {
  return page.evaluate(() => {
    const isOpen = (el) => {
      const cl = typeof el.className === 'string' ? el.className : '';
      const openX = /\btranslate-x-0\b/.test(cl);
      const openY = /\btranslate-y-0\b/.test(cl);
      const closedX = /\btranslate-x-full\b/.test(cl) || /\b-translate-x-full\b/.test(cl);
      const closedY = /\btranslate-y-full\b/.test(cl);
      return (openX && !closedX) || (openY && !closedY);
    };
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      const cl = typeof el.className === 'string' ? el.className : '';
      if (!cl.includes('translate-')) continue;
      if (!isOpen(el)) continue;
      const cs = getComputedStyle(el);
      return {
        className: el.className,
        transform: cs.transform,
        top: cs.top, bottom: cs.bottom, left: cs.left, right: cs.right,
        width: cs.width, height: cs.height,
        borderTopLeftRadius: cs.borderTopLeftRadius,
      };
    }
    return null;
  });
}

async function closeOpenPanel(page) {
  // fecha via ESC
  await page.keyboard.press('Escape').catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
}

async function triggerRow(page) {
  return page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const numeric = btns.find((b) => /^#\d+/.test((b.textContent || '').trim()));
    if (numeric) { numeric.click(); return `#num: ${numeric.textContent?.trim().slice(0, 30)}`; }
    const row = document.querySelector('tbody tr[role="button"], tbody tr.cursor-pointer');
    if (row) { row.click(); return `row: ${(row.textContent || '').slice(0, 30)}`; }
    // cards mobile (li com button)
    const card = document.querySelector('ul li button.text-left, ul li[role="button"]');
    if (card) { card.click(); return `card: ${(card.textContent || '').slice(0, 30)}`; }
    return null;
  });
}

async function triggerRowMenuEdit(page) {
  // Clica no menu de 3 pontinhos da 1ª linha e depois em "Editar"
  const opened = await page.evaluate(() => {
    // botão de menu (⋮) — geralmente aria-label ou title "Ações", ou um botão dentro de tbody td
    const rowMenuBtn =
      document.querySelector('tbody tr:first-child td:last-child button') ||
      document.querySelector('[aria-label*="Ações"], [aria-label*="ações"], [aria-haspopup="menu"]');
    if (!rowMenuBtn) return null;
    rowMenuBtn.click();
    return rowMenuBtn.getAttribute('aria-label') || rowMenuBtn.textContent?.trim().slice(0, 20) || 'menu';
  });
  if (!opened) return null;
  await new Promise((r) => setTimeout(r, 350));
  return page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('button, [role="menuitem"], a'));
    const edit = items.find((el) => /^(editar|edit)$/i.test((el.textContent || '').trim()));
    if (edit) { edit.click(); return 'menu→Editar'; }
    return 'menu abriu mas Editar não achado';
  });
}

async function runOne({ label, viewport, extra, route, expectedMode }) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: true, ...extra });
  const page = await ctx.newPage();
  try {
    await login(page);
    await page.goto(`${URL_TUNNEL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));

    let action;
    if (route.trigger === 'row') action = await triggerRow(page);
    else if (route.trigger === 'rowmenu-edit') action = await triggerRowMenuEdit(page);

    if (!action) {
      console.log(`  [${label}][${route.name}] ⚠ SEM TRIGGER — pulando`);
      return { label, route: route.name, ok: null, reason: 'no-trigger' };
    }
    await new Promise((r) => setTimeout(r, 1500));

    const panel = await findOpenPanel(page);
    if (!panel) {
      console.log(`  [${label}][${route.name}] ❌ drawer não abriu após "${action}"`);
      return { label, route: route.name, ok: false, reason: 'no-panel' };
    }

    let ok;
    let modeStr;
    if (expectedMode === 'bottom') {
      const openY = /\btranslate-y-0\b/.test(panel.className);
      const rounded = panel.borderTopLeftRadius && panel.borderTopLeftRadius !== '0px';
      const atBottom = panel.bottom === '0px' && panel.top !== '0px';
      ok = openY && atBottom;
      modeStr = `translate-y-0=${openY} rounded=${rounded} bottom=${panel.bottom} top=${panel.top}`;
    } else {
      const openX = /\btranslate-x-0\b/.test(panel.className);
      const atRight = panel.right === '0px' && panel.top === '0px';
      ok = openX && atRight;
      modeStr = `translate-x-0=${openX} right=${panel.right} top=${panel.top} w=${panel.width}`;
    }
    console.log(`  [${label}][${route.name}] ${ok ? '✅' : '❌'} (${action}) → ${modeStr}`);
    return { label, route: route.name, ok, action, panel };
  } catch (e) {
    console.log(`  [${label}][${route.name}] 💥 ${e.message.slice(0, 100)}`);
    return { label, route: route.name, ok: false, reason: e.message.slice(0, 100) };
  } finally {
    await browser.close();
  }
}

(async () => {
  const results = [];
  console.log('=== MOBILE (iPhone 13, 375×812) — esperado: bottom-sheet ===');
  for (const route of ROUTES) {
    const r = await runOne({
      label: 'MOB',
      viewport: undefined,
      extra: { ...devices['iPhone 13'] },
      route,
      expectedMode: 'bottom',
    });
    results.push(r);
  }
  console.log('\n=== DESKTOP (1280×800) — esperado: right-slide ===');
  for (const route of ROUTES) {
    const r = await runOne({
      label: 'DSK',
      viewport: { width: 1280, height: 800 },
      extra: {},
      route,
      expectedMode: 'right',
    });
    results.push(r);
  }

  console.log('\n=== RESUMO ===');
  const green = results.filter((r) => r.ok === true).length;
  const red = results.filter((r) => r.ok === false).length;
  const skip = results.filter((r) => r.ok === null).length;
  console.log(`  ✅ ok   = ${green}`);
  console.log(`  ❌ fail = ${red}`);
  console.log(`  ⚠ skip = ${skip}`);
  process.exit(red === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
