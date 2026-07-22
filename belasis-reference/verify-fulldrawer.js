const { chromium } = require('playwright');
(async () => {
  const URL = 'https://conferences-collar-proof-mine.trycloudflare.com';
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await b.newContext({ viewport: { width: 1440, height: 900 } }).then((c) => c.newPage());
  await page.request.post(`${URL}/api/v1/auth/sign-in/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  });
  const routes = ['/comandas', '/clientes', '/servicos', '/produtos'];
  for (const r of routes) {
    await page.goto(`${URL}${r}`);
    await new Promise((rs) => setTimeout(rs, 4000));
    // clica na 1a linha da tabela (any button.text-primary)
    const clicked = await page.evaluate(() => {
      const b = document.querySelector('.ant-table-tbody tr button.text-primary, tbody tr button.text-primary');
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clicked) { console.log(`${r}: sem row click`); continue; }
    await new Promise((rs) => setTimeout(rs, 1500));
    const info = await page.evaluate(() => {
      const dlgs = Array.from(document.querySelectorAll('[role="dialog"]')).map((d) => ({
        w: Math.round(d.getBoundingClientRect().width),
        h: Math.round(d.getBoundingClientRect().height),
        title: d.querySelector('h2')?.textContent?.trim().slice(0, 40),
        tabs: Array.from(d.querySelectorAll('nav button')).map((b) => (b.textContent || '').trim().slice(0, 20)).filter(Boolean),
      }));
      return dlgs.filter((d) => d.w > 500);  // ignora dialogs vazios
    });
    console.log(`${r}: ${JSON.stringify(info[0] || 'nenhum drawer largo')}`);
    await page.keyboard.press('Escape');
    await new Promise((rs) => setTimeout(rs, 500));
  }
  await b.close();
})();
