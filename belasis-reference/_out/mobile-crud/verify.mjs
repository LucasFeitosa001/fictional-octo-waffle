import { chromium, devices } from '/home/lucssfeitosa/cardapio-digital-janeiro/node_modules/playwright/index.mjs';

const WEB = 'http://localhost:5173';
const API = WEB;
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/mobile-crud';

const routes = [
  { file: 'TransacoesPage.tsx', route: '/financeiro/transacoes', slug: 'transacoes' },
  { file: 'FinanceiroCategoriasPage.tsx', route: '/financeiro/cadastros/categorias', slug: 'financeiro-categorias' },
  { file: 'CategoriasPage.tsx', route: '/categorias', slug: 'categorias' },
  { file: 'ProdutosPage.tsx', route: '/produtos', slug: 'produtos' },
  { file: 'PacotesPredefinidosPage.tsx', route: '/controle/pacotes-predefinidos', slug: 'pacotes-predefinidos' },
  { file: 'NotasFiscaisPage.tsx', route: '/financeiro/notas-fiscais', slug: 'notas-fiscais' },
];

const iphone = devices['iPhone 13'];
const browser = await chromium.launch({
  headless: true,
  executablePath: '/home/lucssfeitosa/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
});
const context = await browser.newContext({ ...iphone, ignoreHTTPSErrors: true });

// Login via API to get session cookie
const loginResp = await context.request.post(`${API}/api/v1/auth/sign-in/email`, {
  data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  headers: { 'content-type': 'application/json' },
});
console.error('login status:', loginResp.status());
if (!loginResp.ok()) {
  console.error('login body:', await loginResp.text());
}

// Try to set token in localStorage before navigating
const loginBody = await loginResp.json().catch(() => ({}));
console.error('login body keys:', Object.keys(loginBody));

const page = await context.newPage();
page.on('console', (m) => { if (m.type()==='error') console.error('[page err]', m.text()); });

// Prime storage before app boot
await page.addInitScript((body) => {
  try {
    if (body?.token) localStorage.setItem('token', body.token);
    if (body?.session?.token) localStorage.setItem('token', body.session.token);
    if (body?.user) localStorage.setItem('user', JSON.stringify(body.user));
    localStorage.setItem('auth', JSON.stringify(body));
  } catch {}
}, loginBody);

const results = [];
let passed = 0, failed = 0;

for (const r of routes) {
  const url = `${WEB}${r.route}`;
  const rec = { route: r.route, canEdit: false, canDelete: false, note: '' };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    // If redirected to login, note it
    const nowUrl = page.url();
    if (/\/login|\/sign-?in/i.test(nowUrl)) {
      rec.note = `redirect to auth (${nowUrl})`;
      failed++;
      await page.screenshot({ path: `${OUT}/verify-${r.slug}.png`, fullPage: false });
      results.push(rec);
      continue;
    }

    // Find first card-ish tappable element in list
    const candidates = [
      '[data-testid="mobile-card"]',
      '[role="listitem"]',
      'main [class*="Card"]',
      'main button:has-text("Editar")',
      'main li',
      'main [class*="card" i]',
    ];
    let clicked = false;
    for (const sel of candidates) {
      const loc = page.locator(sel).first();
      if (await loc.count() && await loc.isVisible().catch(()=>false)) {
        await loc.click({ timeout: 3000 }).catch(()=>{});
        clicked = true;
        rec.note = `clicked ${sel}`;
        break;
      }
    }
    if (!clicked) {
      // click first row-ish
      const first = page.locator('main').locator('button, [role="button"], tr, li, div').filter({ hasText: /./ }).first();
      await first.click({ timeout: 3000 }).catch(()=>{});
      rec.note = 'clicked generic first';
    }
    await page.waitForTimeout(1200);

    // Check drawer content for Save & Delete buttons
    const save = page.getByRole('button', { name: /^salvar/i }).first();
    const del = page.getByRole('button', { name: /excluir|remover|deletar/i }).first();
    rec.canEdit = await save.isVisible().catch(()=>false);
    rec.canDelete = await del.isVisible().catch(()=>false);

    await page.screenshot({ path: `${OUT}/verify-${r.slug}.png`, fullPage: false });

    if (rec.canEdit || rec.canDelete) passed++; else failed++;
  } catch (e) {
    rec.note = `err: ${String(e).slice(0,200)}`;
    failed++;
    try { await page.screenshot({ path: `${OUT}/verify-${r.slug}.png` }); } catch {}
  }
  results.push(rec);
}

console.log(JSON.stringify({ results, passed, failed }, null, 2));
await browser.close();
