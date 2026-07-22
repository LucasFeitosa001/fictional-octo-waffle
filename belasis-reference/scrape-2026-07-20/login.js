const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  try {
    await p.goto('https://belasis.app/login', { waitUntil: 'networkidle', timeout: 60000 });
    await new Promise(r => setTimeout(r, 2500));
    const fields = await p.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => ({name:i.name,type:i.type,ph:i.placeholder,id:i.id})));
    console.log('FIELDS', JSON.stringify(fields));
    const email = await p.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first();
    const pass = await p.locator('input[type="password"], input[name="password"]').first();
    await email.fill('franciscoffdc14@gmail.com');
    await pass.fill('jafa1014@&');
    const btn = await p.locator('button:has-text("Log in"), button:has-text("Entrar")').first();
    await btn.click();
    await p.waitForURL(u => !u.href.includes('/login'), { timeout: 30000 }).catch(()=>{});
    await new Promise(r => setTimeout(r, 4000));
    const url = p.url();
    console.log('POST-LOGIN URL', url);
    if (url.includes('/login')) {
      console.error('LOGIN FAILED — still on /login');
      const err = await p.evaluate(() => document.body.innerText.slice(0, 500));
      console.error('BODY:', err);
      await p.screenshot({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/scrape-2026-07-20/login-fail.png' });
      process.exit(1);
    }
    await ctx.storageState({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/scrape-2026-07-20/belasis-auth.json' });
    await p.screenshot({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/scrape-2026-07-20/post-login.png' });
    console.log('AUTH SAVED');
  } catch (e) {
    console.error('FATAL', e.message);
    await p.screenshot({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/scrape-2026-07-20/login-err.png' }).catch(()=>{});
    process.exit(2);
  } finally {
    await b.close();
  }
})();
