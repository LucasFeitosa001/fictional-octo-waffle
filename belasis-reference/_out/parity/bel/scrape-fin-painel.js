const { chromium, devices } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], storageState: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/belasis-auth.json', ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  try {
    await p.goto('https://belasis.app/finance', { waitUntil: 'networkidle', timeout: 45000 });
    for (let i=0;i<3;i++) { await p.evaluate(y => window.scrollTo(0,y), i*400); await new Promise(r=>setTimeout(r,500)); }
    await new Promise(r=>setTimeout(r,2000));
    if (p.url().includes('/login')) throw new Error('auth expired');
    const html = await p.content();
    fs.writeFileSync('/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/parity/bel/fin-painel.html', html);
    await p.screenshot({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/parity/bel/fin-painel.png', fullPage: true });
    const info = await p.evaluate(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.textContent?.trim(),
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(t => t && t.length < 25).slice(0, 30),
      tabs: Array.from(document.querySelectorAll('[role="tab"], .ant-tabs-tab')).map(t => t.textContent?.trim()).filter(Boolean),
      hasFAB: !!document.querySelector('[class*="fixed"][class*="bottom"], .ant-float-btn'),
    }));
    fs.writeFileSync('/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/parity/bel/fin-painel.info.json', JSON.stringify(info, null, 2));
    console.log('OK fin-painel', fs.statSync('/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/parity/bel/fin-painel.html').size);
  } finally { await b.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
