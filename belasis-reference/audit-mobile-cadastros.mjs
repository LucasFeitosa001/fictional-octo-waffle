import { chromium, devices } from 'playwright';
import fs from 'fs';

const API = 'https://conferences-collar-proof-mine.trycloudflare.com';
const WEB = 'http://localhost:5173';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/audit-mobile';
const routes = ['/clientes','/profissionais','/fornecedores','/cadastros/anamneses'];

const results = [];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();

  // Login via UI
  await page.goto(`${WEB}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('input[type=email], input[name=email]', 'contato@fatimacabelos.com.br');
  await page.fill('input[type=password], input[name=password]', 'fatima@2026');
  await Promise.all([
    page.waitForURL(u => !u.toString().includes('/login'), { timeout: 30000 }).catch(()=>{}),
    page.click('button[type=submit]'),
  ]);
  await page.waitForTimeout(2000);
  console.error('post-login url', page.url());

  for (const route of routes) {
    const slug = route.replace(/^\//,'').replace(/\//g,'_');
    const shot = `${OUT}/${slug}.png`;
    const entry = { route, grade: 'error', issues: [], cardHeight: 0, screenshotPath: shot };
    try {
      await page.goto(`${WEB}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: shot, fullPage: false });

      const info = await page.evaluate(() => {
        const q = (sel) => document.querySelector(sel);
        const qa = (sel) => Array.from(document.querySelectorAll(sel));
        // search input
        const inputs = qa('input');
        const searchInput = inputs.find(i => (i.placeholder||'').toLowerCase().includes('digite para buscar'));
        const searchVisible = !!(searchInput && searchInput.offsetParent !== null);

        // mobile list ul
        const uls = qa('ul');
        let mobileUl = null;
        for (const u of uls) {
          const cls = u.className || '';
          if (typeof cls === 'string' && cls.includes('md:hidden')) { mobileUl = u; break; }
        }
        let cardCount = 0, avgH = 0, firstHeights=[];
        let hasDelete=false, hasCheckbox=false, creamAncestor=false;
        if (mobileUl) {
          const cards = Array.from(mobileUl.children);
          cardCount = cards.length;
          const first3 = cards.slice(0,3);
          firstHeights = first3.map(c => c.getBoundingClientRect().height);
          avgH = firstHeights.length ? firstHeights.reduce((a,b)=>a+b,0)/firstHeights.length : 0;
          for (const c of first3) {
            if (c.querySelector('input[type=checkbox]')) hasCheckbox = true;
            const btns = c.querySelectorAll('button');
            for (const b of btns) {
              if ((b.textContent||'').trim().toLowerCase().includes('excluir')) hasDelete = true;
            }
          }
          let p = mobileUl.parentElement;
          while (p) {
            const cls = (p.className && typeof p.className === 'string') ? p.className : '';
            if (cls.includes('bg-warm-white') || cls.includes('bg-cream')) { creamAncestor = true; break; }
            p = p.parentElement;
          }
        }
        // FAB
        const fab = qa('button').find(b => {
          const cls = b.className||'';
          return typeof cls === 'string' && cls.includes('rounded-full') && cls.includes('fixed') && /bottom-\d/.test(cls);
        });
        return { searchVisible, hasMobileUl: !!mobileUl, cardCount, avgH, firstHeights, hasDelete, hasCheckbox, creamAncestor, hasFab: !!fab, title: document.title, url: location.href };
      });

      const issues = [];
      if (!info.searchVisible) issues.push('search input "Digite para buscar" ausente/invisível');
      if (!info.hasMobileUl) issues.push('ul.md:hidden não encontrada');
      if (info.avgH > 100) issues.push(`altura média cards ${info.avgH.toFixed(0)}px (>100)`);
      if (info.creamAncestor) issues.push('Card creme wrapper (bg-warm-white/bg-cream) ao redor da lista');
      if (info.hasDelete) issues.push('botão "Excluir" dentro do card');
      if (info.hasCheckbox) issues.push('checkbox de seleção dentro do card');

      entry.cardHeight = Math.round(info.avgH);
      entry.issues = issues;

      // determine if not-list
      const notList = !info.hasMobileUl && info.cardCount === 0 && !info.searchVisible;
      if (notList) {
        entry.grade = 'not-list';
      } else {
        const heavy = issues.filter(i => i.includes('Card creme') || i.includes('altura média'));
        if (issues.length === 0) entry.grade = 'match';
        else if (issues.length <= 2 && heavy.length === 0) entry.grade = 'partial';
        else entry.grade = 'needs-refactor';
      }
      entry._debug = info;
    } catch (e) {
      entry.issues.push(`erro: ${e.message}`);
    }
    results.push(entry);
    console.error(JSON.stringify(entry));
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/_results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
})();
