import { chromium, devices } from 'playwright';

const API = 'https://conferences-collar-proof-mine.trycloudflare.com';
const WEB = 'http://localhost:5173';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/impl-parity';

const ROUTES = [
  { path: '/agenda', slug: 'agenda' },
  { path: '/comandas', slug: 'comandas' },
  { path: '/clientes', slug: 'clientes' },
  { path: '/pacotes', slug: 'pacotes' },
  { path: '/financeiro/transacoes', slug: 'financeiro-transacoes' },
  { path: '/financeiro/contas', slug: 'financeiro-contas' },
  { path: '/financeiro/cadastros/formas-pagamento', slug: 'financeiro-cadastros-formas-pagamento' },
  { path: '/financeiro/notas-fiscais', slug: 'financeiro-notas-fiscais' },
  { path: '/servicos', slug: 'servicos' },
  { path: '/produtos', slug: 'produtos' },
  { path: '/marcas', slug: 'marcas' },
  { path: '/configuracoes', slug: 'configuracoes' },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

// Login via UI
await page.goto(`${WEB}/entrar`, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
if (!/entrar|login|sign/i.test(page.url())) {
  await page.goto(`${WEB}/`, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
}
await page.waitForTimeout(800);
try {
  await page.fill('input[type=email], input[placeholder*="salao"]', 'contato@fatimacabelos.com.br');
  await page.fill('input[type=password]', 'fatima@2026');
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 30000 }).catch(()=>{}),
    page.click('button:has-text("Entrar")'),
  ]);
  await page.waitForTimeout(2500);
  console.log('post-login url', page.url());
} catch (e) { console.log('login err', e.message); }

const results = [];

for (const r of ROUTES) {
  const entry = { route: r.path, ok: false, note: '' };
  try {
    await page.goto(`${WEB}${r.path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT}/${r.slug}.png`, fullPage: false });

    const bodyText = await page.evaluate(() => document.body.innerText || '');
    const html = await page.content();

    let ok = false, note = '';

    switch (r.path) {
      case '/agenda': {
        const has = /Diário|Semanal|Mensal/i.test(bodyText);
        const selector = await page.$('button:has-text("Diário"), button:has-text("Semanal"), button:has-text("Mensal"), select');
        ok = has;
        note = `visualização keywords=${has} selector=${!!selector}`;
        break;
      }
      case '/comandas': {
        const h1 = await page.$eval('h1', el => el.textContent).catch(()=>'');
        ok = /Comanda/i.test(h1);
        note = `h1="${h1}"`;
        break;
      }
      case '/clientes': {
        // check phone format with parens
        const phones = (bodyText.match(/\(\d{2}\)\s*\d/g) || []).length;
        ok = phones > 0;
        note = `phones-with-parens=${phones}`;
        break;
      }
      case '/pacotes': {
        const hasExpira = /Expira em/i.test(bodyText);
        // count pills on first card - look for rounded-full spans
        const pillCount = await page.evaluate(() => {
          const card = document.querySelector('ul li, [class*="card"], article');
          if (!card) return 0;
          return card.querySelectorAll('[class*="rounded-full"]').length;
        });
        ok = hasExpira;
        note = `expira=${hasExpira} pillsOnCard=${pillCount}`;
        break;
      }
      case '/financeiro/transacoes': {
        const hasChip = /Selecionar/i.test(bodyText);
        const hasJul = /jul,/i.test(bodyText);
        ok = hasChip && hasJul;
        note = `selecionar=${hasChip} jul,=${hasJul}`;
        break;
      }
      case '/financeiro/contas': {
        // tab "Formas de pagamento" not abbreviated
        const hasFull = /Formas de pagamento/i.test(bodyText);
        const hasAbbrev = /Formas de pag\.\.\./i.test(bodyText);
        ok = hasFull && !hasAbbrev;
        note = `fullTab=${hasFull} abbrev=${hasAbbrev}`;
        break;
      }
      case '/financeiro/cadastros/formas-pagamento': {
        const hasTaxa = /Taxa/i.test(bodyText);
        ok = hasTaxa;
        note = `subtitleTaxa=${hasTaxa}`;
        break;
      }
      case '/financeiro/notas-fiscais': {
        const h1 = await page.$eval('h1', el => el.textContent).catch(()=>'');
        ok = !!h1;
        note = `h1="${h1}"`;
        break;
      }
      case '/servicos': {
        const h1 = await page.$eval('h1', el => el.textContent).catch(()=>'');
        ok = /Serviço/i.test(h1) || /Serviço/i.test(bodyText);
        note = `h1="${h1}"`;
        break;
      }
      case '/produtos': {
        // dropdown ordenação + thumbnails
        const hasDropdown = await page.evaluate(() => {
          return !!document.querySelector('select, button[aria-haspopup], [class*="dropdown"]');
        });
        const imgCount = await page.evaluate(() => document.querySelectorAll('img').length);
        ok = hasDropdown;
        note = `dropdown=${hasDropdown} imgs=${imgCount}`;
        break;
      }
      case '/marcas': {
        // amber play button in header
        const playAmber = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('header button, button'));
          for (const b of btns.slice(0, 20)) {
            const style = getComputedStyle(b);
            const svg = b.querySelector('svg');
            if (svg && (b.className||'').match(/amber|yellow|warning/i)) return true;
            if (svg && /rgb\(2[45]\d|rgb\(1[89]\d,\s*1[35]/.test(style.backgroundColor)) return true;
          }
          // Look for any element with amber-ish bg and play icon
          const all = Array.from(document.querySelectorAll('button'));
          return all.some(b => {
            const cn = (b.className||'').toString();
            return /amber|bg-warning|bg-yellow/.test(cn) && b.querySelector('svg');
          });
        });
        ok = playAmber;
        note = `amberPlayBtn=${playAmber}`;
        break;
      }
      case '/configuracoes': {
        const items = ['Admin', 'API', 'Minha Conta', 'Sair'];
        const present = items.filter(i => new RegExp(i, 'i').test(bodyText));
        ok = present.length === items.length;
        note = `found=[${present.join(',')}]`;
        break;
      }
    }

    entry.ok = ok;
    entry.note = note;
  } catch (e) {
    entry.ok = false;
    entry.note = `ERR: ${e.message}`;
  }
  results.push(entry);
  console.log(JSON.stringify(entry));
}

await browser.close();

const passed = results.filter(r => r.ok).length;
const failed = results.length - passed;
console.log('===RESULTS===');
console.log(JSON.stringify({ results, passed, failed }, null, 2));
