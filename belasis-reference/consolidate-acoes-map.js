/*
 * Consolida TODAS as ações capturadas em belasis-reference/{mobile-v4,interactions-*,v5,pixel,tooltips}/
 * num único ACOES-MAP.md humano-legível + ACOES-MAP.json machine-legível.
 */
const fs = require('fs');
const path = require('path');
const REF = __dirname;
const OUT_MD = REF + '/ACOES-MAP.md';
const OUT_JSON = REF + '/ACOES-MAP.json';

const readJSON = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
const ls = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };

const rotas = {};  // { slug: { desktop: {actions,...}, mobile: {...}, tooltips: [...] } }

function ensureRoute(slug) { rotas[slug] = rotas[slug] || { desktop: {}, mobile: {} }; return rotas[slug]; }

// 1. mobile-v4 (page + hamburger)
for (const e of ls(REF + '/mobile-v4')) {
  if (!e.isDirectory() || e.name.startsWith('_')) continue;
  const r = ensureRoute(e.name);
  const d = REF + '/mobile-v4/' + e.name;
  r.mobile.pageBytes = fs.existsSync(d + '/page.html') ? fs.statSync(d + '/page.html').size : 0;
  r.mobile.hamburgerBytes = fs.existsSync(d + '/hamburger.html') ? fs.statSync(d + '/hamburger.html').size : 0;
  r.mobile.newViaUrl = fs.existsSync(d + '/new-via-url.html');
}

// 2. interactions-mobile
const intMobileIdx = readJSON(REF + '/interactions-mobile/_index.json') || [];
for (const rec of intMobileIdx) {
  const r = ensureRoute(rec.slug);
  r.mobile.actions = rec.actions || [];
  r.mobile.bottomNav = rec.bottomNav || 0;
  r.mobile.duplicateOf = rec.duplicateOf || null;
  r.mobile.hash = rec.hash;
  r.mobile.url = rec.url;
}

// 3. interactions-desktop
const intDesktopIdx = readJSON(REF + '/interactions-desktop/_index.json') || [];
for (const rec of intDesktopIdx) {
  const r = ensureRoute(rec.slug);
  r.desktop.actions = rec.actions || [];
  r.desktop.duplicateOf = rec.duplicateOf || null;
  r.desktop.hash = rec.hash;
  r.desktop.url = rec.url;
}

// 4. pixel/desktop
for (const e of ls(REF + '/pixel/desktop')) {
  if (!e.isDirectory()) continue;
  const r = ensureRoute(e.name);
  const d = REF + '/pixel/desktop/' + e.name;
  r.desktop.hasNewDrawer = fs.existsSync(d + '/new-open.html');
  const pickers = ls(d + '/pickers');
  r.desktop.pickers = pickers.filter((p) => p.isDirectory()).map((p) => p.name);
  r.desktop.tabs = ls(d + '/tabs').filter((p) => p.isDirectory()).map((p) => p.name);
  r.desktop.hasRowMenu = fs.existsSync(d + '/row-menu.html');
  r.desktop.hasDeleteConfirm = fs.existsSync(d + '/delete-confirm.html');
}

// 5. v5 (desktop scroll + faturado + fluxo Faturados)
for (const e of ls(REF + '/v5/desktop')) {
  if (!e.isDirectory()) continue;
  const r = ensureRoute(e.name);
  const d = REF + '/v5/desktop/' + e.name;
  r.desktop.v5 = {
    hasSalesDetail: fs.existsSync(d + '/sales-detail.html'),
    hasFaturarButton: fs.existsSync(d + '/_faturar-button.json'),
    detailActions: readJSON(d + '/sales-detail-actions.json'),
  };
}

// 6. tooltips
const tooltipsAll = readJSON(REF + '/tooltips/_all.json') || {};
for (const [route, tips] of Object.entries(tooltipsAll)) {
  const slug = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
  const r = ensureRoute(slug);
  r.tooltips = tips;
}

// Salva JSON completo
fs.writeFileSync(OUT_JSON, JSON.stringify(rotas, null, 2));

// Gera MD humano
let md = `# ACOES-MAP — Mapa completo das ações capturadas do Belasis\n\n`;
md += `Gerado em ${new Date().toISOString()}\n\n`;
md += `Total rotas mapeadas: **${Object.keys(rotas).length}**\n\n`;
md += `## Sumário por rota\n\n`;
md += `| Rota | Desktop drawer | Desktop pickers | Desktop tabs | Mobile page | Mobile hamburger | Mobile bottom-nav | Mobile actions | Tooltips |\n`;
md += `|------|---:|---:|---:|---:|---:|---:|---:|---:|\n`;
for (const [slug, r] of Object.entries(rotas).sort()) {
  md += `| ${slug} `;
  md += `| ${r.desktop.hasNewDrawer ? '✅' : '—'} `;
  md += `| ${(r.desktop.pickers || []).length} `;
  md += `| ${(r.desktop.tabs || []).length} `;
  md += `| ${r.mobile.pageBytes ? Math.round(r.mobile.pageBytes/1024)+'k' : '—'} `;
  md += `| ${r.mobile.hamburgerBytes ? Math.round(r.mobile.hamburgerBytes/1024)+'k' : '—'} `;
  md += `| ${r.mobile.bottomNav || '—'} `;
  md += `| ${(r.mobile.actions || []).length} `;
  md += `| ${(r.tooltips || []).length} |\n`;
}
md += `\n## Ações detalhadas por rota\n\n`;
for (const [slug, r] of Object.entries(rotas).sort()) {
  md += `### ${slug}\n\n`;
  if (r.desktop.actions?.length) md += `**Desktop:** ${r.desktop.actions.map((a) => a.name + (a.clicked ? '="' + a.clicked + '"' : '')).join(' · ')}\n\n`;
  if (r.mobile.actions?.length) md += `**Mobile:** ${r.mobile.actions.map((a) => a.name + (a.clicked ? '="' + a.clicked + '"' : '')).join(' · ')}\n\n`;
  if (r.desktop.pickers?.length) md += `**Pickers do drawer (desktop):** ${r.desktop.pickers.join(', ')}\n\n`;
  if (r.desktop.tabs?.length) md += `**Tabs do drawer (desktop):** ${r.desktop.tabs.join(', ')}\n\n`;
  if (r.tooltips?.length) md += `**Tooltips:** ${r.tooltips.slice(0, 5).map((t) => '"' + (t.tooltip || t.context) + '"').join(', ')}${r.tooltips.length > 5 ? ` (+${r.tooltips.length - 5})` : ''}\n\n`;
  if (r.mobile.duplicateOf) md += `**⚠️ Rota mobile duplicada de ${r.mobile.duplicateOf} (fantasma)**\n\n`;
}

fs.writeFileSync(OUT_MD, md);
console.log(`ACOES-MAP.md salvo em ${OUT_MD}`);
console.log(`ACOES-MAP.json salvo em ${OUT_JSON}`);
console.log(`Total rotas: ${Object.keys(rotas).length}`);
