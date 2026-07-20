/*
 * ONE-SHOT Belasis capture. Log in once in the real Chrome window; everything is
 * captured in that same live tab (session token is in sessionStorage — never open a
 * new tab or close the browser mid-run). HTML + CSS only. No screenshots.
 *
 * Key fixes vs earlier attempts:
 *  - ALWAYS full page.goto (SPA click left document.body null).
 *  - WAIT FOR REAL CONTENT (skeletons gone) instead of a fixed timer — app hydrates slow.
 *  - Capture JS bundles too, so routes can be mined from the router table.
 *  - Robust nav expansion for grouped sections (Comissões/Controle/Config/IA/WhatsApp...).
 *
 * Output under belasis-reference/ (persistent):
 *   _shared/css/*.css, _shared/js/*.js, _shared/styles-inline.css
 *   <slug>/desktop.html, <slug>/mobile.html, <slug>/drawer-*.html
 *   _index.json, _discovery.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile';

// Full route map mined from the JS router table (belasis v5.7.12).
const SEED = [
  // Principal
  ['wow', '/wow'], ['calendar', '/calendar'], ['sales', '/sales'], ['packages', '/packages'],
  ['package-templates', '/package-templates'], ['subscriptions', '/customer/subscriptions'],
  ['subscription-templates', '/customer/subscription-templates'], ['subscription-settings', '/customer/subscription-settings'],
  // Cadastros
  ['clients', '/clients'], ['anamnesis', '/anamnesis'], ['anamnesis-templates', '/anamnesis-templates'],
  ['services', '/services'], ['products', '/products'], ['products-batches', '/products/batches'],
  ['vendors', '/vendors'], ['purchases', '/purchases'],
  ['purchases-invoices', '/purchases/imported-electronic-invoices'],
  ['brands', '/brands'], ['document-templates', '/document-templates'], ['employees', '/employees'], ['groups', '/groups'],
  // Financeiro
  ['finance-dashboard', '/finance/dashboard'], ['finance-transactions', '/finance/transactions'],
  ['finance-accounts', '/finance/accounts'], ['finance-cash', '/finance/cash-accounting'],
  ['finance-cash-history', '/finance/cash-accounting/history'], ['finance-charts', '/finance/charts'],
  ['finance-payment-methods', '/finance/payment-methods'], ['finance-settings', '/finance/settings'],
  ['invoices', '/invoices/invoice'],
  // Comissões
  ['commissions', '/finance/commissions'], ['commissions-batch', '/finance/commissions/batch_payments'],
  ['commissions-bulk', '/finance/commissions/bulk_commissions'], ['commissions-settings', '/finance/commissions/settings'],
  ['commissions-summary', '/finance/commissions/summary'],
  // Relatórios
  ['reports-dre', '/reports/financial/dre'], ['reports-favorites', '/reports/favorites'], ['reports', '/reports'],
  // Marketing
  ['reviews', '/reviews'], ['cashback', '/cashback'], ['goals', '/goals'],
  ['online-booking', '/online-booking'], ['promotions', '/promotions'], ['campaigns-marketing', '/campaigns-marketing'],
  // WhatsApp
  ['whatsapp', '/whatsapp'],
  // Belasis Pay
  ['belasis-pay', '/belasis-pay/panel'], ['belasis-pay-transactions', '/belasis-pay/transactions'],
  ['belasis-pay-transfers', '/belasis-pay/transfers'],
  // Configurações
  ['settings', '/settings'], ['settings-admin', '/settings/admin'], ['settings-api', '/settings/api'],
  ['settings-notifications', '/settings/notifications'], ['settings-personalize', '/settings/personalize'],
  // Outros
  ['notifications', '/notifications'], ['summary', '/summary'],
];
const ANALYTICS = /googletagmanager|google-analytics|facebook|fbcdn|bing\.com|bat\.bing|tawk|wootric|crisp|hotjar|clarity|doubleclick|diffuser|app-us1/i;
const slugOf = (r) => r.replace(/^\//, '').replace(/\//g, '-').replace(/[^\w\-]/g, '') || 'root';

async function waitForContent(page, slug) {
  // proceed as soon as skeletons are gone and the main area has real content (or timeout)
  await page.waitForFunction(() => {
    if (document.querySelector('.ant-skeleton-active')) return false;
    const mc = document.querySelector('.main-content, [class*=main-content]') || document.querySelector('#root');
    const txt = (mc && mc.innerText ? mc.innerText : '').replace(/\s+/g, '').length;
    const rich = document.querySelector('.ant-table, table, .ant-form, .ant-list, .ant-card, [class*=calendar i]');
    return txt > 180 || !!rich;
  }, { timeout: 22000 }).catch(() => {});
  await page.waitForTimeout(slug === 'wow' || slug === 'calendar' ? 3500 : 1500);
}

async function killOverlays(page) {
  await page.evaluate(() => {
    for (const f of document.querySelectorAll('iframe')) { if (/inmoment|survey|wootric|delighted|nps|tawk|crisp/i.test(f.src || '')) f.remove(); }
    // top subscription banner
    const hdr = document.getElementById('navbar-main-menu');
    if (hdr && /assinatura vence/i.test(hdr.textContent || '')) hdr.remove();
    // install / nps notifications
    for (const el of document.querySelectorAll('.ant-notification, .ant-notification-notice-wrapper')) el.remove();
  }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

async function bodyHTML(page) {
  return await page.evaluate(() => (document.body ? document.body.outerHTML : '')).catch(() => '');
}

async function expandNavAndCollect(page) {
  await page.waitForSelector('a[href^="/"], .ant-menu, [class*=menu i] a, nav a', { timeout: 15000 }).catch(() => {});
  const groups = ['Principal', 'Financeiro', 'Comissões', 'Cadastros', 'Controle', 'Relatórios', 'Marketing', 'Configurações', 'Config', 'IA', 'WhatsApp', 'Estoque', 'Vendas', 'Integrações'];
  let prev = -1;
  for (let pass = 0; pass < 4; pass++) {
    // click antd submenu titles
    const titles = page.locator('.ant-menu-submenu-title, [class*=submenu i] [class*=title i], [aria-haspopup=true]');
    const nt = await titles.count().catch(() => 0);
    for (let i = 0; i < Math.min(nt, 30); i++) { try { await titles.nth(i).click({ timeout: 800, force: true }); await page.waitForTimeout(150); } catch (e) {} }
    // click by group label text
    for (const gt of groups) {
      const el = page.locator(':is(li,div,a,span,button)', { hasText: new RegExp('^\\s*' + gt + '\\s*$', 'i') }).first();
      try { if (await el.count()) { await el.click({ timeout: 700, force: true }); await page.waitForTimeout(120); } } catch (e) {}
    }
    const cnt = await page.evaluate(() => document.querySelectorAll('a[href^="/"]').length);
    if (cnt === prev) break; prev = cnt;
  }
  return await page.evaluate(() => {
    const s = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href') || '';
      if (h.startsWith('/') && !h.startsWith('//') && !/^\/(logout|login)/.test(h)) s.add(h.split('?')[0].replace(/\/$/, '') || '/');
    }
    return [...s];
  });
}

async function captureOverlays(page, dir) {
  const rx = '^\\+?\\s*(Nov[ao]|Adicionar|Cadastrar|Criar|Registrar|Gerar|Emitir|Lançar|Incluir)\\b';
  const labels = await page.evaluate((rxs) => {
    const re = new RegExp(rxs, 'i'); const out = [];
    for (const el of document.querySelectorAll('button,[role=button],a')) {
      const t = (el.innerText || '').trim();
      if (t && t.length < 40 && re.test(t) && !out.includes(t)) out.push(t);
    }
    return out.slice(0, 6);
  }, rx);
  let n = 0;
  for (const lbl of labels) {
    try {
      const btn = page.locator(':is(button,[role=button],a)').filter({ hasText: new RegExp('^\\s*' + lbl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i') }).first();
      if (!(await btn.count())) continue;
      await btn.click({ timeout: 3000, force: true }).catch(() => {});
      await page.waitForTimeout(2600);
      await killOverlays(page);
      const ov = await page.evaluate(() => {
        let best = null, area = 0;
        for (const el of document.querySelectorAll('.ant-drawer,.ant-drawer-content,.ant-modal,[role=dialog],[class*=Drawer],[class*=Modal],[class*=drawer],[class*=modal]')) {
          const r = el.getBoundingClientRect(); const t = el.innerText || '';
          if (r.width > 250 && r.height > 140 && !/indicar o sistema|InMoment|assinatura vence/i.test(t) && r.width * r.height > area) { area = r.width * r.height; best = el; }
        }
        return best ? best.outerHTML : null;
      });
      if (ov) { n++; fs.writeFileSync(dir + '/drawer-' + n + '.html', '<!-- trigger: ' + lbl + ' -->\n' + ov); }
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(600);
      await page.keyboard.press('Escape').catch(() => {});
    } catch (e) {}
  }
  return { drawers: n, triggers: labels };
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, { headless: false, viewport: null, args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR' });
  const page = ctx.pages()[0] || await ctx.newPage();
  fs.mkdirSync(REF + '/_shared/css', { recursive: true });
  fs.mkdirSync(REF + '/_shared/js', { recursive: true });
  const cssSeen = new Set(), jsSeen = new Set();
  ctx.on('response', async (res) => {
    try {
      const url = res.url(); const ct = res.headers()['content-type'] || '';
      if (ANALYTICS.test(url)) return;
      if ((/\.css(\?|$)/i.test(url) || /text\/css/i.test(ct)) && !cssSeen.has(url)) {
        cssSeen.add(url);
        fs.writeFileSync(REF + '/_shared/css/' + (url.split('/').pop().split('?')[0] || 'sheet.css').replace(/[^\w.\-]/g, '_'), await res.body());
      } else if (/belasis\.app/.test(url) && /\.js(\?|$)/i.test(url) && !jsSeen.has(url)) {
        jsSeen.add(url);
        fs.writeFileSync(REF + '/_shared/js/' + (url.split('/').pop().split('?')[0] || 'chunk.js').replace(/[^\w.\-]/g, '_'), await res.body());
      }
    } catch (e) {}
  });

  await page.goto('https://belasis.app/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('>>> FAÇA O LOGIN na janela do Chrome. Detecto sozinho e capturo tudo. <<<');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await page.waitForTimeout(2000);
    const url = page.url();
    if (/belasis\.app\/[a-z]/i.test(url) && !/\/login/.test(url)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 3 === 0) console.log('  ...aguardando login (', url, ')');
  }
  if (!authed) { console.log('TIMEOUT login'); await ctx.close(); process.exit(3); }
  console.log('LOGIN OK. Carregando app e descobrindo rotas...');

  await page.setViewportSize({ width: 1440, height: 1600 });
  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await waitForContent(page, 'wow');
  const discovered = await expandNavAndCollect(page);

  const routeMap = new Map();
  for (const [slug, r] of SEED) routeMap.set(r, slug);
  for (const r of discovered) if (!routeMap.has(r)) routeMap.set(r, slugOf(r));
  const routes = [...routeMap.entries()].map(([route, slug]) => ({ slug, route }));
  fs.writeFileSync(REF + '/_discovery.json', JSON.stringify({ discovered, routeCount: routes.length, routes }, null, 2));
  console.log('ROTAS A CAPTURAR:', routes.length, '(descobertas via nav:', discovered.length, ')');

  const idx = [];
  // DESKTOP + drawers
  for (const { slug, route } of routes) {
    const dir = REF + '/' + slug; fs.mkdirSync(dir, { recursive: true });
    const rec = { slug, route };
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      if (/\/login/.test(page.url())) { rec.err = 'LOGGED_OUT'; console.log('!! DESLOGOU', route); idx.push(rec); continue; }
      await waitForContent(page, slug);
      await killOverlays(page);
      const body = await bodyHTML(page);
      fs.writeFileSync(dir + '/desktop.html', body); rec.desktop = body.length;
      const dr = await captureOverlays(page, dir);
      rec.drawers = dr.drawers;
      console.log('D', slug.padEnd(24), rec.desktop + 'b', 'drawers:' + dr.drawers);
    } catch (e) { rec.err = e.message.slice(0, 60); console.log('D-ERR', slug, rec.err); }
    idx.push(rec);
  }

  // MOBILE (same tab/session)
  await page.setViewportSize({ width: 390, height: 844 });
  for (const { slug, route } of routes) {
    const dir = REF + '/' + slug;
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      if (/\/login/.test(page.url())) { console.log('!! mobile deslogou', route); continue; }
      await waitForContent(page, slug);
      await killOverlays(page);
      const body = await bodyHTML(page);
      fs.writeFileSync(dir + '/mobile.html', body);
      const e = idx.find(x => x.slug === slug); if (e) e.mobile = body.length;
      console.log('M', slug.padEnd(24), body.length + 'b');
    } catch (e) { console.log('M-ERR', slug, e.message.slice(0, 40)); }
  }

  try {
    const css = await page.evaluate(() => { let o = []; for (const s of document.styleSheets) { try { for (const r of s.cssRules) o.push(r.cssText); } catch (e) {} } return o.join('\n'); });
    fs.writeFileSync(REF + '/_shared/styles-inline.css', css);
  } catch (e) {}

  fs.writeFileSync(REF + '/_index.json', JSON.stringify(idx, null, 2));
  console.log('=== DONE. desktop:' + idx.filter(x => x.desktop).length + '/' + routes.length +
    ' · mobile:' + idx.filter(x => x.mobile).length + ' · drawers:' + idx.reduce((a, x) => a + (x.drawers || 0), 0) +
    ' · css:' + cssSeen.size + ' · js:' + jsSeen.size);
  await ctx.close();
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
