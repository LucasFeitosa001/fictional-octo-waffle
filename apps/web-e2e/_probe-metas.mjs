import { chromium } from '@playwright/test';

const BASE = 'https://continues-experience-engines-workstation.trycloudflare.com';
const EMAIL = 'lucasfeitasa999@gmail.com';
const PASS = 'teste12345';

async function login(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().waitFor({ timeout: 30000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/sign-in/email') && r.request().method() === 'POST', { timeout: 30000 }),
    page.getByRole('button', { name: 'Entrar', exact: true }).click(),
  ]);
  await page.waitForTimeout(1800);
}

async function probe(browser, label, viewport, mobile) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await login(page);
  await page.goto(BASE + '/metas', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  // Open create
  if (mobile) await page.getByRole('button', { name: 'Novo', exact: true }).click();
  else await page.locator('button.button--primary').filter({ hasText: 'Novo' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ timeout: 8000 });
  await page.waitForTimeout(800);
  // Dump all buttons inside dialog
  const btns = await dlg.getByRole('button').all();
  const names = [];
  for (const b of btns) {
    const name = await b.evaluate((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)).catch(() => '?');
    const haspopup = await b.getAttribute('aria-haspopup').catch(() => null);
    names.push({ name, haspopup });
  }
  // Try clicking the Profissional select and read options
  let optionTexts = [];
  try {
    await dlg.getByRole('button', { name: 'Profissional' }).click({ timeout: 4000 });
    await page.waitForTimeout(600);
    const opts = await page.getByRole('option').all();
    for (const o of opts.slice(0, 6)) optionTexts.push((await o.innerText()).trim().slice(0, 30));
  } catch (e) {
    optionTexts = ['PROF-BTN-FAIL: ' + String(e).slice(0, 120)];
  }
  await ctx.close();
  return { label, dialogButtons: names, optionTexts };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const d = await probe(browser, 'desktop', { width: 1366, height: 900 }, false);
  const m = await probe(browser, 'mobile', { width: 390, height: 844 }, true);
  await browser.close();
  console.log(JSON.stringify({ desktop: d, mobile: m }, null, 2));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
