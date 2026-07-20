/* Captura a seção RELATÓRIOS do Belasis (login manual WSLg → desktop+mobile+drawers). */
const { chromium } = require('playwright');
const fs = require('fs');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile';

const SEED = [
  // Financeiro
  ['reports-financial', '/reports/financial'],
  ['reports-financial-dre', '/reports/financial/dre'],
  ['reports-financial-service-revenue', '/reports/financial/service-revenue'],
  ['reports-financial-product-revenue', '/reports/financial/product-revenue'],
  ['reports-financial-billing-projection', '/reports/financial/billing-projection'],
  ['reports-financial-cash-movements', '/reports/financial/cash-movements'],
  ['reports-financial-bill-recs', '/reports/financial/bill-recs'],
  ['reports-financial-bill-pays', '/reports/financial/bill-pays'],
  ['reports-financial-extract', '/reports/financial/extract'],
  ['reports-financial-extract-movements', '/reports/financial/extract-movements'],
  ['report-views-cash-accounting', '/report-views/financial/cash-accounting'],
  // Abas / outras seções
  ['reports-favorites', '/reports/favorites'],
  ['reports-detailed', '/reports/detailed'],
  ['reports-birthdays', '/reports/birthdays'],
  ['reports-calendars-all', '/reports/calendars/all'],
  ['reports-calendars-creation', '/reports/calendars/creation'],
  ['reports-calendars-deleted', '/reports/calendars/deleted'],
  ['reports-calendars-origin', '/reports/calendars/origin'],
  ['reports-clients-all', '/reports/clients/all'],
  ['reports-clients-birthdays', '/reports/clients/birthdays'],
  ['reports-clients-inactives', '/reports/clients/inactives'],
  ['reports-clients-pendings', '/reports/clients/pendings'],
  ['reports-clients-rank', '/reports/clients/rank'],
  ['reports-clients-return', '/reports/clients/return'],
  ['reports-inventory-stock', '/reports/inventory/stock'],
  ['reports-inventory-products-list', '/reports/inventory/products-list'],
  ['reports-inventory-products-consumed', '/reports/inventory/products-consumed'],
  ['reports-inventory-purchase-suggestion', '/reports/inventory/purchase-suggestion'],
  ['reports-inventory-purchases', '/reports/inventory/purchases'],
  ['reports-inventory-stock-movement', '/reports/inventory/stock-movement'],
  ['reports-messages-sent', '/reports/messages/sent'],
  ['reports-nf', '/reports/nf'],
];
const ANALYTICS = /googletagmanager|google-analytics|facebook|fbcdn|bing\.com|bat\.bing|tawk|wootric|crisp|hotjar|clarity|doubleclick|diffuser|app-us1/i;

async function waitForContent(page) {
  await page.waitForFunction(() => {
    if (document.querySelector('.ant-skeleton-active')) return false;
    const mc = document.querySelector('.main-content, [class*=main-content]') || document.querySelector('#root');
    const txt = (mc && mc.innerText ? mc.innerText : '').replace(/\s+/g, '').length;
    return txt > 160 || !!document.querySelector('.ant-table, table, .ant-card, .recharts-surface, .ant-tabs');
  }, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1800);
}
async function killOverlays(page) {
  await page.evaluate(() => {
    const hdr = document.getElementById('navbar-main-menu');
    if (hdr && /assinatura vence/i.test(hdr.textContent || '')) hdr.remove();
    for (const el of document.querySelectorAll('.ant-notification, .ant-notification-notice-wrapper')) el.remove();
    for (const f of document.querySelectorAll('iframe')) { if (/inmoment|survey|wootric|tawk|crisp/i.test(f.src || '')) f.remove(); }
  }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}
const bodyHTML = (page) => page.evaluate(() => (document.body ? document.body.outerHTML : '')).catch(() => '');

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: null, args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR' });
  const page = ctx.pages()[0] || await ctx.newPage();
  fs.mkdirSync(REF + '/_shared/css', { recursive: true });
  const cssSeen = new Set();
  ctx.on('response', async (res) => {
    try {
      const url = res.url(); const ct = res.headers()['content-type'] || '';
      if (ANALYTICS.test(url)) return;
      if ((/\.css(\?|$)/i.test(url) || /text\/css/i.test(ct)) && !cssSeen.has(url)) {
        cssSeen.add(url);
        fs.writeFileSync(REF + '/_shared/css/' + (url.split('/').pop().split('?')[0] || 'sheet.css').replace(/[^\w.\-]/g, '_'), await res.body());
      }
    } catch (e) {}
  });

  await page.goto('https://belasis.app/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('>>> FAÇA O LOGIN na janela do Chrome. Detecto e capturo os relatórios. <<<');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await page.waitForTimeout(2000);
    const url = page.url();
    if (/belasis\.app\/[a-z]/i.test(url) && !/\/login/.test(url)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 3 === 0) console.log('  ...aguardando login (', url, ')');
  }
  if (!authed) { console.log('TIMEOUT login'); await ctx.close(); process.exit(3); }
  console.log('LOGIN OK. Capturando', SEED.length, 'relatórios...');

  const idx = [];
  await page.setViewportSize({ width: 1440, height: 1600 });
  for (const [slug, route] of SEED) {
    const dir = REF + '/' + slug; fs.mkdirSync(dir, { recursive: true }); const rec = { slug, route };
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      if (/\/login/.test(page.url())) { rec.err = 'LOGGED_OUT'; console.log('!! DESLOGOU', route); idx.push(rec); continue; }
      await waitForContent(page); await killOverlays(page);
      const body = await bodyHTML(page); fs.writeFileSync(dir + '/desktop.html', body); rec.desktop = body.length;
      console.log('D', slug.padEnd(34), rec.desktop + 'b');
    } catch (e) { rec.err = e.message.slice(0, 50); console.log('D-ERR', slug, rec.err); }
    idx.push(rec);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [slug, route] of SEED) {
    const dir = REF + '/' + slug;
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      if (/\/login/.test(page.url())) continue;
      await waitForContent(page); await killOverlays(page);
      const body = await bodyHTML(page); fs.writeFileSync(dir + '/mobile.html', body);
      const e = idx.find((x) => x.slug === slug); if (e) e.mobile = body.length;
      console.log('M', slug.padEnd(34), body.length + 'b');
    } catch (e) { console.log('M-ERR', slug, e.message.slice(0, 40)); }
  }
  fs.writeFileSync(REF + '/_index-reports.json', JSON.stringify(idx, null, 2));
  console.log('=== DONE. desktop:' + idx.filter((x) => x.desktop).length + '/' + SEED.length + ' · mobile:' + idx.filter((x) => x.mobile).length);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
