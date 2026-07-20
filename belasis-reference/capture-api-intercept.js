/*
 * Intercepta TODAS as chamadas XHR/fetch do Belasis enquanto navega em /wow e
 * nas sub-rotas de relatório /reports/<secao>/all. Reusa o profile persistente
 * de auth dos outros capture-*.js (login manual detectado no boot, igual a
 * capture-tooltips.js / reports-capture.js).
 *
 * Para cada par request/response captura-se um arquivo:
 *   belasis-reference/api-intercept/<slug>.json
 * com { seq, routeContext, capturedAt, url, method, resourceType, headers,
 *       requestBody, requestBodyJson, status, responseHeaders, responseBody,
 *       responseBodyJson, responseBodyTruncated, timing }.
 *
 * <slug> = <seq>-<METHOD>-<path[_query]> sanitizado (único e ordenável). Também
 * emite _index.json (url + status + bytes de cada chamada) para grep posterior.
 *
 * Rodar (NÃO faz parte deste passo — só escrever):
 *   cd /home/ubuntu/beautypass/belasis-reference
 *   node capture-api-intercept.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REF = __dirname;
const PROFILE = REF + '/.auth-profile';
const OUT = REF + '/api-intercept';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Ignora analytics / marketing / assets estáticos. Todo o resto que pareça
// chamada de API (xhr/fetch) é capturado.
const IGNORE = /googletagmanager|google-analytics|facebook|fbcdn|bing\.com|bat\.bing|tawk|wootric|crisp|hotjar|clarity|doubleclick|diffuser|app-us1|sentry\.io|logrocket|fullstory|mixpanel|segment\.io|amplitude|intercom|zdassets|zendesk/i;
const STATIC_EXT = /\.(css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|mp4|webm|avif|bmp)(\?|$)/i;
const DOC_EXT = /\.html?(\?|$)/i;

function slugify(s) {
  return String(s)
    .replace(/^https?:\/\//, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'req';
}

function safeJson(v) {
  try { return JSON.parse(v); } catch (e) { return null; }
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: null,
    args: ['--no-sandbox', '--start-maximized'],
    locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  const index = [];
  let seq = 0;
  let currentRoute = 'boot';
  const seen = new Set();

  ctx.on('requestfinished', async (request) => {
    try {
      const url = request.url();
      if (IGNORE.test(url)) return;
      const type = request.resourceType();
      // Só xhr/fetch — as chamadas de API interessantes. Pula estático/doc.
      if (type !== 'xhr' && type !== 'fetch') return;
      if (STATIC_EXT.test(url)) return;
      if (DOC_EXT.test(url)) return;
      // De-dup de GETs idênticos pra manter a saída enxuta.
      const dedupKey = request.method() + ' ' + url;
      if (request.method() === 'GET' && seen.has(dedupKey)) return;
      seen.add(dedupKey);

      const response = await request.response().catch(() => null);
      const status = response ? response.status() : null;
      const responseHeaders = response ? response.headers() : {};
      let responseBody = null;
      let responseBodyTruncated = false;
      if (response) {
        try {
          const buf = await response.body();
          const text = buf.toString('utf8');
          if (text.length > 500000) {
            responseBody = text.slice(0, 500000);
            responseBodyTruncated = true;
          } else {
            responseBody = text;
          }
        } catch (e) {
          responseBody = '<<body unavailable: ' + e.message + '>>';
        }
      }

      let requestBody = null;
      try { requestBody = request.postData(); } catch (e) {}

      const timing = request.timing ? request.timing() : null;
      const n = ++seq;

      const record = {
        seq: n,
        routeContext: currentRoute,
        capturedAt: new Date().toISOString(),
        url,
        method: request.method(),
        resourceType: type,
        headers: request.headers(),
        requestBody,
        requestBodyJson: requestBody ? safeJson(requestBody) : null,
        status,
        responseHeaders,
        responseBody,
        responseBodyJson: responseBody ? safeJson(responseBody) : null,
        responseBodyTruncated,
        timing,
      };

      const u = new URL(url);
      const pathSlug = slugify(u.pathname + (u.search ? '_' + u.search : ''));
      const slug = String(n).padStart(4, '0') + '-' + request.method() + '-' + pathSlug;
      const file = path.join(OUT, slug + '.json');
      fs.writeFileSync(file, JSON.stringify(record, null, 2));
      index.push({
        seq: n,
        routeContext: currentRoute,
        method: request.method(),
        status,
        url,
        file: path.basename(file),
        bytes: responseBody ? responseBody.length : 0,
      });
      const short = url.length > 90 ? url.slice(0, 87) + '...' : url;
      console.log(String(n).padStart(4, '0'), request.method().padEnd(6), String(status || '---').padEnd(4), short);
    } catch (e) {
      // Nunca deixe um erro de intercept derrubar o run.
      console.error('  intercept-err:', e.message);
    }
  });

  // === AUTH: mesmo padrão dos capture-*.js — abre login e detecta sessão. ===
  await page.goto('https://belasis.app/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('>>> FAÇA O LOGIN na janela do Chrome. Detecto e começo o intercept. <<<');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const url = page.url();
    if (/belasis\.app\/[a-z]/i.test(url) && !/\/login/.test(url)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 3 === 0) console.log('  ...aguardando login (', url, ')');
  }
  if (!authed) { console.log('TIMEOUT login'); await ctx.close(); process.exit(3); }
  console.log('LOGIN OK. Iniciando intercept em /wow + /reports/*/all...');

  const goto = async (route, label) => {
    currentRoute = label;
    console.log('\n>>>', label, '·', route);
    await page.goto('https://belasis.app' + route, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
      console.log('  goto-err:', e.message);
    });
    if (/\/login/.test(page.url())) {
      console.log('!! DESLOGOU — refaça login manual (login-manual.js ou capture-all.js).');
      await ctx.close();
      process.exit(3);
    }
    // Hidratação: skeletons somem E há conteúdo real OU um widget rico.
    await page.waitForFunction(() => {
      if (document.querySelector('.ant-skeleton-active')) return false;
      const mc = document.querySelector('.main-content, [class*=main-content]') || document.querySelector('#root');
      const txt = (mc && mc.innerText ? mc.innerText : '').replace(/\s+/g, '').length;
      const rich = document.querySelector(
        '.ant-table, table, .ant-form, .ant-list, .ant-card, .recharts-surface, .recharts-funnel, .recharts-wrapper, [class*=calendar i]',
      );
      return txt > 180 || !!rich;
    }, { timeout: 30000 }).catch(() => console.log('  timeout aguardando hidratação'));
    // Janela idle extra — XHRs lazy após o primeiro paint (ex.: dados do funil).
    await sleep(5000);
    // Nudge de scroll pra disparar widgets lazy, depois volta ao topo.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await sleep(1500);
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await sleep(1500);
  };

  // /wow + todas as sub-rotas /reports/<secao>/all.
  const routes = [
    ['/wow', 'wow'],
    ['/reports/calendars/all', 'reports-calendars-all'],
    ['/reports/clients/all', 'reports-clients-all'],
  ];

  for (const [route, label] of routes) {
    await goto(route, label);
  }

  fs.writeFileSync(path.join(OUT, '_index.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    total: index.length,
    routes: routes.map(([r, l]) => ({ route: r, label: l })),
    entries: index,
  }, null, 2));

  console.log('\n=== DONE ·', index.length, 'chamadas de API capturadas em', OUT, '===');
  await ctx.close();
  process.exit(0);
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
