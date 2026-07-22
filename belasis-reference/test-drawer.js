const { chromium } = require('playwright');
(async () => {
  const URL = 'https://conferences-collar-proof-mine.trycloudflare.com';
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.request.post(`${URL}/api/v1/auth/sign-in/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  });
  await page.goto(`${URL}/comandas`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 5000));
  const before = page.url();
  await page.evaluate(() => {
    const btn = document.querySelector('td button.text-primary');
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  const after = page.url();
  const drawerOpen = await page.evaluate(() => {
    return !!document.querySelector('[role="dialog"], .drawer-open, [class*="drawer" i][class*="open" i]')
        || (document.body.innerText || '').includes('Editando comanda')
        || (document.body.innerText || '').includes('Nova comanda')
        || (document.body.innerText || '').includes('Itens da comanda');
  });
  console.log('URL antes:', before);
  console.log('URL depois:', after);
  console.log('Rota mudou?', before !== after);
  console.log('Drawer aberto?', drawerOpen);
  await b.close();
})();
