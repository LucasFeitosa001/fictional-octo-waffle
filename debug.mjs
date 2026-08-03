import { chromium } from 'playwright';

const b = await chromium.launch();
const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
const erros = [];
p.on('console', (m) => {
  if (m.type() === 'error') erros.push(m.text().slice(0, 200));
});
p.on('pageerror', (e) => erros.push('PAGEERROR ' + String(e.message).slice(0, 200)));

await p.goto('https://app.salonpass.com.br/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.fill('input[type="email"]', 'lucasfeitasa999@gmail.com');
await p.fill('input[type="password"]', 'DesignModa#2026');
await p.click('button[type="submit"]');
await p.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});

await p.goto('https://app.salonpass.com.br/reports/financial/dre', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(9000);
const gerar = p.getByRole('button', { name: /^Gerar relat/i }).first();
if (await gerar.count()) { await gerar.click().catch(() => {}); await p.waitForTimeout(7000); }

const nomes = (await p.locator('button').allInnerTexts()).filter((t) => t.trim());
console.log('BOTOES ' + JSON.stringify(nomes.slice(0, 12)));

const btn = p.getByRole('button', { name: /Gerar PDF/i }).first();
console.log('TEM_BOTAO ' + (await btn.count()));
if (await btn.count()) {
  await btn.click().catch((e) => console.log('CLIQUE_ERRO ' + String(e.message).slice(0, 80)));
  await p.waitForTimeout(9000);
  const depois = (await p.locator('button').allInnerTexts()).filter((t) => t.trim());
  console.log('BOTOES_DEPOIS ' + JSON.stringify(depois.slice(0, 12)));
  const corpo = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  console.log('DIALOGO ' + JSON.stringify(corpo.slice(0, 200)));
}
console.log('ERROS ' + JSON.stringify(erros.slice(0, 5)));
await b.close();
