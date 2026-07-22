const { chromium } = require('playwright');
(async () => {
  const URL = 'https://conferences-collar-proof-mine.trycloudflare.com';
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push({ type: 'pageerror', msg: (e.message || String(e)).slice(0, 300) }));
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push({ type: m.type(), msg: (m.text() || '').slice(0, 300) }); });
  page.on('requestfailed', (req) => errs.push({ type: 'reqfail', url: req.url().slice(0, 120), err: req.failure()?.errorText }));

  // login programático via API
  const login = await page.request.post(`${URL}/api/v1/auth/sign-in/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  });
  console.log('login:', login.status());

  await page.goto(`${URL}/comandas`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 6000));

  const bodyLen = await page.evaluate(() => (document.body.innerText || '').length);
  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 500) || '');
  console.log('body text length:', bodyLen);
  console.log('root primeiros 500 chars:', rootHtml.slice(0, 300));
  await page.screenshot({ path: '/tmp/tela.png', fullPage: false }).catch(() => {});
  console.log('screenshot: /tmp/tela.png');

  console.log('\n== ERROS/WARNINGS ==');
  for (const e of errs.slice(0, 15)) console.log(' ', e.type, ':', e.msg || e.url);
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
