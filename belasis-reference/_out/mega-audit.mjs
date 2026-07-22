import { chromium, devices } from 'playwright';

const BASE = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/mega';
const routes = [
  '/comandas','/clientes','/profissionais','/produtos','/servicos','/categorias','/marcas','/pacotes','/fornecedores','/cadastros/anamneses',
  '/financeiro/transacoes','/financeiro/contas','/financeiro/notas-fiscais','/financeiro/caixas','/financeiro/caixas/historico',
  '/controle/pacotes-predefinidos',
  '/notificacoes','/notificacoes/novidades','/perfil/adicionais',
  '/'
];

const slugify = r => r.replace(/^\//,'').replace(/\//g,'_') || 'root';

(async () => {
  const res = await fetch(`${BASE}/api/v1/auth/sign-in/email`, {
    method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({email:'contato@fatimacabelos.com.br', password:'fatima@2026'})
  });
  const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.raw?.()['set-cookie']||[]);
  const body = await res.json().catch(()=>({}));
  const token = body?.token || body?.session?.token;

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const cookies = [];
  for (const c of setCookie) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    cookies.push({ name: pair.slice(0,idx).trim(), value: pair.slice(idx+1).trim(), url: BASE });
  }
  if (cookies.length) await ctx.addCookies(cookies);
  if (token) await ctx.addInitScript(t => { try { localStorage.setItem('token', t); localStorage.setItem('auth_token', t); } catch(e){} }, token);
  const page = await ctx.newPage();

  const results = [];
  for (const route of routes) {
    const slug = slugify(route);
    const shot = `${OUT}/${slug}.png`;
    const entry = { route, ok:false, note:'' };
    try {
      await page.goto(BASE + route, { waitUntil:'networkidle', timeout: 30000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: shot });
      const info = await page.evaluate(() => {
        const hasH1 = !!document.querySelector('h1');
        const title = document.querySelector('h1')?.innerText?.slice(0,60) || '';
        const searchInput = Array.from(document.querySelectorAll('input')).find(i => (i.placeholder||'').toLowerCase().includes('digite para buscar'));
        const searchVisible = !!(searchInput && searchInput.offsetParent !== null);
        const uls = Array.from(document.querySelectorAll('ul'));
        const mobileList = uls.find(u => u.className && /md:hidden/.test(u.className)) || uls.find(u => u.offsetParent !== null && u.children.length > 0);
        let cardCount = 0, avgH = 0;
        if (mobileList) {
          const items = Array.from(mobileList.children);
          cardCount = items.length;
          const first3 = items.slice(0,3);
          if (first3.length) avgH = Math.round(first3.reduce((s,el)=>s+el.getBoundingClientRect().height,0)/first3.length);
        }
        let creamWrap = false;
        if (mobileList) {
          let p = mobileList.parentElement;
          while (p && p !== document.body) {
            const cls = p.className || '';
            if (typeof cls === 'string' && /(bg-warm-white|bg-cream)/.test(cls)) { creamWrap = true; break; }
            p = p.parentElement;
          }
        }
        return { hasH1, title, searchVisible, cardCount, avgH, creamWrap, hasList: !!mobileList };
      });

      const notes = [];
      if (!info.hasH1) notes.push('sem h1');
      else notes.push(`h1="${info.title}"`);
      const isPainel = route === '/';
      const isForm = !info.hasList;
      if (!isPainel && !isForm) {
        if (!info.searchVisible) notes.push('search ausente');
        if (info.creamWrap) notes.push('CARD CREME wrapper');
        if (info.cardCount > 0 && (info.avgH < 40 || info.avgH > 130)) notes.push(`altura card=${info.avgH}px fora 60-100`);
        else if (info.cardCount > 0) notes.push(`altura=${info.avgH}px cards=${info.cardCount}`);
        else notes.push('lista vazia');
      } else if (isForm) {
        notes.push('sem lista (form/dashboard)');
      }
      const bad = notes.some(n => /sem h1|CARD CREME|fora 60-100/.test(n));
      entry.ok = !bad;
      entry.note = notes.join('; ');
    } catch(e) {
      entry.note = 'ERR ' + String(e.message||e).slice(0,120);
    }
    results.push(entry);
    console.error(route, entry.ok?'OK':'FAIL', entry.note);
  }

  await browser.close();
  const passed = results.filter(r=>r.ok).length;
  const failed = results.length - passed;
  console.log(JSON.stringify({ results, passed, failed }, null, 2));
})();
