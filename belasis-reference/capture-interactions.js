/*
 * CAPTURA INTERATIVA — clica em Filtrar/Buscar/Adicionar/Selecionar em cada rota.
 * Modes: --mobile  ou  --desktop  (usa devices['iPhone 13'] ou viewport 1440x900)
 * Continua ultra-safe (blacklist contra Sair/Excluir/etc.)
 *
 * Cliques permitidos (texto EXATO):
 *   - Filtrar, Filtros, Filter        → captura painel de filtros aberto
 *   - Buscar, Search                  → captura input de busca / dropdown de sugestões
 *   - Adicionar, +Adicionar           → dentro de drawer/página, captura o item picker
 *   - Selecionar serviço/produto/etc  → dropdown de escolha
 *   - Atualizar, Refresh              → força reload dos dados
 *   - Aplicar, Aplicar filtros        → aplica filtro e captura state
 *
 * NUNCA clica: Sair, Logout, Deslogar, Excluir, Deletar, Remover (exceto "Remover filtro"),
 *              Cancelar assinatura, Finalizar assinatura, Pagar agora, Faturar.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const MODE = process.argv.includes('--desktop') ? 'desktop' : 'mobile';
const PROFILE = REF + (MODE === 'desktop' ? '/.auth-profile' : '/.auth-profile-mobile');
const OUT = REF + `/interactions-${MODE}`;
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const j = (o) => JSON.stringify(o, null, 2);

const ROUTES = [
  '/wow', '/calendar', '/sales', '/clients', '/employees', '/products', '/services',
  '/packages', '/subscriptions', '/vendors', '/brands',
  '/finance/transactions', '/finance/accounts', '/finance/cash', '/finance/dashboard',
  '/commissions', '/reports', '/reports/financial',
  '/marketing/agendamento-online', '/marketing/campanhas', '/marketing/cashback',
  '/settings',
];

// 🚨 BLACKLIST — nunca clicar
const DANGER = /\b(Sair|Logout|Sign\s*out|Deslogar|Cancelar\s*assinatura|Finalizar\s*(assinatura|conta)|Excluir|Deletar|Delete|Faturar|Pagar\s*agora|Reset(ar)?\s+dados|Apagar)\b/i;

// ✅ SAFE ACTIONS pra tentar clicar em cada rota (texto EXATO no botão)
const SAFE_ACTIONS = [
  { name: 'filtrar',  regex: /^(Filtrar|Filtros|Filter)$/i },
  { name: 'buscar',   regex: /^(Buscar|Search|Pesquisar)$/i },
  { name: 'atualizar', regex: /^(Atualizar|Refresh|Recarregar)$/i },
  { name: 'aplicar',  regex: /^(Aplicar|Aplicar\s+filtros|Apply)$/i },
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
  await sleep(3000);
}

async function killOverlays(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.ant-notification, .ant-notification-notice-wrapper')) el.remove();
  }).catch(() => {});
}

// Clica em botão cujo texto DIRETO bate o regex + NÃO está na DANGER blacklist.
async function safeClick(page, textRegex) {
  return page.evaluate((args) => {
    const rx = new RegExp(args.re, args.flags);
    const danger = new RegExp(args.danger, 'i');
    for (const el of document.querySelectorAll('button, a, [role="button"], .ant-btn')) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('svg, ul, li, .ant-badge').forEach((n) => n.remove());
      const txt = (clone.textContent || '').replace(/\s+/g, ' ').trim();
      if (!rx.test(txt)) continue;
      const outer = (el.outerHTML || '').slice(0, 500);
      if (danger.test(outer)) continue;  // 🚨 skip perigoso
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 15) continue;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return { text: txt, class: (el.className || '').slice(0, 80) };
    }
    return null;
  }, { re: textRegex.source, flags: textRegex.flags, danger: DANGER.source });
}

async function findOpenOverlay(page) {
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

async function main() {
  const device = MODE === 'mobile' ? devices['iPhone 13'] : null;
  const ctxOpts = MODE === 'mobile'
    ? { ...device, headless: false, args: ['--no-sandbox'], locale: 'pt-BR' }
    : { viewport: { width: 1440, height: 900 }, headless: false, args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR' };
  console.log(`Interactions capture (${MODE}) — profile: ${PROFILE}\n`);
  const ctx = await chromium.launchPersistentContext(PROFILE, ctxOpts);
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('>>> Aguardando login (se necessário) <<<\n');
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

  console.log(`LOGIN OK. Rodando interações...\n`);
  const idx = [];
  const htmlHashes = new Map();  // hash → primeira rota que gerou ele
  const crypto = require('crypto');
  let deslogou = false;

  for (const route of ROUTES) {
    if (deslogou) break;
    const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    const base = path.join(OUT, slug);
    fs.mkdirSync(base, { recursive: true });
    const rec = { route, slug, actions: [] };
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug} deslogou`); deslogou = true; break; }
      await waitDataReady(page); await killOverlays(page);

      // ⚠️ Detecção de HTML duplicado — se essa rota renderizou o MESMO HTML de outra, marca como fantasma e pula interações
      const urlAfter = page.url();
      const bodyHtml = await page.evaluate(() => document.body.outerHTML);
      const hash = crypto.createHash('sha1').update(bodyHtml).digest('hex').slice(0, 12);
      rec.url = urlAfter; rec.hash = hash;
      if (htmlHashes.has(hash)) {
        rec.duplicateOf = htmlHashes.get(hash);
        console.log(`  ${slug}: 👻 HTML idêntico a ${rec.duplicateOf} — SKIP interações (rota fantasma)`);
        idx.push(rec);
        w(OUT + '/_index.json', j(idx));
        continue;
      }
      htmlHashes.set(hash, slug);
      if (!urlAfter.endsWith(route) && !urlAfter.includes(route.split('?')[0])) {
        rec.redirectedTo = urlAfter;
        console.log(`  ${slug}: 🔀 redirecionou para ${urlAfter}`);
      }

      // Snapshot base
      await page.screenshot({ path: path.join(base, 'page.png'), fullPage: false }).catch(() => {});

      // Tenta cada SAFE ACTION
      for (const act of SAFE_ACTIONS) {
        const clicked = await safeClick(page, act.regex);
        if (!clicked) continue;
        await sleep(800);
        if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug}: ${act.name} deslogou`); deslogou = true; break; }
        const ov = await findOpenOverlay(page);
        if (ov) {
          const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
          w(path.join(base, `action-${act.name}.html`), html);
          await page.screenshot({ path: path.join(base, `action-${act.name}.png`), fullPage: false }).catch(() => {});
          rec.actions.push({ name: act.name, clicked: clicked.text, overlaySelector: ov, bytes: html.length });
        } else {
          rec.actions.push({ name: act.name, clicked: clicked.text, note: 'sem overlay' });
        }
        // fecha
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(400);
      }

      // 🔗 LINKS AZUIS (texto em cor primary) — clica na 1ª cell da 1ª row pra abrir drawer/modal/detalhe
      const beforeLinkUrl = page.url();
      const beforeLinkHash = crypto.createHash('sha1').update(await page.evaluate(() => document.body.outerHTML)).digest('hex').slice(0, 12);
      const linkClick = await page.evaluate((danger) => {
        const DANGER = new RegExp(danger, 'i');
        // Coleta elementos com COR primary-ish (azul-roxo) ou tag <a> dentro de tabelas/cards
        function isPrimaryish(cs) {
          const c = cs.color || '';
          // Belasis usa azul/roxo tipo #4F5BF6 / rgb(80,90,251) / oklch(50%...)
          const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
          if (!m) return /^(link|primary)/.test(c);
          const [, r, g, b] = m.map(Number);
          // azul/roxo: b > 180, r < 130
          return b >= 180 && r < 150 && Math.abs(r - g) < 60;
        }
        // Escopo: 1ª linha da tabela OU 1º card
        const scope = document.querySelector('.ant-table-tbody tr, .ant-card-body, tbody tr') || document.body;
        const cands = [];
        for (const el of scope.querySelectorAll('a, span, td [class*="link" i], [role="link"]')) {
          const txt = (el.textContent || '').trim().slice(0, 60);
          if (!txt || txt.length < 2) continue;
          if (DANGER.test(txt) || DANGER.test((el.outerHTML || '').slice(0, 300))) continue;
          const cs = getComputedStyle(el);
          const looksClickable = cs.cursor === 'pointer' || el.tagName === 'A' || cs.textDecoration.includes('underline');
          if (!looksClickable && !isPrimaryish(cs)) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 10 || r.height < 10) continue;
          cands.push({ el, txt, color: cs.color, tag: el.tagName });
        }
        if (!cands.length) return null;
        const pick = cands[0];
        pick.el.scrollIntoView({ block: 'center' });
        pick.el.click();
        return { text: pick.txt, color: pick.color, tag: pick.tag };
      }, DANGER.source);
      if (linkClick) {
        await sleep(1200);
        if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug}: link deslogou`); deslogou = true; break; }
        const afterUrl = page.url();
        // Se navegou: dumpa nova rota
        if (afterUrl !== beforeLinkUrl) {
          const detailHtml = await page.evaluate(() => document.body.outerHTML);
          w(path.join(base, 'link-navigated.html'), detailHtml);
          await page.screenshot({ path: path.join(base, 'link-navigated.png'), fullPage: true }).catch(() => {});
          rec.actions.push({ name: 'link-nav', clicked: linkClick.text, from: beforeLinkUrl, to: afterUrl, bytes: detailHtml.length });
          await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await sleep(500);
        } else {
          // Se abriu drawer/modal, dumpa
          const ov = await findOpenOverlay(page);
          if (ov) {
            const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
            w(path.join(base, 'link-overlay.html'), html);
            await page.screenshot({ path: path.join(base, 'link-overlay.png'), fullPage: false }).catch(() => {});
            rec.actions.push({ name: 'link-overlay', clicked: linkClick.text, overlaySelector: ov, bytes: html.length });
            await page.keyboard.press('Escape').catch(() => {});
            await sleep(400);
          } else {
            // Detecta hash mudou? (SPA state)
            const afterHash = crypto.createHash('sha1').update(await page.evaluate(() => document.body.outerHTML)).digest('hex').slice(0, 12);
            if (afterHash !== beforeLinkHash) {
              rec.actions.push({ name: 'link-state', clicked: linkClick.text, hashChanged: true });
            }
          }
        }
      }

      // 📋 ITEM DA LISTA: clica na 1ª LINHA da tabela (ou 1º card) — abre detalhe/drawer/nova rota
      const beforeRowUrl = page.url();
      const rowClick = await page.evaluate((danger) => {
        const DANGER = new RegExp(danger, 'i');
        // tenta tr (tabela), depois primeiro card clicável
        const row = document.querySelector('.ant-table-tbody > tr:not(.ant-table-placeholder), tbody > tr:not(.no-data)')
                 || document.querySelector('.ant-card[class*="clickable" i], [role="listitem"], li[class*="item" i]');
        if (!row) return null;
        const outer = (row.outerHTML || '').slice(0, 400);
        if (DANGER.test(outer)) return null;
        row.scrollIntoView({ block: 'center' });
        row.click();
        const firstCell = row.querySelector('td, .ant-card-body') || row;
        return { text: (firstCell.textContent || '').trim().slice(0, 80), tag: row.tagName };
      }, DANGER.source);
      if (rowClick) {
        await sleep(1200);
        if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug}: row-click deslogou`); deslogou = true; break; }
        const after = page.url();
        if (after !== beforeRowUrl) {
          const html = await page.evaluate(() => document.body.outerHTML);
          w(path.join(base, 'row-detail.html'), html);
          await page.screenshot({ path: path.join(base, 'row-detail.png'), fullPage: true }).catch(() => {});
          // Bônus: enumera TODAS as ações disponíveis no detalhe
          const detailActions = await page.evaluate((danger) => {
            const D = new RegExp(danger, 'i');
            const out = [];
            for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
              const t = (el.textContent || '').trim().slice(0, 60);
              if (!t || D.test(t)) continue;
              const r = el.getBoundingClientRect();
              if (r.width < 20 || r.height < 15) continue;
              out.push({ text: t, tag: el.tagName, href: el.getAttribute('href') || null, class: (el.className || '').slice(0, 80), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } });
            }
            return out;
          }, DANGER.source);
          w(path.join(base, 'row-detail-actions.json'), j(detailActions));
          rec.actions.push({ name: 'row-detail', clicked: rowClick.text, url: after, actionsInDetail: detailActions.length });
          await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
          await sleep(600);
          await waitDataReady(page);
        } else {
          const ov = await findOpenOverlay(page);
          if (ov) {
            const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
            w(path.join(base, 'row-overlay.html'), html);
            await page.screenshot({ path: path.join(base, 'row-overlay.png'), fullPage: false }).catch(() => {});
            rec.actions.push({ name: 'row-overlay', clicked: rowClick.text, overlaySelector: ov, bytes: html.length });
            await page.keyboard.press('Escape').catch(() => {});
            await sleep(400);
          }
        }
      }

      // 📱 MOBILE-ONLY: BOTTOM-NAV — dumpa + CLICA em cada item safe (não só lista, INTERAGE)
      if (MODE === 'mobile') {
        const navInfo = await page.evaluate((danger) => {
          const bn = document.querySelector('[class*="bottom-nav" i], .ant-tabs.ant-tabs-bottom, nav[class*="bottom" i]')
                  || Array.from(document.querySelectorAll('nav, [role="navigation"]')).find((n) => { const r = n.getBoundingClientRect(); return r.bottom > window.innerHeight - 100; });
          if (!bn) return { found: false };
          const items = [];
          for (const el of bn.querySelectorAll('a, button, [role="button"]')) {
            const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
            const href = el.getAttribute('href') || '';
            const outer = (el.outerHTML || '').slice(0, 300);
            if (new RegExp(danger, 'i').test(outer)) continue;
            const r = el.getBoundingClientRect();
            items.push({ text: txt, href, tag: el.tagName, x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
          }
          return { found: true, items, html: bn.outerHTML.slice(0, 4000) };
        }, DANGER.source);
        if (navInfo.found) {
          w(path.join(base, 'bottom-nav.html'), navInfo.html);
          w(path.join(base, 'bottom-nav-items.json'), j(navInfo.items));
          await page.screenshot({ path: path.join(base, 'bottom-nav.png'), fullPage: false }).catch(() => {});
          rec.bottomNav = navInfo.items.length;

          // clica em cada item da bottom-nav (safe) e captura o resultado
          for (let i = 0; i < Math.min(navInfo.items.length, 6); i++) {
            const item = navInfo.items[i];
            const beforeBn = page.url();
            try {
              await page.mouse.click(item.x, item.y, { delay: 50 });
              await sleep(900);
              if (/\/login/.test(page.url())) { console.log(`  🚨 ${slug}: bnav[${i}] deslogou`); deslogou = true; break; }
              const after = page.url();
              const ov = await findOpenOverlay(page);
              const bnSlug = (item.text || `item-${i}`).replace(/\W+/g, '-').slice(0, 30);
              if (after !== beforeBn) {
                await page.screenshot({ path: path.join(base, `bnav-${i}-${bnSlug}.png`), fullPage: false }).catch(() => {});
                rec.actions.push({ name: `bnav-${i}`, clicked: item.text, navigatedTo: after });
                await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
                await sleep(500);
                await waitDataReady(page);
              } else if (ov) {
                const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
                w(path.join(base, `bnav-${i}-${bnSlug}.html`), html);
                await page.screenshot({ path: path.join(base, `bnav-${i}-${bnSlug}.png`), fullPage: false }).catch(() => {});
                rec.actions.push({ name: `bnav-${i}`, clicked: item.text, overlaySelector: ov, bytes: html.length });
                await page.keyboard.press('Escape').catch(() => {});
                await sleep(400);
              }
            } catch (e) {}
          }
        }
      }

      console.log(`  ${slug}: ${rec.actions.length} interações [${rec.actions.map((a) => a.name).join(',')}]`);
    } catch (e) { console.log('  ERR', slug, (e.message || '').slice(0, 60)); }
    idx.push(rec);
    w(OUT + '/_index.json', j(idx));
  }
  const totalActions = idx.reduce((a, r) => a + r.actions.length, 0);
  console.log(`\n=== DONE (${MODE}). ${idx.length} rotas · ${totalActions} interações capturadas${deslogou ? ' (⚠️ parou por logout)' : ''} ===`);
  await sleep(1500);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
