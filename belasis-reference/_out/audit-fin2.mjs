import { chromium, devices } from 'playwright';

const BASE = 'https://conferences-collar-proof-mine.trycloudflare.com';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/audit-mobile';
const routes = ["/financeiro/notas-fiscais","/financeiro/belasis-pay","/financeiro/cadastros/categorias"];

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
  // Add cookies from set-cookie
  const cookies = [];
  for (const c of setCookie) {
    const [pair] = c.split(';');
    const idx = pair.indexOf('=');
    const name = pair.slice(0,idx).trim();
    const value = pair.slice(idx+1).trim();
    cookies.push({ name, value, url: BASE });
  }
  if (cookies.length) await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  if (token) await ctx.addInitScript(t => { try { localStorage.setItem('token', t); localStorage.setItem('auth_token', t); } catch(e){} }, token);

  const results = [];
  for (const route of routes) {
    const slug = slugify(route);
    const shot = `${OUT}/${slug}.png`;
    const entry = { route, grade:'error', issues:[], cardHeight:0, screenshotPath: shot };
    try {
      await page.goto(BASE + route, { waitUntil:'networkidle', timeout: 30000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: shot });
      const info = await page.evaluate(() => {
        const q = sel => document.querySelector(sel);
        const searchInput = Array.from(document.querySelectorAll('input')).find(i => (i.placeholder||'').toLowerCase().includes('digite para buscar'));
        const searchVisible = !!(searchInput && searchInput.offsetParent !== null);
        const uls = Array.from(document.querySelectorAll('ul'));
        const mobileList = uls.find(u => u.className && /md:hidden/.test(u.className)) || uls.find(u => u.offsetParent !== null);
        let cardCount = 0, avgH = 0, hasDelete = false, hasCheckbox = false;
        if (mobileList) {
          const items = Array.from(mobileList.children);
          cardCount = items.length;
          const first3 = items.slice(0,3);
          if (first3.length) avgH = Math.round(first3.reduce((s,el)=>s+el.getBoundingClientRect().height,0)/first3.length);
          for (const it of first3) {
            if (/Excluir/.test(it.textContent||'')) hasDelete = true;
            if (it.querySelector('input[type=checkbox]')) hasCheckbox = true;
          }
        }
        // Check for cream/warm-white ancestor around list
        let creamWrap = false;
        if (mobileList) {
          let p = mobileList.parentElement;
          while (p && p !== document.body) {
            const cls = p.className || '';
            if (typeof cls === 'string' && /(bg-warm-white|bg-cream)/.test(cls)) { creamWrap = true; break; }
            p = p.parentElement;
          }
        }
        const fab = !!document.querySelector('button.rounded-full.fixed');
        const bodyText = document.body.innerText.slice(0,200);
        const isForm = !mobileList && document.querySelectorAll('form input, form select').length > 3;
        return { searchVisible, cardCount, avgH, hasDelete, hasCheckbox, creamWrap, fab, isForm, hasList: !!mobileList, snippet: bodyText };
      });

      entry.cardHeight = info.avgH;
      const issues = [];
      if (!info.hasList && info.isForm) {
        entry.grade = 'not-list';
        entry.issues = ['form/dashboard page'];
        results.push(entry); continue;
      }
      if (!info.hasList) {
        entry.grade = 'not-list';
        entry.issues = ['no list found - likely dashboard/form'];
        results.push(entry); continue;
      }
      if (!info.searchVisible) issues.push('search input "Digite para buscar" ausente/invisível');
      if (info.creamWrap) issues.push('Card creme wrapper (bg-warm-white/bg-cream) ao redor da lista');
      if (info.hasDelete) issues.push('botão Excluir dentro do card');
      if (info.hasCheckbox) issues.push('checkbox de seleção dentro do card');
      if (info.avgH > 100) issues.push(`altura do card ${info.avgH}px > 100px`);
      if (info.cardCount === 0) issues.push('lista vazia (sem cards)');

      let grade = 'match';
      if (info.creamWrap || info.avgH > 100 || issues.length >= 3) grade = 'needs-refactor';
      else if (issues.length >= 1) grade = 'partial';
      entry.grade = grade;
      entry.issues = issues;
    } catch(e) {
      entry.issues = [String(e.message||e)];
    }
    results.push(entry);
  }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
