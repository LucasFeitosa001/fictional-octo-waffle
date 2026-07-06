import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const OUT = '/tmp/audit';
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  '/', '/agenda', '/comandas', '/clientes', '/profissionais', '/servicos',
  '/produtos', '/categorias', '/marcas', '/fornecedores', '/pacotes',
  '/assinaturas', '/financeiro', '/financeiro/transacoes', '/financeiro/contas',
  '/caixa', '/comissoes', '/comissoes/config', '/relatorios', '/metas',
  '/marketing/link', '/marketing/promocoes', '/marketing/avaliacoes',
  '/marketing/cashback', '/configuracoes',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];

const slug = (r) => (r === '/' ? 'root' : r.replace(/^\//, '').replace(/\//g, '_'));

const summary = {};

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORTS[0] });
const page = await context.newPage();

const pageErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`);
});
page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'samya@beautypass.dev');
await page.fill('input[type="password"]', 'samya123');
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);
console.error('Logged in. URL:', page.url());

for (const vp of VIEWPORTS) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  for (const route of ROUTES) {
    const key = `${route}@${vp.name}`;
    pageErrors.length = 0;
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (e) {
      pageErrors.push(`nav: ${e.message}`);
    }
    await page.waitForTimeout(700);
    const bodyText = await page.evaluate(() => document.body?.innerText?.length ?? 0);
    const errorBoundary = await page
      .evaluate(() => /algo deu errado|something went wrong|Application error/i.test(document.body?.innerText ?? ''))
      .catch(() => false);
    await page.screenshot({ path: `${OUT}/${slug(route)}-${vp.name}.png`, fullPage: true }).catch(() => {});
    summary[key] = {
      errors: [...pageErrors],
      bodyLen: bodyText,
      ok: pageErrors.length === 0 && bodyText > 50 && !errorBoundary,
    };
  }
}

await browser.close();

console.log(JSON.stringify(summary, null, 2));
const broken = Object.entries(summary).filter(([, v]) => !v.ok);
console.log('\n=== BROKEN ROUTES:', broken.length, '===');
for (const [k, v] of broken) console.log(k, '->', v.errors.slice(0, 3).join(' | ') || `bodyLen=${v.bodyLen}`);
