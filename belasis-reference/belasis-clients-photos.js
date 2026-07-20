/* Colhe o mapa {legacyId, photoUrl, nome, phone} de TODOS os clientes do Belasis.
 * Login manual WSLg. Intercepta a API de clientes, aprende endpoint+token, pagina tudo.
 * Uso: node belasis-reference/belasis-clients-photos.js
 * Saída: belasis-reference/clients-photos.json (+ _clients-raw-sample.json p/ inspeção). */
const { chromium } = require('playwright');
const fs = require('fs');
const REF = __dirname;
const PROFILE = REF + '/.auth-profile';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// heurística: extrai foto de um objeto cliente (campos variados)
function pickPhoto(o) {
  for (const k of ['photo', 'avatar', 'image', 'picture', 'avatarUrl', 'photoUrl', 'thumb', 'thumbnail']) {
    const v = o && o[k];
    if (typeof v === 'string' && /belasiscdn|\.(jpg|jpeg|png|webp)/i.test(v)) return v;
    if (v && typeof v === 'object') { const u = v.url || v.src || v.small || v.thumb; if (typeof u === 'string' && /https?:/.test(u)) return u; }
  }
  return null;
}
function pickId(o) { return o && (o.id ?? o._id ?? o.clientId ?? o.customerId ?? o.code) != null ? String(o.id ?? o._id ?? o.clientId ?? o.customerId ?? o.code) : null; }
function pickName(o) { return o && (o.name || o.fullName || o.nome || o.client_name || '') || ''; }
function pickPhone(o) { return o && (o.phone || o.cellphone || o.celular || o.mobile || o.telefone || '') || ''; }

// acha o array de clientes dentro de qualquer envelope de resposta
function findClientArray(json) {
  if (Array.isArray(json)) return json;
  for (const k of ['data', 'items', 'results', 'clients', 'customers', 'rows', 'content', 'list']) {
    if (Array.isArray(json?.[k])) return json[k];
    if (json?.[k] && Array.isArray(json[k]?.data)) return json[k].data;
  }
  // procura o 1o array de objetos com id
  for (const k of Object.keys(json || {})) if (Array.isArray(json[k]) && json[k][0] && typeof json[k][0] === 'object') return json[k];
  return [];
}

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false, viewport: null, acceptDownloads: true,
    args: ['--no-sandbox', '--start-maximized'], locale: 'pt-BR',
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  let apiReq = null; // { url, headers }
  const rawSamples = [];
  ctx.on('requestfinished', async (req) => {
    try {
      const url = req.url();
      if (!/\/(clients?|customers?)(\b|\/|\?)/i.test(url)) return;
      if (/\.(js|css|png|jpg|svg|woff)/i.test(url)) return;
      const res = await req.response(); if (!res) return;
      const ct = (res.headers()['content-type'] || ''); if (!/json/i.test(ct)) return;
      const body = await res.json().catch(() => null); if (!body) return;
      const arr = findClientArray(body);
      if (arr.length && !apiReq) {
        apiReq = { url, headers: req.headers(), method: req.method() };
        rawSamples.push({ url, sample: arr.slice(0, 3), envelopeKeys: Object.keys(body) });
        fs.writeFileSync(REF + '/_clients-raw-sample.json', JSON.stringify({ apiReq: { url, method: apiReq.method }, envelopeKeys: Object.keys(body), sample: arr.slice(0, 5) }, null, 2));
        console.log('  ★ API de clientes detectada:', url, '· itens/página:', arr.length);
      }
    } catch (e) {}
  });

  await page.goto('https://belasis.app/login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('\n>>> FAÇA O LOGIN no Chrome. Depois eu navego em Clientes e colho as fotos. <<<\n');
  let authed = false, streak = 0;
  for (let i = 0; i < 300; i++) {
    await sleep(2000);
    const u = page.url();
    if (/belasis\.app\/[a-z]/i.test(u) && !/\/login/.test(u)) { if (++streak >= 2) { authed = true; break; } } else streak = 0;
    if (i % 5 === 0) console.log('  ...aguardando login (', u, ')');
  }
  if (!authed) { console.log('TIMEOUT login'); await ctx.close(); process.exit(3); }
  console.log('LOGIN OK. Abrindo lista de clientes...');

  // dispara o carregamento da lista (a interceptação captura a API)
  await page.goto('https://belasis.app/clients', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(6000);
  if (!apiReq) { await page.goto('https://belasis.app/reports/clients/all', { waitUntil: 'domcontentloaded' }).catch(() => {}); await sleep(6000); }
  if (!apiReq) { console.log('!! não detectei a API de clientes. Veja _clients-raw-sample.json (vazio). Rode de novo navegando manualmente em Clientes.'); await ctx.close(); process.exit(4); }

  // pagina tudo replicando a request com page/limit crescentes
  const base = apiReq.url;
  const setParam = (u, k, v) => { const x = new URL(u); x.searchParams.set(k, v); return x.toString(); };
  const map = {};
  let got = 0;
  for (let pg = 1; pg <= 200; pg++) {
    let u = base;
    // tenta esquemas comuns de paginação
    u = setParam(u, 'page', String(pg));
    if (/[?&]limit=/i.test(base) || true) u = setParam(u, 'limit', '100');
    if (/[?&]per_page=/i.test(base)) u = setParam(u, 'per_page', '100');
    const json = await page.evaluate(async ({ url, headers }) => {
      try { const r = await fetch(url, { headers: { authorization: headers.authorization || headers.Authorization || '', accept: 'application/json' }, credentials: 'include' }); return await r.json(); } catch (e) { return null; }
    }, { url: u, headers: apiReq.headers }).catch(() => null);
    if (!json) break;
    const arr = findClientArray(json);
    if (!arr.length) break;
    let newOnes = 0;
    for (const c of arr) { const id = pickId(c); const photo = pickPhoto(c); if (id && !(id in map)) { map[id] = { legacyId: id, photoUrl: photo || null, name: pickName(c), phone: pickPhone(c) }; newOnes++; } }
    got += newOnes;
    console.log('  página', pg, '→', arr.length, 'clientes (', got, 'únicos,', Object.values(map).filter((x) => x.photoUrl).length, 'com foto)');
    if (newOnes === 0) break; // sem novos → fim
    await sleep(400);
  }

  const withPhoto = Object.values(map).filter((x) => x.photoUrl);
  fs.writeFileSync(REF + '/clients-photos.json', JSON.stringify(Object.values(map), null, 2));
  console.log('\n=== DONE.', Object.keys(map).length, 'clientes ·', withPhoto.length, 'COM FOTO → belasis-reference/clients-photos.json ===');
  await sleep(1500);
  await ctx.close();
  process.exit(0);
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
