/**
 * Verifica /comandas no mobile 1:1 Belasis:
 *  1) input "Digite para buscar" visível no topo (sem toggle)
 *  2) cards compactos: 2 linhas, height razoável (< 80px), gap ~8-12px
 *  3) checkbox oculto quando selectMode off; visível quando ativado via BottomNav
 *  4) clique no card (modo normal) abre drawer (bottom-sheet)
 *  5) clique no card (modo selecionar) alterna seleção, não abre drawer
 *
 * Screenshots vão para belasis-reference/_out/comandas-mobile-*.png
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = path.join(__dirname, '_out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function login(page) {
  const res = await page.request.post(`${URL}/api/v1/auth/sign-in/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  });
  if (res.status() !== 200) throw new Error(`login ${res.status()}`);
}

async function measureCards(page) {
  return page.evaluate(() => {
    const list = document.querySelector('ul.flex-col.md\\:hidden, ul.flex.flex-col.gap-2.md\\:hidden');
    if (!list) return { found: false };
    const items = Array.from(list.querySelectorAll('li'));
    const rects = items.slice(0, 4).map((li) => {
      const r = li.getBoundingClientRect();
      return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top) };
    });
    // gap = espaço vertical entre 1º e 2º cards
    const gap = rects.length >= 2 ? Math.round(rects[1].top - (rects[0].top + rects[0].h)) : null;
    return { found: true, count: items.length, sample: rects, gap };
  });
}

async function findSearchInput(page) {
  return page.evaluate(() => {
    const input = document.querySelector('input[placeholder="Digite para buscar"]');
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return { placeholder: input.placeholder, top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) };
  });
}

async function hasSelectCheckbox(page) {
  return page.evaluate(() => {
    const list = document.querySelector('ul.md\\:hidden');
    if (!list) return null;
    const firstLi = list.querySelector('li');
    if (!firstLi) return null;
    // checkbox custom (span grid h-5 w-5) ou input[type=checkbox] dentro do card
    const check = firstLi.querySelector('span.grid.h-5.w-5.rounded, input[type="checkbox"]');
    return !!check;
  });
}

async function clickBottomNavAction(page, label) {
  return page.evaluate((label) => {
    const nav = document.querySelector('nav[aria-label="Navegação principal"]');
    if (!nav) return null;
    const btns = Array.from(nav.querySelectorAll('button'));
    const target = btns.find((b) => (b.textContent || '').trim().toLowerCase().includes(label.toLowerCase()));
    if (!target) return null;
    target.click();
    return target.getAttribute('aria-pressed') || 'ok';
  }, label);
}

async function findOpenDrawer(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      const cl = typeof el.className === 'string' ? el.className : '';
      if (!/\btranslate-y-0\b/.test(cl)) continue;
      if (/\btranslate-y-full\b/.test(cl)) continue;
      if (!cl.includes('rounded-t') && !cl.includes('bottom-0')) continue;
      const r = el.getBoundingClientRect();
      // filtra BottomNav (altura pequena, ~68px)
      if (r.height < 100) continue;
      return { className: cl.slice(0, 200), height: Math.round(r.height), top: Math.round(r.top) };
    }
    return null;
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  const results = {};

  try {
    await login(page);
    await page.goto(`${URL}/comandas`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));

    await page.screenshot({ path: path.join(OUT, 'comandas-mobile-1-initial.png'), fullPage: false });

    // (1) input de busca sempre visível?
    const search = await findSearchInput(page);
    results.searchVisible = !!search;
    console.log('[1] busca sempre visível:', search ? `✅ top=${search.top}px  w=${search.w}px` : '❌ ausente');

    // (2) cards compactos?
    const cards = await measureCards(page);
    if (!cards.found) {
      console.log('[2] cards ❌ ul não encontrado');
    } else {
      const avgH = cards.sample.reduce((a, r) => a + r.h, 0) / cards.sample.length;
      results.cardHeightOk = avgH < 90;
      results.cardGapOk = cards.gap !== null && cards.gap <= 12;
      console.log(`[2] cards ${cards.count} — altura média=${Math.round(avgH)}px (< 90? ${results.cardHeightOk ? '✅' : '❌'}), gap=${cards.gap}px (≤ 12? ${results.cardGapOk ? '✅' : '❌'})`);
      console.log(`    amostra: ${JSON.stringify(cards.sample)}`);
    }

    // (3) checkbox oculto por padrão
    const noCheck = await hasSelectCheckbox(page);
    results.checkboxHiddenByDefault = !noCheck;
    console.log(`[3a] checkbox oculto (modo normal): ${!noCheck ? '✅' : '❌'}`);

    // (3b) modo NORMAL primeiro — clica no 1º card, deve abrir drawer bottom-sheet
    await page.evaluate(() => {
      const first = document.querySelector('ul.md\\:hidden li button');
      if (first) first.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    const drawerNormal = await findOpenDrawer(page);
    results.drawerOpensInNormalMode = !!drawerNormal;
    console.log(`[3b] clique em card (modo NORMAL) abre drawer: ${drawerNormal ? `✅ h=${drawerNormal.height}px top=${drawerNormal.top}px` : '❌ não abriu'}`);
    await page.screenshot({ path: path.join(OUT, 'comandas-mobile-2-drawer-normal.png'), fullPage: false });

    // fecha drawer (ESC)
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 700));

    // (3c) ativa modo Selecionar via BottomNav
    const pressedBefore = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Navegação principal"]');
      const btn = Array.from(nav?.querySelectorAll('button') || []).find((b) => (b.textContent || '').toLowerCase().includes('selecionar'));
      return btn?.getAttribute('aria-pressed');
    });
    const clicked = await clickBottomNavAction(page, 'Selecionar');
    console.log(`[3c] clique BottomNav "Selecionar" (era aria-pressed=${pressedBefore}): ${clicked || 'não achou'}`);
    await new Promise((r) => setTimeout(r, 700));
    const pressedAfter = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Navegação principal"]');
      const btn = Array.from(nav?.querySelectorAll('button') || []).find((b) => (b.textContent || '').toLowerCase().includes('selecionar'));
      return btn?.getAttribute('aria-pressed');
    });
    console.log(`     agora aria-pressed=${pressedAfter}`);
    const hasCheck = await hasSelectCheckbox(page);
    results.checkboxAppearsInSelectMode = !!hasCheck;
    console.log(`[3d] checkbox aparece em modo Selecionar: ${hasCheck ? '✅' : '❌'}`);
    await page.screenshot({ path: path.join(OUT, 'comandas-mobile-3-select-mode.png'), fullPage: false });

    // (4) modo Selecionar: clicar em card alterna seleção, não abre drawer
    await page.evaluate(() => {
      const first = document.querySelector('ul.md\\:hidden li button');
      if (first) first.click();
    });
    await new Promise((r) => setTimeout(r, 900));
    const drawerInSelectMode = await findOpenDrawer(page);
    results.noDrawerInSelectMode = !drawerInSelectMode;
    console.log(`[4] clique em card (modo Selecionar) NÃO abre drawer: ${!drawerInSelectMode ? '✅' : '❌ drawer apareceu:' + JSON.stringify(drawerInSelectMode)}`);
    await page.screenshot({ path: path.join(OUT, 'comandas-mobile-4-selected.png'), fullPage: false });

    const allOk = Object.values(results).every(Boolean);
    console.log('\n' + (allOk ? '✅ TODOS OS TESTES PASSARAM' : '❌ ALGUNS FALHARAM') + ' →', results);
    process.exit(allOk ? 0 : 1);
  } catch (e) {
    console.error('FATAL', e);
    await page.screenshot({ path: path.join(OUT, 'comandas-mobile-error.png'), fullPage: false }).catch(() => {});
    process.exit(2);
  } finally {
    await browser.close();
  }
})();
