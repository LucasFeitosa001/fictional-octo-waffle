import { chromium, devices } from 'playwright';

const BASE = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/delete-cat-prove';

const results = {};

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['iPhone 13'] });
const page = await context.newPage();

// Login via API to set cookies
const loginRes = await context.request.post(`${BASE}/api/v1/auth/sign-in/email`, {
  data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  headers: { 'content-type': 'application/json' },
});
console.log('login:', loginRes.status());
const loginBody = await loginRes.text();
console.log('login body:', loginBody.slice(0, 200));

async function probe(name, url, file) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch {}
  await page.waitForTimeout(2500);
  await page.screenshot({ path: file, fullPage: true });
  const counts = await page.evaluate(() => ({
    trash: document.querySelectorAll('ul button[aria-label*="Excluir"]').length,
    pencil: document.querySelectorAll('ul button[aria-label*="Editar"]').length,
    trashAll: document.querySelectorAll('button[aria-label*="Excluir"]').length,
    pencilAll: document.querySelectorAll('button[aria-label*="Editar"]').length,
  }));
  results[name] = counts;
  console.log(name, counts);
}

await probe('A', `${BASE}/categorias`, `${OUT}/A-categorias.png`);
await probe('B', `${BASE}/financeiro/cadastros/categorias`, `${OUT}/B-fin-categorias.png`);

console.log('RESULTS', JSON.stringify(results));
await browser.close();
