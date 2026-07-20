const { chromium } = require('playwright');
const fs = require('fs');
const CRED = JSON.parse(fs.readFileSync('cred.json','utf8'));
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ locale: 'pt-BR', viewport:{width:1440,height:1000} });
  const page = await ctx.newPage();
  page.on('response', r => { if (/auth|login|signin|token|sessao|sign_in/i.test(r.url())) console.log('  RESP', r.status(), r.url().slice(0,90)); });
  await page.goto('https://belasis.app/login', { waitUntil: 'networkidle', timeout: 60000 }).catch(()=>{});
  await page.waitForTimeout(2500);
  await page.fill('#email', CRED.email);
  await page.fill('#password', CRED.pass);
  console.log('filled. email val=', await page.inputValue('#email'), 'pwlen=', (await page.inputValue('#password')).length);
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
  for (let i=0;i<8;i++){ await page.waitForTimeout(2000); console.log(i, 'url=', page.url()); if(!/login/.test(page.url())) break; }
  const err = await page.evaluate(()=>{
    const t=[];
    for(const el of document.querySelectorAll('[class*=error i],[class*=alert i],[class*=toast i],[class*=ant-message],[class*=ant-notification],[role=alert]')){ const s=(el.innerText||'').trim(); if(s) t.push(s); }
    return [...new Set(t)];
  });
  console.log('ERRORS/TOASTS:', JSON.stringify(err));
  console.log('FINAL URL:', page.url());
  await b.close();
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
