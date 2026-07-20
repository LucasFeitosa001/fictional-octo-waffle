/*
 * CAPTURA PIXEL-PERFECT do Belasis — todas as AÇÕES, todos os overlays, todas as animações.
 * Playwright HEADED + profile persistente. Você loga UMA vez; o script:
 *
 *   Para cada VIEWPORT (desktop 1440x900 e mobile 390x844):
 *     Para cada ROTA (14 telas):
 *       1. Página base (HTML + PNG + JSON de CSS-computed de containers-chave).
 *       2. Sidebar (expandida e colapsada).
 *       3. Bottom-nav mobile (viewport mobile).
 *       4. Botão "Novo/Criar" → drawer/modal
 *            - DUMPS: html, png, animação (3 frames: 0/mid/end), computed CSS (transition/transform/opacity).
 *            - Dentro: cada picker (select/autocomplete/date/cascader) → clica → 3-frame do overlay + html + computed CSS.
 *            - Dentro: cada tab do drawer → clica → dumpa o painel.
 *      5. Menu de 3 pontinhos (…) das linhas da tabela → captura popup.
 *      6. Clique em EDITAR e EXCLUIR → captura modal de confirmação (in/out frames).
 *      7. Hover states em botões e linhas de tabela.
 *
 * Saída: belasis-reference/pixel/<viewport>/<rota>/<action>/{html,png,anim,css.json}
 *
 * Uso:  node belasis-reference/capture-pixel-perfect.js
 * WSLg necessário (DISPLAY=:0).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile';
const OUT = REF + '/pixel';
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = [
  { slug: 'calendar', route: '/calendar', newTriggers: ['Novo', 'Novo agendamento', 'Criar', '+'] },
  { slug: 'sales', route: '/sales', newTriggers: ['Novo', 'Nova comanda', '+'] },
  { slug: 'clients', route: '/clients', newTriggers: ['Novo', 'Novo cliente', '+'] },
  { slug: 'employees', route: '/employees', newTriggers: ['Novo', 'Novo profissional', '+'] },
  { slug: 'products', route: '/products', newTriggers: ['Novo', 'Novo produto', '+'] },
  { slug: 'services', route: '/services', newTriggers: ['Novo', 'Novo serviço', '+'] },
  { slug: 'packages', route: '/packages', newTriggers: ['Novo', 'Novo pacote', '+'] },
  { slug: 'subscriptions', route: '/subscriptions', newTriggers: ['Novo', 'Nova venda', '+'] },
  { slug: 'vendors', route: '/vendors', newTriggers: ['Novo', 'Novo fornecedor', '+'] },
  { slug: 'brands', route: '/brands', newTriggers: ['Novo', 'Nova marca', '+'] },
  { slug: 'finance-transactions', route: '/finance/transactions', newTriggers: ['Novo', 'Novo recebimento', 'Nova despesa', '+'] },
  { slug: 'finance-accounts', route: '/finance/accounts', newTriggers: ['Novo', 'Nova conta', 'Nova categoria', 'Nova forma', '+'] },
  { slug: 'purchases', route: '/purchases', newTriggers: ['Novo', 'Nova compra', '+'] },
  { slug: 'package-templates', route: '/package-templates', newTriggers: ['Novo', '+'] },
];

const VIEWPORTS = [
  { name: 'desktop', size: { width: 1440, height: 900 } },
  { name: 'mobile',  size: { width: 390,  height: 844 } },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
const j = (obj) => JSON.stringify(obj, null, 2);
const w = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };

async function waitForContent(page) {
  await page.waitForFunction(() => {
    if (document.querySelector('.ant-skeleton-active')) return false;
    return !!document.querySelector('.ant-btn, button, .ant-picker, .ant-table, .ant-card, .ant-tabs, .recharts-surface, .ant-drawer, .ant-modal');
  }, { timeout: 20000 }).catch(() => {});
  await sleep(700);
}

async function killOverlays(page) {
  await page.evaluate(() => {
    const hdr = document.getElementById('navbar-main-menu');
    if (hdr && /assinatura vence/i.test(hdr.textContent || '')) hdr.remove();
    for (const el of document.querySelectorAll('.ant-notification, .ant-notification-notice-wrapper')) el.remove();
    for (const f of document.querySelectorAll('iframe')) { if (/inmoment|survey|wootric|tawk|crisp/i.test(f.src || '')) f.remove(); }
  }).catch(() => {});
}

// Extrai computed CSS de containers-chave (drawer/modal/overlays/animados).
async function extractComputedCSS(page, root = 'body') {
  return page.evaluate((rootSel) => {
    const KEYS = ['transition','transitionProperty','transitionDuration','transitionTimingFunction','transitionDelay',
      'animation','animationDuration','animationTimingFunction','animationDelay',
      'transform','transformOrigin','opacity','backdropFilter','filter',
      'backgroundColor','color','borderColor','borderRadius','boxShadow',
      'width','height','minWidth','maxWidth','padding','margin','fontSize','fontWeight','fontFamily','lineHeight',
      'position','top','right','bottom','left','zIndex','display','flexDirection','gap','alignItems','justifyContent'];
    const SELECTORS = [
      '.ant-drawer', '.ant-drawer-mask', '.ant-drawer-content-wrapper', '.ant-drawer-content', '.ant-drawer-header', '.ant-drawer-body', '.ant-drawer-footer',
      '.ant-modal-mask', '.ant-modal-wrap', '.ant-modal', '.ant-modal-content', '.ant-modal-header', '.ant-modal-body', '.ant-modal-footer',
      '.ant-select-dropdown', '.ant-picker-dropdown', '.ant-cascader-dropdown', '.ant-popover',
      '.ant-btn-primary', '.ant-btn-dangerous', '.ant-btn-default',
      '.ant-table-thead', '.ant-table-tbody > tr', '.ant-table-cell',
      '.ant-tabs-nav', '.ant-tabs-tab', '.ant-tabs-tab-active',
      '.ant-form-item-label > label', '.ant-input', '.ant-select-selector', '.ant-switch',
      '.ant-badge', '.ant-tag',
    ];
    const rootEl = document.querySelector(rootSel);
    if (!rootEl) return {};
    const out = {};
    for (const sel of SELECTORS) {
      const el = rootEl.querySelector(sel);
      if (!el) continue;
      const cs = getComputedStyle(el);
      const rec = {};
      for (const k of KEYS) rec[k] = cs[k];
      const rect = el.getBoundingClientRect();
      rec.__rect = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) };
      out[sel] = rec;
    }
    return out;
  }, root);
}

// Captura 3-frame de animação: dispara ação (clicar em algo), tira PNGs em t=0/60/240ms.
async function animate3(page, doAction, baseFile) {
  const frames = [0, 60, 240];
  const started = Date.now();
  // Dispara ação sem awaitar (queremos os frames enquanto anima).
  const actionP = Promise.resolve().then(doAction).catch(() => {});
  for (const t of frames) {
    const wait = Math.max(0, t - (Date.now() - started));
    if (wait) await sleep(wait);
    await page.screenshot({ path: `${baseFile}-${String(t).padStart(3, '0')}ms.png`, fullPage: false }).catch(() => {});
  }
  await actionP;
}

async function dumpHtml(page, sel, file) {
  const html = sel === 'body'
    ? await page.evaluate(() => document.body ? document.body.outerHTML : '').catch(() => '')
    : await page.evaluate((s) => { const el = document.querySelector(s); return el ? el.outerHTML : ''; }, sel).catch(() => '');
  if (html) w(file, html);
  return html.length;
}

// Encontra o painel aberto no topo (drawer > modal), retorna selector.
async function findOpenPanel(page) {
  const sels = [
    '.ant-drawer-open .ant-drawer-content-wrapper',
    '.ant-modal-root .ant-modal-content',
    '.ant-drawer .ant-drawer-content',
    '.ant-modal .ant-modal-content',
  ];
  for (const s of sels) if (await page.$(s)) return s;
  return null;
}

async function findOverlay(page) {
  const sels = [
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
    '.ant-cascader-dropdown:not(.ant-cascader-dropdown-hidden)',
    '.ant-popover:not(.ant-popover-hidden)',
    '.ant-dropdown:not(.ant-dropdown-hidden)',
    '.ant-drawer.ant-drawer-bottom.ant-drawer-open .ant-drawer-content',
  ];
  for (const s of sels) if (await page.$(s)) return s;
  return null;
}

// Robust click: tenta button, a, li, div, span com esse texto. Preferindo o MAIOR ancestral clicável.
async function clickByText(page, texts) {
  for (const t of texts) {
    // Ordem de tags a testar (do mais provável ao menos)
    for (const tag of ['button', 'a', 'li', '*[role="button"]', '*[class*="dropdown-trigger"]', 'div', 'span']) {
      const q = `xpath=(//${tag}[contains(normalize-space(.), "${t}") and not(descendant::*[contains(normalize-space(.), "${t}") and self::${tag}])])[1]`;
      const el = page.locator(q);
      if (await el.count().catch(() => 0)) {
        try { await el.first().scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {}); await el.first().click({ timeout: 3000, force: true }); return t; } catch (e) {}
      }
    }
  }
  return null;
}

// Botão "Novo" do Belasis: `<button class="ant-btn ant-btn-primary ant-btn-variant-solid">Novo</button>`
// (não usa `ant-layout-sider`; o botão pode estar no sidebar OU no topbar da tela).
async function clickSidebarNew(page) {
  return await page.evaluate(() => {
    // Coleta CANDIDATOS: qualquer button/a/[role=button] cujo texto DIRETO comece com "Novo"
    const cands = [];
    for (const el of document.querySelectorAll('button, a, [role="button"], .ant-dropdown-trigger')) {
      const clone = el.cloneNode(true);
      // remove sub-menus/dropdowns que já estejam renderizados dentro
      clone.querySelectorAll('ul, li, .ant-menu, .ant-dropdown, .ant-menu-submenu, .ant-menu-submenu-popup').forEach((n) => n.remove());
      const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^Novo\b/i.test(text) && text.length < 30) cands.push({ el, text, cls: el.className || '' });
    }
    if (!cands.length) return null;
    // PRIORIDADE: ant-btn-primary (solid) > variant-solid > ant-btn-block > outline/outros
    const rank = (c) => {
      let r = 0;
      if (/ant-btn-primary/.test(c.cls)) r += 10;
      if (/variant-solid/.test(c.cls)) r += 8;
      if (/ant-btn-block/.test(c.cls)) r += 5;
      if (/dropdown-trigger/.test(c.cls)) r += 3;
      if (/variant-outlined/.test(c.cls)) r -= 4; // notificações costumam ser outlined
      return r;
    };
    cands.sort((a, b) => rank(b) - rank(a));
    const pick = cands[0];
    pick.el.scrollIntoView({ block: 'center' });
    pick.el.click();
    return `${pick.el.tagName}[rank=${rank(pick)}].${pick.cls.slice(0, 90)} · text="${pick.text}"`;
  }).catch(() => null);
}

async function pressEsc(page) { await page.keyboard.press('Escape').catch(() => {}); await sleep(350); }

// Enumera pickers dentro de um painel.
async function findPickers(page, panelSel) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel); if (!root) return [];
    const kinds = ['.ant-select-selector', '.ant-picker:not(.ant-picker-range) input', '.ant-picker-range', '.ant-cascader-picker', 'input[readonly]:not([disabled])'];
    const seen = new Set(); const out = [];
    for (const k of kinds) {
      for (const el of root.querySelectorAll(k)) {
        const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 18) continue;
        const label = (el.closest('.ant-form-item') && el.closest('.ant-form-item').querySelector('label')) || null;
        const text = ((label ? label.textContent : (el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.textContent || '')) || '').trim();
        const key = `${k}|${text}`; if (seen.has(key)) continue; seen.add(key);
        out.push({ kind: k, text: text.slice(0, 80) });
      }
    }
    return out;
  }, panelSel);
}

async function clickNthPicker(page, panelSel, i) {
  return page.evaluate(({ s, idx }) => {
    const root = document.querySelector(s); if (!root) return false;
    const kinds = ['.ant-select-selector', '.ant-picker:not(.ant-picker-range) input', '.ant-picker-range', '.ant-cascader-picker', 'input[readonly]:not([disabled])'];
    const seen = new Set(); const list = [];
    for (const k of kinds) for (const el of root.querySelectorAll(k)) {
      const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 18) continue;
      const label = (el.closest('.ant-form-item') && el.closest('.ant-form-item').querySelector('label')) || null;
      const text = ((label ? label.textContent : (el.getAttribute('placeholder') || el.textContent || '')) || '').trim();
      const key = `${k}|${text}`; if (seen.has(key)) continue; seen.add(key);
      list.push(el);
    }
    const el = list[idx]; if (!el) return false;
    el.scrollIntoView({ block: 'center' }); el.click(); return true;
  }, { s: panelSel, idx: i });
}

async function findTabsInPanel(page, panelSel) {
  return page.evaluate((s) => {
    const root = document.querySelector(s); if (!root) return [];
    const tabs = root.querySelectorAll('.ant-tabs-tab');
    return Array.from(tabs).map((t) => (t.textContent || '').trim().slice(0, 40));
  }, panelSel);
}
async function clickNthTab(page, panelSel, i) {
  return page.evaluate(({ s, idx }) => {
    const root = document.querySelector(s); if (!root) return false;
    const t = root.querySelectorAll('.ant-tabs-tab')[idx]; if (!t) return false;
    t.scrollIntoView({ block: 'center' }); t.click(); return true;
  }, { s: panelSel, idx: i });
}

// Captura o SIDEBAR (expandido + colapsado) + BOTTOM-NAV
async function captureChrome(page, dir, viewport) {
  try {
    // sidebar expandida
    await dumpHtml(page, '.side-menu, .ant-layout-sider, [class*=sidebar], [class*=SideMenu]', path.join(dir, 'sidebar-expanded.html'));
    await page.screenshot({ path: path.join(dir, 'sidebar-expanded.png'), fullPage: false }).catch(() => {});
    // clica no botão colapsar (varia)
    const collapsed = await page.evaluate(() => {
      const btn = document.querySelector('.ant-layout-sider-trigger, [class*=collapse], [aria-label*="olapsar"], [aria-label*="ollapse"]');
      if (btn) { btn.click(); return true; } return false;
    }).catch(() => false);
    if (collapsed) {
      await sleep(500);
      await dumpHtml(page, '.side-menu, .ant-layout-sider, [class*=sidebar]', path.join(dir, 'sidebar-collapsed.html'));
      await page.screenshot({ path: path.join(dir, 'sidebar-collapsed.png'), fullPage: false }).catch(() => {});
      // volta ao normal
      await page.evaluate(() => {
        const btn = document.querySelector('.ant-layout-sider-trigger, [class*=collapse], [aria-label*="xpandir"]');
        if (btn) btn.click();
      }).catch(() => {});
      await sleep(500);
    }
    if (viewport === 'mobile') {
      await dumpHtml(page, '.bottom-nav, [class*=bottom-nav], [class*=BottomNav], .ant-tabs.ant-tabs-bottom', path.join(dir, 'bottom-nav.html'));
      await page.screenshot({ path: path.join(dir, 'bottom-nav.png'), fullPage: false }).catch(() => {});
    }
  } catch (e) {}
}

// Captura menu (3 pontinhos) da 1ª linha da tabela.
async function captureRowMenu(page, dir) {
  try {
    const opened = await page.evaluate(() => {
      const row = document.querySelector('.ant-table-tbody > tr, tbody > tr'); if (!row) return false;
      const btn = row.querySelector('.ant-dropdown-trigger, .anticon-more, [class*=more], button svg')
                || row.querySelector('button:last-child');
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center' });
      const rect = btn.getBoundingClientRect();
      const evt = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: rect.x + rect.width/2, clientY: rect.y + rect.height/2 });
      btn.dispatchEvent(evt);
      return true;
    }).catch(() => false);
    if (!opened) return;
    await sleep(500);
    const ov = await findOverlay(page);
    if (ov) {
      const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
      w(path.join(dir, 'row-menu.html'), html);
      await page.screenshot({ path: path.join(dir, 'row-menu.png'), fullPage: false }).catch(() => {});
    }
    await pressEsc(page);
  } catch (e) {}
}

// Captura o fluxo FATURADOS: em rotas de tabela (sales/calendar), clica no 1º item pra ver
// o drawer de detalhe + captura TODOS os botões/menus disponíveis (pra entender "Faturar").
async function captureFaturadoFlow(page, dir, R) {
  if (!['sales', 'calendar', 'packages', 'subscriptions'].includes(R.slug)) return;
  try {
    const clicked = await page.evaluate(() => {
      const row = document.querySelector('.ant-table-tbody > tr, tbody > tr, .fc-event, [class*="calendar-event"]');
      if (!row) return false;
      row.scrollIntoView({ block: 'center' });
      row.click();
      return true;
    }).catch(() => false);
    if (!clicked) return;
    await sleep(900);
    const panel = await findOpenPanel(page);
    if (!panel) return;
    // Dumpa detalhe completo + PNG
    await dumpHtml(page, 'body', path.join(dir, 'detail-open.html'));
    await dumpHtml(page, panel, path.join(dir, 'detail-panel-only.html'));
    await page.screenshot({ path: path.join(dir, 'detail-open.png'), fullPage: false }).catch(() => {});
    w(path.join(dir, 'detail-open.css.json'), j(await extractComputedCSS(page)));

    // Lista TODOS os botões/dropdowns dentro do detalhe — foco em Faturar/Finalizar/Confirmar/Ver pagamentos/Excluir
    const actions = await page.evaluate((sel) => {
      const root = document.querySelector(sel); if (!root) return [];
      const out = [];
      for (const el of root.querySelectorAll('button, a, [role="button"], [class*="dropdown-trigger"]')) {
        const t = (el.textContent || '').trim().slice(0, 60);
        if (!t) continue;
        const r = el.getBoundingClientRect();
        out.push({ text: t, tag: el.tagName, class: (el.className || '').slice(0, 100), rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } });
      }
      return out;
    }, panel).catch(() => []);
    w(path.join(dir, 'detail-actions.json'), j(actions));

    // Se algum menu de ações existir (3-pontos ou "Mais"), abre e captura
    const menuClicked = await page.evaluate((sel) => {
      const root = document.querySelector(sel); if (!root) return null;
      for (const el of root.querySelectorAll('button, [role="button"]')) {
        const t = (el.textContent || '').trim();
        if (/^(Mais|Ações|Outros|Opções|Menu|\.\.\.|⋯)$/i.test(t) || el.className.includes('more')) {
          el.click(); return t || 'mais';
        }
      }
      return null;
    }, panel).catch(() => null);
    if (menuClicked) {
      await sleep(500);
      const ov = await findOverlay(page);
      if (ov) {
        const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
        w(path.join(dir, 'detail-actions-menu.html'), html);
        await page.screenshot({ path: path.join(dir, 'detail-actions-menu.png'), fullPage: false }).catch(() => {});
      }
      await pressEsc(page);
    }
    await pressEsc(page); // fecha o drawer de detalhe
  } catch (e) {}
}

// Captura modal de confirmação de EXCLUSÃO clicando em "Excluir" no menu da linha (se abriu).
async function captureDeleteConfirm(page, dir) {
  try {
    const opened = await page.evaluate(() => {
      const row = document.querySelector('.ant-table-tbody > tr, tbody > tr'); if (!row) return false;
      const btn = row.querySelector('.ant-dropdown-trigger, .anticon-more, [class*=more]') || row.querySelector('button:last-child');
      if (btn) { btn.click(); return true; } return false;
    }).catch(() => false);
    if (!opened) return;
    await sleep(500);
    // clica em "Excluir" no menu dropdown
    const clicked = await page.evaluate(() => {
      const items = document.querySelectorAll('.ant-dropdown-menu-item, .ant-menu-item, [role="menuitem"], li');
      for (const it of items) if (/excluir|remover|delete/i.test((it.textContent || '').trim())) { it.click(); return true; }
      return false;
    }).catch(() => false);
    if (!clicked) { await pressEsc(page); return; }
    await sleep(400);
    // deve ter aparecido um popconfirm/modal
    const pop = await page.$('.ant-popover:not(.ant-popover-hidden), .ant-modal-content, .ant-popconfirm');
    if (pop) {
      const html = await page.evaluate(() => (document.querySelector('.ant-popover:not(.ant-popover-hidden), .ant-modal-root, .ant-popconfirm')?.outerHTML || ''));
      w(path.join(dir, 'delete-confirm.html'), html);
      await page.screenshot({ path: path.join(dir, 'delete-confirm.png'), fullPage: false }).catch(() => {});
      const css = await extractComputedCSS(page);
      w(path.join(dir, 'delete-confirm.css.json'), j(css));
    }
    await pressEsc(page); await pressEsc(page);
  } catch (e) {}
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, viewport: null,
    args: ['--no-sandbox', '--start-maximized'],
    locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  await page.goto('https://belasis.app/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('\n>>> FAÇA O LOGIN na janela do Chrome. Detecto e sigo. <<<\n');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const u = page.url();
    if (/belasis\.app\/[a-z]/i.test(u) && !/\/login/.test(u)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 5 === 0) console.log('  ...aguardando login (', u, ')');
  }
  if (!authed) { console.log('TIMEOUT login'); await ctx.close(); process.exit(3); }
  console.log('LOGIN OK. Capturando tokens de sessão...');

  // Belasis coloca o token em sessionStorage/localStorage — vamos preservar entre gotos
  const authSnap = await page.evaluate(() => ({
    session: Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)).map((k) => [k, sessionStorage.getItem(k)])),
    local:   Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)])),
  })).catch(() => ({ session: {}, local: {} }));
  console.log(`  sessionStorage: ${Object.keys(authSnap.session).length} chaves · localStorage: ${Object.keys(authSnap.local).length} chaves`);
  fs.writeFileSync(OUT + '/_auth-snap.json', j(authSnap));

  // Injeta em CADA navegação — antes de qualquer script da página rodar
  await ctx.addInitScript((snap) => {
    try {
      for (const [k, v] of Object.entries(snap.session || {})) sessionStorage.setItem(k, v);
      for (const [k, v] of Object.entries(snap.local || {})) localStorage.setItem(k, v);
    } catch (e) {}
  }, authSnap);

  console.log('Iniciando captura pixel-perfect...\n');

  const idx = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp.size);
    console.log(`\n═══ VIEWPORT ${vp.name} (${vp.size.width}×${vp.size.height}) ═══`);
    for (const R of ROUTES) {
      const base = path.join(OUT, vp.name, R.slug);
      fs.mkdirSync(base, { recursive: true });
      const rec = { slug: R.slug, viewport: vp.name, route: R.route, pickers: [], tabs: [], captured: [] };
      try {
        await page.goto('https://belasis.app' + R.route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
        if (/\/login/.test(page.url())) { console.log('  deslogou em', R.route); break; }
        await waitForContent(page); await killOverlays(page);

        // 1. Página base
        await dumpHtml(page, 'body', path.join(base, 'page.html'));
        await page.screenshot({ path: path.join(base, 'page.png'), fullPage: true }).catch(() => {});
        w(path.join(base, 'page.css.json'), j(await extractComputedCSS(page)));
        rec.captured.push('page');

        // 2. Chrome (sidebar / bottom-nav)
        await captureChrome(page, base, vp.name); rec.captured.push('chrome');

        // 3. Menu de linha (3 pontos) — apenas se houver tabela
        await captureRowMenu(page, base); rec.captured.push('rowMenu?');

        // 4. Modal de confirmação de exclusão (in/out frames)
        await captureDeleteConfirm(page, base); rec.captured.push('deleteConfirm?');

        // 4b. FLUXO FATURADOS: clica na 1ª linha pra ver detalhe + ações disponíveis (Faturar/Finalizar/etc)
        await captureFaturadoFlow(page, base, R); rec.captured.push('faturadoFlow?');

        // 5. Botão "Novo" — o Belasis tem "Novo +" no SIDEBAR (desktop) que abre um menu
        //    "Agendamento/Comanda/Cliente/…". Clicar num item abre o drawer/modal.
        //    Em mobile, o botão vive na BottomNav (procura ali primeiro).
        let openedFrom = null;
        if (vp.name === 'mobile') {
          const clickedBottom = await page.evaluate(() => {
            const bn = document.querySelector('.bottom-nav, [class*="bottom-nav"], .ant-tabs.ant-tabs-bottom, [role="navigation"][class*="bottom"]');
            if (!bn) return null;
            const plus = Array.from(bn.querySelectorAll('*')).find((el) => /^(\+|Novo|Criar)$/.test((el.textContent || '').trim())) || bn.querySelector('button');
            if (plus) { plus.click(); return plus.tagName + '.' + (plus.className||'').slice(0,50); }
            return null;
          }).catch(() => null);
          openedFrom = clickedBottom;
        }
        if (!openedFrom) openedFrom = await clickSidebarNew(page);
        if (!openedFrom) openedFrom = await clickByText(page, R.newTriggers);
        if (!openedFrom) { console.log(`  ${R.slug}[${vp.name}]: sem gatilho "Novo"`); idx.push(rec); continue; }
        rec.newTrigger = openedFrom;
        for (const dt of [0, 60, 240]) {
          await page.screenshot({ path: path.join(base, `new-in-${String(dt).padStart(3,'0')}ms.png`), fullPage: false }).catch(() => {});
          await sleep(dt === 0 ? 60 : dt === 60 ? 180 : 0);
        }
        await sleep(400);

        // 5a. Se o clique abriu um MENU/DROPDOWN (não um drawer direto), captura o menu e clica no item da rota
        let panel = await findOpenPanel(page);
        if (!panel) {
          // pode ter surgido um dropdown/menu — dumpa e escolhe o item conforme rota
          const menu = await page.$('.ant-dropdown:not(.ant-dropdown-hidden), .ant-menu-submenu-popup:not(.ant-menu-hidden), .ant-popover:not(.ant-popover-hidden)');
          if (menu) {
            const menuSel = '.ant-dropdown:not(.ant-dropdown-hidden), .ant-menu-submenu-popup:not(.ant-menu-hidden), .ant-popover:not(.ant-popover-hidden)';
            const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', menuSel);
            w(path.join(base, 'new-menu.html'), html);
            await page.screenshot({ path: path.join(base, 'new-menu.png'), fullPage: false }).catch(() => {});
            // clica no item de menu associado à rota (Agendamento/Comanda/Cliente/…)
            const itemTexts = {
              calendar: ['Agendamento'], sales: ['Comanda', 'Nova comanda'], clients: ['Cliente'],
              employees: ['Profissional'], products: ['Produto'], services: ['Serviço'], packages: ['Pacote'],
              subscriptions: ['Assinatura', 'Venda'], vendors: ['Fornecedor'], brands: ['Marca'],
              'finance-transactions': ['Recebimento', 'Despesa', 'Transação'], 'finance-accounts': ['Conta'],
              purchases: ['Compra'], 'package-templates': ['Pacote Predefinido', 'Pacote'],
            }[R.slug] || ['Novo'];
            const clickedItem = await page.evaluate(({ sel, opts }) => {
              const root = document.querySelector(sel); if (!root) return null;
              for (const t of opts) {
                for (const it of root.querySelectorAll('li, a, .ant-dropdown-menu-item, [role="menuitem"]')) {
                  if (new RegExp(`\\b${t}\\b`, 'i').test((it.textContent || '').trim())) { it.click(); return t; }
                }
              }
              return null;
            }, { sel: menuSel, opts: itemTexts }).catch(() => null);
            rec.newMenuItem = clickedItem;
            await sleep(500);
            panel = await findOpenPanel(page);
          }
        }
        if (!panel) { console.log(`  ${R.slug}[${vp.name}]: "Novo" clicou (${openedFrom}), painel não apareceu`); idx.push(rec); continue; }

        // dump completo do drawer/modal
        await dumpHtml(page, 'body', path.join(base, 'new-open.html'));
        await dumpHtml(page, panel, path.join(base, 'new-panel-only.html'));
        await page.screenshot({ path: path.join(base, 'new-open.png'), fullPage: false }).catch(() => {});
        w(path.join(base, 'new-open.css.json'), j(await extractComputedCSS(page)));
        rec.captured.push('newOpen');

        // 6. Pickers dentro do drawer — cada select/date/autocomplete → overlay
        const pickers = await findPickers(page, panel);
        console.log(`  ${R.slug}[${vp.name}]: drawer aberto, ${pickers.length} pickers`);
        for (let i = 0; i < pickers.length; i++) {
          const p = pickers[i]; const slug = slugify(p.text || `picker-${i}`);
          const pdir = path.join(base, 'pickers', `${String(i + 1).padStart(2, '0')}-${slug}`);
          fs.mkdirSync(pdir, { recursive: true });
          try {
            // 3-frame da animação do popup: clicar + shots em t=0/60/240
            const started = Date.now();
            const clickP = clickNthPicker(page, panel, i).catch(() => false);
            for (const dt of [0, 60, 240]) {
              const wait = Math.max(0, dt - (Date.now() - started)); if (wait) await sleep(wait);
              await page.screenshot({ path: path.join(pdir, `open-${String(dt).padStart(3,'0')}ms.png`), fullPage: false }).catch(() => {});
            }
            await clickP; await sleep(300);
            const ov = await findOverlay(page);
            if (ov) {
              const html = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', ov);
              w(path.join(pdir, 'overlay.html'), html);
              await page.screenshot({ path: path.join(pdir, 'overlay.png'), fullPage: false }).catch(() => {});
              w(path.join(pdir, 'css.json'), j(await extractComputedCSS(page)));
              rec.pickers.push({ index: i, label: p.text, kind: p.kind, overlaySelector: ov, bytes: html.length });
              console.log(`    ${String(i+1).padStart(2,'0')} "${p.text}" → ${html.length}b`);
            } else {
              console.log(`    ${String(i+1).padStart(2,'0')} "${p.text}" — sem overlay`);
            }
            await pressEsc(page);
          } catch (e) { console.log(`    ${i} erro ${(e.message || '').slice(0, 50)}`); }
        }

        // 7. Tabs dentro do drawer (menu interno)
        const tabs = await findTabsInPanel(page, panel);
        if (tabs.length > 1) {
          console.log(`  ${R.slug}[${vp.name}]: ${tabs.length} tabs no drawer`);
          for (let i = 0; i < tabs.length; i++) {
            const label = tabs[i]; const slug = slugify(label || `tab-${i}`);
            try {
              await clickNthTab(page, panel, i); await sleep(500);
              const tdir = path.join(base, 'tabs', `${String(i + 1).padStart(2, '0')}-${slug}`);
              fs.mkdirSync(tdir, { recursive: true });
              await dumpHtml(page, panel, path.join(tdir, 'panel.html'));
              await page.screenshot({ path: path.join(tdir, 'panel.png'), fullPage: false }).catch(() => {});
              rec.tabs.push({ index: i, label });
            } catch (e) {}
          }
        }

        // 8. Fechar drawer (3-frame OUT anim)
        const startedOut = Date.now();
        const closeP = pressEsc(page);
        for (const dt of [0, 60, 240]) {
          const wait = Math.max(0, dt - (Date.now() - startedOut)); if (wait) await sleep(wait);
          await page.screenshot({ path: path.join(base, `new-out-${String(dt).padStart(3,'0')}ms.png`), fullPage: false }).catch(() => {});
        }
        await closeP;

      } catch (e) { console.log('  ERR', R.slug, (e.message || '').slice(0, 60)); }
      idx.push(rec);
      w(OUT + '/_index.json', j(idx));
    }
  }
  console.log('\n═══ DONE. capturas em belasis-reference/pixel/ ═══');
  await sleep(2000);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
