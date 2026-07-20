/*
 * PHASE RUNNER — 1 fase por vez, todas as rotas.
 * Uso: node phase-runner.js --mobile|--desktop --phase=<A|B|C|D|E>
 *
 * A: header "Novo/Criar" → drawer de criação (mais crítico)
 * B: 1ª row da tabela → detalhe (com scroll)
 * C: header "Filtrar" → painel/drawer de filtros
 * D: cada tab interna da página
 * E: bottom-nav mobile (só mobile)
 *
 * TIMEOUT DURO por rota: 90s. Se estourar, pula. Não trava a fase toda.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const REF = __dirname;
const MODE = process.argv.includes('--desktop') ? 'desktop' : 'mobile';
const PHASE_ARG = (process.argv.find((a) => a.startsWith('--phase=')) || '--phase=A').split('=')[1];
const PROFILE = REF + (MODE === 'desktop' ? '/.auth-profile' : '/.auth-profile-mobile');
const OUT = REF + `/phases/${MODE}/phase-${PHASE_ARG}`;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const j = (o) => JSON.stringify(o, null, 2);
const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';

const ROUTES = [
  '/wow', '/calendar', '/sales', '/clients', '/employees', '/products', '/services',
  '/packages', '/subscriptions', '/vendors', '/brands',
  '/finance/transactions', '/finance/accounts', '/finance/cash', '/finance/dashboard',
  '/commissions', '/commissions/settings',
  '/reports', '/reports/financial', '/reports/clients/all', '/reports/calendars/all',
  '/marketing/agendamento-online', '/marketing/campanhas', '/marketing/cashback', '/marketing/promocoes', '/marketing/avaliacoes',
  '/settings',
];

const DANGER = /\b(Sair|Logout|Sign\s*out|Deslogar|Cancelar\s+assinatura|Finalizar\s+(assinatura|conta)|Excluir|Deletar|Delete|Faturar|Pagar\s+agora|Reset(ar)?\s+dados|Apagar|Remover(?!\s+filtro))\b/i;
const ROUTE_TIMEOUT_MS = 90_000;

async function waitReady(page) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.ant-skeleton-active, .ant-spin-spinning'), { timeout: 10000 }).catch(() => {});
  // Espera dados REAIS: tabela com row, chart, form, ou body grande
  await page.waitForFunction(() => {
    const t = document.querySelector('.ant-table-tbody');
    if (t && t.querySelectorAll('tr:not(.ant-table-placeholder)').length >= 1) return true;
    if (/Não há dados|Nenhum registro/i.test(document.body.innerText || '')) return true;
    if (document.querySelector('.recharts-surface, form input, .ant-input, .ant-card-body')) return true;
    return (document.body.innerText || '').length > 500;
  }, { timeout: 15000 }).catch(() => {});
  await sleep(2500);
}

async function findOverlay(page) {
  const sels = ['.ant-drawer-open .ant-drawer-content-wrapper', '.ant-modal-root .ant-modal-content',
    '.ant-drawer .ant-drawer-content', '.ant-modal .ant-modal-content'];
  for (const s of sels) if (await page.$(s)) return s;
  return null;
}

async function waitOverlayStable(page, sel) {
  await page.waitForFunction((s) => {
    const el = document.querySelector(s); if (!el) return false;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.opacity || '1') < 0.99) return false;
    const t = cs.transform || 'none';
    if (t !== 'none') {
      const m = t.match(/matrix\([^)]+\)/);
      if (m) { const nums = m[0].match(/-?\d+\.?\d*/g); if (nums && (Math.abs(+nums[4]) > 1 || Math.abs(+nums[5]) > 1)) return false; }
    }
    return true;
  }, sel, { timeout: 3000 }).catch(() => {});
  await sleep(400);
}

async function scrollInOverlay(page, sel) {
  const has = await page.evaluate((s) => {
    const root = document.querySelector(s); if (!root) return false;
    const cand = root.querySelector('.ant-drawer-body, .ant-modal-body') || root;
    return cand.scrollHeight > cand.clientHeight + 20;
  }, sel);
  if (!has) return;
  for (const pct of [0.5, 1.0, 0]) {
    await page.evaluate((args) => {
      const root = document.querySelector(args.s);
      const cand = root.querySelector('.ant-drawer-body, .ant-modal-body') || root;
      cand.scrollTop = Math.round(cand.scrollHeight * args.p);
    }, { s: sel, p: pct });
    await sleep(500);
  }
}

