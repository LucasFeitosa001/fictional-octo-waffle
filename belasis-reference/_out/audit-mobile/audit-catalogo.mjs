import { chromium, devices } from 'playwright';

const API = 'https://conferences-collar-proof-mine.trycloudflare.com';
const WEB = 'http://localhost:5173';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/audit-mobile';
const ROUTES = ['/produtos','/servicos','/categorias','/marcas','/pacotes'];

const results = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

// Login via UI
await page.goto(`${WEB}/entrar`, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
if (!/entrar|login|sign/i.test(page.url())) {
  await page.goto(`${WEB}/`, { waitUntil: 'networkidle', timeout: 30000 });
}
await page.waitForTimeout(1000);
try {
  await page.fill('input[type=email], input[placeholder*="salao"]', 'contato@fatimacabelos.com.br');
  await page.fill('input[type=password]', 'fatima@2026');
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 30000 }),
    page.click('button:has-text("Entrar")'),
  ]);
  await page.waitForTimeout(2000);
  console.log('post-login url', page.url());
} catch(e) { console.log('login ui err', e.message); }

for (const route of ROUTES) {
  const slug = route.replace(/^\//,'').replace(/\//g,'-') || 'root';
  const entry = { route, grade: 'error', issues: [], screenshotPath: `${OUT}/${slug}.png` };
  try {
    await page.goto(`${WEB}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: entry.screenshotPath, fullPage: false });

    const info = await page.evaluate(() => {
      const q = (sel) => document.querySelector(sel);
      const qa = (sel) => Array.from(document.querySelectorAll(sel));
      const search = qa('input').find(i => (i.placeholder||'').toLowerCase().includes('digite para buscar'));
      const searchVisible = search ? !!(search.offsetParent) : false;
      const ul = qa('ul').find(u => u.className && /md:hidden/.test(u.className));
      let cardCount = 0, avgH = 0, heights = [];
      if (ul) {
        const items = Array.from(ul.children);
        cardCount = items.length;
        heights = items.slice(0,3).map(el => el.getBoundingClientRect().height);
        avgH = heights.length ? Math.round(heights.reduce((a,b)=>a+b,0)/heights.length) : 0;
      }
      // detect creme wrapper ancestor
      let creme = false;
      if (ul) {
        let el = ul.parentElement;
        for (let i=0;i<6 && el;i++) {
          const c = el.className || '';
          if (typeof c === 'string' && /bg-warm-white|bg-cream/.test(c)) { creme = true; break; }
          el = el.parentElement;
        }
      }
      // excluir/checkbox in first card
      let hasExcluir = false, hasCheckbox = false;
      if (ul && ul.children[0]) {
        hasExcluir = /Excluir/i.test(ul.children[0].textContent || '');
        hasCheckbox = !!ul.children[0].querySelector('input[type=checkbox]');
      }
      const fab = qa('button').some(b => {
        const c = b.className || '';
        return /rounded-full/.test(c) && /fixed/.test(c) && /bottom-/.test(c);
      });
      const bodyText = document.body.innerText.slice(0,200);
      return { searchVisible, hasUl: !!ul, cardCount, avgH, heights, creme, hasExcluir, hasCheckbox, fab, bodyText };
    });

    entry.cardHeight = info.avgH;
    const issues = [];
    if (!info.hasUl) {
      entry.grade = 'not-list';
      entry.issues = ['sem <ul md:hidden> — pode não ser lista'];
      results.push(entry); continue;
    }
    if (!info.searchVisible) issues.push('search "Digite para buscar" ausente/oculto no topo mobile');
    if (info.creme) issues.push('Card creme wrapper (bg-warm-white/bg-cream) ao redor da lista');
    if (info.hasExcluir) issues.push('botão "Excluir" dentro do card');
    if (info.hasCheckbox) issues.push('checkbox de seleção dentro do card');
    if (info.avgH > 100) issues.push(`card alto (${info.avgH}px > 100)`);
    if (info.avgH && info.avgH < 50) issues.push(`card muito baixo (${info.avgH}px)`);
    if (!info.fab) issues.push('sem FAB Novo (opcional)');

    const hard = issues.filter(i => !i.includes('opcional')).length;
    if (hard === 0) entry.grade = 'match';
    else if (hard <= 2) entry.grade = 'partial';
    else entry.grade = 'needs-refactor';
    if (info.creme || info.avgH > 100) entry.grade = 'needs-refactor';
    entry.issues = issues;
  } catch (e) {
    entry.issues = [`erro: ${String(e.message).slice(0,200)}`];
  }
  results.push(entry);
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
