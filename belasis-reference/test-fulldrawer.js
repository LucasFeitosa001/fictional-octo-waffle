const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await b.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
  await page.request.post('https://conferences-collar-proof-mine.trycloudflare.com/api/v1/auth/sign-in/email', {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  });
  await page.goto('https://conferences-collar-proof-mine.trycloudflare.com/comandas');
  await new Promise((r) => setTimeout(r, 4000));
  await page.evaluate(() => { const b = document.querySelector('td button.text-primary'); if (b) b.click(); });
  await new Promise((r) => setTimeout(r, 1500));
  const info = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return { found: false };
    const w = dlg.getBoundingClientRect().width;
    const menu = Array.from(dlg.querySelectorAll('nav li')).map((li) => (li.textContent || '').trim().slice(0, 20));
    const title = dlg.querySelector('h2')?.textContent?.trim();
    return { found: true, width: Math.round(w), title, menu: menu.slice(0, 8) };
  });
  console.log(JSON.stringify(info, null, 2));
  await b.close();
})();
