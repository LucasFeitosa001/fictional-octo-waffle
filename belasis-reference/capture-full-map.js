/*
 * CAPTURE FULL MAP — mapeamento agressivo pra 1:1.
 * Modes: --mobile | --desktop
 *
 * Para CADA rota, clica em (safe):
 *   1. HEADER: cada botão do topo (Filtrar/Buscar/Novo/Exportar/Imprimir/Atualizar/etc.)
 *   2. TABS: cada aba interna, dumpa panel
 *   3. ROWS: as 3 primeiras rows da tabela (click na linha inteira) → detail
 *   4. LINKS AZUIS: cada link azul da 1ª row (nome cliente, código, valor)
 *   5. ROW-MENU: 3-pontinhos (⋯) da 1ª row → dropdown de opções
 *   6. BOTTOM-NAV (mobile): cada item da nav inferior → captura target
 *   7. HAMBURGER (mobile): dumpa menu lateral (sem clicar nele)
 *
 * Salva CADA overlay/drawer/modal/página que abriu em CADA click.
 * Cada rota → belasis-reference/full-map/<mode>/<slug>/{action-*.html,png}
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const REF = __dirname;
const MODE = process.argv.includes('--desktop') ? 'desktop' : 'mobile';
const PROFILE = REF + (MODE === 'desktop' ? '/.auth-profile' : '/.auth-profile-mobile');
const OUT = REF + `/full-map/${MODE}`;
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

async function waitReady(page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('.ant-skeleton-active, .ant-spin-spinning'), { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => {
    const t = document.querySelector('.ant-table-tbody');
    if (t) return t.querySelectorAll('tr').length >= 1;
    if (/Não há dados|Nenhum registro/i.test(document.body.innerText || '')) return true;
    if (document.querySelector('.recharts-surface, form input, .ant-input, .ant-card')) return true;
    return (document.body.innerText || '').length > 500;
  }, { timeout: 20000 }).catch(() => {});
  await sleep(2500);
}

async function killOverlays(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.ant-notification, .ant-notification-notice-wrapper')) el.remove();
  }).catch(() => {});
}

async function findOverlay(page) {
  const sels = [
    '.ant-drawer-open .ant-drawer-content-wrapper',
    '.ant-modal-root .ant-modal-content',
    '.ant-dropdown:not(.ant-dropdown-hidden)',
    '.ant-popover:not(.ant-popover-hidden)',
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
  ];
  for (const s of sels) if (await page.$(s)) return s;
  return null;
}

// Wait transition CSS terminar: opacity=1 + transform sem translate.
async function waitOverlayStable(page, sel) {
  await page.waitForFunction((s) => {
    const el = document.querySelector(s); if (!el) return false;
    const cs = getComputedStyle(el);
    const opacity = parseFloat(cs.opacity || '1');
    if (opacity < 0.99) return false;
    const t = cs.transform || '';
    // se ainda tem translate diferente de 0, ainda está animando
    if (t !== 'none' && /matrix|translate/.test(t)) {
      const m = t.match(/matrix\([^)]+\)/);
      if (m) {
        const nums = m[0].match(/-?\d+\.?\d*/g);
        if (nums && nums.length >= 6) {
          const tx = parseFloat(nums[4]); const ty = parseFloat(nums[5]);
          if (Math.abs(tx) > 1 || Math.abs(ty) > 1) return false;
        }
      }
    }
    return true;
  }, sel, { timeout: 3000 }).catch(() => {});
  await sleep(300); // margem pra sub-elementos internos animarem
}

