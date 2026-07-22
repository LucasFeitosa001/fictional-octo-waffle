import { chromium } from '@playwright/test';

const BASE = 'https://continues-experience-engines-workstation.trycloudflare.com';
const EMAIL = 'lucasfeitasa999@gmail.com';
const PASS = 'teste12345';
const SHOT = '/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/6b417d23-625b-4c63-ba8f-a4fefe6be6c0/scratchpad';
const STAMP = Date.now().toString(36).slice(-5);

const api = (p) => (r) => r.url().includes('/api/v1' + p);
const isPost = (r) => r.request().method() === 'POST';

async function actAndWait(page, action, pred, timeout = 45000) {
  const [resp] = await Promise.all([page.waitForResponse(pred, { timeout }), action()]);
  let body = null;
  try { body = await resp.json(); } catch {}
  return { status: resp.status(), body };
}

async function login(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().waitFor({ timeout: 30000 });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  const r = await actAndWait(
    page,
    () => page.getByRole('button', { name: 'Entrar', exact: true }).click(),
    (rp) => rp.url().includes('/auth/sign-in/email') && isPost(rp),
    30000,
  );
  await page.waitForTimeout(2000);
  return r.status;
}

async function openMetaCreate(page, mobile) {
  if (mobile) {
    await page.locator('nav[aria-label="Navegação principal"] button', { hasText: 'Novo' }).first().click();
  } else {
    await page.locator('button.button--primary', { hasText: 'Novo' }).first().click();
  }
}

async function runMetas(page, mobile) {
  const res = {};
  await page.goto(BASE + '/metas', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await openMetaCreate(page, mobile);
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ timeout: 10000 });
  // Trigger accessible name CONTAINS "Profissional" (aria-label) + selected value → non-exact.
  const profTrigger = dlg.getByRole('button', { name: 'Profissional' });
  await profTrigger.waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  await profTrigger.click();
  await page.waitForTimeout(600);
  const opts = page.getByRole('option');
  await opts.first().waitFor({ timeout: 8000 });
  const count = await opts.count();
  let profName = null;
  for (let i = 0; i < count; i++) {
    const t = (await opts.nth(i).innerText()).trim();
    if (t && t !== 'Todos') { profName = t; await opts.nth(i).click(); break; }
  }
  res.professional = profName;
  await page.waitForTimeout(500);
  await dlg.getByLabel('Alvo').fill('1500');
  const created = await actAndWait(
    page,
    () => dlg.getByRole('button', { name: 'Salvar', exact: true }).click(),
    (r) => api('/goals')(r) && isPost(r),
  );
  res.createHttp = created.status;
  res.employeeId = created.body?.employeeId;
  res.target = created.body?.target;
  res.period = created.body?.period;
  res.profMatchesEmployee = created.body?.employeeId != null;
  await dlg.getByRole('button', { name: 'Fechar' }).first().click().catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(1800);
  res.profVisibleInColumn = await page.locator(`text=${profName}`).first().isVisible().catch(() => false);
  // Filter by that professional.
  const filterBtn = page.getByRole('button', { name: 'Todos', exact: true });
  if (await filterBtn.count()) {
    await filterBtn.first().click();
    await page.waitForTimeout(500);
    const fopt = page.getByRole('option', { name: profName });
    if (await fopt.count()) { await fopt.first().click(); await page.waitForTimeout(400); }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1000);
    res.filterProfVisible = await page.locator(`text=${profName}`).first().isVisible().catch(() => false);
    res.filterEmptyState = await page.locator('text=Nenhuma meta encontrada').first().isVisible().catch(() => false);
    // Count meta rows visible under filter (desktop table rows or mobile cards).
    res.filterRowCount = mobile
      ? await page.locator('div.md\\:hidden [class*="rounded-xl"]').count().catch(() => -1)
      : await page.locator('table tbody tr').count().catch(() => -1);
  } else {
    res.filterBtnFound = false;
  }
  return res;
}

// Mobile anamnese list truth: create a model, reload, screenshot, filter via search.
async function mobileAnamneseList(page) {
  const res = {};
  const modelName = `AnaListChk ${STAMP}`;
  await page.goto(BASE + '/cadastros/anamneses', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Anamneses' }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await page.locator('nav[aria-label="Navegação principal"] button', { hasText: 'Novo' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Ex.: Anamnese Capilar').waitFor({ timeout: 10000 });
  await dlg.getByPlaceholder('Ex.: Anamnese Capilar').fill(modelName);
  await dlg.getByPlaceholder('Pergunta 1').fill('P1?');
  await dlg.getByRole('button', { name: 'Adicionar pergunta' }).click();
  await dlg.getByPlaceholder('Pergunta 2').fill('P2?');
  const created = await actAndWait(
    page,
    () => dlg.getByRole('button', { name: 'Salvar', exact: true }).click(),
    (r) => api('/anamnesis-templates')(r) && isPost(r),
  );
  res.createHttp = created.status;
  res.id = created.body?.id;

  // Reload, wait for the templates GET to complete deterministically.
  const [listResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/anamnesis-templates') && r.request().method() === 'GET', { timeout: 20000 }).catch(() => null),
    page.goto(BASE + '/cadastros/anamneses', { waitUntil: 'domcontentloaded' }),
  ]);
  res.listGetStatus = listResp ? listResp.status() : 'none';
  if (listResp) {
    const arr = await listResp.json().catch(() => null);
    res.listCount = Array.isArray(arr) ? arr.length : 'n/a';
    res.modelInApiList = Array.isArray(arr) ? arr.some((t) => t.name === modelName) : false;
  }
  await page.getByRole('heading', { name: 'Anamneses' }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  // Before search: is the card visible at top (createdAt desc)?
  res.visibleBeforeSearch = await page.locator(`text=${modelName}`).first().isVisible().catch(() => false);
  await page.screenshot({ path: `${SHOT}/mobile-analist-before.png` }).catch(() => {});
  // Now filter via the mobile search box.
  const search = page.getByLabel('Buscar modelo de anamnese');
  await search.waitFor({ timeout: 8000 });
  await search.fill(modelName);
  const cardVisible = await page.locator(`text=${modelName}`).first()
    .waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  res.visibleAfterSearch = cardVisible;
  await page.screenshot({ path: `${SHOT}/mobile-analist-after.png` }).catch(() => {});
  res.listInnerText = await page.locator('ul').first().innerText().catch(() => '(no ul)');
  return res;
}

async function runViewport(browser, label, viewport, mobile, withAnaList) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const out = { label };
  out.loginHttp = await login(page);
  try { out.metas = await runMetas(page, mobile); }
  catch (e) {
    out.metas = { error: String(e).slice(0, 300) };
    await page.screenshot({ path: `${SHOT}/${label}-metas-probe-fail.png` }).catch(() => {});
  }
  if (withAnaList) {
    try { out.anaList = await mobileAnamneseList(page); }
    catch (e) { out.anaList = { error: String(e).slice(0, 300) }; }
  }
  await ctx.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const desktop = await runViewport(browser, 'desktop', { width: 1366, height: 900 }, false, false);
  const mobile = await runViewport(browser, 'mobile', { width: 390, height: 844 }, true, true);
  await browser.close();
  console.log('===PROBE_JSON_START===');
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
  console.log('===PROBE_JSON_END===');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
