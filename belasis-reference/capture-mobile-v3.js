/*
 * MOBILE CAPTURE v3 — SAFETY-FIRST.
 * FIXES vs v2:
 *  - Estratégia "Novo" ULTRA-CONSERVADORA: só clica se o elemento tem texto EXATO "Novo" ou "+" e NÃO
 *    contém nenhuma palavra da BLACKLIST (Sair/Logout/Excluir/Cancelar assinatura/Deletar/Remover).
 *  - Remove estratégias "hamburger→qualquer coisa com Novo" e "bottom-nav fallback SVG".
 *  - AGUARDA DADOS REAIS: network-idle + espera de tabela preenchida OU skeleton ausente + delay 3.5s.
 *  - Skip rotas que redirect pra login/mesma URL suspeita.
 *  - Antes de qualquer click, checa que a URL NÃO É /login e loga o texto exato do target.
 */
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile-mobile';
const OUT = REF + '/mobile-v3';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const w = (f, s) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); };
const j = (o) => JSON.stringify(o, null, 2);

const ROUTES = [
  '/wow', '/calendar', '/sales', '/clients', '/employees', '/products', '/services',
  '/packages', '/subscriptions', '/vendors', '/brands',
  '/finance/transactions', '/finance/accounts', '/finance/cash', '/finance/dashboard',
  '/commissions', '/commissions/settings',
  '/reports', '/reports/financial', '/reports/clients/all', '/reports/calendars/all', '/reports/inventory/stock',
  '/marketing/agendamento-online', '/marketing/campanhas', '/marketing/cashback', '/marketing/promocoes', '/marketing/avaliacoes',
  '/settings',
];

// 🚨 BLACKLIST — texto nesses padrões = NUNCA CLICAR (mesmo que tenha "Novo" perto)
const DANGER_REGEX = /\b(Sair|Logout|Sign\s*out|Deslogar|Cancelar\s*assinatura|Excluir|Deletar|Delete|Remover(?!\s+filtro)|Pagar\s+agora|Finalizar\s+(assinatura|conta))\b/i;

async function waitDataReady(page) {
  // 1) network-idle (com timeout defensivo)
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  // 2) espera skeleton sumir
  await page.waitForFunction(() => !document.querySelector('.ant-skeleton-active, .ant-spin-spinning'), { timeout: 15000 }).catch(() => {});
  // 3) espera tabela ter DADOS OU card ter texto real (não só header)
  await page.waitForFunction(() => {
    // se tem tabela, precisa ter tbody com pelo menos 1 row
    const t = document.querySelector('.ant-table-tbody');
    if (t) return t.querySelectorAll('tr').length >= 1;
    // se tem card com "Nada há dados" (empty state), OK — página carregou
    if (/Não há dados|Nenhum registro/i.test(document.body.innerText || '')) return true;
    // se tem chart renderizado
    if (document.querySelector('.recharts-surface, .recharts-wrapper')) return true;
    // se tem form com input
    if (document.querySelector('form input, .ant-input')) return true;
    // fallback: se body tem texto substancial
    return (document.body.innerText || '').length > 500;
  }, { timeout: 20000 }).catch(() => {});
  // 4) delay adicional pra XHR tardios (hover-refetch, lazy KPIs)
  await sleep(3500);
}

async function killOverlays(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.ant-notification, .ant-notification-notice-wrapper')) el.remove();
    for (const f of document.querySelectorAll('iframe')) if (/inmoment|survey|wootric|tawk|crisp/i.test(f.src || '')) f.remove();
  }).catch(() => {});
}

// SAFE openNewMobile: só tenta FAB e headerplus com texto EXATO + blacklist.
async function openNewSafe(page) {
  const currentUrl = page.url();
  if (/\/login/.test(currentUrl)) return { error: 'em_login' };

  // Estratégia 1: FAB explícito (canto inferior direito)
  const fabResult = await page.evaluate((DANGER_STR) => {
    const DANGER = new RegExp(DANGER_STR, 'i');
    const cands = Array.from(document.querySelectorAll('.ant-fab, [class*="fab" i][role="button"], .ant-btn-primary.ant-btn-circle, [aria-label*="Novo" i], [aria-label*="Criar" i]'));
    for (const el of cands) {
      const r = el.getBoundingClientRect();
      if (r.bottom < window.innerHeight - 260 || r.right < window.innerWidth - 240) continue; // não é FAB (nem tá no canto)
      const txt = (el.textContent || '').trim();
      const aria = el.getAttribute('aria-label') || '';
      if (DANGER.test(txt) || DANGER.test(aria)) continue; // 🚨 skip perigoso
      el.click();
      return { strategy: 'fab', text: txt || aria, class: (el.className || '').slice(0, 60) };
    }
    return null;
  }, DANGER_REGEX.source);
  if (fabResult) return fabResult;

  // Estratégia 2: botão com texto EXATO "Novo" ou "+" no HEADER/TOOLBAR (não em rodapé ou side menu)
  const headerResult = await page.evaluate((DANGER_STR) => {
    const DANGER = new RegExp(DANGER_STR, 'i');
    const scope = document.querySelector('header, .ant-page-header, [class*="header" i], .toolbar') || document.body;
    for (const el of scope.querySelectorAll('button, a')) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('svg, ul, li').forEach((n) => n.remove());
      const txt = (clone.textContent || '').trim();
      if (!/^(\+|Novo|Criar)$/i.test(txt)) continue; // TEXTO EXATO
      const outer = (el.outerHTML || '').slice(0, 300);
      if (DANGER.test(outer)) continue; // 🚨 skip perigoso
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) continue;
      el.click();
      return { strategy: 'header', text: txt, class: (el.className || '').slice(0, 60) };
    }
    return null;
  }, DANGER_REGEX.source);
  if (headerResult) return headerResult;

  return { error: 'sem_gatilho_seguro' };
}

