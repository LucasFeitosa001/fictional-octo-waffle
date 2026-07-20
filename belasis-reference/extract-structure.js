/*
 * Turn a captured Belasis HTML file into a compact, readable structure skeleton
 * (real DOM via Playwright, offline). Prints an indented tree: tag, meaningful
 * classes, role/aria, and trimmed direct text — so we can clone layout without
 * dumping the raw hashed markup. Also emits computed-ish hints from inline style.
 *
 * Usage: node extract-structure.js <file.html> [maxDepth] > out.txt
 */
const { chromium } = require('playwright');
const fs = require('fs');

const file = process.argv[2];
const MAXDEPTH = parseInt(process.argv[3] || '14', 10);
if (!file || !fs.existsSync(file)) { console.error('file not found:', file); process.exit(1); }

(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await b.newPage();
  await page.setContent(fs.readFileSync(file, 'utf8'), { waitUntil: 'domcontentloaded' });

  const out = await page.evaluate((MAXDEPTH) => {
    const KEEP_ATTR = ['role', 'aria-label', 'placeholder', 'type', 'href'];
    // keep human-meaningful classes (ant-*, semantic names); drop hashed noise:
    // styled-components (wb__sc-*), emotion (css-*), and random 6-8 char hashes.
    const isNoise = (c) =>
      /^wb__sc-/.test(c) || /^css-[a-z0-9]+$/i.test(c) ||
      (/^[A-Za-z]{5,9}$/.test(c) && /[A-Z]/.test(c) && /[a-z]/.test(c) && !/^ant/.test(c));
    const cleanClass = (cls) =>
      (cls || '').split(/\s+/).filter((c) => c && !isNoise(c)).slice(0, 5).join('.');
    const lines = [];
    const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'IFRAME']);
    function directText(el) {
      let t = '';
      for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
      return t.replace(/\s+/g, ' ').trim().slice(0, 60);
    }
    function walk(el, depth) {
      if (depth > MAXDEPTH || skip.has(el.tagName)) return;
      const r = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
      const cls = cleanClass(el.getAttribute('class'));
      const attrs = KEEP_ATTR.filter((a) => el.hasAttribute(a)).map((a) => `${a}=${JSON.stringify(el.getAttribute(a).slice(0, 30))}`).join(' ');
      const txt = directText(el);
      // skip pure-wrapper divs with nothing distinctive to reduce noise
      const distinctive = cls || attrs || txt || ['BUTTON', 'A', 'INPUT', 'IMG', 'SVG', 'TABLE', 'UL', 'LI', 'H1', 'H2', 'H3', 'LABEL', 'HEADER', 'NAV', 'MAIN', 'SECTION', 'FORM'].includes(el.tagName);
      if (distinctive) {
        const tag = el.tagName.toLowerCase();
        const dim = r.width && r.height ? ` {${Math.round(r.width)}x${Math.round(r.height)}}` : '';
        lines.push('  '.repeat(depth) + `${tag}${cls ? '.' + cls : ''}${attrs ? ' [' + attrs + ']' : ''}${txt ? ' "' + txt + '"' : ''}`);
        for (const c of el.children) walk(c, depth + 1);
      } else {
        for (const c of el.children) walk(c, depth);
      }
    }
    const root = document.body;
    for (const c of root.children) walk(c, 0);
    return lines.join('\n');
  }, MAXDEPTH);

  process.stdout.write(out + '\n');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
