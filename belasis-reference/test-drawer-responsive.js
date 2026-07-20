/**
 * Verifica que:
 *  - mobile (375×812): drawer sobe de baixo (translate-y no início, translate-y-0 aberto)
 *  - desktop (1280×800): drawer desliza da direita (translate-x-full → translate-x-0)
 *
 * Rota testada: /comandas (usa FullDrawer sem sections — form único).
 * Clica no #número da 1ª comanda para abrir o EditarComandaDrawer.
 */
const { chromium, devices } = require('playwright');

const URL_TUNNEL = 'https://conferences-collar-proof-mine.trycloudflare.com';
const EMAIL = 'contato@fatimacabelos.com.br';
const PASSWORD = 'fatima@2026';

async function login(page) {
  const res = await page.request.post(`${URL_TUNNEL}/api/v1/auth/sign-in/email`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email: EMAIL, password: PASSWORD },
  });
  if (res.status() !== 200) throw new Error(`login ${res.status()}: ${(await res.text()).slice(0, 200)}`);
}

async function findPanel(page) {
  // Só painéis ABERTOS: translate-*-0 sem translate-*-full. Ignora BottomNav (sempre montado, translate-y-full).
  return page.evaluate(() => {
    const isOpen = (el) => {
      const cl = el.className || '';
      if (typeof cl !== 'string') return false;
      const hasOpenX = /\btranslate-x-0\b/.test(cl);
      const hasOpenY = /\btranslate-y-0\b/.test(cl);
      const hasClosedX = /\btranslate-x-full\b/.test(cl) || /\b-translate-x-full\b/.test(cl);
      const hasClosedY = /\btranslate-y-full\b/.test(cl);
      return (hasOpenX && !hasClosedX) || (hasOpenY && !hasClosedY);
    };
    const snap = (el) => {
      const cs = getComputedStyle(el);
      return {
        className: el.className,
        transform: cs.transform,
        transitionProperty: cs.transitionProperty,
        transitionDuration: cs.transitionDuration,
        position: cs.position,
        width: cs.width,
        height: cs.height,
        top: cs.top,
        bottom: cs.bottom,
        right: cs.right,
        left: cs.left,
        borderTopLeftRadius: cs.borderTopLeftRadius,
      };
    };
    // varre todos elementos posicionados fixed/absolute com role dialog OU dentro de aria-modal
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      const cl = typeof el.className === 'string' ? el.className : '';
      if (!cl.includes('translate-')) continue;
      if (!isOpen(el)) continue;
      // filtra: ignora BottomNav (tem shadow-pop + rounded-t-3xl mas fechado quando não é o alvo)
      return snap(el);
    }
    return null;
  });
}

async function runViewport(label, extraContextOpts, viewport) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport,
    ignoreHTTPSErrors: true,
    ...extraContextOpts,
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${(e.message || String(e)).slice(0, 200)}`));

  try {
    await login(page);
    await page.goto(`${URL_TUNNEL}/comandas`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));

    // procura um elemento clicável que abre o drawer (o #número na tabela desktop, ou a linha inteira no mobile)
    const clicked = await page.evaluate(() => {
      // desktop: button.text-primary com "#" — mas no mobile pode ser um card
      const btns = Array.from(document.querySelectorAll('button'));
      const numeric = btns.find((b) => /^#\d+/.test((b.textContent || '').trim()));
      if (numeric) { numeric.click(); return `#num button: ${numeric.textContent?.trim().slice(0, 30)}`; }
      // fallback: primeira row/card clicável
      const row = document.querySelector('tbody tr[role="button"], tbody tr.cursor-pointer, [data-testid*="comanda"]');
      if (row) { row.click(); return `row: ${(row.textContent || '').slice(0, 40)}`; }
      // último recurso: 1º link com "#"
      const link = Array.from(document.querySelectorAll('a')).find((a) => /^#\d+/.test((a.textContent || '').trim()));
      if (link) { link.click(); return `link: ${link.textContent?.trim().slice(0, 30)}`; }
      return null;
    });

    if (!clicked) {
      console.log(`[${label}] NÃO ACHOU elemento clicável — body chars:`, await page.evaluate(() => (document.body.innerText || '').length));
      const bodySlice = await page.evaluate(() => (document.body.innerText || '').slice(0, 400));
      console.log(`[${label}] body slice:`, bodySlice);
    }

    console.log(`[${label}] clicou em:`, clicked);
    // aguarda animação de entrada (~380ms) + settling
    await new Promise((r) => setTimeout(r, 1500));

    const panel = await findPanel(page);
    if (!panel) { console.log(`[${label}] ❌ painel drawer NÃO encontrado`); return null; }

    console.log(`[${label}] ✔ drawer aberto:`);
    console.log(`  transform: ${panel.transform}`);
    console.log(`  className hint: ${panel.className.split(' ').filter((c) => c.includes('translate') || c.includes('rounded') || c.includes('bottom') || c.includes('top') || c.includes('right') || c.includes('inset-x')).join(' ')}`);
    console.log(`  pos: top=${panel.top} bottom=${panel.bottom} right=${panel.right} left=${panel.left}`);
    console.log(`  size: ${panel.width} × ${panel.height}`);
    console.log(`  rounded-t: ${panel.borderTopLeftRadius}`);

    return { label, panel, errs };
  } finally {
    await browser.close();
  }
}

(async () => {
  console.log('=== MOBILE (375×812, iPhone 13) ===');
  const mobile = await runViewport('mobile', { ...devices['iPhone 13'] }, undefined);
  console.log('');
  console.log('=== DESKTOP (1280×800) ===');
  const desktop = await runViewport('desktop', {}, { width: 1280, height: 800 });

  console.log('\n=== VERIFICAÇÃO ===');
  const ok = { mobile: false, desktop: false };
  if (mobile && mobile.panel) {
    const p = mobile.panel;
    const hasBottomSheet = p.className.includes('translate-y-0') || p.className.includes('rounded-t');
    const notFromRight = !p.className.includes('translate-x');
    ok.mobile = hasBottomSheet && notFromRight;
    console.log(`  mobile bottom-sheet: ${ok.mobile ? '✅' : '❌'}  (translate-y-0=${p.className.includes('translate-y-0')}, rounded-t=${p.className.includes('rounded-t')})`);
  }
  if (desktop && desktop.panel) {
    const p = desktop.panel;
    const hasRightSlide = p.className.includes('translate-x-0');
    ok.desktop = hasRightSlide;
    console.log(`  desktop right-slide: ${ok.desktop ? '✅' : '❌'}  (translate-x-0=${hasRightSlide})`);
  }
  process.exit(ok.mobile && ok.desktop ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
