/*
 * MOBILE CAPTURE v2 — usa DEVICE EMULATION real (isMobile+hasTouch+userAgent mobile).
 * O v4/v5 anterior só mudava setViewportSize → SPA renderizava layout DESKTOP num viewport pequeno.
 * Fix: chromium.launchPersistentContext com ...devices['iPhone 13'] espalhado.
 *
 * Estratégias de "Novo" adaptativas pra mobile:
 *  a) FAB (Floating Action Button) — .ant-fab, [class*="fab" i], botão flutuante no canto direito inferior
 *  b) Bottom-nav "+" — o botão central da nav inferior
 *  c) Hamburger menu — abre drawer lateral, procura "Novo" lá dentro
 *  d) Header topo mobile — botão "+" no header
 *
 * Uso: node belasis-reference/capture-mobile-v2.js
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile-mobile';
const OUT = REF + '/mobile-v2';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const j = (o) => JSON.stringify(o, null, 2);

const ROUTES = [
  '/wow', '/calendar', '/sales', '/clients', '/employees', '/products', '/services',
  '/packages', '/subscriptions', '/vendors', '/brands',
  '/finance/transactions', '/finance/accounts', '/finance/cash', '/finance/dashboard',
  '/commissions', '/commissions/settings', '/reports', '/reports/financial',
  '/marketing/agendamento-online', '/marketing/campanhas', '/marketing/cashback',
  '/settings',
];

async function waitReady(page) {
  await page.waitForFunction(() => {
    if (document.querySelector('.ant-skeleton-active')) return false;
    return !!document.querySelector('.ant-btn, button, [class*="fab" i], nav');
  }, { timeout: 25000 }).catch(() => {});
  await sleep(1500);
}

async function killOverlays(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.ant-notification, .ant-notification-notice-wrapper')) el.remove();
    for (const f of document.querySelectorAll('iframe')) if (/inmoment|survey|wootric|tawk|crisp/i.test(f.src || '')) f.remove();
  }).catch(() => {});
}

// Estratégia adaptativa mobile: tenta FAB → bottom-nav "+" → hambúrguer → header +
async function openNewMobile(page) {
  const strategies = [
    { name: 'fab', fn: () => page.evaluate(() => {
        const fab = document.querySelector('.ant-fab, [class*="fab" i][role="button"], [class*="Fab" i], .ant-btn-primary.ant-btn-circle');
        if (!fab) return null;
        const r = fab.getBoundingClientRect();
        // FAB fica geralmente no canto inferior direito da viewport
        if (r.bottom > window.innerHeight - 200 && r.right > window.innerWidth - 200) {
          fab.scrollIntoView({ block: 'center' });
          fab.click();
          return 'fab:' + (fab.className || '').slice(0, 60);
        }
        return null;
      }) },
    { name: 'bottom-nav-plus', fn: () => page.evaluate(() => {
        // Bottom nav mobile Belasis: procura o botão "+" central da barra inferior
        const nav = document.querySelector('[class*="bottom" i][class*="nav" i], nav[class*="tab" i]');
        const scope = nav || document.body;
        const btns = Array.from(scope.querySelectorAll('button, a, [role="button"]'));
        // Filtra os que estão nos últimos 100px da viewport
        const bottom = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > window.innerHeight - 120 && r.top > window.innerHeight - 200; });
        // procura texto "+" ou "Novo" ou "Criar"
        const target = bottom.find((b) => {
          const t = (b.textContent || '').trim();
          return /^\+$|^Novo$|^Criar$/i.test(t) || (b.querySelector('.anticon-plus') && !t.length);
        }) || bottom.find((b) => b.querySelector('svg') && b.getBoundingClientRect().width > 40);
        if (target) { target.click(); return 'bottom-nav'; }
        return null;
      }) },
    { name: 'hamburger', fn: async () => {
        const opened = await page.evaluate(() => {
          const h = document.querySelector('[aria-label*="Menu" i], .anticon-menu, .anticon-menu-outlined, button[class*="menu" i]');
          if (h) { h.click(); return true; } return false;
        });
        if (!opened) return null;
        await sleep(400);
        // Agora procura "Novo" dentro do drawer aberto
        const clicked = await page.evaluate(() => {
          const drawer = document.querySelector('.ant-drawer-open .ant-drawer-content, .ant-drawer-content');
          if (!drawer) return null;
          for (const el of drawer.querySelectorAll('button, a, [role="button"]')) {
            const t = (el.textContent || '').trim();
            if (/^Novo\b/i.test(t) && t.length < 25) { el.click(); return 'hamburger→Novo'; }
          }
          return null;
        });
        return clicked;
      } },
    { name: 'header-plus', fn: () => page.evaluate(() => {
        const header = document.querySelector('header, .ant-page-header, [class*="Header" i]');
        if (!header) return null;
        for (const el of header.querySelectorAll('button, a')) {
          const t = (el.textContent || '').trim();
          if (/^(\+|Novo|Criar)$/i.test(t)) { el.click(); return 'header:' + t; }
        }
        return null;
      }) },
  ];
  for (const s of strategies) {
    try {
      const r = await s.fn();
      if (r) { console.log(`      estratégia: ${s.name} → ${r}`); return r; }
    } catch (e) {}
  }
  return null;
}

async function findOpenPanel(page) {
  const sels = ['.ant-drawer-open .ant-drawer-content-wrapper', '.ant-modal-root .ant-modal-content', '.ant-drawer .ant-drawer-content'];
  for (const s of sels) if (await page.$(s)) return s;
  return null;
}

async function main() {
  // ⭐ DEVICE EMULATION REAL (não só viewport)
  const device = devices['iPhone 13'];
  console.log('Device:', device.userAgent.slice(0, 60), '| viewport:', device.viewport, '| touch:', device.hasTouch);

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    ...device,
    // WSLg-friendly
    args: ['--no-sandbox'], locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('\n>>> Se aparecer login, faça-o (mobile). Detecto quando /wow carregar. <<<\n');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const u = page.url();
    if (/belasis\.app\/[a-z]/i.test(u) && !/\/login/.test(u)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 5 === 0) console.log('  ...aguardando (', u, ')');
  }
  if (!authed) { console.log('TIMEOUT'); await ctx.close(); process.exit(3); }

  // Auth persist
  const snap = await page.evaluate(() => ({
    session: Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)).map((k) => [k, sessionStorage.getItem(k)])),
    local:   Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)])),
  })).catch(() => ({ session: {}, local: {} }));
  await ctx.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s.session || {})) sessionStorage.setItem(k, v);
          for (const [k, v] of Object.entries(s.local || {})) localStorage.setItem(k, v); } catch (e) {}
  }, snap);
  w(OUT + '/_auth-snap.json', j(snap));

  console.log(`LOGIN OK (mobile ${device.viewport.width}×${device.viewport.height}). Capturando...\n`);
  const idx = [];
  for (const route of ROUTES) {
    const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    const base = path.join(OUT, slug);
    fs.mkdirSync(base, { recursive: true });
    const rec = { route, slug, captured: [] };
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      if (/\/login/.test(page.url())) { console.log('  DESLOGOU em', route); break; }
      await waitReady(page); await killOverlays(page);

      // SCROLL COMPLETO
      const H = await page.evaluate(async () => {
        const h = document.documentElement.scrollHeight;
        for (let y = 0; y <= h; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); }
        window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 300));
        return document.documentElement.scrollHeight;
      });
      // Snapshots
      const html = await page.evaluate(() => document.body.outerHTML);
      w(path.join(base, 'page.html'), html);
      await page.screenshot({ path: path.join(base, 'page-full.png'), fullPage: true }).catch(() => {});
      await page.screenshot({ path: path.join(base, 'page-viewport.png'), fullPage: false }).catch(() => {});
      rec.htmlBytes = html.length; rec.scrollH = H;
      rec.captured.push('page');

      // "Novo" adaptativo
      const strat = await openNewMobile(page);
      rec.newStrategy = strat;
      if (strat) {
        await sleep(700);
        const panel = await findOpenPanel(page);
        if (panel) {
          const panelHtml = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', panel);
          w(path.join(base, 'new-panel.html'), panelHtml);
          await page.screenshot({ path: path.join(base, 'new-panel.png'), fullPage: false }).catch(() => {});
          rec.captured.push('newPanel');
        } else {
          // pode ser dropdown/menu simples
          const menuHtml = await page.evaluate(() => {
            const m = document.querySelector('.ant-dropdown:not(.ant-dropdown-hidden), .ant-menu-submenu-popup:not(.ant-menu-hidden)');
            return m ? m.outerHTML : '';
          });
          if (menuHtml) { w(path.join(base, 'new-menu.html'), menuHtml); await page.screenshot({ path: path.join(base, 'new-menu.png'), fullPage: false }).catch(() => {}); rec.captured.push('newMenu'); }
        }
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(300);
      }
      console.log(`  ${slug}: H=${H} html=${html.length}b strat=${strat || 'nenhuma'}`);
    } catch (e) { console.log('  ERR', slug, (e.message || '').slice(0, 60)); }
    idx.push(rec);
    w(OUT + '/_index.json', j(idx));
  }
  console.log('\n=== DONE. belasis-reference/mobile-v2/ ===');
  const withPanel = idx.filter((r) => r.captured.includes('newPanel')).length;
  const withMenu = idx.filter((r) => r.captured.includes('newMenu')).length;
  console.log(`Novo drawer: ${withPanel}/${idx.length} · Novo menu: ${withMenu}/${idx.length}`);
  await sleep(1500);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
