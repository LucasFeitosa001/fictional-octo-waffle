/*
 * MOBILE CAPTURE v4 — ULTRA-SAFE + estratégias sem cliques cegos.
 * FIXES vs v3:
 *  - NUNCA clica em item de menu (0% risco de logout/excluir).
 *  - Estratégias novas SEGURAS: (a) dumpa hambúrguer aberto + captura HTML/PNG (sem clicar dentro),
 *    (b) tenta URL PARAMETER `?new=1`/`?action=new` (padrão salonpass/nosso — se abrir drawer, capta;
 *    se não fizer nada, pula), (c) tenta rota `/route/new` (Belasis pode usar essa convenção).
 *  - Se qualquer coisa acionar redirect pra /login → aborta batch.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile-mobile';
const OUT = REF + '/mobile-v4';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const j = (o) => JSON.stringify(o, null, 2);

const ROUTES = [
  '/wow', '/calendar', '/sales', '/clients', '/employees', '/products', '/services',
  '/packages', '/subscriptions', '/vendors', '/brands',
  '/finance/transactions', '/finance/accounts', '/finance/cash', '/finance/dashboard',
  '/commissions', '/commissions/settings',
  '/reports', '/reports/financial', '/reports/clients/all', '/reports/calendars/all', '/reports/inventory/stock',
  '/marketing/agendamento-online', '/marketing/campanhas', '/marketing/cashback', '/marketing/promocoes', '/marketing/avaliacoes',
  '/settings',
];

async function waitDataReady(page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.ant-skeleton-active, .ant-spin-spinning'), { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => {
    const t = document.querySelector('.ant-table-tbody');
    if (t) return t.querySelectorAll('tr').length >= 1;
    if (/Não há dados|Nenhum registro/i.test(document.body.innerText || '')) return true;
    if (document.querySelector('.recharts-surface, form input, .ant-input')) return true;
    return (document.body.innerText || '').length > 500;
  }, { timeout: 20000 }).catch(() => {});
  await sleep(3500);
}

async function killOverlays(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.ant-notification, .ant-notification-notice-wrapper')) el.remove();
    for (const f of document.querySelectorAll('iframe')) if (/inmoment|survey|wootric|tawk|crisp/i.test(f.src || '')) f.remove();
  }).catch(() => {});
}

// SAFE: só dumpa o hambúrguer aberto (não clica em item nenhum).
async function captureHamburger(page, dir) {
  try {
    const opened = await page.evaluate(() => {
      const h = document.querySelector('[aria-label*="Menu" i], .anticon-menu, .anticon-menu-outlined, button[class*="menu" i]');
      if (h) { h.click(); return true; } return false;
    });
    if (!opened) return null;
    await sleep(600);
    const drawer = await page.$('.ant-drawer-open .ant-drawer-content, .ant-drawer-content');
    if (!drawer) return null;
    const html = await page.evaluate(() => (document.querySelector('.ant-drawer-open .ant-drawer-content, .ant-drawer-content')?.outerHTML || ''));
    w(path.join(dir, 'hamburger.html'), html);
    await page.screenshot({ path: path.join(dir, 'hamburger.png'), fullPage: false }).catch(() => {});
    // Fecha via Esc — NÃO clica em nada dentro
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(300);
    return { bytes: html.length };
  } catch (e) { return null; }
}

// SAFE: só tenta URL PARAMETER `?new=1` (via navegação, não clique)
async function tryNewViaUrl(page, route, dir) {
  try {
    const beforeUrl = page.url();
    const beforeH = await page.evaluate(() => document.body.outerHTML.length);
    await page.goto('https://belasis.app' + route + '?new=1', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    await sleep(1500);
    if (/\/login/.test(page.url())) return { error: 'redirect_login' };
    // Se após ?new=1 apareceu um drawer, capta
    const panel = await page.$('.ant-drawer-open .ant-drawer-content-wrapper, .ant-modal-root .ant-modal-content');
    if (panel) {
      const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', '.ant-drawer-open .ant-drawer-content-wrapper, .ant-modal-root .ant-modal-content');
      w(path.join(dir, 'new-via-url.html'), html);
      await page.screenshot({ path: path.join(dir, 'new-via-url.png'), fullPage: false }).catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(300);
      return { via: 'query-param', bytes: html.length };
    }
    return { via: 'query-param', bytes: 0, note: 'sem drawer' };
  } catch (e) { return { error: (e.message || '').slice(0, 60) }; }
}

async function main() {
  const device = devices['iPhone 13'];
  console.log(`Mobile v4 (ULTRA-SAFE): ${device.viewport.width}×${device.viewport.height}\n`);
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, ...device, args: ['--no-sandbox'], locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('>>> Se aparecer login, faça-o. Detecto. <<<\n');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const u = page.url();
    if (/belasis\.app\/[a-z]/i.test(u) && !/\/login/.test(u)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 5 === 0) console.log('  ...aguardando (', u, ')');
  }
  if (!authed) { console.log('TIMEOUT'); await ctx.close(); process.exit(3); }

  const snap = await page.evaluate(() => ({
    session: Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)).map((k) => [k, sessionStorage.getItem(k)])),
    local:   Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)])),
  })).catch(() => ({ session: {}, local: {} }));
  await ctx.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s.session || {})) sessionStorage.setItem(k, v);
          for (const [k, v] of Object.entries(s.local || {})) localStorage.setItem(k, v); } catch (e) {}
  }, snap);
  w(OUT + '/_auth-snap.json', j(snap));

  console.log(`LOGIN OK. v4 = página base + hambúrguer + ?new=1 tentativa\n`);
  const idx = [];
  let deslogou = false;
  for (const route of ROUTES) {
    if (deslogou) break;
    const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    const base = path.join(OUT, slug);
    fs.mkdirSync(base, { recursive: true });
    const rec = { route, slug, captured: [] };
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      if (/\/login/.test(page.url())) { console.log(`  ${slug}: 🚨 deslogado - PARANDO`); deslogou = true; break; }
      await waitDataReady(page); await killOverlays(page);

      // Scroll top→bottom
      const H = await page.evaluate(async () => {
        const h = document.documentElement.scrollHeight;
        for (let y = 0; y <= h; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
        window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
        return document.documentElement.scrollHeight;
      });

      // page.html + PNGs
      const html = await page.evaluate(() => document.body.outerHTML);
      w(path.join(base, 'page.html'), html);
      await page.screenshot({ path: path.join(base, 'page-full.png'), fullPage: true }).catch(() => {});
      await page.screenshot({ path: path.join(base, 'page-viewport.png'), fullPage: false }).catch(() => {});
      rec.htmlBytes = html.length; rec.scrollH = H; rec.captured.push('page');

      // Hamburger (SEM clicar dentro)
      const ham = await captureHamburger(page, base);
      if (ham && ham.bytes) { rec.hamburger = ham.bytes; rec.captured.push('hamburger'); }
      if (/\/login/.test(page.url())) { console.log(`  ${slug}: 🚨 hambúrguer causou logout - PARANDO`); deslogou = true; break; }

      // ?new=1 via URL
      const nu = await tryNewViaUrl(page, route, base);
      if (nu && nu.via) rec.newViaUrl = nu;
      if (/\/login/.test(page.url())) { console.log(`  ${slug}: 🚨 ?new=1 causou logout - PARANDO`); deslogou = true; break; }

      console.log(`  ${slug}: H=${H} html=${html.length}b · hamb=${ham?.bytes || '-'} · new?url=${nu?.bytes || '-'}`);
    } catch (e) { console.log('  ERR', slug, (e.message || '').slice(0, 60)); }
    idx.push(rec);
    w(OUT + '/_index.json', j(idx));
  }
  const withHam = idx.filter((r) => r.captured.includes('hamburger')).length;
  const withUrl = idx.filter((r) => r.newViaUrl && r.newViaUrl.bytes > 0).length;
  console.log(`\n=== DONE. ${idx.length}/${ROUTES.length} rotas · hambúrguer: ${withHam} · new?url: ${withUrl} ${deslogou ? '(⚠️ logout)' : ''} ===`);
  await sleep(1500);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
