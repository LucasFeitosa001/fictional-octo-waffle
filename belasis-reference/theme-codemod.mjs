/*
 * Themeable-color codemod. Converts Tailwind ARBITRARY brand-color classes
 *   bg-[#f2b33d]  text-[#111111]  border-[#fdfaf7]/40  ring-[#e0a01f]
 * into semantic token utilities (bg-gold, text-ink, …) that resolve per theme.
 *
 * SAFETY: only rewrites the `<prefix>-[#hex]` class-token syntax (optionally with
 * /opacity). It never touches inline style objects, chart props (stroke="#..."),
 * SVG fills, or plain JS hex strings — those don't match the class pattern.
 * Only hexes in BRAND_MAP are converted; every other arbitrary color is left as-is.
 *
 * Usage: node theme-codemod.mjs <srcDir> [--apply]
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!SRC || !fs.existsSync(SRC)) { console.error('srcDir not found:', SRC); process.exit(1); }

// normalized-lowercase 6-digit hex -> token name (tokens defined in index.css @theme inline)
const BRAND_MAP = {
  f2b33d: 'gold',
  e0a01f: 'gold-strong',
  a67c1e: 'gold-strong', // dark gold text → strong
  '111111': 'ink',
  '1a1a1a': 'ink-soft',
  fdfaf7: 'canvas',
  f7f3ea: 'cream',
  fffdf8: 'warm-white',
  f08ca5: 'pink',
  e9d9c3: 'beige',
  bfaf9e: 'beige-deep',
  '6f6a63': 'muted-ink',
};
const norm = (h) => {
  h = h.toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return h;
};

// prefix-[#hex] with optional /opacity, e.g. bg-[#f2b33d]/15 , hover:text-[#111]
const RE = /((?:[a-z-]+:)*[a-z][a-z-]*)-\[#([0-9a-fA-F]{3,8})\](\/[0-9.]+)?/g;

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist|\.git/.test(p)) walk(p); }
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) files.push(p);
  }
})(SRC);

let totalHits = 0, totalConv = 0;
const perToken = {};
const samples = [];
const touched = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let convInFile = 0;
  const out = src.replace(RE, (m, prefix, hex, op) => {
    totalHits++;
    const key = norm(hex);
    const token = BRAND_MAP[key];
    if (!token) return m; // non-brand arbitrary color: leave untouched
    // don't touch if it's an alpha-8 hex (rgba) — keep explicit
    if (hex.length === 8) return m;
    totalConv++; convInFile++;
    perToken[token] = (perToken[token] || 0) + 1;
    const repl = `${prefix}-${token}${op || ''}`;
    if (samples.length < 24) samples.push(`${m}  →  ${repl}   (${path.relative(SRC, f)})`);
    return repl;
  });
  if (convInFile > 0) {
    touched.push(`${convInFile}\t${path.relative(SRC, f)}`);
    if (APPLY) fs.writeFileSync(f, out);
  }
}

console.log(`files scanned: ${files.length}`);
console.log(`arbitrary-color classes seen: ${totalHits} · brand→token conversions: ${totalConv}`);
console.log('per token:', JSON.stringify(perToken));
console.log(`files touched: ${touched.length}`);
console.log('\n--- sample conversions ---\n' + samples.join('\n'));
console.log('\n--- top touched files ---\n' + touched.sort((a, b) => parseInt(b) - parseInt(a)).slice(0, 15).join('\n'));
console.log(APPLY ? '\n*** APPLIED ***' : '\n(dry-run — pass --apply to write)');
