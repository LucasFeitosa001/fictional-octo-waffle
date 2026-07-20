/* Captura direcionada /wow (Painel Belasis) — funil de agendamentos completo, desktop + mobile. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const REF = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference';
const PROFILE = REF + '/.auth-profile';
const OUT = REF + '/wow';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, viewport: null,
    args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://belasis.app/wow', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  if (/\/login/.test(page.url())) { console.log('DESLOGOU - faça login e re-rode'); await ctx.close(); process.exit(3); }
  // aguarda hidratação — espera recharts OU texto do funil
  await page.waitForFunction(() => {
    if (document.querySelector('.ant-skeleton-active')) return false;
    if (document.querySelector('.recharts-surface, .recharts-funnel, .recharts-wrapper')) return true;
    const t = (document.body.innerText || '');
    return /Faturado|Confirmado/.test(t) && t.length > 500;
  }, { timeout: 45000 }).catch(() => console.log('  timeout aguardando funil'));
  // scroll pra baixo pra garantir que o funil renderiza (lazy)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
  await sleep(2000);
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await sleep(1500);
  const url = page.url();
  const bodyLen = await page.evaluate(() => (document.body.innerText || '').length).catch(() => 0);
  console.log(`  URL: ${url} · innerText: ${bodyLen}b`);

  console.log('LOGIN OK. Capturando /wow em desktop + mobile...');
  for (const vp of [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844 }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(2500);
    const dir = path.join(OUT, vp.name);
    fs.mkdirSync(dir, { recursive: true });
    // page full
    const html = await page.evaluate(() => document.body.outerHTML).catch(() => '');
    fs.writeFileSync(path.join(dir, 'page.html'), html);
    await page.screenshot({ path: path.join(dir, 'page.png'), fullPage: true }).catch(() => {});
    // extrai TEXTO estruturado do funil
    const dump = await page.evaluate(() => {
      // acha o elemento cujo texto contém "Faturado" e sobe pra pegar o container do funil
      let node = null;
      for (const el of document.querySelectorAll('*')) {
        const t = (el.textContent || '').trim();
        if (/^Faturado/i.test(t) && t.length < 40) { node = el; break; }
      }
      const container = node ? (node.closest('.ant-card, [class*="chart"], [class*="funnel"], [class*="Funnel"], section, div') || node.parentElement) : null;
      const text = container ? (container.innerText || '').replace(/\s+\n/g, '\n').slice(0, 2000) : '(sem funil encontrado)';
      const rect = container ? container.getBoundingClientRect() : null;
      // captura HTML do container do funil isoladamente
      const containerHtml = container ? container.outerHTML : '';
      // busca por padrões numéricos do funil: "Todos: X", "Confirmados: Y", "Faturados: Z"
      const bodyTxt = document.body.innerText || '';
      const funil = {};
      for (const key of ['Todos', 'Confirmados', 'Faturados']) {
        const m = bodyTxt.match(new RegExp(`${key}[:\\s]*(\\d+)`, 'i'));
        if (m) funil[key.toLowerCase()] = parseInt(m[1], 10);
      }
      return { text, rect, containerHtml, funil };
    });
    fs.writeFileSync(path.join(dir, 'funil-text.txt'), dump.text);
    fs.writeFileSync(path.join(dir, 'funil.html'), dump.containerHtml);
    fs.writeFileSync(path.join(dir, 'funil.json'), JSON.stringify({ funil: dump.funil, rect: dump.rect }, null, 2));
    // CSS computed do container do funil + descendentes chave (bars, labels)
    const css = await page.evaluate(() => {
      const KEYS = ['transition','transform','opacity','backgroundColor','color','borderColor','borderRadius','width','height','padding','fontSize','fontWeight','fontFamily','display','flexDirection','gap'];
      const out = {};
      const selectors = ['[class*="funnel"]', '[class*="Funnel"]', '.recharts-surface', '.recharts-funnel', 'svg', '.ant-card', '.ant-progress'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        out[sel] = { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
        for (const k of KEYS) out[sel][k] = cs[k];
      }
      return out;
    }).catch(() => ({}));
    fs.writeFileSync(path.join(dir, 'css.json'), JSON.stringify(css, null, 2));
    console.log(`  ${vp.name}: ${vp.w}x${vp.h} · funil=${JSON.stringify(dump.funil)} · html ${html.length}b`);
  }
  console.log('=== DONE. belasis-reference/wow/{desktop,mobile}/ ===');
  await sleep(1500);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
