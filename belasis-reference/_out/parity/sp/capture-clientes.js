const { chromium, devices } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  try {
    await p.request.post('https://conferences-collar-proof-mine.trycloudflare.com/api/v1/auth/sign-in/email', { headers:{'Content-Type':'application/json'}, data:{email:'contato@fatimacabelos.com.br', password:'fatima@2026'}});
    await p.goto('https://conferences-collar-proof-mine.trycloudflare.com/clientes', { waitUntil: 'networkidle', timeout: 30000 });
    for (let i=0;i<3;i++) { await p.evaluate(y => window.scrollTo(0,y), i*400); await new Promise(r=>setTimeout(r,500)); }
    await new Promise(r=>setTimeout(r,2000));
    await p.screenshot({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/parity/sp/clientes.png', fullPage: true });
    const info = await p.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      url: location.href,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t && t.length < 25).slice(0, 30),
      tabs: Array.from(document.querySelectorAll('[role="tab"], nav a')).map(t => t.textContent?.trim()).filter(Boolean).slice(0, 15),
      hasFAB: !!document.querySelector('[class*="fixed"][class*="bottom"]'),
    }));
    fs.writeFileSync('/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/parity/sp/clientes.info.json', JSON.stringify(info, null, 2));
    console.log('OK clientes', p.url());
  } finally { await b.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
