const { chromium, devices } = require('playwright');
const URL = 'https://conferences-collar-proof-mine.trycloudflare.com';
const ROUTES = [
  { path: '/comissoes/resumo', expect: 'Comissões' },
  { path: '/comissoes/em-aberto', expect: 'Comissões' },
  { path: '/financeiro/caixas-abertos', expect: 'Caixas' },
  { path: '/financeiro/cadastros/categorias', expect: 'Categorias' },
  { path: '/financeiro/cadastros/formas-pagamento', expect: 'Contas' },
  { path: '/financeiro/cadastros/contas', expect: 'Contas' },
  { path: '/financeiro/belasis-pay', expect: 'Belasis Pay' },
  { path: '/financeiro/historico-caixa', expect: 'Histórico' },
  { path: '/vendas-por-assinatura', expect: 'Assinaturas' },
];
async function login(page) {
  const r = await page.request.post(`${URL}/api/v1/auth/sign-in/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
  });
  if (r.status() !== 200) throw new Error(`login ${r.status()}`);
}
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  await login(p);
  console.log('=== ROTAS ===');
  let ok = 0, fail = 0;
  for (const route of ROUTES) {
    await p.goto(`${URL}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 1800));
    const h1 = await p.evaluate(() => document.querySelector('h1')?.textContent?.trim() || '');
    const passed = h1.includes(route.expect);
    if (passed) ok++; else fail++;
    console.log(`  ${passed ? '✅' : '❌'} ${route.path.padEnd(46)} h1="${h1.slice(0, 40)}" (esperado contém "${route.expect}")`);
  }
  console.log(`\nROTAS: ${ok}/${ROUTES.length} passaram`);

  console.log('\n=== DRAWER SUBIR EM PACOTES ===');
  await p.goto(`${URL}/pacotes`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  const clicked = await p.evaluate(() => {
    const first = document.querySelector('ul.md\\:hidden li button');
    if (first) { first.click(); return first.textContent?.trim().slice(0, 30); }
    return null;
  });
  console.log('  clicou em:', clicked);
  await new Promise((r) => setTimeout(r, 1500));
  const panel = await p.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      const cl = typeof el.className === 'string' ? el.className : '';
      if (!/\btranslate-y-0\b/.test(cl)) continue;
      if (/\btranslate-y-full\b/.test(cl)) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 150) continue;
      return { subiu: true, className: cl.slice(0, 120), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) };
    }
    return null;
  });
  console.log(`  drawer Pacotes: ${panel ? '✅ SUBIU' : '❌ NÃO SUBIU'}`, panel || '');
  await p.screenshot({ path: '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/final-pacotes-drawer.png' });
  await b.close();
  process.exit(fail === 0 && panel ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
