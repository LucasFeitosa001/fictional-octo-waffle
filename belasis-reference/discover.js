// Discovery: reuse saved auth (state.json). Expand every nav group, collect all
// routes + drawer buttons, download all CSS via network. No login, no screenshots.
const { chromium } = require('playwright');
const fs = require('fs');
const REF = __dirname;
const STATE = REF + '/state.json';
fs.mkdirSync(REF + '/_shared/css', { recursive: true });

async function main() {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1600 }, locale: 'pt-BR', storageState: STATE });
  const page = await ctx.newPage();

  const cssSeen = new Set();
  page.on('response', async (res) => {
    try {
      const url = res.url();
      const ct = res.headers()['content-type'] || '';
      if ((/\.css(\?|$)/i.test(url) || /text\/css/i.test(ct)) && !cssSeen.has(url)) {
        cssSeen.add(url);
        const body = await res.body();
        const name = (url.split('/').pop().split('?')[0] || ('sheet' + cssSeen.size + '.css')).replace(/[^\w.\-]/g, '_');
        fs.writeFileSync(REF + '/_shared/css/' + name, body);
      }
    } catch (e) {}
  });

  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(7000);
  if (/\/login/.test(page.url())) { console.log('AUTH INVÁLIDA →', page.url()); await b.close(); process.exit(2); }
  console.log('AUTH OK →', page.url());

  // Expand every collapsible nav group (antd submenu titles / group headers)
  const groupTexts = ['Principal','Financeiro','Comissões','Cadastros','Controle','Relatórios','Marketing','Configurações','IA','WhatsApp'];
  for (let pass = 0; pass < 2; pass++) {
    for (const gt of groupTexts) {
      const el = page.locator(`:is(li,div,a,span)`, { hasText: new RegExp('^\\s*' + gt + '\\s*$', 'i') }).first();
      try { if (await el.count()) { await el.click({ timeout: 1500, force: true }); await page.waitForTimeout(400); } } catch (e) {}
    }
  }
  await page.waitForTimeout(1000);

  const inv = await page.evaluate(() => {
    const links = new Set();
    for (const a of document.querySelectorAll('a[href]')) {
      const h = a.getAttribute('href') || '';
      if (h.startsWith('/') && !h.startsWith('//') && !/^\/(logout|login)/.test(h)) links.add(h.split('?')[0].replace(/\/$/, '') || '/');
    }
    const btns = [];
    for (const el of document.querySelectorAll('button,[role=button],a')) {
      const t = (el.innerText || '').trim();
      if (t && t.length < 40 && /^\+?\s*(Nov[ao]|Adicionar|Cadastrar|Criar|Registrar|Gerar|Emitir)\b/i.test(t)) btns.push(t);
    }
    // full sidebar text so we can see groups even if not links yet
    const sider = document.querySelector('[class*=sider i],[class*=sidebar i],aside,nav');
    return { links: [...links].sort(), btns: [...new Set(btns)], siderText: sider ? (sider.innerText || '').slice(0, 2000) : '' };
  });

  fs.writeFileSync(REF + '/_discovery.json', JSON.stringify({ url: page.url(), links: inv.links, btns: inv.btns, cssFiles: [...cssSeen] }, null, 2));
  console.log('\n=== NAV LINKS (' + inv.links.length + ') ===');
  console.log(inv.links.join('\n'));
  console.log('\n=== DRAWER BUTTONS on /wow ===\n' + inv.btns.join(' | '));
  console.log('\n=== CSS FILES: ' + cssSeen.size + ' ===');
  console.log('\n=== SIDEBAR TEXT ===\n' + inv.siderText);
  await b.close();
}
main().catch(e => { console.error('FATAL', e.message); process.exit(1); });
