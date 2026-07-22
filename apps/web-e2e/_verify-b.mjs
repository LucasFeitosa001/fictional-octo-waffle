import { chromium } from '@playwright/test';

const BASE = 'https://continues-experience-engines-workstation.trycloudflare.com';
const EMAIL = 'lucasfeitasa999@gmail.com';
const PASS = 'teste12345';
const SHOT = '/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/6b417d23-625b-4c63-ba8f-a4fefe6be6c0/scratchpad';
const STAMP = Date.now().toString(36).slice(-5);

const api = (p) => (r) => r.url().includes('/api/v1' + p);
const isPost = (r) => r.request().method() === 'POST';
const isPatch = (r) => r.request().method() === 'PATCH';

async function actAndWait(page, action, pred, timeout = 45000) {
  const [resp] = await Promise.all([page.waitForResponse(pred, { timeout }), action()]);
  let body = null;
  try { body = await resp.json(); } catch {}
  return { status: resp.status(), body, url: resp.url(), method: resp.request().method() };
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
  await page.waitForTimeout(1800);
  return r.status;
}

async function openFirstClient(page, mobile) {
  await page.goto(BASE + '/clientes', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  let nameBtn;
  if (mobile) nameBtn = page.locator('ul li button').first();
  else nameBtn = page.locator('table tbody tr').first().locator('button').first();
  await nameBtn.waitFor({ timeout: 20000 });
  const name = (await nameBtn.innerText()).trim();
  await nameBtn.click();
  await page.waitForTimeout(1500);
  return name;
}

async function runAnamnese(page, mobile) {
  const res = { model: {}, ficha: {} };
  const modelName = `Anamnese ${mobile ? 'M' : 'D'} ${STAMP}`;
  await page.goto(BASE + '/cadastros/anamneses', { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Anamneses' }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  if (mobile) await page.getByRole('button', { name: 'Novo', exact: true }).click();
  else await page.getByRole('button', { name: 'Criar', exact: true }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Ex.: Anamnese Capilar').waitFor({ timeout: 10000 });
  await dlg.getByPlaceholder('Ex.: Anamnese Capilar').fill(modelName);
  await dlg.getByPlaceholder('Pergunta 1').fill('Possui alergia?');
  await dlg.getByRole('button', { name: 'Adicionar pergunta' }).click();
  await dlg.getByPlaceholder('Pergunta 2').fill('Usa medicacao continua?');
  const created = await actAndWait(
    page,
    () => dlg.getByRole('button', { name: 'Salvar', exact: true }).click(),
    (r) => api('/anamnesis-templates')(r) && isPost(r),
  );
  res.model.http = created.status;
  res.model.name = created.body?.name;
  res.model.questionsCount = Array.isArray(created.body?.questionsJson) ? created.body.questionsJson.length : null;
  res.model.id = created.body?.id;
  await page.goto(BASE + '/cadastros/anamneses', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  res.model.persistedVisible = await page.locator(`text=${modelName}`).first().isVisible().catch(() => false);
  res.model.showsTwoPerguntas = await page.locator('text=2 perguntas').first().isVisible().catch(() => false);

  const clientName = await openFirstClient(page, mobile);
  res.ficha.client = clientName;
  const perfil = page.getByRole('dialog');
  await perfil.getByRole('button', { name: 'Anamneses', exact: true }).click();
  await page.waitForTimeout(1200);
  await perfil.getByRole('button', { name: 'Nova ficha' }).click();
  await page.waitForTimeout(700);
  await perfil.getByRole('button', { name: /Sem modelo/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('option', { name: modelName }).click();
  await page.waitForTimeout(400);
  const fichaCreated = await actAndWait(
    page,
    () => perfil.getByRole('button', { name: 'Criar ficha' }).click(),
    (r) => /\/customers\/[^/]+\/anamneses$/.test(new URL(r.url()).pathname) && isPost(r),
  );
  res.ficha.createHttp = fichaCreated.status;
  res.ficha.anamId = fichaCreated.body?.id;
  await page.waitForTimeout(1300);
  const answers = perfil.getByPlaceholder('Resposta');
  await answers.first().waitFor({ timeout: 8000 });
  const n = await answers.count();
  res.ficha.answerFields = n;
  if (n >= 1) await answers.nth(0).fill('Nao');
  if (n >= 2) await answers.nth(1).fill('Sim, losartana');
  const saved = await actAndWait(
    page,
    () => perfil.getByRole('button', { name: 'Salvar respostas' }).click(),
    (r) => /\/customers\/[^/]+\/anamneses\/[^/]+$/.test(new URL(r.url()).pathname) && isPatch(r),
  );
  res.ficha.saveAnswersHttp = saved.status;
  await page.waitForTimeout(900);
  const signed = await actAndWait(
    page,
    () => perfil.getByRole('button', { name: 'Assinar' }).click(),
    (r) => /\/customers\/[^/]+\/anamneses\/[^/]+$/.test(new URL(r.url()).pathname) && isPatch(r),
  );
  res.ficha.signHttp = signed.status;
  res.ficha.signedAt = signed.body?.signedAt;
  await page.waitForTimeout(1300);
  await openFirstClient(page, mobile);
  const perfil2 = page.getByRole('dialog');
  await perfil2.getByRole('button', { name: 'Anamneses', exact: true }).click();
  await page.waitForTimeout(1600);
  res.ficha.persistedAssinada = await perfil2.locator('text=Assinada').first().isVisible().catch(() => false);
  res.ficha.persistedModelName = await perfil2.locator(`text=${modelName}`).first().isVisible().catch(() => false);
  await page.keyboard.press('Escape').catch(() => {});
  return res;
}

async function runMetas(page, mobile) {
  const res = {};
  await page.goto(BASE + '/metas', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: 'Novo', exact: true }).click();
  const dlg = page.getByRole('dialog');
  await dlg.waitFor({ timeout: 10000 });
  await page.waitForTimeout(700);
  await dlg.getByRole('button', { name: 'Todos', exact: true }).click();
  await page.waitForTimeout(500);
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
  await dlg.getByRole('button', { name: 'Fechar' }).click().catch(() => {});
  await page.waitForTimeout(1800);
  res.profVisibleInColumn = await page.locator(`text=${profName}`).first().isVisible().catch(() => false);
  const filterBtn = page.getByRole('button', { name: 'Todos', exact: true });
  if (await filterBtn.count()) {
    await filterBtn.first().click();
    await page.waitForTimeout(500);
    const fopt = page.getByRole('option', { name: profName });
    if (await fopt.count()) { await fopt.first().click(); await page.waitForTimeout(400); }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(900);
    res.filterProfVisible = await page.locator(`text=${profName}`).first().isVisible().catch(() => false);
    res.filterEmptyState = await page.locator('text=Nenhuma meta encontrada').first().isVisible().catch(() => false);
  }
  return res;
}

async function runCashback(page, mobile) {
  const res = { config: {}, redeem: {} };
  await page.goto(BASE + '/marketing/cashback', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.waitForTimeout(1100);
  const activeChk = page.locator('label:has-text("Ativar programa de cashback") input[type="checkbox"]');
  await activeChk.waitFor({ timeout: 8000 });
  if (!(await activeChk.isChecked())) await activeChk.check();
  const valInput = page.getByLabel('Valor padrão', { exact: true });
  await valInput.fill('10');
  const savedCfg = await actAndWait(
    page,
    () => page.getByRole('button', { name: 'Salvar configurações' }).click(),
    (r) => api('/cashback/config')(r) && isPost(r),
  );
  res.config.http = savedCfg.status;
  res.config.active = savedCfg.body?.cashbackActive;
  res.config.value = savedCfg.body?.cashbackValue;
  res.config.savedMsg = await page.locator('text=Configurações salvas com sucesso').first().isVisible().catch(() => false);
  await page.goto(BASE + '/marketing/cashback', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Configurações' }).click();
  await page.waitForTimeout(1300);
  const activeChk2 = page.locator('label:has-text("Ativar programa de cashback") input[type="checkbox"]');
  res.config.persistedActive = await activeChk2.isChecked().catch(() => false);
  res.config.persistedValue = await page.getByLabel('Valor padrão', { exact: true }).inputValue().catch(() => null);

  await openFirstClient(page, mobile);
  const perfil = page.getByRole('dialog');
  await perfil.getByRole('button', { name: 'Cashback', exact: true }).click();
  await page.waitForTimeout(1600);
  await perfil.getByRole('button', { name: 'Gerar', exact: true }).click();
  await page.waitForTimeout(600);
  await perfil.getByLabel('Valor', { exact: true }).fill('20');
  const grant = await actAndWait(
    page,
    () => perfil.getByRole('button', { name: 'Confirmar' }).click(),
    (r) => /\/customers\/[^/]+\/cashback\/adjust$/.test(new URL(r.url()).pathname) && isPost(r),
  );
  res.redeem.grantHttp = grant.status;
  res.redeem.saldoAfterGrant = grant.body?.saldo ?? grant.body?.balance;
  await page.waitForTimeout(1600);
  await perfil.getByRole('button', { name: 'Resgatar', exact: true }).click();
  await page.waitForTimeout(600);
  await perfil.getByLabel('Valor', { exact: true }).fill('5');
  const redeem = await actAndWait(
    page,
    () => perfil.getByRole('button', { name: 'Confirmar' }).click(),
    (r) => /\/customers\/[^/]+\/cashback\/redeem$/.test(new URL(r.url()).pathname) && isPost(r),
  );
  res.redeem.http = redeem.status;
  res.redeem.saldoAfterRedeem = redeem.body?.saldo ?? redeem.body?.balance;
  res.redeem.changed =
    res.redeem.saldoAfterGrant != null && res.redeem.saldoAfterRedeem != null &&
    Number(res.redeem.saldoAfterRedeem) !== Number(res.redeem.saldoAfterGrant);
  await page.keyboard.press('Escape').catch(() => {});
  return res;
}

async function runViewport(browser, label, viewport, mobile) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const out = { label };
  try {
    out.loginHttp = await login(page);
  } catch (e) {
    out.loginError = String(e).slice(0, 300);
    await page.screenshot({ path: `${SHOT}/${label}-login-fail.png` }).catch(() => {});
    await context.close();
    return out;
  }
  for (const [key, fn] of [['anamnese', runAnamnese], ['metas', runMetas], ['cashback', runCashback]]) {
    try {
      out[key] = await fn(page, mobile);
    } catch (e) {
      out[key] = { error: String(e).slice(0, 400) };
      await page.screenshot({ path: `${SHOT}/${label}-${key}-fail.png` }).catch(() => {});
      try { out[key].domSnippet = (await page.locator('body').innerText()).slice(0, 500); } catch {}
    }
  }
  await context.close();
  return out;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const desktop = await runViewport(browser, 'desktop', { width: 1366, height: 900 }, false);
  const mobile = await runViewport(browser, 'mobile', { width: 390, height: 844 }, true);
  await browser.close();
  console.log('===RESULT_JSON_START===');
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
  console.log('===RESULT_JSON_END===');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