async function closeAll(page) {
  const x = await page.evaluate(() => {
    const c = document.querySelector('.ant-drawer-close, .ant-modal-close');
    if (c) { c.click(); return true; } return false;
  });
  await sleep(400);
  if (!x) { await page.keyboard.press('Escape').catch(() => {}); await sleep(400); }
  const still = await findOverlay(page);
  if (still) { await page.keyboard.press('Escape').catch(() => {}); await sleep(400); }
}

// ─── FASE A: "Novo" ───────────────────────────────────────────────────────
async function phaseA(page, route, base) {
  const NEW_TEXTS = ['Novo', 'Novo agendamento', 'Nova comanda', 'Novo cliente', 'Novo profissional',
    'Novo produto', 'Novo serviço', 'Novo pacote', 'Nova assinatura', 'Novo fornecedor',
    'Nova marca', 'Novo recebimento', 'Nova despesa', 'Nova conta', 'Nova compra', 'Criar', '+'];
  const clicked = await page.evaluate((args) => {
    const D = new RegExp(args.danger, 'i');
    for (const wanted of args.texts) {
      for (const el of document.querySelectorAll('button, a, [role="button"], .ant-btn')) {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('svg, ul, li, .ant-badge').forEach((n) => n.remove());
        const txt = (clone.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt !== wanted) continue;
        if (D.test((el.outerHTML || '').slice(0, 500))) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 20 || r.height < 15) continue;
        el.scrollIntoView({ block: 'center' });
        el.click();
        return { text: txt };
      }
    }
    return null;
  }, { texts: NEW_TEXTS, danger: DANGER.source });
  if (!clicked) return { note: 'sem-botao-novo' };
  await sleep(1800);
  const ov = await findOverlay(page);
  if (!ov) return { clicked: clicked.text, note: 'sem-overlay' };
  await waitOverlayStable(page, ov);
  const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
  w(path.join(base, 'novo.html'), html);
  await page.screenshot({ path: path.join(base, 'novo-top.png'), fullPage: false }).catch(() => {});
  await scrollInOverlay(page, ov);
  await page.screenshot({ path: path.join(base, 'novo-bottom.png'), fullPage: false }).catch(() => {});
  await closeAll(page);
  return { clicked: clicked.text, overlay: ov, bytes: html.length };
}

// ─── FASE B: 1ª row → detalhe (com scroll) ────────────────────────────────
async function phaseB(page, route, base) {
  const before = page.url();
  const clicked = await page.evaluate((danger) => {
    const D = new RegExp(danger, 'i');
    const rows = document.querySelectorAll('.ant-table-tbody > tr:not(.ant-table-placeholder), tbody > tr:not(.no-data)');
    if (!rows.length) return null;
    const row = rows[0];
    if (D.test((row.outerHTML || '').slice(0, 400))) return null;
    row.scrollIntoView({ block: 'center' });
    row.click();
    const cell = row.querySelector('td, .ant-card-body') || row;
    return { text: (cell.textContent || '').trim().slice(0, 80) };
  }, DANGER.source);
  if (!clicked) return { note: 'sem-row' };
  await sleep(2000);
  const after = page.url();
  if (after !== before) {
    await waitReady(page);
    // scroll top→bottom pra pegar todos os cards do detalhe
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y <= h; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
      window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 500));
    });
    const html = await page.evaluate(() => document.body.outerHTML);
    w(path.join(base, 'row-detail.html'), html);
    await page.screenshot({ path: path.join(base, 'row-detail-full.png'), fullPage: true }).catch(() => {});
    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(800);
    return { clicked: clicked.text, navigatedTo: after, bytes: html.length };
  } else {
    const ov = await findOverlay(page);
    if (!ov) return { clicked: clicked.text, note: 'sem-nav-nem-overlay' };
    await waitOverlayStable(page, ov);
    const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
    w(path.join(base, 'row-overlay.html'), html);
    await page.screenshot({ path: path.join(base, 'row-overlay-top.png'), fullPage: false }).catch(() => {});
    await scrollInOverlay(page, ov);
    await page.screenshot({ path: path.join(base, 'row-overlay-bottom.png'), fullPage: false }).catch(() => {});
    await closeAll(page);
    return { clicked: clicked.text, overlay: ov, bytes: html.length };
  }
}

