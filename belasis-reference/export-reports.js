/* Baixa TODOS os relatórios do Belasis desde 2020 (backup). Login manual WSLg.
 * Uso: node belasis-reference/export-reports.js
 * Salva downloads em belasis-reference/exports/ e dumps de DOM em exports/_dom/. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile';
const OUT = REF + '/exports';
const DOM = OUT + '/_dom';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(DOM, { recursive: true });

const START = '01/01/2020';
const today = new Date();
const END = String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth() + 1).padStart(2, '0') + '/' + today.getFullYear();

// Rotas de relatório (as que têm "Gerar relatório" / dados exportáveis)
const REPORTS = [
  ['financial-dre', '/reports/financial/dre'],
  ['financial-service-revenue', '/reports/financial/service-revenue'],
  ['financial-product-revenue', '/reports/financial/product-revenue'],
  ['financial-billing-projection', '/reports/financial/billing-projection'],
  ['financial-cash-movements', '/reports/financial/cash-movements'],
  ['financial-bill-recs', '/reports/financial/bill-recs'],
  ['financial-bill-pays', '/reports/financial/bill-pays'],
  ['financial-extract', '/reports/financial/extract'],
  ['financial-extract-movements', '/reports/financial/extract-movements'],
  ['calendars-all', '/reports/calendars/all'],
  ['calendars-creation', '/reports/calendars/creation'],
  ['calendars-deleted', '/reports/calendars/deleted'],
  ['calendars-origin', '/reports/calendars/origin'],
  ['clients-all', '/reports/clients/all'],
  ['clients-birthdays', '/reports/clients/birthdays'],
  ['clients-inactives', '/reports/clients/inactives'],
  ['clients-pendings', '/reports/clients/pendings'],
  ['clients-rank', '/reports/clients/rank'],
  ['clients-return', '/reports/clients/return'],
  ['inventory-stock', '/reports/inventory/stock'],
  ['inventory-products-list', '/reports/inventory/products-list'],
  ['inventory-products-consumed', '/reports/inventory/products-consumed'],
  ['inventory-purchase-suggestion', '/reports/inventory/purchase-suggestion'],
  ['inventory-purchases', '/reports/inventory/purchases'],
  ['inventory-stock-movement', '/reports/inventory/stock-movement'],
  ['messages-sent', '/reports/messages/sent'],
  ['birthdays', '/reports/birthdays'],
  ['nf', '/reports/nf'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForContent(page) {
  await page.waitForFunction(() => {
    if (document.querySelector('.ant-skeleton-active')) return false;
    return !!document.querySelector('.ant-btn, button, .ant-picker, .ant-table, .ant-card, .recharts-surface');
  }, { timeout: 20000 }).catch(() => {});
  await sleep(1200);
}

// Seta um antd RangePicker (ou 2 date inputs) para START..END
async function setPeriod(page) {
  try {
    const inputs = await page.$$('.ant-picker-range input, .ant-picker input');
    if (inputs.length >= 2) {
      await inputs[0].click(); await sleep(200);
      await inputs[0].fill(''); await inputs[0].type(START, { delay: 20 }); await inputs[0].press('Enter'); await sleep(300);
      await inputs[1].fill(''); await inputs[1].type(END, { delay: 20 }); await inputs[1].press('Enter'); await sleep(300);
      await page.keyboard.press('Escape').catch(() => {});
      return true;
    }
    if (inputs.length === 1) {
      await inputs[0].click(); await sleep(200);
      await inputs[0].fill(''); await inputs[0].type(START, { delay: 20 }); await inputs[0].press('Enter'); await sleep(300);
      return true;
    }
  } catch (e) {}
  return false;
}

async function clickByText(page, texts) {
  for (const t of texts) {
    const el = await page.$(`xpath=//button[contains(normalize-space(.), "${t}")] | //*[@role="button"][contains(normalize-space(.), "${t}")] | //a[contains(normalize-space(.), "${t}")]`);
    if (el) { try { await el.click({ timeout: 3000 }); return t; } catch (e) {} }
  }
  return null;
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, viewport: null, acceptDownloads: true,
    args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // captura QUALQUER download do contexto
  const dls = [];
  ctx.on('page', (p) => p.on('download', (d) => dls.push(d)));
  page.on('download', (d) => dls.push(d));

  await page.goto('https://belasis.app/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('\n>>> FAÇA O LOGIN na janela do Chrome. Detecto e começo a baixar. <<<\n');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const url = page.url();
    if (/belasis\.app\/[a-z]/i.test(url) && !/\/login/.test(url)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 5 === 0) console.log('  ...aguardando login (', url, ')');
  }
  if (!authed) { console.log('TIMEOUT login'); await ctx.close(); process.exit(3); }
  console.log('LOGIN OK. Período:', START, '->', END, '· relatórios:', REPORTS.length, '\n');

  const idx = [];
  for (const [slug, route] of REPORTS) {
    const rec = { slug, route, downloads: [] };
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
      if (/\/login/.test(page.url())) { rec.err = 'DESLOGOU'; console.log('!! deslogou em', route); idx.push(rec); break; }
      await waitForContent(page);
      const before = dls.length;
      const setOk = await setPeriod(page); rec.periodo = setOk;
      // dump do DOM carregado (referência de seletores)
      const html1 = await page.evaluate(() => document.body ? document.body.outerHTML : '').catch(() => '');
      fs.writeFileSync(DOM + '/' + slug + '-loaded.html', html1);
      // gerar relatório
      const gen = await clickByText(page, ['Gerar relatório', 'Gerar Relatório', 'Gerar']);
      rec.gerou = gen; await sleep(3500);
      // tentar botões de export
      await clickByText(page, ['Exportar para Excel', 'Exportar', 'Baixar', 'Download', 'Excel', 'Imprimir']);
      await sleep(2500);
      // dump pós-geração
      const html2 = await page.evaluate(() => document.body ? document.body.outerHTML : '').catch(() => '');
      fs.writeFileSync(DOM + '/' + slug + '-generated.html', html2);
      // salvar downloads que surgiram
      for (let k = before; k < dls.length; k++) {
        const d = dls[k];
        const name = slug + '__' + (d.suggestedFilename() || ('report-' + k));
        const dest = path.join(OUT, name.replace(/[^\w.\-]/g, '_'));
        try { await d.saveAs(dest); rec.downloads.push(path.basename(dest)); console.log('  ⬇', route, '->', path.basename(dest)); } catch (e) { rec.dlErr = e.message.slice(0, 60); }
      }
      if (!rec.downloads.length) console.log('  ·', route, '(sem download; DOM salvo em _dom/' + slug + '-generated.html)');
    } catch (e) { rec.err = (e.message || '').slice(0, 80); console.log('  ERR', route, rec.err); }
    idx.push(rec);
    fs.writeFileSync(OUT + '/_index.json', JSON.stringify(idx, null, 2));
  }
  const okd = idx.filter((r) => r.downloads && r.downloads.length).length;
  console.log('\n=== DONE. relatórios com download:', okd, '/', REPORTS.length, '· ver belasis-reference/exports/ ===');
  await sleep(2000);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
