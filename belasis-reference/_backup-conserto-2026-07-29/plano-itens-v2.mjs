/**
 * Plano de religar itens — v2, com a chave CERTA.
 *
 * A v1 cruzou `Order.number` com `C#<n>` do relatório. Errado: nossa numeração
 * foi resequenciada na importação. O que amarra é o `Order.legacyId = "cmd:<n>"`
 * — a comanda #348 nossa é a C#352 do Belasis.
 */
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/home/lucssfeitosa/beautypass/beautypass/packages/db/');
const { PrismaClient } = require('@prisma/client');
const XLSX = (await import('xlsx')).default;

const url = fs.readFileSync('/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/d6b351c7-90d3-45f3-aa74-75c4f3e3862e/scratchpad/.dburl', 'utf8').trim();
const p = new PrismaClient({ datasources: { db: { url } } });
const cid = 'cmrqa8nzm00000hfbkyljwqrc';

const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

const wb = XLSX.readFile('/mnt/c/Users/Usuario/Downloads/Vendas-Produtos-Serviços-Completo.xls');
const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).slice(1);

// C#<n> → linhas
const porComanda = new Map();
for (const l of linhas) {
  const chave = String(l[2] ?? '').trim();
  const m = /^C#(\d+)$/.exec(chave);
  if (!m) continue;
  const n = m[1];
  if (!porComanda.has(n)) porComanda.set(n, []);
  porComanda.get(n).push({
    cliente: l[0], data: l[3], profissional: l[4], nome: l[5], categoria: l[6],
    quantidade: Number(String(l[7]).replace(',', '.')) || 1,
    total: Number(String(l[8]).replace(',', '.')) || 0,
  });
}

const [ordens, servicos, produtos] = await Promise.all([
  p.order.findMany({
    where: { companyId: cid, items: { none: {} } },
    select: { id: true, number: true, legacyId: true, netTotal: true, date: true, customer: { select: { name: true } } },
    orderBy: { number: 'asc' },
  }),
  p.service.findMany({ where: { companyId: cid }, select: { id: true, name: true } }),
  p.product.findMany({ where: { companyId: cid }, select: { id: true, name: true } }),
]);
const idServico = new Map(servicos.map((s) => [norm(s.name), s.id]));
const idProduto = new Map(produtos.map((x) => [norm(x.name), x.id]));

const REVENDA = /DIDIM|PICOLE|SORVETE|PRODUTOS|NATYLLA|MIRRA|OLENKA|CHINA|WELLA|ANEETHUN|ACQUAFLORA|LONDON|FANBEAUTY|ROUPA|MAGA FORM/i;

const plano = { resumo: {}, ordens: [], faltamNoCatalogo: {} };
let religaveis = 0, batem = 0, semLinhas = 0, semCatalogo = 0;

for (const o of ordens) {
  const n = /^cmd:(\d+)$/.exec(o.legacyId ?? '')?.[1];
  const linhasDaComanda = n ? porComanda.get(n) ?? [] : [];
  if (linhasDaComanda.length === 0) { semLinhas++; plano.ordens.push({ numero: o.number, legacyId: o.legacyId, orderId: o.id, netTotal: Number(o.netTotal), itens: [], bate: false, motivo: 'sem linhas no relatório' }); continue; }

  const itens = linhasDaComanda.map((l) => {
    const chave = norm(l.nome);
    const ehRevenda = REVENDA.test(l.categoria ?? '') || REVENDA.test(l.nome ?? '');
    const refServico = idServico.get(chave);
    const refProduto = idProduto.get(chave);
    const kind = ehRevenda ? (refProduto ? 'product' : refServico ? 'service' : 'product')
                           : (refServico ? 'service' : refProduto ? 'product' : 'service');
    const refId = kind === 'service' ? refServico ?? null : refProduto ?? null;
    if (!refId) plano.faltamNoCatalogo[`${l.nome}|${l.categoria}|${kind}`] = (plano.faltamNoCatalogo[`${l.nome}|${l.categoria}|${kind}`] ?? 0) + 1;
    return {
      nome: l.nome, categoria: l.categoria, profissional: l.profissional,
      quantidade: l.quantidade, total: l.total,
      unitario: l.quantidade > 0 ? Number((l.total / l.quantidade).toFixed(2)) : l.total,
      kind, refId,
    };
  });
  const soma = Number(itens.reduce((s, i) => s + i.total, 0).toFixed(2));
  const bate = Math.abs(soma - Number(o.netTotal)) <= 0.01;
  const completo = itens.every((i) => i.refId);
  if (bate) batem++;
  if (!completo) semCatalogo++;
  if (bate && completo) religaveis++;
  plano.ordens.push({
    numero: o.number, legacyId: o.legacyId, orderId: o.id, cliente: o.customer?.name,
    data: o.date.toISOString().slice(0, 10), netTotal: Number(o.netTotal), soma, bate, completo, itens,
  });
}

plano.resumo = {
  comandasSemItem: ordens.length,
  comLinhasNoRelatorio: ordens.length - semLinhas,
  semLinhas,
  somasQueBatem: batem,
  comNomeForaDoCatalogo: semCatalogo,
  religaveis100: religaveis,
  itensAInserir: plano.ordens.filter((o) => o.bate && o.completo).reduce((s, o) => s + o.itens.length, 0),
};
plano.faltamNoCatalogo = Object.entries(plano.faltamNoCatalogo).map(([k, v]) => ({ chave: k, ocorrencias: v }));

fs.writeFileSync('/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/d6b351c7-90d3-45f3-aa74-75c4f3e3862e/scratchpad/plano-itens.json', JSON.stringify(plano, null, 1));
console.log(JSON.stringify(plano.resumo, null, 1));
console.log('faltam no catálogo:', JSON.stringify(plano.faltamNoCatalogo, null, 1));
console.log('amostra:', JSON.stringify(plano.ordens.filter((o) => o.bate && o.completo).slice(0, 3), null, 1).slice(0, 900));
await p.$disconnect();
