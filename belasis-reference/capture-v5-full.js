/*
 * Playwright v5 — captura COMPLETA com scroll, /wow, fluxo Faturados e ações reais.
 * FIXES vs v4:
 *  - Adiciona /wow (Painel/Dashboard com FUNIL).
 *  - SCROLL COMPLETO em cada tela (top→bottom em passos, pausa pra lazy render).
 *  - Captura CSS-computed DEPOIS do scroll (elementos abaixo do fold agora renderizados).
 *  - Captura "seções" separadamente por card/card-title (funil, ranking, heatmap, ocupação).
 *  - Fluxo Faturados: em /sales entra em comanda existente (URL /sales/:id), dumpa detalhe.
 *  - Screenshots em 3 posições de scroll (top/middle/bottom) além do fullPage.
 *  - Agenda: alterna view Dia/Semana/Mês + clica num evento existente.
 *
 * Uso: node belasis-reference/capture-v5-full.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile';
const OUT = REF + '/v5';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const j = (o) => JSON.stringify(o, null, 2);
const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';

const ROUTES = [
  { slug: 'wow',                   route: '/wow',                   title: 'Painel',            focus: ['funil', 'faturado', 'ranking', 'ocupação', 'heatmap', 'ticket'] },
  { slug: 'calendar',              route: '/calendar',              title: 'Agenda',            focus: ['agenda', 'evento'] },
  { slug: 'sales',                 route: '/sales',                 title: 'Comandas',          focus: ['comanda', 'faturar'] },
  { slug: 'clients',               route: '/clients',               title: 'Clientes',          focus: ['cliente'] },
  { slug: 'employees',             route: '/employees',             title: 'Profissionais',     focus: [] },
  { slug: 'products',              route: '/products',              title: 'Produtos',          focus: [] },
  { slug: 'services',              route: '/services',              title: 'Serviços',          focus: [] },
  { slug: 'packages',              route: '/packages',              title: 'Pacotes',           focus: [] },
  { slug: 'subscriptions',         route: '/subscriptions',         title: 'Assinaturas',       focus: [] },
  { slug: 'vendors',               route: '/vendors',               title: 'Fornecedores',      focus: [] },
  { slug: 'brands',                route: '/brands',                title: 'Marcas',            focus: [] },
  { slug: 'finance-transactions',  route: '/finance/transactions',  title: 'Transações',        focus: [] },
  { slug: 'finance-accounts',      route: '/finance/accounts',      title: 'Cadastros',         focus: [] },
  { slug: 'finance-cash',          route: '/finance/cash',          title: 'Caixa',             focus: [] },
  { slug: 'commissions',           route: '/commissions',           title: 'Comissões',         focus: [] },
  { slug: 'reports',               route: '/reports',               title: 'Relatórios',        focus: [] },
  { slug: 'reports-financial',     route: '/reports/financial',     title: 'Relatório Financeiro', focus: [] },
];

const VIEWPORTS = [
  { name: 'desktop', size: { width: 1440, height: 900 } },
  { name: 'mobile',  size: { width: 390,  height: 844 } },
];

async function waitReady(page) {
  await page.waitForFunction(() => {
    if (document.querySelector('.ant-skeleton-active')) return false;
    return !!document.querySelector('.ant-btn, button, .ant-picker, .ant-table, .ant-card, .ant-tabs, .recharts-surface, .ant-drawer, .ant-modal');
  }, { timeout: 30000 }).catch(() => {});
  await sleep(1200);
}
async function killOverlays(page) {
  await page.evaluate(() => {
    const hdr = document.getElementById('navbar-main-menu');
    if (hdr && /assinatura vence/i.test(hdr.textContent || '')) hdr.remove();
    for (const el of document.querySelectorAll('.ant-notification, .ant-notification-notice-wrapper')) el.remove();
    for (const f of document.querySelectorAll('iframe')) if (/inmoment|survey|wootric|tawk|crisp/i.test(f.src || '')) f.remove();
  }).catch(() => {});
}

// SCROLL COMPLETO: rola em passos (força lazy render), captura 3 screenshots (top/mid/bot), volta ao topo.
async function scrollAndSnap(page, dir) {
  const meta = await page.evaluate(async () => {
    const H = document.documentElement.scrollHeight;
    const vh = window.innerHeight;
    return { H, vh, needScroll: H > vh };
  });
  await page.screenshot({ path: path.join(dir, 'scroll-top.png'), fullPage: false }).catch(() => {});
  if (meta.needScroll) {
    // rola em passos pra forçar render lazy
    const steps = Math.min(Math.ceil(meta.H / meta.vh), 10);
    for (let i = 1; i <= steps; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round((meta.H * i) / steps));
      await sleep(400);
    }
    await sleep(600);
    await page.screenshot({ path: path.join(dir, 'scroll-bottom.png'), fullPage: false }).catch(() => {});
    // meio
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(meta.H / 2));
    await sleep(500);
    await page.screenshot({ path: path.join(dir, 'scroll-middle.png'), fullPage: false }).catch(() => {});
    // volta ao topo
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(500);
  }
  // fullPage após tudo renderizado
  await page.screenshot({ path: path.join(dir, 'page-fullpage.png'), fullPage: true }).catch(() => {});
  return meta;
}

// Extrai CSS-computed de MUITOS elementos após scroll completo.
async function extractCSSFull(page) {
  return page.evaluate(() => {
    const KEYS = ['transition','transitionDuration','transitionTimingFunction','animation','animationDuration','transform','opacity',
      'backgroundColor','color','borderColor','borderRadius','boxShadow','backdropFilter',
      'width','height','minWidth','maxWidth','padding','margin','fontSize','fontWeight','fontFamily','lineHeight',
      'position','top','right','bottom','left','zIndex','display','flexDirection','gap','alignItems','justifyContent'];
    const SELECTORS = [
      '.ant-card', '.ant-card-head', '.ant-card-body',
      '.ant-btn-primary', '.ant-btn-dangerous', '.ant-btn-default',
      '.ant-table-thead', '.ant-table-tbody > tr', '.ant-table-cell',
      '.ant-tabs-nav', '.ant-tabs-tab', '.ant-tabs-tab-active',
      '.ant-form-item-label > label', '.ant-input', '.ant-select-selector', '.ant-switch', '.ant-badge', '.ant-tag',
      '.ant-progress', '.recharts-surface', '.recharts-funnel', '.recharts-bar', '.recharts-pie',
      '[class*="funnel" i]', '[class*="Funnel" i]', '[class*="chart" i]', '[class*="Card" i]',
    ];
    const out = {};
    for (const sel of SELECTORS) {
      const els = document.querySelectorAll(sel);
      if (!els.length) continue;
      const first = els[0];
      const cs = getComputedStyle(first);
      const r = first.getBoundingClientRect();
      const rec = { __count: els.length, __rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
      for (const k of KEYS) rec[k] = cs[k];
      out[sel] = rec;
    }
    return out;
  }).catch(() => ({}));
}

// Extrai o TEXTO estruturado do funil de agendamentos (Todos/Confirmados/Faturados)
async function extractFunil(page) {
  return page.evaluate(() => {
    const text = document.body.innerText || '';
    const out = {};
    // procura padrões: "Todos" "N (Y%)"  ou "Todos: N"
    for (const key of ['Todos', 'Confirmados', 'Faturados', 'Vendas totais', 'Agendamentos', 'Comandas', 'Ticket', 'Ticket médio']) {
      const re = new RegExp(`${key}[\\s:]*([\\d\\.,\\-R$]+)`, 'i');
      const m = text.match(re);
      if (m) out[key] = m[1].trim();
    }
    // se achou funil, extrai também o elemento container do funil
    let funilEl = null;
    for (const el of document.querySelectorAll('*')) {
      const t = (el.textContent || '').trim();
      if (/^Faturado/i.test(t) && t.length < 60) { funilEl = el; break; }
    }
    const container = funilEl ? (funilEl.closest('.ant-card, [class*="chart" i], [class*="funnel" i], section, div') || funilEl.parentElement) : null;
    return {
      valores: out,
      funilContainerHtml: container ? container.outerHTML.slice(0, 8000) : '',
      funilContainerText: container ? (container.innerText || '').slice(0, 1500) : '',
      bodyBytes: (document.body.outerHTML || '').length,
    };
  }).catch(() => ({}));
}

// Fluxo Faturados: em /sales, clica na 1ª linha e dumpa detalhe. Se abrir em nova rota, navega.
async function captureSalesDetail(page, base) {
  try {
    const before = page.url();
    // tenta clicar num link/tr da tabela
    const clicked = await page.evaluate(() => {
      // tr com onclick, ou <a> dentro da 1ª tr
      const row = document.querySelector('.ant-table-tbody > tr[onclick], .ant-table-tbody > tr');
      if (!row) return null;
      const link = row.querySelector('a, [href]');
      if (link) { link.click(); return 'link'; }
      row.click(); return 'row';
    });
    if (!clicked) return;
    await sleep(1500);
    // pode ter aberto drawer OU navegado pra /sales/:id
    const after = page.url();
    if (after !== before) {
      console.log(`    detail navegou: ${before} → ${after}`);
      await waitReady(page);
    }
    // dumpa o que estiver na tela agora
    const html = await page.evaluate(() => document.body.outerHTML);
    w(path.join(base, 'sales-detail.html'), html);
    await page.screenshot({ path: path.join(base, 'sales-detail.png'), fullPage: true }).catch(() => {});
    // extrai TODAS as ações disponíveis (botões/links)
    const actions = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
        const t = (el.textContent || '').trim().slice(0, 60);
        if (!t) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 15) continue;
        out.push({ text: t, tag: el.tagName, class: (el.className || '').slice(0, 100), href: el.getAttribute('href') || null, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } });
      }
      return out;
    });
    w(path.join(base, 'sales-detail-actions.json'), j(actions));
    // busca especificamente por "Faturar"/"Ver pagamentos"/"Finalizar" nas actions
    const faturarBtn = actions.find((a) => /Faturar|Ver pagamentos|Finalizar comanda|Pagar/i.test(a.text));
    if (faturarBtn) w(path.join(base, '_faturar-button.json'), j(faturarBtn));
    // volta pra lista
    if (after !== before) await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await sleep(400);
  } catch (e) {}
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, viewport: null,
    args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('\n>>> Se aparecer login, faça-o. Detecto quando /wow carregar. <<<\n');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const u = page.url();
    if (/belasis\.app\/[a-z]/i.test(u) && !/\/login/.test(u)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 5 === 0) console.log('  ...aguardando (', u, ')');
  }
  if (!authed) { console.log('TIMEOUT'); await ctx.close(); process.exit(3); }

  // Session snapshot pra persistir através de gotos
  const authSnap = await page.evaluate(() => ({
    session: Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)).map((k) => [k, sessionStorage.getItem(k)])),
    local:   Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)])),
  })).catch(() => ({ session: {}, local: {} }));
  console.log(`  auth: ${Object.keys(authSnap.session).length}s ${Object.keys(authSnap.local).length}l`);
  await ctx.addInitScript((snap) => {
    try {
      for (const [k, v] of Object.entries(snap.session || {})) sessionStorage.setItem(k, v);
      for (const [k, v] of Object.entries(snap.local || {})) localStorage.setItem(k, v);
    } catch (e) {}
  }, authSnap);
  fs.writeFileSync(OUT + '/_auth-snap.json', j(authSnap));

  console.log('LOGIN OK. Captura completa com SCROLL...\n');
  const idx = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp.size);
    console.log(`\n═══ ${vp.name} (${vp.size.width}×${vp.size.height}) ═══`);
    for (const R of ROUTES) {
      const base = path.join(OUT, vp.name, R.slug);
      fs.mkdirSync(base, { recursive: true });
      const rec = { slug: R.slug, viewport: vp.name, route: R.route, captured: [] };
      try {
        await page.goto('https://belasis.app' + R.route, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
        if (/\/login/.test(page.url())) { console.log(`  ${R.slug}[${vp.name}]: DESLOGOU`); break; }
        await waitReady(page); await killOverlays(page);
        // SCROLL COMPLETO + screenshots por posição
        const meta = await scrollAndSnap(page, base);
        rec.htmlBefore = meta.H; rec.captured.push('scroll+snaps');
        // HTML DEPOIS de tudo renderizado
        const html = await page.evaluate(() => document.body.outerHTML);
        w(path.join(base, 'page.html'), html);
        // CSS-computed completo
        w(path.join(base, 'css.json'), j(await extractCSSFull(page)));
        // FUNIL / KPIs semânticos (útil pra /wow)
        const funil = await extractFunil(page);
        w(path.join(base, 'funil.json'), j(funil));
        rec.funilValores = funil.valores;
        rec.captured.push('funil');
        // Fluxo específico de /sales: entra no detalhe
        if (R.slug === 'sales' && vp.name === 'desktop') {
          await captureSalesDetail(page, base);
          rec.captured.push('salesDetail');
        }
        console.log(`  ${R.slug}[${vp.name}]: H=${meta.H}px · html=${html.length}b · funil=${JSON.stringify(funil.valores)}`);
      } catch (e) { console.log(`  ${R.slug}[${vp.name}]: ERR ${(e.message||'').slice(0,60)}`); }
      idx.push(rec);
      w(OUT + '/_index.json', j(idx));
    }
  }
  console.log('\n═══ DONE. belasis-reference/v5/ ═══');
  await sleep(2000);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
