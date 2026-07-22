import { chromium, devices } from 'playwright';

const BASE = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/reload-nuclear';

const results = [];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function detectSplash(page) {
  // Heurística: procura elemento com texto de splash ou classe conhecida
  return await page.evaluate(() => {
    const text = document.body?.innerText || '';
    const hasSplashText = /carregando|loading|splash/i.test(text.slice(0, 500));
    const splashEl = document.querySelector('[data-splash], .splash, #splash, [class*="splash" i]');
    return { hasSplashText, hasSplashEl: !!splashEl, bodyLen: document.body?.innerHTML?.length ?? 0 };
  });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();

  // Login via API para obter cookies/token
  const loginResp = await page.request.post(`${BASE}/api/v1/auth/sign-in/email`, {
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
    headers: { 'content-type': 'application/json' },
  });
  const loginStatus = loginResp.status();
  const loginBody = await loginResp.text();
  console.log('login', loginStatus, loginBody.slice(0, 200));

  // Se retornou token, injeta em localStorage/sessionStorage
  let token = null;
  try {
    const j = JSON.parse(loginBody);
    token = j.token || j.accessToken || j.data?.token || null;
  } catch {}

  // Vai pra base pra estabelecer origin, depois injeta token
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  if (token) {
    await page.evaluate((t) => {
      localStorage.setItem('token', t);
      localStorage.setItem('accessToken', t);
      sessionStorage.setItem('token', t);
    }, token);
  }

  // Cenário A
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.screenshot({ path: `${OUT}/verify-A-initial.png`, fullPage: false });
  const splashA1 = await detectSplash(page);
  await sleep(10000);
  await page.screenshot({ path: `${OUT}/verify-A-after10s.png`, fullPage: false });
  const splashA2 = await detectSplash(page);
  const aReappeared = splashA2.hasSplashEl && !splashA1.hasSplashEl;
  results.push({
    name: 'A) Splash não reaparece após 10s idle em /',
    ok: !aReappeared,
    note: `initial=${JSON.stringify(splashA1)} after=${JSON.stringify(splashA2)}`,
  });

  // Cenário B
  await page.goto(`${BASE}/notificacoes/novidades`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.screenshot({ path: `${OUT}/verify-B-initial.png`, fullPage: false });
  const splashB1 = await detectSplash(page);
  await sleep(3000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(2000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/verify-B-after-visibility.png`, fullPage: false });
  const splashB2 = await detectSplash(page);
  const bAppeared = splashB2.hasSplashEl && !splashB1.hasSplashEl;
  results.push({
    name: 'B) Splash não aparece após visibilitychange hidden->visible',
    ok: !bAppeared,
    note: `before=${JSON.stringify(splashB1)} after=${JSON.stringify(splashB2)}`,
  });

  // Cenário C — bfcache pageshow persisted
  let reloadTriggered = false;
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) reloadTriggered = true;
  });
  reloadTriggered = false;
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await sleep(2000);
  await page.screenshot({ path: `${OUT}/verify-C-after-pageshow.png`, fullPage: false });
  const splashC = await detectSplash(page);
  results.push({
    name: 'C) pageshow persisted não dispara reload/splash',
    ok: !reloadTriggered && !splashC.hasSplashEl,
    note: `reload=${reloadTriggered} splash=${JSON.stringify(splashC)}`,
  });

  // Cenário D — HTML sem SW cleanup script
  const html = await page.content();
  const rawIndex = await (await page.request.get(`${BASE}/`)).text();
  const swPatterns = [
    /serviceWorker\.getRegistrations/i,
    /unregister\(\)/i,
    /caches\.keys\(\)/i,
    /SW.*cleanup/i,
  ];
  const hitsRaw = swPatterns.filter(p => p.test(rawIndex)).map(p => p.toString());
  const hitsRendered = swPatterns.filter(p => p.test(html)).map(p => p.toString());
  results.push({
    name: 'D) HTML não contém script de SW cleanup',
    ok: hitsRaw.length === 0,
    note: `rawIndex hits=${JSON.stringify(hitsRaw)} rendered hits=${JSON.stringify(hitsRendered)}`,
  });

  await browser.close();

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  console.log('RESULTS_JSON=' + JSON.stringify({ scenarios: results, passed, failed }));
})().catch(e => {
  console.error('FATAL', e);
  process.exit(1);
});
