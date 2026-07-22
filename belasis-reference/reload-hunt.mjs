// Forensic reload hunter — instruments spontaneous reloads on the SalonPass web app.
// Usage: node belasis-reference/reload-hunt.mjs
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE   = 'https://conferences-collar-proof-mine.trycloudflare.com';
const EMAIL  = 'contato@fatimacabelos.com.br';
const PASS   = 'fatima@2026';
const OUTDIR = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_out/reload-hunt';
const HOLD_MS = 60_000;

fs.mkdirSync(OUTDIR, { recursive: true });

const timeline = {
  meta: { base: BASE, email: EMAIL, holdMs: HOLD_MS, startedAt: null, t0LoginMs: null, iso: null },
  events: [],
  summary: {},
};

let t0 = 0;
const now = () => (t0 ? Date.now() - t0 : 0);
const push = (kind, data) => timeline.events.push({ t: now(), kind, ...data });

function classify(url) {
  if (/\/api\//.test(url)) return 'api';
  if (/\.(js|mjs|ts|tsx|jsx|css|map)(\?|$)/.test(url)) return 'code';
  if (/\.(png|jpe?g|svg|gif|webp|ico|woff2?|ttf)(\?|$)/.test(url)) return 'asset';
  if (/^wss?:/.test(url)) return 'ws';
  return 'other';
}

// Init script injected before ANY page script runs — hooks everything up.
const initScript = `
(() => {
  const t0 = performance.timeOrigin;
  const stamp = () => performance.now();
  const send = (kind, data) => {
    try { window.__reloadHunt && window.__reloadHunt(kind, data); } catch(e){}
    try { console.log('[HUNT]', kind, JSON.stringify(data)); } catch(e){ console.log('[HUNT]', kind); }
  };
  window.addEventListener('beforeunload', (e) => {
    send('beforeunload', { at: stamp(), stack: new Error().stack });
  }, true);
  window.addEventListener('unload', (e) => {
    send('unload', { at: stamp() });
  }, true);
  window.addEventListener('pagehide', (e) => {
    send('pagehide', { at: stamp(), persisted: e.persisted });
  }, true);
  document.addEventListener('visibilitychange', () => {
    send('visibilitychange', { at: stamp(), state: document.visibilityState });
  }, true);
  window.addEventListener('focus',    () => send('window.focus',    { at: stamp() }), true);
  window.addEventListener('blur',     () => send('window.blur',     { at: stamp() }), true);
  window.addEventListener('online',   () => send('online',          { at: stamp() }), true);
  window.addEventListener('offline',  () => send('offline',         { at: stamp() }), true);

  // location.reload / replace / assign / href setter
  const origReload = window.location.reload.bind(window.location);
  try {
    window.location.reload = function(...args){
      send('location.reload', { at: stamp(), stack: new Error().stack });
      return origReload(...args);
    };
  } catch(e){ send('hook.reload.failed', { err: String(e) }); }

  try {
    const origAssign = window.location.assign?.bind(window.location);
    if (origAssign) window.location.assign = function(u){
      send('location.assign', { at: stamp(), url: String(u), stack: new Error().stack });
      return origAssign(u);
    };
    const origReplace = window.location.replace?.bind(window.location);
    if (origReplace) window.location.replace = function(u){
      send('location.replace', { at: stamp(), url: String(u), stack: new Error().stack });
      return origReplace(u);
    };
  } catch(e){ send('hook.location.failed', { err: String(e) }); }

  // history
  const origPush = history.pushState.bind(history);
  history.pushState = function(state, title, url){
    send('history.pushState', { at: stamp(), url: String(url||''), stack: new Error().stack });
    return origPush(state, title, url);
  };
  const origReplaceH = history.replaceState.bind(history);
  history.replaceState = function(state, title, url){
    send('history.replaceState', { at: stamp(), url: String(url||''), stack: new Error().stack });
    return origReplaceH(state, title, url);
  };
  window.addEventListener('popstate', (e) => send('popstate', { at: stamp(), url: location.href }), true);
  window.addEventListener('hashchange', (e) => send('hashchange', { at: stamp(), url: location.href }), true);

  // setInterval tracker
  const origSI = window.setInterval;
  const intervals = new Map();
  window.setInterval = function(fn, delay, ...rest){
    const id = origSI.apply(this, [fn, delay, ...rest]);
    let src = '';
    try { src = (typeof fn === 'function') ? fn.toString().slice(0,220) : String(fn).slice(0,220); } catch(e){}
    intervals.set(id, { delay, src, at: stamp() });
    send('setInterval', { at: stamp(), id, delay, srcHead: src, stack: new Error().stack.split('\\n').slice(0,6).join('\\n') });
    return id;
  };
  const origCI = window.clearInterval;
  window.clearInterval = function(id){
    if (intervals.has(id)) { send('clearInterval', { at: stamp(), id }); intervals.delete(id); }
    return origCI.call(this, id);
  };

  const origST = window.setTimeout;
  window.setTimeout = function(fn, delay, ...rest){
    // only log timeouts > 1000ms to reduce noise
    if (typeof delay === 'number' && delay >= 1500) {
      let src = '';
      try { src = (typeof fn === 'function') ? fn.toString().slice(0,180) : String(fn).slice(0,180); } catch(e){}
      send('setTimeout>=1500', { at: stamp(), delay, srcHead: src });
    }
    return origST.apply(this, [fn, delay, ...rest]);
  };

  // fetch wrapper
  const origFetch = window.fetch.bind(window);
  window.fetch = function(input, init){
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const method = (init && init.method) || (typeof input === 'object' && input.method) || 'GET';
    send('fetch.start', { at: stamp(), url, method });
    return origFetch(input, init).then((r) => {
      send('fetch.end', { at: stamp(), url, status: r.status });
      return r;
    }).catch((e) => {
      send('fetch.error', { at: stamp(), url, err: String(e) });
      throw e;
    });
  };

  // XHR
  const OrigXHR = window.XMLHttpRequest;
  function TracedXHR(){
    const x = new OrigXHR();
    let _url = '', _m = 'GET';
    const origOpen = x.open;
    x.open = function(m, u, ...rest){ _m=m; _url=u; return origOpen.call(x, m, u, ...rest); };
    const origSend = x.send;
    x.send = function(body){
      send('xhr.start', { at: stamp(), url: _url, method: _m });
      x.addEventListener('loadend', () => send('xhr.end', { at: stamp(), url: _url, status: x.status }));
      return origSend.call(x, body);
    };
    return x;
  }
  TracedXHR.prototype = OrigXHR.prototype;
  try { window.XMLHttpRequest = TracedXHR; } catch(e){}

  // Splash mutation observer + generic React root reset detector
  const armSplash = () => {
    const splash = document.getElementById('splash') || document.querySelector('#splash, [data-splash], .splash-root');
    if (splash) {
      send('splash.found.initial', { at: stamp(), display: getComputedStyle(splash).display, visible: splash.offsetParent !== null });
    }
    const rootObs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // splash reappeared?
        if (m.target && (m.target.id === 'splash' || (m.target.closest && m.target.closest('#splash')))) {
          send('splash.mutation', { at: stamp(), type: m.type, attr: m.attributeName, stack: new Error().stack });
        }
        // Added a splash node?
        for (const n of m.addedNodes || []) {
          if (n.nodeType === 1 && (n.id === 'splash' || (n.querySelector && n.querySelector('#splash')))) {
            send('splash.re-added', { at: stamp(), stack: new Error().stack });
          }
        }
      }
    });
    rootObs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style','class','hidden','aria-hidden'] });
    send('mutationObserver.armed', { at: stamp() });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', armSplash, { once: true });
  } else {
    armSplash();
  }

  // Detect React root wipe (SPA hard-reset) — root children going to 0 then repopulating
  let lastRootChildren = 0;
  setInterval(() => {
    try {
      const r = document.getElementById('root') || document.body;
      const n = r.childElementCount;
      if (n !== lastRootChildren) {
        send('root.childCount.change', { at: stamp(), from: lastRootChildren, to: n });
        lastRootChildren = n;
      }
    } catch(e){}
  }, 250);

  send('init.done', { at: stamp(), url: location.href });
})();
`;

(async () => {
  timeline.meta.iso = new Date().toISOString();
  timeline.meta.startedAt = Date.now();

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    ...devices['iPhone 13'],
    ignoreHTTPSErrors: true,
    baseURL: BASE,
  });

  // Expose sink BEFORE add init so it's guaranteed
  await ctx.exposeBinding('__reloadHunt', (_source, kind, data) => {
    push('page:'+kind, { data });
  });

  await ctx.addInitScript({ content: initScript });

  const page = await ctx.newPage();

  // Console / errors / navigation / websockets
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[HUNT]')) return; // duplicate via binding
    push('console', { level: msg.type(), text: text.slice(0, 500) });
  });
  page.on('pageerror', (err) => push('pageerror', { message: String(err.message || err), stack: String(err.stack||'').slice(0, 800) }));
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) push('framenavigated', { url: frame.url() });
  });
  page.on('load', () => push('load', { url: page.url() }));
  page.on('domcontentloaded', () => push('domcontentloaded', { url: page.url() }));
  page.on('requestfailed', (req) => push('requestfailed', { url: req.url(), method: req.method(), failure: req.failure()?.errorText }));
  page.on('crash', () => push('crash', {}));
  page.on('close', () => push('close', {}));

  page.on('request', (req) => {
    const url = req.url();
    push('request', {
      url,
      method: req.method(),
      type: classify(url),
      rt: req.resourceType(),
      isNav: req.isNavigationRequest(),
    });
  });
  page.on('response', (res) => {
    const url = res.url();
    // reduce noise: only api + navigation + code
    const c = classify(url);
    if (c === 'asset') return;
    push('response', { url, status: res.status(), type: c });
  });

  // WebSocket events
  page.on('websocket', (ws) => {
    push('ws.open', { url: ws.url() });
    ws.on('framereceived', (data) => {
      const payload = typeof data.payload === 'string' ? data.payload : '[bin]';
      push('ws.recv', { url: ws.url(), payload: payload.slice(0, 500) });
    });
    ws.on('framesent', (data) => {
      const payload = typeof data.payload === 'string' ? data.payload : '[bin]';
      push('ws.send', { url: ws.url(), payload: payload.slice(0, 300) });
    });
    ws.on('close', () => push('ws.close', { url: ws.url() }));
    ws.on('socketerror', (err) => push('ws.error', { url: ws.url(), err: String(err) }));
  });

  // 1) LOGIN via REST — cookies persist on ctx.
  console.error('[hunt] logging in via', BASE + '/api/v1/auth/sign-in/email');
  const apiCtx = ctx.request;
  const loginRes = await apiCtx.post(BASE + '/api/v1/auth/sign-in/email', {
    data: { email: EMAIL, password: PASS },
    headers: { 'content-type': 'application/json' },
  });
  const loginStatus = loginRes.status();
  let loginBody = null;
  try { loginBody = await loginRes.json(); } catch(e){ loginBody = { raw: (await loginRes.text()).slice(0, 400) }; }
  console.error('[hunt] login status', loginStatus);
  t0 = Date.now();
  timeline.meta.t0LoginMs = t0;
  push('login.done', { status: loginStatus, hasToken: !!(loginBody && (loginBody.token || loginBody.session || loginBody.user)) });

  // 2) Navigate to /
  console.error('[hunt] goto /');
  const gotoStart = now();
  try {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    push('goto.error', { err: String(e) });
  }
  push('goto.done', { url: page.url(), tookMs: now() - gotoStart });

  // Screenshot marker
  try { await page.screenshot({ path: path.join(OUTDIR, 'shot-postload.png'), fullPage: false }); } catch(e){}

  // 3) Hold for 60s — just watch.
  console.error('[hunt] holding for', HOLD_MS, 'ms — recording…');
  const holdStart = now();
  // Take a screenshot every 15s to visually correlate
  const shotTimer = setInterval(async () => {
    try {
      const el = now();
      const p = path.join(OUTDIR, `shot-t${Math.round(el/1000)}s.png`);
      await page.screenshot({ path: p, fullPage: false });
      push('screenshot.taken', { path: p });
    } catch(e){}
  }, 15000);

  await page.waitForTimeout(HOLD_MS);
  clearInterval(shotTimer);

  try { await page.screenshot({ path: path.join(OUTDIR, 'shot-final.png'), fullPage: false }); } catch(e){}
  push('hold.done', { heldMs: now() - holdStart });

  // Grab performance nav entries + history length
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation').map((e) => ({ name: e.name, type: e.type, dur: e.duration, startTime: e.startTime }));
    return { nav, historyLen: history.length, url: location.href, docReadyState: document.readyState };
  }).catch((e) => ({ err: String(e) }));
  push('perf.snapshot', perf);

  await browser.close();

  // ---------- Analysis ----------
  const events = timeline.events;
  const s = timeline.summary;
  s.totalEvents = events.length;
  s.byKind = {};
  for (const e of events) s.byKind[e.kind] = (s.byKind[e.kind] || 0) + 1;

  // repeated get-session?
  const sessCalls = events.filter(e => (e.kind === 'request' || e.kind === 'page:fetch.start' || e.kind === 'page:xhr.start') && /\/api\/v1\/auth\/get-session|\/api\/auth\/session|\/auth\/me/i.test(e.url || e.data?.url || ''));
  s.getSessionCalls = sessCalls.length;
  if (sessCalls.length >= 2) {
    const deltas = [];
    for (let i = 1; i < sessCalls.length; i++) deltas.push(sessCalls[i].t - sessCalls[i-1].t);
    s.getSessionDeltasMs = deltas;
    s.getSessionMedianIntervalMs = deltas.slice().sort((a,b)=>a-b)[Math.floor(deltas.length/2)];
  }

  // navigations & reloads
  s.frameNavigations = events.filter(e => e.kind === 'framenavigated').map(e => ({ t: e.t, url: e.url }));
  s.loadEvents      = events.filter(e => e.kind === 'load').length;
  s.pageReloadCalls = events.filter(e => e.kind === 'page:location.reload').length;
  s.locationReplace = events.filter(e => e.kind === 'page:location.replace').length;
  s.pushStates      = events.filter(e => e.kind === 'page:history.pushState').length;
  s.replaceStates   = events.filter(e => e.kind === 'page:history.replaceState').length;
  s.popstate        = events.filter(e => e.kind === 'page:popstate').length;
  s.beforeunload    = events.filter(e => e.kind === 'page:beforeunload').length;
  s.pageErrors      = events.filter(e => e.kind === 'pageerror').length;

  // splash
  s.splashMutations  = events.filter(e => e.kind === 'page:splash.mutation').length;
  s.splashReAdded    = events.filter(e => e.kind === 'page:splash.re-added').length;
  s.rootChildChanges = events.filter(e => e.kind === 'page:root.childCount.change').length;

  // WebSocket / Vite HMR
  s.wsUrls = [...new Set(events.filter(e => e.kind === 'ws.open').map(e => e.url))];
  const viteMsgs = events.filter(e => e.kind === 'ws.recv' && /update|full-reload|prune|error/.test(e.payload || ''));
  s.viteMessages = viteMsgs.slice(0, 20).map(e => ({ t: e.t, url: e.url, payload: (e.payload || '').slice(0, 300) }));
  s.viteFullReloadCount = events.filter(e => e.kind === 'ws.recv' && /"type":"full-reload"/.test(e.payload || '')).length;
  s.viteUpdateCount     = events.filter(e => e.kind === 'ws.recv' && /"type":"update"/.test(e.payload || '')).length;

  // intervals
  const ivs = events.filter(e => e.kind === 'page:setInterval');
  s.intervalsRegistered = ivs.map(e => ({ t: e.t, delay: e.data?.delay, srcHead: (e.data?.srcHead || '').slice(0, 160) }));
  s.intervalCount = ivs.length;

  // sequence around each framenavigate / splash re-add — up to 8 events before, for cause pinning
  s.reloadCauseHints = [];
  const nav2 = events.filter((e, i) => i > 0 && e.kind === 'framenavigated');
  for (const nv of nav2) {
    const idx = events.indexOf(nv);
    const before = events.slice(Math.max(0, idx - 12), idx);
    s.reloadCauseHints.push({
      navT: nv.t, navUrl: nv.url,
      priorEvents: before.map(e => ({ t: e.t, kind: e.kind, url: e.url, text: e.text, data: e.data })).slice(-12),
    });
  }
  for (const ev of events.filter(e => e.kind === 'page:splash.re-added' || e.kind === 'page:splash.mutation')) {
    const idx = events.indexOf(ev);
    const before = events.slice(Math.max(0, idx - 8), idx);
    s.reloadCauseHints.push({
      splashT: ev.t, splashKind: ev.kind,
      priorEvents: before.map(e => ({ t: e.t, kind: e.kind, url: e.url, text: e.text, data: e.data })).slice(-8),
    });
  }

  // React StrictMode double-invoke heuristic: same api URL fired twice within 200ms
  const apiReqs = events.filter(e => e.kind === 'request' && classify(e.url) === 'api');
  const dupPairs = [];
  const byUrl = new Map();
  for (const r of apiReqs) {
    const prev = byUrl.get(r.url);
    if (prev && Math.abs(r.t - prev.t) < 250) dupPairs.push({ url: r.url, t1: prev.t, t2: r.t });
    byUrl.set(r.url, r);
  }
  s.strictModeDoubleInvokeCandidates = dupPairs.slice(0, 20);

  const outPath = path.join(OUTDIR, 'timeline.json');
  fs.writeFileSync(outPath, JSON.stringify(timeline, null, 2));
  console.error('[hunt] wrote', outPath, '— events:', events.length);

  // Compact console printout
  console.log('SUMMARY:', JSON.stringify(s, null, 2).slice(0, 4000));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