// ─── FASE C: Filtrar ──────────────────────────────────────────────────────
async function phaseC(page, route, base) {
  const clicked = await page.evaluate((danger) => {
    const D = new RegExp(danger, 'i');
    for (const el of document.querySelectorAll('button, a, [role="button"], .ant-btn')) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('svg, ul, li').forEach((n) => n.remove());
      const txt = (clone.textContent || '').replace(/\s+/g, ' ').trim();
      if (!/^(Filtrar|Filtros|Filter)$/i.test(txt)) continue;
      if (D.test((el.outerHTML || '').slice(0, 500))) continue;
      el.scrollIntoView({ block: 'center' }); el.click(); return { text: txt };
    }
    return null;
  }, DANGER.source);
  if (!clicked) return { note: 'sem-filtrar' };
  await sleep(1500);
  const ov = await findOverlay(page);
  if (!ov) return { clicked: clicked.text, note: 'sem-overlay' };
  await waitOverlayStable(page, ov);
  const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
  w(path.join(base, 'filtros.html'), html);
  await page.screenshot({ path: path.join(base, 'filtros-top.png'), fullPage: false }).catch(() => {});
  await scrollInOverlay(page, ov);
  await page.screenshot({ path: path.join(base, 'filtros-bottom.png'), fullPage: false }).catch(() => {});
  await closeAll(page);
  return { clicked: clicked.text, overlay: ov, bytes: html.length };
}

// ─── FASE D: Tabs ─────────────────────────────────────────────────────────
async function phaseD(page, route, base) {
  const tabs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.ant-tabs-nav .ant-tabs-tab')).map((t, i) => ({
      index: i, text: (t.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
    }));
  });
  if (!tabs.length) return { note: 'sem-tabs' };
  const captured = [];
  for (const t of tabs.slice(0, 8)) {
    if (DANGER.test(t.text)) continue;
    await page.evaluate((idx) => {
      const tab = document.querySelectorAll('.ant-tabs-nav .ant-tabs-tab')[idx];
      if (tab) { tab.scrollIntoView({ block: 'nearest' }); tab.click(); }
    }, t.index);
    await sleep(900);
    const panelHtml = await page.evaluate(() => {
      const active = document.querySelector('.ant-tabs-tabpane-active');
      return active ? active.outerHTML.slice(0, 40000) : '';
    });
    if (panelHtml) {
      const sfx = `tab-${String(t.index).padStart(2, '0')}-${slugify(t.text)}`;
      w(path.join(base, `${sfx}.html`), panelHtml);
      await page.screenshot({ path: path.join(base, `${sfx}.png`), fullPage: false }).catch(() => {});
      captured.push({ index: t.index, text: t.text, bytes: panelHtml.length });
    }
  }
  return { tabs: captured.length, details: captured };
}

