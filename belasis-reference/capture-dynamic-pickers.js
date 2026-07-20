/*
 * Captura DINÂMICA pixel-perfect dos pickers/drawers/dropdowns do Belasis.
 * Usa Playwright HEADED + profile persistente. Você loga UMA vez; o script:
 *   1. Navega em cada rota alvo.
 *   2. Clica em "Novo/Adicionar" pra abrir o drawer.
 *   3. Dumpa o drawer + screenshot.
 *   4. Dentro do drawer, encontra TODOS os selects/autocompletes/date-pickers,
 *      clica em cada um pra abrir o popup/bottom-sheet, dumpa o overlay + screenshot,
 *      fecha (Esc) e vai pro próximo.
 *   5. Roda em VIEWPORT DESKTOP (1920×1080) E MOBILE (390×844) — as duas versões.
 * Saída: belasis-reference/pickers/<rota>/<viewport>/<action-slug>.html + .png
 *
 * Uso:  node belasis-reference/capture-dynamic-pickers.js
 * OBS:  requer WSLg (DISPLAY=:0). Se sessão expirar, faz login manual quando pedir.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile';
const OUT = REF + '/pickers';
fs.mkdirSync(OUT, { recursive: true });

// Rotas onde queremos capturar novo/editar/pickers dinâmicos
const ROUTES = [
  { slug: 'calendar', route: '/calendar', newTriggers: ['Novo', 'Novo agendamento', 'Criar', '+'] },
  { slug: 'sales', route: '/sales', newTriggers: ['Novo', 'Nova comanda', 'Novo lançamento', '+'] },
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
  { name: 'mobile', size: { width: 390, height: 844 } },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slugify = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';

async function waitForContent(page) {
  await page.waitForFunction(() => {
    if (document.querySelector('.ant-skeleton-active')) return false;
    return !!document.querySelector('.ant-btn, button, .ant-picker, .ant-table, .ant-card, .ant-tabs, .recharts-surface');
  }, { timeout: 20000 }).catch(() => {});
  await sleep(1000);
}

// Encontra e clica no botão "Novo/Criar" da tela. Retorna true se achou.
async function clickNew(page, triggers) {
  for (const t of triggers) {
    const el = page.locator(
      `xpath=(//button[contains(normalize-space(.), "${t}")] | //a[contains(normalize-space(.), "${t}")])[1]`,
    );
    try {
      if (await el.count()) { await el.first().click({ timeout: 3000 }); return t; }
    } catch (e) {}
  }
  return null;
}

// Detecta o "painel aberto no topo" (drawer/modal). Retorna o handle ou null.
async function findOpenPanel(page) {
  const sels = [
    '.ant-drawer-open .ant-drawer-content-wrapper',
    '.ant-modal-root .ant-modal-content',
    '.ant-drawer .ant-drawer-content',
    '.ant-modal-mask ~ .ant-modal .ant-modal-content',
  ];
  for (const s of sels) {
    const h = await page.$(s);
    if (h) return { handle: h, selector: s };
  }
  return null;
}

async function dumpBody(page, file) {
  const html = await page.evaluate(() => document.body ? document.body.outerHTML : '').catch(() => '');
  fs.writeFileSync(file, html);
  return html.length;
}

// Retorna array de seletores/labels dos "pickers" clicáveis DENTRO de um panel.
async function findPickersInPanel(page, panelSelector) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return [];
    const out = [];
    const seen = new Set();
    const pickerSel = [
      '.ant-select-selector',
      '.ant-picker:not(.ant-picker-range) input',
      '.ant-picker-range',
      '.ant-cascader-picker',
      'input[readonly]:not([disabled])',
    ];
    for (const s of pickerSel) {
      for (const el of root.querySelectorAll(s)) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 18) continue;
        // label mais próximo
        const label = (el.closest('.ant-form-item') && el.closest('.ant-form-item').querySelector('label'))
          || (el.closest('[class*=form-item], .field, .form-field, [class*="Form"]') && el.closest('[class*=form-item], .field, .form-field, [class*="Form"]').querySelector('label'));
        const text = (label ? label.textContent : (el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.textContent || '')).trim();
        const key = `${s}|${text}`;
        if (seen.has(key)) continue; seen.add(key);
        out.push({ text: text.slice(0, 60) || s, kind: s });
        if (out.length >= 20) return out;
      }
    }
    return out;
  }, panelSelector);
}

// Clica no idx-ésimo picker da lista (re-encontra a cada iteração — DOM muda).
async function clickNthPicker(page, panelSelector, idx) {
  return page.evaluate(({ sel, i }) => {
    const root = document.querySelector(sel);
    if (!root) return false;
    const pickerSel = ['.ant-select-selector', '.ant-picker:not(.ant-picker-range) input', '.ant-picker-range', '.ant-cascader-picker', 'input[readonly]:not([disabled])'];
    const els = [];
    const seen = new Set();
    for (const s of pickerSel) {
      for (const el of root.querySelectorAll(s)) {
        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 18) continue;
        const label = (el.closest('.ant-form-item') && el.closest('.ant-form-item').querySelector('label')) || null;
        const text = (label ? label.textContent : (el.getAttribute('placeholder') || el.textContent || '')).trim();
        const key = `${s}|${text}`;
        if (seen.has(key)) continue; seen.add(key);
        els.push(el);
      }
    }
    const el = els[i]; if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, { sel: panelSelector, i: idx });
}

// Overlay do popup (dropdown/date/cascader) que aparece FORA do panel.
async function findOverlay(page) {
  const sels = [
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden)',
    '.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)',
    '.ant-cascader-dropdown:not(.ant-cascader-dropdown-hidden)',
    '.ant-popover:not(.ant-popover-hidden)',
    '.ant-drawer.ant-drawer-bottom.ant-drawer-open .ant-drawer-content',
  ];
  for (const s of sels) {
    const h = await page.$(s);
    if (h) return { handle: h, selector: s };
  }
  return null;
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
  console.log('LOGIN OK. Iniciando captura dinâmica...\n');

  const idx = [];
  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp.size);
    console.log(`\n=== VIEWPORT ${vp.name} (${vp.size.width}x${vp.size.height}) ===`);
    for (const R of ROUTES) {
      const dir = path.join(OUT, R.slug, vp.name);
      fs.mkdirSync(dir, { recursive: true });
      const rec = { slug: R.slug, route: R.route, viewport: vp.name, pickers: [] };
      try {
        await page.goto('https://belasis.app' + R.route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
        if (/\/login/.test(page.url())) { console.log('  deslogou em', R.route); break; }
        await waitForContent(page);

        // dumpa a tela base + screenshot
        await dumpBody(page, path.join(dir, '_page.html'));
        await page.screenshot({ path: path.join(dir, '_page.png'), fullPage: true }).catch(() => {});

        // abre o "Novo"
        const t = await clickNew(page, R.newTriggers);
        if (!t) { console.log(`  ${R.slug}: sem botão "Novo"`); idx.push(rec); continue; }
        await sleep(1200);
        const panel = await findOpenPanel(page);
        if (!panel) { console.log(`  ${R.slug}: clicou "${t}" mas nenhum panel abriu`); idx.push(rec); continue; }
        rec.newTrigger = t;

        // dumpa o drawer/modal aberto + screenshot
        await dumpBody(page, path.join(dir, 'new.html'));
        await page.screenshot({ path: path.join(dir, 'new.png'), fullPage: false }).catch(() => {});

        // encontra pickers
        const pickers = await findPickersInPanel(page, panel.selector);
        console.log(`  ${R.slug}[${vp.name}]: painel aberto, ${pickers.length} pickers`);
        for (let i = 0; i < pickers.length; i++) {
          const p = pickers[i];
          const slug = slugify(p.text || `picker-${i}`);
          try {
            await clickNthPicker(page, panel.selector, i);
            await sleep(800);
            const ov = await findOverlay(page);
            if (!ov) { console.log(`    ${i}: "${p.text}" — sem overlay`); continue; }
            // captura o overlay isolado + página inteira
            const ovHtml = await page.evaluate((s) => { const el = document.querySelector(s); return el ? el.outerHTML : ''; }, ov.selector);
            fs.writeFileSync(path.join(dir, `picker-${String(i + 1).padStart(2, '0')}-${slug}.html`), ovHtml);
            await page.screenshot({ path: path.join(dir, `picker-${String(i + 1).padStart(2, '0')}-${slug}.png`), fullPage: false }).catch(() => {});
            rec.pickers.push({ index: i, label: p.text, kind: p.kind, overlaySelector: ov.selector, htmlBytes: ovHtml.length });
            console.log(`    ${i}: "${p.text}" → capturado (${ovHtml.length}b)`);
            // fecha overlay
            await page.keyboard.press('Escape').catch(() => {});
            await sleep(400);
          } catch (e) {
            console.log(`    ${i}: "${p.text}" — erro ${(e.message || '').slice(0, 60)}`);
          }
        }
        // fecha drawer/modal
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(500);
      } catch (e) { console.log('  ERR', R.slug, (e.message || '').slice(0, 60)); }
      idx.push(rec);
      fs.writeFileSync(OUT + '/_index.json', JSON.stringify(idx, null, 2));
    }
  }
  console.log('\n=== DONE. captura salva em belasis-reference/pickers/ ===');
  await sleep(2000);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