// Scroll DENTRO do overlay/drawer/modal (não a página) — 3 posições de screenshot.
async function scrollInOverlay(page, sel, base, actionSlug) {
  // Descobre altura scrollable dentro do overlay
  const meta = await page.evaluate((s) => {
    // encontra o elemento scrollable dentro do overlay (drawer body / modal body)
    const root = document.querySelector(s); if (!root) return { has: false };
    const cand = root.querySelector('.ant-drawer-body, .ant-modal-body, [class*="body" i][class*="scroll" i]') || root;
    const H = cand.scrollHeight; const vh = cand.clientHeight;
    return { has: H > vh + 20, H, vh };
  }, sel);
  if (!meta.has) return;
  await page.evaluate((args) => {
    const root = document.querySelector(args.s);
    const cand = root.querySelector('.ant-drawer-body, .ant-modal-body') || root;
    cand.scrollTop = Math.round(cand.scrollHeight * 0.5);
  }, { s: sel });
  await sleep(500);
  await page.screenshot({ path: path.join(base, `${actionSlug}-mid.png`), fullPage: false }).catch(() => {});
  await page.evaluate((args) => {
    const root = document.querySelector(args.s);
    const cand = root.querySelector('.ant-drawer-body, .ant-modal-body') || root;
    cand.scrollTop = cand.scrollHeight;
  }, { s: sel });
  await sleep(500);
  await page.screenshot({ path: path.join(base, `${actionSlug}-bottom.png`), fullPage: false }).catch(() => {});
  // volta ao topo
  await page.evaluate((args) => {
    const root = document.querySelector(args.s);
    const cand = root.querySelector('.ant-drawer-body, .ant-modal-body') || root;
    cand.scrollTop = 0;
  }, { s: sel });
  await sleep(300);
}

async function captureOverlay(page, base, actionSlug) {
  // Espera generosa pra overlay aparecer (transições Belasis são 250-400ms + hydration)
  await sleep(600);
  const ov = await findOverlay(page);
  if (!ov) return { overlay: false };
  // Espera transition CSS estabilizar
  await waitOverlayStable(page, ov);
  // Screenshot TOP + HTML completo
  await page.screenshot({ path: path.join(base, `${actionSlug}-top.png`), fullPage: false }).catch(() => {});
  const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
  w(path.join(base, `${actionSlug}.html`), html);
  // Scroll dentro pra capturar drawer/modal LONGO
  await scrollInOverlay(page, ov, base, actionSlug);
  return { overlay: true, selector: ov, bytes: html.length };
}

async function closeOverlays(page) {
  // Tenta clicar em X primeiro (fecha mais limpo)
  const clicked = await page.evaluate(() => {
    const x = document.querySelector('.ant-drawer-close, .ant-modal-close, [aria-label*="close" i], [aria-label*="fechar" i]');
    if (x) { x.click(); return true; }
    return false;
  });
  await sleep(400);
  if (!clicked) { await page.keyboard.press('Escape').catch(() => {}); await sleep(400); }
  // se ainda tem overlay, ESC de novo
  const still = await findOverlay(page);
  if (still) { await page.keyboard.press('Escape').catch(() => {}); await sleep(400); }
  await sleep(300);
}

