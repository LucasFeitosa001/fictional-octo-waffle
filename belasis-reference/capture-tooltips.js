/*
 * Captura TOOLTIPS DINÂMICOS do Belasis: faz hover em cada elemento tooltip-trigger
 * e salva o texto que aparece no .ant-tooltip-inner.
 * Alvos: .anticon-question-circle, .anticon-info-circle, [title] em labels/botões,
 * ícones ⓘ em campos de form, headers de tabela.
 * Uso: node belasis-reference/capture-tooltips.js
 * Saída: belasis-reference/tooltips/<slug>.json (map elemento -> texto do tooltip)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile';
const OUT = REF + '/tooltips';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Rotas prioritárias (mais tooltips) + o painel (/wow tem MUITOS)
const ROUTES = [
  '/wow', '/calendar', '/sales', '/clients', '/employees', '/products', '/services',
  '/packages', '/subscriptions', '/vendors', '/brands',
  '/finance/transactions', '/finance/accounts', '/finance/cash', '/finance/dashboard',
  '/commissions', '/commissions/settings',
  '/reports', '/reports/financial', '/reports/clients/all',
  '/marketing/agendamento-online', '/marketing/campanhas', '/marketing/promocoes',
  '/marketing/cashback', '/marketing/avaliacoes',
  '/settings',
];

async function waitReady(page) {
  await page.waitForFunction(() => {
    if (document.querySelector('.ant-skeleton-active')) return false;
    return !!document.querySelector('.ant-btn, button, .ant-form');
  }, { timeout: 25000 }).catch(() => {});
  await sleep(1200);
}

// Enumera candidatos de tooltip-trigger na página inteira (com rect e path CSS-ish)
async function enumerateTriggers(page) {
  return page.evaluate(() => {
    const SEL = [
      '.anticon-question-circle',
      '.anticon-info-circle',
      '.anticon-exclamation-circle',
      '[data-tooltip]',
      '[aria-describedby*="tooltip"]',
      '.ant-tooltip-open',
      // "?" pequenos ao lado de labels
      'label .anticon',
      '.ant-form-item-label .anticon',
      '.ant-table-column-title .anticon',
      // botões/badges com title muito específico (não puros dados)
      '.ant-btn[title]',
    ];
    const seen = new Set();
    const out = [];
    for (const sel of SEL) {
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        if (r.y < 0 || r.y > window.innerHeight + document.documentElement.scrollHeight) continue;
        // ID único aproximado
        const key = `${sel}|${Math.round(r.x)}|${Math.round(r.y)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // pega label/contexto próximo (o texto do label ou botão que este ícone acompanha)
        const parent = el.closest('label, .ant-form-item-label, .ant-table-column-title, .ant-btn, .ant-card-head, .ant-tabs-tab, td, th, li');
        const context = parent ? (parent.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80) : '';
        // title atual (fallback caso não abra tooltip)
        const title = el.getAttribute('title') || (parent && parent.getAttribute('title')) || '';
        out.push({
          selector: sel,
          rect: { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) },
          context,
          title,
          tagName: el.tagName,
        });
        if (out.length >= 60) return out;
      }
    }
    return out;
  }).catch(() => []);
}

async function hoverAndReadTooltip(page, trig) {
  try {
    await page.mouse.move(trig.rect.x, trig.rect.y, { steps: 4 });
    await sleep(700); // antd tooltip default delay ~500ms
    const text = await page.evaluate(() => {
      const t = document.querySelector('.ant-tooltip:not(.ant-tooltip-hidden) .ant-tooltip-inner, .ant-popover-open .ant-popover-inner-content');
      return t ? (t.textContent || '').replace(/\s+/g, ' ').trim() : '';
    }).catch(() => '');
    // move mouse pra longe pra fechar
    await page.mouse.move(2, 2);
    await sleep(200);
    return text;
  } catch (e) { return ''; }
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('\n>>> Se pedir login, faça e o script segue. <<<\n');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const u = page.url();
    if (/belasis\.app\/[a-z]/i.test(u) && !/\/login/.test(u)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 5 === 0) console.log('  ...aguardando (', u, ')');
  }
  if (!authed) { console.log('TIMEOUT'); await ctx.close(); process.exit(3); }

  // Auth snapshot pra preservar entre gotos
  const snap = await page.evaluate(() => ({
    session: Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)).map((k) => [k, sessionStorage.getItem(k)])),
    local:   Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)])),
  })).catch(() => ({ session: {}, local: {} }));
  await ctx.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s.session || {})) sessionStorage.setItem(k, v);
          for (const [k, v] of Object.entries(s.local || {})) localStorage.setItem(k, v); } catch (e) {}
  }, snap);

  console.log('LOGIN OK. Capturando tooltips por hover...\n');
  const master = {};
  for (const route of ROUTES) {
    const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      if (/\/login/.test(page.url())) { console.log('DESLOGOU em', route); break; }
      await waitReady(page);
      // scroll pra baixo pra hidratar tudo
      await page.evaluate(async () => {
        const H = document.documentElement.scrollHeight;
        for (let y = 0; y <= H; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); }
        window.scrollTo(0, 0);
      }).catch(() => {});
      await sleep(600);
      const trigs = await enumerateTriggers(page);
      const tooltips = [];
      for (const t of trigs) {
        // scroll pro elemento aparecer
        await page.evaluate((r) => window.scrollTo(0, Math.max(0, r.y - 200)), t.rect).catch(() => {});
        await sleep(150);
        const txt = await hoverAndReadTooltip(page, t);
        if (txt && txt.length > 2 && txt.length < 400) {
          tooltips.push({ context: t.context, selector: t.selector, tooltip: txt });
        } else if (t.title && t.title.length > 8) {
          tooltips.push({ context: t.context, selector: t.selector, tooltip: t.title, source: 'title-attr' });
        }
      }
      // dedupe por (context, tooltip)
      const seen = new Set();
      const unique = tooltips.filter((t) => {
        const k = `${t.context}|${t.tooltip}`;
        if (seen.has(k)) return false; seen.add(k); return true;
      });
      master[route] = unique;
      fs.writeFileSync(path.join(OUT, `${slug}.json`), JSON.stringify(unique, null, 2));
      console.log(`  ${route}: ${trigs.length} triggers → ${unique.length} tooltips únicos`);
    } catch (e) { console.log('  ERR', route, (e.message || '').slice(0, 50)); }
  }
  fs.writeFileSync(OUT + '/_all.json', JSON.stringify(master, null, 2));
  const total = Object.values(master).reduce((a, b) => a + b.length, 0);
  console.log(`\n=== DONE. ${total} tooltips capturados em ${Object.keys(master).length} rotas → ${OUT}/ ===`);
  await sleep(1200);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
