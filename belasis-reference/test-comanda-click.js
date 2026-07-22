const { chromium } = require('playwright');
(async () => {
  const URL = 'https://conferences-collar-proof-mine.trycloudflare.com';
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push({ type: 'pageerror', msg: (e.message || String(e)).slice(0, 300) }));
  page.on('console', (m) => { if (m.type() === 'error') errs.push({ type: 'error', msg: (m.text() || '').slice(0, 300) }); });

  await page.request.post(`${URL}/api/v1/auth/sign-in/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  });
  await page.goto(`${URL}/comandas`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 5000));
  console.log('URL antes:', page.url());
  console.log('body chars:', await page.evaluate(() => (document.body.innerText || '').length));

  // clica no 1º nome de cliente
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('td button.text-primary, td button.max-w-\\[220px\\]');
    if (!btn) return null;
    btn.click();
    return btn.textContent?.trim().slice(0, 40);
  });
  console.log('clicou em:', clicked);
  await new Promise((r) => setTimeout(r, 3000));
  console.log('URL depois:', page.url());
  console.log('body chars depois:', await page.evaluate(() => (document.body.innerText || '').length));
  console.log('erros:');
  for (const e of errs.slice(0, 8)) console.log(' ', e.type, ':', e.msg);
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
