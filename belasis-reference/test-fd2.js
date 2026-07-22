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
  // list all dialogs BEFORE click
  const before = await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"]')).map((d) => ({ t: d.querySelector('h2')?.textContent?.trim() || '?', w: Math.round(d.getBoundingClientRect().width) })));
  console.log('dialogs ANTES click:', JSON.stringify(before));
  // fecha se tiver algo aberto
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 500));
  // clica no número da comanda
  const info = await page.evaluate(() => {
    // encontra a td tabela primeira linha button
    const rows = document.querySelectorAll('.ant-table-tbody tr, tbody tr');
    const firstRowBtn = rows[0]?.querySelector('button.text-primary');
    if (!firstRowBtn) return { note: 'no-row-btn' };
    firstRowBtn.click();
    return { clicked: firstRowBtn.textContent?.trim() };
  });
  console.log('clicou:', JSON.stringify(info));
  await new Promise((r) => setTimeout(r, 2000));
  const after = await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"]')).map((d) => {
    const w = Math.round(d.getBoundingClientRect().width);
    const t = d.querySelector('h2')?.textContent?.trim() || '?';
    const menu = Array.from(d.querySelectorAll('nav li button')).map((b) => (b.textContent || '').trim()).filter(Boolean);
    return { t, w, menu: menu.slice(0, 6) };
  }));
  console.log('dialogs DEPOIS click:', JSON.stringify(after, null, 2));
  await b.close();
})();
