import { chromium, devices } from 'playwright';

const URL_BASE = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/login-sair';

const results = [];

async function scenarioA() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const note = [];
  let ok = false;
  try {
    await page.goto(`${URL_BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    // fill email/password
    const emailSel = 'input[type="email"], input[name="email"], input[placeholder*="mail" i]';
    const passSel = 'input[type="password"]';
    await page.fill(emailSel, 'contato@fatimacabelos.com.br');
    await page.fill(passSel, 'fatima@2026');
    // click submit
    const btn = page.locator('button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar"), button[type="submit"]').first();
    await btn.click();
    await page.waitForTimeout(5000);
    const url = page.url();
    const body = await page.locator('body').innerText().catch(() => '');
    note.push(`url=${url}`);
    note.push(`hasOlá=${body.includes('Olá')}`);
    ok = !url.includes('/login') && body.includes('Olá');
    await page.screenshot({ path: `${OUT}/verify-A.png`, fullPage: true });
  } catch (e) {
    note.push(`err=${e.message}`);
    try { await page.screenshot({ path: `${OUT}/verify-A.png`, fullPage: true }); } catch {}
  }
  await browser.close();
  results.push({ scenario: 'A: Login funciona', ok, note: note.join(' | ') });
}

async function scenarioB() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const note = [];
  let ok = false;
  try {
    // Sign in via UI (safer than guessing API)
    await page.goto(`${URL_BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"], input[name="email"]', 'contato@fatimacabelos.com.br');
    await page.fill('input[type="password"]', 'fatima@2026');
    await page.locator('button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar"), button[type="submit"]').first().click();
    await page.waitForTimeout(4000);
    await page.goto(`${URL_BASE}/`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    // open sidebar via bottom nav Menu
    const menuBtn = page.locator('nav[aria-label="Navegação principal"] button[aria-label="Menu"]').first();
    if (await menuBtn.count()) {
      await menuBtn.click();
    } else {
      // fallback: any visible button whose text is exactly Menu
      await page.locator('button:has-text("Menu"):visible').first().click().catch(e => note.push(`fbMenu=${e.message}`));
    }
    await page.waitForTimeout(600);
    // click "Meu perfil" button
    const perfilBtn = page.locator('button:has-text("Meu perfil"), :text("Meu perfil")').first();
    await perfilBtn.click({ timeout: 5000 }).catch(e => note.push(`perfilClick=${e.message}`));
    await page.waitForTimeout(600);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasMinha = bodyText.includes('Minha conta');
    const hasAssin = bodyText.includes('Assinatura');
    const hasSair = bodyText.includes('Sair');
    note.push(`Minha=${hasMinha} Assin=${hasAssin} Sair=${hasSair}`);
    ok = hasMinha && hasAssin && hasSair;
    await page.screenshot({ path: `${OUT}/verify-B.png`, fullPage: true });
  } catch (e) {
    note.push(`err=${e.message}`);
    try { await page.screenshot({ path: `${OUT}/verify-B.png`, fullPage: true }); } catch {}
  }
  await browser.close();
  results.push({ scenario: 'B: Dropdown Sair aparece', ok, note: note.join(' | ') });
}

await scenarioA();
await scenarioB();
console.log(JSON.stringify(results, null, 2));