// Enumera CANDIDATOS clicáveis por categoria em uma varredura DOM (safe filter)
async function enumerate(page) {
  return page.evaluate((danger) => {
    const D = new RegExp(danger, 'i');
    const isVis = (el) => { const r = el.getBoundingClientRect(); return r.width >= 20 && r.height >= 15 && r.bottom > 0 && r.top < window.innerHeight * 3; };
    const cleanText = (el) => {
      const c = el.cloneNode(true);
      c.querySelectorAll('svg, ul, li, .ant-badge').forEach((n) => n.remove());
      return (c.textContent || '').replace(/\s+/g, ' ').trim();
    };
    // HEADER buttons (no topo da main area)
    const headerButtons = [];
    for (const el of document.querySelectorAll('header button, header a, .ant-page-header button, [class*="toolbar" i] button, .page-header button')) {
      const t = cleanText(el).slice(0, 30);
      if (!t || D.test((el.outerHTML || '').slice(0, 400))) continue;
      if (!isVis(el)) continue;
      headerButtons.push({ text: t, class: (el.className || '').slice(0, 60) });
    }
    // TABS
    const tabs = Array.from(document.querySelectorAll('.ant-tabs-nav .ant-tabs-tab')).map((t, i) => ({ index: i, text: cleanText(t).slice(0, 30) }));
    // ROWS
    const rows = Array.from(document.querySelectorAll('.ant-table-tbody > tr:not(.ant-table-placeholder), tbody > tr:not(.no-data)')).slice(0, 3);
    const rowInfos = rows.map((r, i) => ({ index: i, text: cleanText(r).slice(0, 100), hasMenu: !!r.querySelector('.anticon-more, [class*="more" i], .ant-dropdown-trigger') }));
    // LINKS AZUIS da 1a row
    const links = [];
    const firstRow = rows[0];
    if (firstRow) {
      for (const el of firstRow.querySelectorAll('a, span')) {
        const cs = getComputedStyle(el);
        const m = (cs.color || '').match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
        if (!m) continue;
        const [, r, g, b] = m.map(Number);
        if (b < 180 || r >= 150) continue;
        const t = cleanText(el).slice(0, 40);
        if (!t || D.test(t)) continue;
        if (!isVis(el)) continue;
        links.push({ text: t, color: cs.color });
      }
    }
    // BOTTOM-NAV (mobile)
    const bnItems = [];
    const bn = document.querySelector('[class*="bottom-nav" i], .ant-tabs.ant-tabs-bottom, nav[class*="bottom" i]')
            || Array.from(document.querySelectorAll('nav, [role="navigation"]')).find((n) => { const r = n.getBoundingClientRect(); return r.bottom > window.innerHeight - 100 && r.top > window.innerHeight - 200; });
    if (bn) {
      for (const el of bn.querySelectorAll('a, button, [role="button"]')) {
        const t = cleanText(el).slice(0, 30);
        const outer = (el.outerHTML || '').slice(0, 300);
        if (D.test(outer)) continue;
        const r = el.getBoundingClientRect();
        bnItems.push({ text: t, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
      }
    }
    return { headerButtons, tabs, rows: rowInfos, links, bnItems };
  }, DANGER.source);
}

async function safeClickText(page, textStr) {
  return page.evaluate((args) => {
    const D = new RegExp(args.danger, 'i');
    for (const el of document.querySelectorAll('button, a, [role="button"], .ant-btn')) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('svg, ul, li, .ant-badge').forEach((n) => n.remove());
      const txt = (clone.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt !== args.text) continue;
      if (D.test((el.outerHTML || '').slice(0, 500))) return null;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return { text: txt };
    }
    return null;
  }, { text: textStr, danger: DANGER.source });
}

async function main() {
  const device = MODE === 'mobile' ? devices['iPhone 13'] : null;
  const opts = MODE === 'mobile'
    ? { ...device, headless: false, args: ['--no-sandbox'], locale: 'pt-BR' }
    : { viewport: { width: 1440, height: 900 }, headless: false, args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR' };
  console.log(`FULL-MAP (${MODE}) — mapeamento agressivo\n`);
  const ctx = await chromium.launchPersistentContext(PROFILE, opts);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('>>> Login se pedir <<<\n');
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

  console.log(`LOGIN OK. Mapeando...\n`);
  const master = [];
  const hashes = new Map();
  let deslogou = false;

  for (const route of ROUTES) {
    if (deslogou) break;
    const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    const base = path.join(OUT, slug);
    fs.mkdirSync(base, { recursive: true });
    const rec = { route, slug, actions: [] };
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug} deslogado`); deslogou = true; break; }
      await waitReady(page); await killOverlays(page);

      // scroll top→bottom
      await page.evaluate(async () => {
        const h = document.documentElement.scrollHeight;
        for (let y = 0; y <= h; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); }
        window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
      });

      const bodyHtml = await page.evaluate(() => document.body.outerHTML);
      const hash = crypto.createHash('sha1').update(bodyHtml).digest('hex').slice(0, 12);
      rec.hash = hash;
      if (hashes.has(hash)) { rec.duplicateOf = hashes.get(hash); console.log(`  ${slug}: 👻 duplicado de ${rec.duplicateOf}`); master.push(rec); continue; }
      hashes.set(hash, slug);

      w(path.join(base, 'page.html'), bodyHtml);
      await page.screenshot({ path: path.join(base, 'page.png'), fullPage: true }).catch(() => {});

      const cands = await enumerate(page);
      rec.candidates = { header: cands.headerButtons.length, tabs: cands.tabs.length, rows: cands.rows.length, links: cands.links.length, bnav: cands.bnItems.length };
      w(path.join(base, '_candidates.json'), j(cands));

      // 1. HEADER buttons — clica em cada UMA vez, dedupe por texto
      const clickedHeader = new Set();
      for (const b of cands.headerButtons.slice(0, 8)) {
        if (clickedHeader.has(b.text)) continue;
        clickedHeader.add(b.text);
        const clicked = await safeClickText(page, b.text);
        if (!clicked) continue;
        await sleep(1400); // aguarda animação começar (transitions belasis 250-400ms + render)
        if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug}: header "${b.text}" deslogou`); deslogou = true; break; }
        const cap = await captureOverlay(page, base, 'header-' + slugify(b.text));
        rec.actions.push({ kind: 'header', text: b.text, overlay: cap.overlay, bytes: cap.bytes || 0 });
        await closeOverlays(page);
        await sleep(500); // margem entre ações
      }
      if (deslogou) break;

      // 2. TABS — clica em cada (safe)
      for (const t of cands.tabs.slice(0, 8)) {
        if (!t.text || DANGER.test(t.text)) continue;
        const clicked = await page.evaluate((idx) => {
          const tab = document.querySelectorAll('.ant-tabs-nav .ant-tabs-tab')[idx];
          if (!tab) return null; tab.scrollIntoView({ block: 'nearest' }); tab.click(); return true;
        }, t.index);
        if (!clicked) continue;
        await sleep(600);
        await page.screenshot({ path: path.join(base, `tab-${String(t.index).padStart(2,'0')}-${slugify(t.text)}.png`), fullPage: false }).catch(() => {});
        const panelHtml = await page.evaluate(() => {
          const active = document.querySelector('.ant-tabs-tabpane-active');
          return active ? active.outerHTML.slice(0, 30000) : '';
        });
        if (panelHtml) w(path.join(base, `tab-${String(t.index).padStart(2,'0')}-${slugify(t.text)}.html`), panelHtml);
        rec.actions.push({ kind: 'tab', text: t.text, bytes: panelHtml.length });
      }

      // 3. ROWS — clica nas 3 primeiras COM FLUXO HUMANO (scroll into view + hover + click + wait + explore)
      for (const r of cands.rows) {
        const beforeUrl = page.url();
        const clicked = await page.evaluate((idx) => {
          const row = document.querySelectorAll('.ant-table-tbody > tr:not(.ant-table-placeholder), tbody > tr')[idx];
          if (!row) return null;
          row.scrollIntoView({ block: 'center' });
          return true;
        }, r.index);
        if (!clicked) continue;
        await sleep(600);  // pausa depois do scroll (humano olha antes de clicar)
        await page.evaluate((idx) => {
          const row = document.querySelectorAll('.ant-table-tbody > tr:not(.ant-table-placeholder), tbody > tr')[idx];
          if (row) row.click();
        }, r.index);
        await sleep(1800); // aguarda transição drawer/nav (humano espera tela responder)
        if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug}: row deslogou`); deslogou = true; break; }
        const after = page.url();
        const sfx = `row-${String(r.index).padStart(2,'0')}`;
        if (after !== beforeUrl) {
          await waitReady(page); // espera dados do detalhe carregarem
          // scroll top→bottom da página de detalhe (humano lê tudo)
          const H = await page.evaluate(async () => {
            const h = document.documentElement.scrollHeight;
            for (let y = 0; y <= h; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
            window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
            return h;
          });
          const html = await page.evaluate(() => document.body.outerHTML);
          w(path.join(base, `${sfx}-detail.html`), html);
          await page.screenshot({ path: path.join(base, `${sfx}-detail-full.png`), fullPage: true }).catch(() => {});
          await page.screenshot({ path: path.join(base, `${sfx}-detail-viewport.png`), fullPage: false }).catch(() => {});
          rec.actions.push({ kind: 'row', index: r.index, text: r.text.slice(0, 60), navigatedTo: after, bytes: html.length, scrollH: H });
          await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await sleep(900);
          await waitReady(page);
        } else {
          const cap = await captureOverlay(page, base, sfx);
          rec.actions.push({ kind: 'row', index: r.index, text: r.text.slice(0, 60), overlay: cap.overlay, bytes: cap.bytes || 0 });
          await closeOverlays(page);
          await sleep(500);
        }
      }
      if (deslogou) break;

      // 4. LINKS AZUIS da 1a row (fluxo humano com espera+scroll)
      for (let li = 0; li < Math.min(cands.links.length, 3); li++) {
        const beforeUrl = page.url();
        await sleep(400);  // pausa entre links (humano lê)
        const clicked = await page.evaluate((args) => {
          const D = new RegExp(args.danger, 'i');
          const firstRow = document.querySelector('.ant-table-tbody > tr:not(.ant-table-placeholder), tbody > tr');
          if (!firstRow) return null;
          const candidates = [];
          for (const el of firstRow.querySelectorAll('a, span')) {
            const cs = getComputedStyle(el);
            const m = (cs.color || '').match(/rgb\((\d+),\s*(\d+),\s*(\d+)/); if (!m) continue;
            const [, r, g, b] = m.map(Number); if (b < 180 || r >= 150) continue;
            const txt = (el.textContent || '').trim(); if (!txt || D.test(txt)) continue;
            candidates.push(el);
          }
          const el = candidates[args.idx]; if (!el) return null;
          el.scrollIntoView({ block: 'center' }); el.click();
          return { text: (el.textContent || '').trim().slice(0, 60) };
        }, { idx: li, danger: DANGER.source });
        if (!clicked) continue;
        await sleep(1800); // aguarda drawer/nav abrir humano
        if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug}: link deslogou`); deslogou = true; break; }
        const after = page.url();
        const sfx = `link-${String(li).padStart(2,'0')}-${slugify(clicked.text)}`;
        if (after !== beforeUrl) {
          await waitReady(page);
          // scroll top→bottom da rota de destino
          await page.evaluate(async () => {
            const h = document.documentElement.scrollHeight;
            for (let y = 0; y <= h; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
            window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
          });
          const html = await page.evaluate(() => document.body.outerHTML);
          w(path.join(base, `${sfx}-nav.html`), html);
          await page.screenshot({ path: path.join(base, `${sfx}-nav-full.png`), fullPage: true }).catch(() => {});
          rec.actions.push({ kind: 'link', index: li, text: clicked.text, navigatedTo: after, bytes: html.length });
          await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await sleep(900); await waitReady(page);
        } else {
          const cap = await captureOverlay(page, base, sfx);
          rec.actions.push({ kind: 'link', index: li, text: clicked.text, overlay: cap.overlay, bytes: cap.bytes || 0 });
          await closeOverlays(page);
          await sleep(500);
        }
      }
      if (deslogou) break;

      // 5. BOTTOM-NAV items (mobile only)
      if (MODE === 'mobile' && cands.bnItems.length) {
        for (let bi = 0; bi < Math.min(cands.bnItems.length, 6); bi++) {
          const item = cands.bnItems[bi];
          const beforeUrl = page.url();
          await sleep(400); // pausa humano
          try { await page.mouse.click(item.x, item.y, { delay: 80 }); } catch (e) { continue; }
          await sleep(1800); // aguarda navegação/overlay
          if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug}: bnav deslogou`); deslogou = true; break; }
          const after = page.url();
          const sfx = `bnav-${String(bi).padStart(2,'0')}-${slugify(item.text)}`;
          if (after !== beforeUrl) {
            await waitReady(page);
            await page.evaluate(async () => {
              const h = document.documentElement.scrollHeight;
              for (let y = 0; y <= h; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 200)); }
              window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 300));
            });
            const html = await page.evaluate(() => document.body.outerHTML);
            w(path.join(base, `${sfx}.html`), html);
            await page.screenshot({ path: path.join(base, `${sfx}-full.png`), fullPage: true }).catch(() => {});
            rec.actions.push({ kind: 'bnav', index: bi, text: item.text, navigatedTo: after, bytes: html.length });
            await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
            await sleep(900); await waitReady(page);
          } else {
            const cap = await captureOverlay(page, base, sfx);
            if (cap.overlay) rec.actions.push({ kind: 'bnav', index: bi, text: item.text, overlay: true, bytes: cap.bytes });
            await closeOverlays(page);
            await sleep(500);
          }
        }
      }
      if (deslogou) break;

      console.log(`  ${slug}: cand{h:${rec.candidates.header} t:${rec.candidates.tabs} r:${rec.candidates.rows} l:${rec.candidates.links} bn:${rec.candidates.bnav}} → ${rec.actions.length} ações`);
    } catch (e) { console.log(`  ${slug}: ERR ${(e.message || '').slice(0, 60)}`); }
    master.push(rec);
    w(OUT + '/_index.json', j(master));
  }

  const totalActions = master.reduce((a, r) => a + (r.actions?.length || 0), 0);
  console.log(`\n=== DONE (${MODE}). ${master.length} rotas · ${totalActions} ações mapeadas${deslogou ? ' (⚠️ parou por logout)' : ''} ===`);
  await sleep(1500);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