// ─── FASE E: BottomNav (mobile) ───────────────────────────────────────────
async function phaseE(page, route, base) {
  if (MODE !== 'mobile') return { note: 'mobile-only' };
  const nav = await page.evaluate((danger) => {
    const D = new RegExp(danger, 'i');
    const bn = document.querySelector('[class*="bottom-nav" i], .ant-tabs.ant-tabs-bottom, nav[class*="bottom" i]')
            || Array.from(document.querySelectorAll('nav, [role="navigation"]')).find((n) => { const r = n.getBoundingClientRect(); return r.bottom > window.innerHeight - 100 && r.top > window.innerHeight - 200; });
    if (!bn) return null;
    const items = [];
    for (const el of bn.querySelectorAll('a, button, [role="button"]')) {
      if (D.test((el.outerHTML || '').slice(0, 300))) continue;
      const r = el.getBoundingClientRect();
      items.push({ text: (el.textContent || '').trim().slice(0, 30), x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
    }
    return { html: bn.outerHTML.slice(0, 4000), items };
  }, DANGER.source);
  if (!nav) return { note: 'sem-bottom-nav' };
  w(path.join(base, 'bottom-nav.html'), nav.html);
  await page.screenshot({ path: path.join(base, 'bottom-nav.png'), fullPage: false }).catch(() => {});
  const captured = [];
  for (let i = 0; i < Math.min(nav.items.length, 6); i++) {
    const item = nav.items[i];
    const before = page.url();
    try { await page.mouse.click(item.x, item.y, { delay: 80 }); } catch (e) { continue; }
    await sleep(1800);
    if (/\/login/.test(page.url())) return { deslogou: true };
    const after = page.url();
    const sfx = `bnav-${String(i).padStart(2, '0')}-${slugify(item.text)}`;
    if (after !== before) {
      await waitReady(page);
      const html = await page.evaluate(() => document.body.outerHTML);
      w(path.join(base, `${sfx}.html`), html);
      await page.screenshot({ path: path.join(base, `${sfx}-full.png`), fullPage: true }).catch(() => {});
      captured.push({ index: i, text: item.text, navigatedTo: after });
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await sleep(900); await waitReady(page);
    } else {
      const ov = await findOverlay(page);
      if (ov) {
        await waitOverlayStable(page, ov);
        const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
        w(path.join(base, `${sfx}.html`), html);
        await page.screenshot({ path: path.join(base, `${sfx}.png`), fullPage: false }).catch(() => {});
        captured.push({ index: i, text: item.text, overlay: true });
        await closeAll(page);
      }
    }
  }
  return { navItems: nav.items.length, captured: captured.length };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
const PHASES = { A: phaseA, B: phaseB, C: phaseC, D: phaseD, E: phaseE };

async function main() {
  const phaseFn = PHASES[PHASE_ARG.toUpperCase()];
  if (!phaseFn) { console.error('Fase inválida:', PHASE_ARG, 'Use A/B/C/D/E'); process.exit(2); }
  const device = MODE === 'mobile' ? devices['iPhone 13'] : null;
  const opts = MODE === 'mobile'
    ? { ...device, headless: false, args: ['--no-sandbox'], locale: 'pt-BR' }
    : { viewport: { width: 1440, height: 900 }, headless: false, args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR' };
  console.log(`PHASE ${PHASE_ARG} (${MODE}) — 1 ação por rota, timeout 90s\n`);
  const ctx = await chromium.launchPersistentContext(PROFILE, opts);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('>>> Login se pedir <<<');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const u = page.url();
    if (/belasis\.app\/[a-z]/i.test(u) && !/\/login/.test(u)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 5 === 0) console.log('  ...', u);
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

  console.log(`LOGIN OK. Fase ${PHASE_ARG}...\n`);
  const master = [];
  let deslogou = false;
  for (const route of ROUTES) {
    if (deslogou) break;
    const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    const base = path.join(OUT, slug);
    fs.mkdirSync(base, { recursive: true });
    const rec = { route, slug };
    const start = Date.now();
    try {
      // Timeout DURO por rota (90s)
      await Promise.race([
        (async () => {
          await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
          if (/\/login/.test(page.url())) { deslogou = true; return; }
          await waitReady(page);
          rec.result = await phaseFn(page, route, base);
          if (rec.result?.deslogou) deslogou = true;
        })(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('ROUTE_TIMEOUT_90s')), ROUTE_TIMEOUT_MS)),
      ]);
    } catch (e) { rec.error = (e.message || '').slice(0, 60); }
    rec.durationMs = Date.now() - start;
    console.log(`  ${slug} [${Math.round(rec.durationMs/1000)}s]: ${JSON.stringify(rec.result || { error: rec.error })}`.slice(0, 170));
    master.push(rec);
    w(OUT + '/_index.json', j(master));
  }
  console.log(`\n=== FASE ${PHASE_ARG} DONE (${MODE}). ${master.length} rotas ${deslogou ? '(⚠️ parou por logout)' : ''} ===`);
  await sleep(1500);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
