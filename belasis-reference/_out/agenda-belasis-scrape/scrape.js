const { chromium, devices } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], storageState: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/belasis-auth.json', ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  await p.goto('https://belasis.app/calendar', { waitUntil: 'networkidle', timeout: 60000 });
  for (let i=0;i<3;i++) { await p.evaluate(y => window.scrollTo(0,y), i*400); await new Promise(r=>setTimeout(r,700)); }
  await new Promise(r=>setTimeout(r,2500));
  if (p.url().includes('/login')) throw new Error('bounced to /login');
  const html = await p.content();
  fs.writeFileSync('/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/calendar.html', html);
  await p.screenshot({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/calendar.png', fullPage: true });
  const info = await p.evaluate(() => {
    const bottomNav = Array.from(document.querySelectorAll('[class*="bottom"], footer button, nav button')).map(b => b.textContent?.trim()).filter(Boolean).slice(0, 20);
    const header = document.querySelector('header')?.textContent?.trim().slice(0, 200);
    const eventCards = document.querySelectorAll('[class*="event"], [class*="appointment"]').length;
    return { title: document.title, url: location.href, bottomNav, header, eventCards };
  });
  fs.writeFileSync('/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/calendar.info.json', JSON.stringify(info, null, 2));
  console.log('CALENDAR OK', info);
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
