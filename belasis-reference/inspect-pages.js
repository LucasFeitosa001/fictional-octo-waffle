const { chromium } = require('playwright');
(async () => {
  const URL = 'https://conferences-collar-proof-mine.trycloudflare.com';
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await b.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
  await page.request.post(`${URL}/api/v1/auth/sign-in/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  });
  const routes = ['/comandas', '/clientes', '/servicos'];
  for (const r of routes) {
    await page.goto(`${URL}${r}`);
    await new Promise((rs) => setTimeout(rs, 4000));
    const info = await page.evaluate(() => ({
      bodyText: (document.body.innerText || '').slice(0, 200),
      hasTable: !!document.querySelector('table, .ant-table'),
      rowsInTable: document.querySelectorAll('tbody tr').length,
      buttonsPrimary: document.querySelectorAll('button.text-primary').length,
      anyRowButton: document.querySelectorAll('tbody tr button').length,
    }));
    console.log(r + ':', JSON.stringify(info, null, 2));
  }
  await b.close();
})();
