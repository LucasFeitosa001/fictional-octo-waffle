const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  await p.goto('https://belasis.app/login-by-phone', { waitUntil: 'networkidle', timeout: 60000 });
  await new Promise(r=>setTimeout(r,2500));
  console.log('AT:', p.url());
  // Toggle to email login form.
  const emailToggle = p.locator('text=/Login with email|Entrar com e-?mail|Login com e-?mail/i').first();
  if (await emailToggle.count()) {
    await emailToggle.click({ force: true }).catch(e=>console.log('toggle click err', e.message));
    await new Promise(r=>setTimeout(r,2500));
    console.log('AFTER TOGGLE:', p.url());
  } else {
    console.log('email toggle NOT found; body:', (await p.evaluate(()=>document.body.innerText)).slice(0,300));
  }
  const emailBox = p.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first();
  const passBox = p.locator('input[type="password"], input[name="password"]').first();
  p.on('request', r => {
    if (r.method() === 'POST') console.log('POST', r.url(), (r.postData()||'').slice(0,200));
  });
  p.on('response', async r => {
    if (r.request().method() === 'POST') {
      let body = '';
      try { body = (await r.text()).slice(0,300); } catch {}
      console.log('POST-RESP', r.status(), r.url(), body);
    }
  });
  await emailBox.fill('franciscoffdc14@gmail.com');
  await passBox.fill('jafa1014@&');
  console.log('FILLED email=', await emailBox.inputValue(), 'passlen=', (await passBox.inputValue()).length);
  // enumerate buttons for debug
  const btns = await p.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => ({t:(b.innerText||'').trim().slice(0,30), type:b.type, vis: !!(b.offsetWidth||b.offsetHeight)})));
  console.log('BTNS:', JSON.stringify(btns));
  // Submit via keyboard on password
  await passBox.press('Enter');
  await new Promise(r=>setTimeout(r,1500));
  console.log('AFTER ENTER URL:', p.url());
  if (p.url().includes('/login')) {
    // fallback: try clicking the submit-typed visible button that is NOT the phone-toggle-shaped hidden one
    const visibleBtn = p.locator('button:visible:has-text("Log in"), button:visible:has-text("Entrar")').first();
    if (await visibleBtn.count()) await visibleBtn.click({ force: true }).catch(()=>{});
  }
  await p.waitForURL(u => !u.href.includes('/login'), { timeout: 20000 }).catch(()=>{});
  await new Promise(r=>setTimeout(r,3500));
  const url = p.url();
  console.log('POST-LOGIN URL:', url);
  if (url.includes('/login')) {
    const err = await p.evaluate(() => document.body.innerText.slice(0, 400));
    console.error('LOGIN FAIL:', err);
    await p.screenshot({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/login-fail.png' });
    process.exit(1);
  }
  await ctx.storageState({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/belasis-auth.json' });
  await p.screenshot({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/post-login.png' });
  console.log('AUTH SAVED to /home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/belasis-auth.json');
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(2); });
