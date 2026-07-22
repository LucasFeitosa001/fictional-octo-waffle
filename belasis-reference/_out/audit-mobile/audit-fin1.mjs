import { chromium, devices } from 'playwright';

const API = 'https://conferences-collar-proof-mine.trycloudflare.com';
const BASE = 'http://localhost:5173';
const OUT = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/audit-mobile';
const ROUTES = ["/financeiro/transacoes","/financeiro/contas","/financeiro/caixas","/financeiro/caixas/historico"];

const slug = (r) => r.replace(/^\//,'').replace(/\//g,'-') || 'root';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });

// Login via API
const resp = await ctx.request.post(`${API}/api/v1/auth/sign-in/email`, {
  data: { email: 'contato@fatimacabelos.com.br', password: 'fatima@2026' },
});
const body = await resp.json().catch(()=>({}));
const token = body?.token || body?.accessToken || body?.data?.token;
console.error('login status', resp.status(), 'token?', !!token);

const page = await ctx.newPage();

// Login via UI
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
  console.error('post-login url', page.url());
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
      const ul = document.querySelector('ul.md\\:hidden') || Array.from(document.querySelectorAll('ul')).find(u => u.className.includes('md:hidden'));
      out.hasUl = !!ul;
      if (ul) {
        const cards = Array.from(ul.children);
        out.cardCount = cards.length;
        const heights = cards.slice(0,3).map(c => c.getBoundingClientRect().height);
        out.avgHeight = heights.length ? Math.round(heights.reduce((a,b)=>a+b,0)/heights.length) : 0;
        // creme wrapper?
        let p = ul.parentElement;
        let creme = false;
        while (p) {
          const cn = p.className||'';
          if (typeof cn === 'string' && (cn.includes('bg-warm-white') || cn.includes('bg-cream'))) { creme = true; break; }
          p = p.parentElement;
        }
        out.cremeWrapper = creme;
        // excluir / checkbox inside card
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
      out.bodyText = document.body.innerText.slice(0, 200);
      return out;
    });

    entry.cardHeight = info.avgHeight || 0;
    const issues = [];
    if (!info.hasUl) {
      // Might not be list page
      entry.grade = 'not-list';
      entry.issues = ['no ul.md:hidden found'];
      results.push({ ...entry, info });
      continue;
    }
    if (!info.hasSearch) issues.push('search input "Digite para buscar" ausente');
    if (info.cremeWrapper) issues.push('Card creme wrapper (bg-warm-white/cream) ao redor da lista');
    if (info.hasExcluir) issues.push('Botão Excluir dentro do card');
    if (info.hasCheckbox) issues.push('Checkbox dentro do card');
    if (info.avgHeight > 100) issues.push(`card altura ${info.avgHeight}px > 100px`);
    if (!info.hasFab) issues.push('sem FAB (opcional)');

    const hardIssues = issues.filter(i => !i.includes('opcional'));
    if (hardIssues.length === 0) entry.grade = 'match';
    else if (hardIssues.length <= 2 && info.avgHeight <= 100 && !info.cremeWrapper) entry.grade = 'partial';
    else entry.grade = 'needs-refactor';
    entry.issues = issues;
    results.push({ ...entry, info });
  } catch (e) {
    entry.grade = 'error';
    entry.issues = [String(e.message||e)];
    results.push(entry);
  }
}

console.log(JSON.stringify({ group: 'Financeiro1', pages: results }, null, 2));
await browser.close();
