const { chromium, devices } = require('playwright');
const URL_BASE = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/agenda-belasis-scrape/salonpass-agenda.png';

(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  const resp = await page.request.post(`${URL_BASE}/api/v1/auth/sign-in/email`, {
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
    headers: { 'content-type': 'application/json' },
  });
  console.log('login', resp.status());

  const state = await page.request.storageState();
  await ctx.addCookies(state.cookies);

  await page.goto(`${URL_BASE}/agenda`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const txt = (el) => el?.innerText?.trim() || null;
    const all = (sel) => Array.from(document.querySelectorAll(sel)).map(e => e.innerText?.trim()).filter(Boolean);
    return {
      url: location.href,
      title: document.title,
      h1: txt(document.querySelector('h1')),
      h2: txt(document.querySelector('h2')),
      headerText: txt(document.querySelector('header')),
      buttonsTop: all('header button, [class*="Topbar"] button, [class*="topbar"] button').slice(0, 20),
      bottomNav: all('[class*="BottomNav"] *, [class*="bottom-nav"] *, nav[class*="bottom"] *').slice(0, 30),
      navAll: all('nav *').slice(0, 30),
      fabCandidates: all('[class*="fab" i], button[aria-label*="Novo" i], button[aria-label*="Criar" i], button[class*="floating" i]').slice(0,10),
      hasMonthGrid: !!document.querySelector('[class*="month" i], [class*="grid" i][class*="cal" i]'),
      hasListView: !!document.querySelector('[class*="list" i][class*="event" i], [class*="agenda-list" i]'),
      hasTimeGrid: !!document.querySelector('[class*="time-grid" i], [class*="timegrid" i], [class*="hour" i]'),
      tabs: all('[role="tab"], [class*="tab-button"], [class*="Tabs"] button').slice(0, 10),
      dayHeaders: all('th, [role="columnheader"], [class*="day-header"]').slice(0, 10),
      bodyPreview: document.body.innerText.slice(0, 1200),
    };
  });
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: OUT, fullPage: true });
  console.log('saved', OUT);
  await b.close();
})();
