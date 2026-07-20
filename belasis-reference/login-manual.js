// Opens a REAL Chromium window via WSLg. User logs in by hand.
// Auto-detects success, saves auth to state.json (+ persistent profile), then exits.
const { chromium } = require('playwright');
const fs = require('fs');
const PROFILE = __dirname + '/.auth-profile';   // persistent, NOT /tmp
const STATE = __dirname + '/state.json';

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: null,
    args: ['--no-sandbox', '--start-maximized'],
    locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://belasis.app/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('>>> Janela aberta. FAÇA O LOGIN manualmente na janela do Chrome. <<<');
  console.log('>>> Aguardando... (detecto sozinho quando o app carregar)');

  const deadline = Date.now.bind ? null : null; // Date.now unusable in workflows only; fine in node
  let ok = false;
  for (let i = 0; i < 300; i++) {                 // up to ~10 min (300 * 2s)
    await page.waitForTimeout(2000);
    let url = '';
    try { url = ctx.pages().map(p => p.url()).find(u => /belasis\.app/.test(u)) || page.url(); } catch (e) {}
    const authed = /belasis\.app\//.test(url) && !/\/login/.test(url) && !/^https:\/\/belasis\.app\/?$/.test(url);
    if (authed) {
      // confirm the app shell really rendered (nav present)
      const shell = await page.evaluate(() => !!document.querySelector('a[href="/wow"],a[href^="/finance"],[class*=sider i],[class*=sidebar i]')).catch(() => false);
      if (shell) { ok = true; console.log('LOGIN detectado em', url); break; }
    }
    if (i % 5 === 0) console.log('  ...ainda aguardando login (', url, ')');
  }

  if (ok) {
    await ctx.storageState({ path: STATE });
    console.log('AUTH SALVA em state.json + perfil persistente. Pode fechar.');
  } else {
    console.log('TIMEOUT: login não detectado em 10min.');
  }
  await ctx.close();
  process.exit(ok ? 0 : 3);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
