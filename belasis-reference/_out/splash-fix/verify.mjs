import { chromium, devices } from 'playwright';
import { writeFileSync } from 'fs';

const WEB = 'http://localhost:5173';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/splash-fix';
const STORAGE = `${OUT}/storage-auth.json`;

const results = { A: null, B: null, C: null };

function splashVisible(page) {
  return page.evaluate(() => {
    const el = document.getElementById('splash');
    if (!el) return false;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    return true;
  });
}

async function measureSplashMs(page, maxMs = 5000) {
  const start = Date.now();
  let firstSeen = null;
  let lastSeen = null;
  while (Date.now() - start < maxMs) {
    const vis = await splashVisible(page);
    if (vis) {
      if (firstSeen === null) firstSeen = Date.now();
      lastSeen = Date.now();
    } else if (firstSeen !== null) {
      break;
    }
    await page.waitForTimeout(20);
  }
  if (firstSeen === null) return { ms: 0, present: false };
  return { ms: lastSeen - firstSeen, present: true };
}

(async () => {
  const browser = await chromium.launch();

  // ============= Scenario A: internal navigation, ZERO splash =============
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: STORAGE });
    const page = await ctx.newPage();

    let splashSeen = 0;
    const poll = setInterval(async () => {
      try { if (await splashVisible(page)) splashSeen++; } catch {}
    }, 30);

    await page.goto(`${WEB}/comandas`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(300);
    // reset counter — we're only counting splash during internal navs
    splashSeen = 0;

    for (const route of ['/clientes', '/comandas', '/pacotes']) {
      await page.evaluate((r) => window.history.pushState({}, '', r), route);
      // Actually SPA-nav: use link click if possible, else full nav via router
      // Use page.evaluate to dispatch popstate for react-router
      await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
      await page.waitForTimeout(800);
    }
    // Also try router-driven nav via anchor clicks fallback: use goto for robustness
    // (already covered by popstate; keep it simple)

    clearInterval(poll);
    await page.screenshot({ path: `${OUT}/verify-A.png`, fullPage: false });
    results.A = { splashSeen, ok: splashSeen === 0 };
    await ctx.close();
  }

  // Scenario A v2: real internal SPA nav via router (use goto with no reload semantics
  // by clicking sidenav — simpler: use page.goto but that IS a full reload for MPA;
  // for React Router SPA, page.goto still full reloads. We need in-app navigation.)
  // Use page.evaluate to call history.pushState + popstate as above.

  // ============= Scenario B: reload (F5) =============
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: STORAGE });
    const page = await ctx.newPage();
    await page.goto(`${WEB}/comandas`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    // Reload — measure splash lifetime
    const reloadPromise = page.reload({ waitUntil: 'commit' });
    await reloadPromise;
    const meas = await measureSplashMs(page, 8000);
    await page.screenshot({ path: `${OUT}/verify-B.png`, fullPage: false });
    results.B = meas;
    await ctx.close();
  }

  // ============= Scenario C: fresh context + storageState =============
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13'], storageState: STORAGE });
    const page = await ctx.newPage();
    // Start measuring BEFORE first paint
    const navPromise = page.goto(`${WEB}/comandas`, { waitUntil: 'commit', timeout: 30000 });
    await navPromise;
    const meas = await measureSplashMs(page, 10000);
    await page.screenshot({ path: `${OUT}/verify-C.png`, fullPage: false });
    results.C = meas;
    await ctx.close();
  }

  await browser.close();
  writeFileSync(`${OUT}/verify-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error('FAIL', e); process.exit(1); });
