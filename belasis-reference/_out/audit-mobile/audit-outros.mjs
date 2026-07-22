import { chromium, devices } from 'playwright';

const BASE = 'http://localhost:5173';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/audit-mobile';
const ROUTES = ["/agendamentos","/assinaturas","/comissoes","/relatorios/mensagens","/relatorios/aniversariantes"];

const slug = (r) => r.replace(/^\//,'').replace(/\//g,'-') || 'root';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

await page.goto(`${BASE}/painel`, { waitUntil: 'networkidle', timeout: 30000 }).catch(()=>{});
await page.waitForTimeout(2000);
try {
  await page.waitForSelector('input[type=email], input[placeholder*="salao"]', { timeout: 15000 });
  await page.fill('input[type=email], input[placeholder*="salao"]', 'contato@fatimacabelos.com.br');
  await page.fill('input[type=password]', 'fatima@2026');
  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 30000 }),
    page.click('button:has-text("Entrar")'),
  ]);
  await page.waitForTimeout(2000);
} catch(e) { console.error('login ui err', e.message); }

const results = [];
for (const route of ROUTES) {
  const s = slug(route);
  const screenshotPath = `${OUT}/${s}.png`;
  const entry = { route, grade: 'match', issues: [], cardHeight: 0, screenshotPath };
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: screenshotPath });

    const info = await page.evaluate(() => {
      const out = {};
      const inputs = Array.from(document.querySelectorAll('input'));
      const search = inputs.find(i => (i.placeholder||'').toLowerCase().includes('digite para buscar'));
      out.hasSearch = !!search && !!search.offsetParent;
      const ul = document.querySelector('ul.md\\:hidden') || Array.from(document.querySelectorAll('ul')).find(u => (u.className||'').includes && u.className.includes('md:hidden'));
      out.hasUl = !!ul;
      if (ul) {
        const cards = Array.from(ul.children);
        out.cardCount = cards.length;
        const heights = cards.slice(0,3).map(c => c.getBoundingClientRect().height);
        out.avgHeight = heights.length ? Math.round(heights.reduce((a,b)=>a+b,0)/heights.length) : 0;
        let p = ul.parentElement;
        let creme = false;
        while (p) {
          const cn = p.className||'';
          if (typeof cn === 'string' && (cn.includes('bg-warm-white') || cn.includes('bg-cream'))) { creme = true; break; }
          p = p.parentElement;
        }
        out.cremeWrapper = creme;
        const firstCard = cards[0];
        if (firstCard) {
          out.hasExcluir = !!Array.from(firstCard.querySelectorAll('button')).find(b => (b.textContent||'').trim().toLowerCase().includes('excluir'));
          out.hasCheckbox = !!firstCard.querySelector('input[type=checkbox]');
        }
      }
      const fab = Array.from(document.querySelectorAll('button')).find(b => {
        const cn = b.className||'';
        return typeof cn==='string' && cn.includes('rounded-full') && cn.includes('fixed') && cn.includes('bottom-');
      });
      out.hasFab = !!fab;
      out.bodyText = document.body.innerText.slice(0, 300);
      return out;
    });

    entry.cardHeight = info.avgHeight || 0;
    const issues = [];
    if (!info.hasUl) {
      entry.grade = 'not-list';
      entry.issues = ['no ul.md:hidden found - possibly not a list page'];
      entry._info = info;
      results.push(entry);
      continue;
    }
    if (!info.hasSearch) issues.push('search input "Digite para buscar" ausente');
    if (info.cremeWrapper) issues.push('Card creme wrapper ao redor da lista');
    if (info.hasExcluir) issues.push('Botão Excluir dentro do card');
    if (info.hasCheckbox) issues.push('Checkbox dentro do card');
    if (info.avgHeight > 100) issues.push(`card altura ${info.avgHeight}px > 100px`);
    if (!info.hasFab) issues.push('sem FAB (opcional)');

    const hard = issues.filter(i => !i.includes('opcional'));
    if (hard.length === 0) entry.grade = 'match';
    else if (hard.length <= 2 && info.avgHeight <= 100 && !info.cremeWrapper) entry.grade = 'partial';
    else entry.grade = 'needs-refactor';
    entry.issues = issues;
    entry._info = info;
    results.push(entry);
  } catch (e) {
    entry.grade = 'error';
    entry.issues = [String(e.message||e)];
    results.push(entry);
  }
}

console.log(JSON.stringify({ group: 'Outros', pages: results }, null, 2));
await browser.close();
