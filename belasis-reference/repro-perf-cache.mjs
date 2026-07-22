import { chromium, devices } from 'playwright';

const WEB = 'http://localhost:5173';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/perf-cache';

const results = { steps: [], requestsRevisit: [], requestsFocus: [], timings: {}, spinnerRevisit: null, focusTriggeredRefetch: null };

function classify(url) {
  if (url.includes('/api/')) return 'api';
  if (/\.(js|mjs|css|png|jpg|jpeg|svg|woff2?|ico)(\?|$)/.test(url)) return 'asset';
  return 'other';
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();

  const allReqs = [];
  page.on('request', (req) => {
    allReqs.push({ ts: Date.now(), url: req.url(), method: req.method(), type: classify(req.url()), rt: req.resourceType() });
  });

  // Login via UI
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type=email], input[name=email]', 'contato@fatimacabelos.com.br');
  await page.fill('input[type=password], input[name=password]', 'fatima@2026');
  await Promise.all([
    page.waitForURL(u => !u.toString().includes('/login'), { timeout: 30000 }).catch(()=>{}),
    page.click('button[type=submit]'),
  ]);
  await page.waitForTimeout(1500);
  console.error('post-login url', page.url());

  // Step 1: navigate to /comandas
  await page.goto(`${WEB}/comandas`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  const T1 = Date.now();
  const reqsBeforeRevisit = allReqs.length;
  await page.screenshot({ path: `${OUT}/repro-1.png`, fullPage: false });

  // Step 4: navigate to /clientes
  await page.goto(`${WEB}/clientes`, { waitUntil: 'networkidle', timeout: 30000 });
  // Step 5: wait 3s
  await page.waitForTimeout(3000);

  // Step 6: back to /comandas (do NOT wait for load - want to see spinner asap)
  const revisitStart = Date.now();
  const navPromise = page.goto(`${WEB}/comandas`, { waitUntil: 'commit', timeout: 30000 });
  await navPromise;
  // Step 7: wait 200ms
  await page.waitForTimeout(200);

  // Step 8: check for LoadingState / spinner / "Carregando"
  const uiState = await page.evaluate(() => {
    const body = document.body.innerText || '';
    const hasCarregando = /carregando/i.test(body);
    // LoadingState typically renders a spinner element
    const spinnerSelectors = [
      '[data-testid="loading-state"]',
      '[data-loading]',
      '.animate-spin',
      '[role="progressbar"]',
      '[class*="spinner" i]',
      '[class*="Loading" i]',
    ];
    const found = {};
    for (const s of spinnerSelectors) {
      const el = document.querySelector(s);
      found[s] = !!el && !!(el.offsetParent || el.getClientRects().length);
    }
    const anySpinner = Object.values(found).some(Boolean);
    return { hasCarregando, anySpinner, found, bodySample: body.slice(0, 300) };
  });

  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/repro-2.png`, fullPage: false });

  const T2 = Date.now();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(()=>{});
  const T2end = Date.now();

  const reqsRevisit = allReqs.slice(reqsBeforeRevisit).filter(r => r.ts >= revisitStart);
  results.requestsRevisit = reqsRevisit.map(r => ({ url: r.url.replace('http://localhost:5173',''), type: r.type, method: r.method }));
  results.spinnerRevisit = uiState;
  results.timings.T1 = T1;
  results.timings.T2_after200ms = T2;
  results.timings.deltaMs_revisitToCheck = T2 - revisitStart;
  results.timings.deltaMs_revisitToIdle = T2end - revisitStart;

  // Focus/blur test
  await page.goto(`${WEB}/pacotes`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);
  const beforeFocus = allReqs.length;
  const focusStart = Date.now();

  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);

  const focusReqs = allReqs.slice(beforeFocus).filter(r => r.ts >= focusStart);
  results.requestsFocus = focusReqs.map(r => ({ url: r.url.replace('http://localhost:5173',''), type: r.type, method: r.method }));
  results.focusTriggeredRefetch = focusReqs.some(r => r.type === 'api');

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
