const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out';
const EMAIL = 'contato@fatimacabelos.com.br';
const PASSWORD = 'fatima@2026';

const ROUTES = [
  { path: '/pacotes', expect: 'cards compactos, FAB azul, BottomNav Selecionar' },
  { path: '/assinaturas?tab=subscribers', expect: 'tab Assinantes, search top' },
  { path: '/assinaturas?tab=plans', expect: 'empty state com CTA Clique aqui' },
  { path: '/vendas-por-assinatura', expect: 'mesma AssinaturasPage — alias' },
  { path: '/financeiro/transacoes', expect: 'chips row, cards mobile' },
  { path: '/financeiro/contas', expect: 'cards mobile, dot indicator' },
  { path: '/financeiro/contas?tab=formas', expect: 'skeleton or seed data' },
  { path: '/financeiro/cadastros/categorias', expect: 'nova página, chips de tipo' },
  { path: '/financeiro/belasis-pay', expect: 'form PJ/PF, rodapé sticky' },
  { path: '/financeiro/notas-fiscais', expect: 'upsell modal com Fechar/Contratar' },
  { path: '/financeiro/caixas-abertos', expect: 'aba Resumo NÃO Resumido' },
  { path: '/financeiro/historico-caixa', expect: 'alias funciona' },
  { path: '/agenda', expect: 'FAB azul mobile' },
  { path: '/comissoes/resumo', expect: 'labels curtos Em aberto/Pagas' },
];

function slug(p) {
  return p.replace(/^\//, '').replace(/[\/?=&]/g, '-') || 'root';
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const iphone = devices['iPhone 13'];
  const context = await browser.newContext({
    ...iphone,
    ignoreHTTPSErrors: true,
  });

  // Login via API
  const loginRes = await context.request.post(`${BASE}/api/v1/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD },
    headers: { 'Content-Type': 'application/json' },
  });
  console.log('login status', loginRes.status());
  if (!loginRes.ok()) {
    console.log('login body', await loginRes.text());
  }

  const results = [];

  for (const route of ROUTES) {
    const page = await context.newPage();
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text().slice(0, 300));
    });
    page.on('pageerror', err => errors.push('pageerror: ' + String(err).slice(0, 300)));

    let ok = false;
    let note = '';
    let h1 = '';
    let ulMobileItems = 0;
    let httpStatus = 0;
    const s = slug(route.path);
    const shot = path.join(OUT, `verify-${s}.png`);

    try {
      const resp = await page.goto(`${BASE}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      httpStatus = resp ? resp.status() : 0;
      try {
        await page.waitForLoadState('networkidle', { timeout: 15000 });
      } catch {}
      await page.waitForTimeout(3000);

      try { h1 = (await page.locator('h1').first().textContent({ timeout: 2000 }))?.trim() || ''; } catch {}
      try {
        ulMobileItems = await page.locator('ul.md\\:hidden > li').count();
      } catch {}

      await page.screenshot({ path: shot, fullPage: false });

      const bodyText = (await page.locator('body').textContent()) || '';
      const is404 = /404|não encontrada|not found/i.test(bodyText) && bodyText.length < 500;
      ok = httpStatus < 400 && !is404;
      note = `http=${httpStatus} h1="${h1}" ul-mobile-items=${ulMobileItems} errors=${errors.length}${errors.length ? ' :: ' + errors.slice(0,2).join(' | ') : ''}`;
    } catch (e) {
      note = 'exception: ' + String(e).slice(0, 300);
    }

    results.push({
      route: route.path,
      ok,
      note,
      screenshot: shot,
      h1,
      ulMobileItems,
      httpStatus,
      errors,
      expect: route.expect,
    });

    await page.close();
    console.log(route.path, ok ? 'OK' : 'FAIL', note);
  }

  await browser.close();

  const passed = results.filter(r => r.ok).length;
  const failed = results.length - passed;
  const out = { baseUrl: BASE, passed, failed, results };
  fs.writeFileSync(path.join(OUT, 'verify-mobile-fix-all.json'), JSON.stringify(out, null, 2));
  console.log(`\nPASSED=${passed} FAILED=${failed}`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
