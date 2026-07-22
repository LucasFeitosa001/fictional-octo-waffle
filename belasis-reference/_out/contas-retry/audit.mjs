import { chromium, devices } from 'playwright';

const BASE = 'http://localhost:5173';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/contas-retry';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

// UI login
await page.goto(`${BASE}/painel`, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
await page.waitForTimeout(1500);
try {
  await page.waitForSelector('input[type=email], input[placeholder*="salao"]', { timeout: 15000 });
  await page.fill('input[type=email], input[placeholder*="salao"]', 'contato@fatimacabelos.com.br');
  await page.fill('input[type=password]', 'fatima@2026');
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 30000 }),
    page.click('button:has-text("Entrar")'),
  ]);
  await page.waitForTimeout(2000);
  console.error('post-login url', page.url());
} catch (e) { console.error('login err', e.message); }

const results = [];

// === Scenario A ===
try {
  await page.goto(`${BASE}/financeiro/cadastros/formas-pagamento?tab=formas`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/A.png`, fullPage: true });

  const infoA = await page.evaluate(() => {
    const text = document.body.innerText;
    const taxaMatches = text.match(/Taxa\s+[\d.,]+%/g) || [];
    const contadorMatch = text.match(/(\d+)\s+registros?/i);
    // Also probe cards
    const cards = Array.from(document.querySelectorAll('[class*="rounded"]')).filter(el => (el.textContent||'').match(/Taxa\s+[\d.,]+%/));
    return {
      taxaCount: taxaMatches.length,
      taxaSample: taxaMatches.slice(0, 5),
      contador: contadorMatch ? contadorMatch[0] : null,
      cardCount: cards.length,
      bodySnippet: text.slice(0, 400),
    };
  });
  const okA = infoA.taxaCount > 0 && !!infoA.contador;
  results.push({ scenario: 'A', ok: okA, note: JSON.stringify(infoA) });
} catch (e) {
  results.push({ scenario: 'A', ok: false, note: 'error: ' + e.message });
}

// === Scenario B ===
try {
  await page.goto(`${BASE}/financeiro/contas`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/B.png`, fullPage: true });

  const infoB = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasFormasTab = /Formas de pagamento/i.test(text);
    const sortChip = (text.match(/Ordenando por[^\n]{0,40}/i) || [null])[0];
    // BottomNav: look for buttons/items in fixed bottom nav containing "Selecionar"
    const bnav = Array.from(document.querySelectorAll('nav, [class*="bottom"], [class*="Bottom"]')).filter(el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return (cs.position === 'fixed' || cs.position === 'sticky') && r.top > window.innerHeight * 0.5;
    });
    const bnavTexts = bnav.map(el => (el.innerText||'').replace(/\s+/g,' ').trim()).filter(Boolean);
    const hasSelecionarInBnav = bnavTexts.some(t => /Selecionar/i.test(t));
    const hasSelecionarAnywhere = /Selecionar/i.test(text);
    return {
      hasFormasTab,
      sortChip,
      hasSelecionarInBnav,
      hasSelecionarAnywhere,
      bnavCount: bnav.length,
      bnavTexts: bnavTexts.slice(0, 3),
    };
  });
  const okB = infoB.hasFormasTab && !!infoB.sortChip && /Nome/i.test(infoB.sortChip || '') && infoB.hasSelecionarInBnav;
  results.push({ scenario: 'B', ok: okB, note: JSON.stringify(infoB) });
} catch (e) {
  results.push({ scenario: 'B', ok: false, note: 'error: ' + e.message });
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