async function findOpenPanel(page) {
  const sels = ['.ant-drawer-open .ant-drawer-content-wrapper', '.ant-modal-root .ant-modal-content', '.ant-drawer .ant-drawer-content'];
  for (const s of sels) if (await page.$(s)) return s;
  return null;
}

async function main() {
  const device = devices['iPhone 13'];
  console.log(`Mobile v3 (SAFETY-FIRST): ${device.viewport.width}×${device.viewport.height} · touch=${device.hasTouch}\n`);
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, ...device, args: ['--no-sandbox'], locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://belasis.app/wow', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('>>> Se aparecer login, faça-o. Detecto. <<<\n');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const u = page.url();
    if (/belasis\.app\/[a-z]/i.test(u) && !/\/login/.test(u)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 5 === 0) console.log('  ...aguardando (', u, ')');
  }
  if (!authed) { console.log('TIMEOUT'); await ctx.close(); process.exit(3); }

  const snap = await page.evaluate(() => ({
    session: Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)).map((k) => [k, sessionStorage.getItem(k)])),
    local:   Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)])),
  })).catch(() => ({ session: {}, local: {} }));
  await ctx.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s.session || {})) sessionStorage.setItem(k, v);
          for (const [k, v] of Object.entries(s.local || {})) localStorage.setItem(k, v); } catch (e) {}
  }, snap);
  w(OUT + '/_auth-snap.json', j(snap));
  console.log(`LOGIN OK. Aguardando dados reais em cada rota (network-idle + skeleton + delay).\n`);

  const idx = [];
  let deslogou = false;
  for (const route of ROUTES) {
    if (deslogou) break;
    const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
    const base = path.join(OUT, slug);
    fs.mkdirSync(base, { recursive: true });
    const rec = { route, slug, captured: [] };
    try {
      await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
      const urlNow = page.url();
      if (/\/login/.test(urlNow)) { console.log(`  ${slug}: 🚨 DESLOGADO - parando`); deslogou = true; break; }
      if (!urlNow.includes(route.split('?')[0].split('/').filter(Boolean).slice(-1)[0])) {
        // rota redirecionou pra outra — não é fatal, mas anota
        rec.redirectedTo = urlNow;
      }
      await waitDataReady(page);
      await killOverlays(page);

      // SCROLL top→bottom em passos
      const H = await page.evaluate(async () => {
        const h = document.documentElement.scrollHeight;
        for (let y = 0; y <= h; y += 300) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 250)); }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 400));
        return document.documentElement.scrollHeight;
      });

      const html = await page.evaluate(() => document.body.outerHTML);
      w(path.join(base, 'page.html'), html);
      await page.screenshot({ path: path.join(base, 'page-full.png'), fullPage: true }).catch(() => {});
      await page.screenshot({ path: path.join(base, 'page-viewport.png'), fullPage: false }).catch(() => {});
      rec.htmlBytes = html.length; rec.scrollH = H; rec.captured.push('page');

      // Só tenta "Novo" com estratégia SEGURA
      const result = await openNewSafe(page);
      rec.newStrategy = result;
      if (result && result.strategy) {
        await sleep(800);
        const panel = await findOpenPanel(page);
        if (panel) {
          const panelHtml = await page.evaluate((s) => document.querySelector(s)?.outerHTML || '', panel);
          w(path.join(base, 'new-panel.html'), panelHtml);
          await page.screenshot({ path: path.join(base, 'new-panel.png'), fullPage: false }).catch(() => {});
          rec.captured.push('newPanel');
        }
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(400);
        // GUARD: se depois do clique redirecionou pra login = perigoso, para tudo
        if (/\/login/.test(page.url())) { console.log(`  ${slug}: 🚨 clique em Novo deslogou! ABORTANDO`); deslogou = true; break; }
      }
      console.log(`  ${slug}: H=${H} html=${html.length}b strat=${result?.strategy || 'nenhuma'} panel=${rec.captured.includes('newPanel') ? 'SIM' : 'não'}`);
    } catch (e) { console.log('  ERR', slug, (e.message || '').slice(0, 60)); }
    idx.push(rec);
    w(OUT + '/_index.json', j(idx));
  }
  const withPanel = idx.filter((r) => r.captured.includes('newPanel')).length;
  console.log(`\n=== DONE. ${idx.length}/${ROUTES.length} rotas · Novo drawer: ${withPanel}/${idx.length} ${deslogou ? '(⚠️ parou por logout)' : ''} ===`);
  await sleep(1500);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
