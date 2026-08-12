/**
 * Comandas que importaram SÓ PARTE dos itens: religa as linhas que faltaram.
 * Só age quando (itens atuais + linhas faltantes) fecha com o netTotal já lançado.
 */
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/home/lucssfeitosa/beautypass/beautypass/packages/db/');
const { PrismaClient } = require('@prisma/client');
const XLSX = (await import('xlsx')).default;
const url = fs.readFileSync('/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/d6b351c7-90d3-45f3-aa74-75c4f3e3862e/scratchpad/.dburl', 'utf8').trim();
const p = new PrismaClient({ datasources: { db: { url } } });
const cid = 'cmrqa8nzm00000hfbkyljwqrc';
const escrever = process.env.CONFIRMA === '1';
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

const wb = XLSX.readFile('/mnt/c/Users/Usuario/Downloads/Vendas-Produtos-Serviços-Completo.xls');
const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).slice(1);
const porComanda = new Map();
for (const l of linhas) {
  const m = /^C#(\d+)$/.exec(String(l[2] ?? '').trim());
  if (!m) continue;
  const arr = porComanda.get(m[1]) ?? [];
  arr.push({ profissional: l[4], nome: l[5], categoria: l[6],
             quantidade: Number(String(l[7]).replace(',', '.')) || 1,
             total: Number(String(l[8]).replace(',', '.')) || 0 });
  porComanda.set(m[1], arr);
}

const [ordens, servicos, produtos, profs] = await Promise.all([
  p.order.findMany({ where: { companyId: cid, legacyId: { startsWith: 'cmd:' }, items: { some: {} } },
    select: { id: true, number: true, legacyId: true, netTotal: true, items: { select: { refId: true, grossValue: true, kind: true } } } }),
  p.service.findMany({ where: { companyId: cid }, select: { id: true, name: true } }),
  p.product.findMany({ where: { companyId: cid }, select: { id: true, name: true } }),
  p.professional.findMany({ where: { companyId: cid }, select: { id: true, name: true } }),
]);
const idServico = new Map(servicos.map((s) => [norm(s.name), s.id]));
const idProduto = new Map(produtos.map((x) => [norm(x.name), x.id]));
const idProf = new Map(profs.map((x) => [norm(x.name), x.id]));
const nomePorId = new Map([...servicos.map((s) => [s.id, norm(s.name)]), ...produtos.map((x) => [x.id, norm(x.name)])]);
const REVENDA = /DIDIM|PICOLE|SORVETE|PRODUTOS|NATYLLA|MIRRA|OLENKA|CHINA|WELLA|ANEETHUN|ACQUAFLORA|LONDON|FANBEAUTY|ROUPA|MAGA FORM|KIT |NINHO|BOMBOM/i;

const plano = [];
const faltamNomes = new Map();
for (const o of ordens) {
  const n = /^cmd:(\d+)$/.exec(o.legacyId ?? '')?.[1];
  const doRelatorio = n ? porComanda.get(n) ?? [] : [];
  if (doRelatorio.length <= o.items.length) continue;
  const jaTem = o.items.map((i) => nomePorId.get(i.refId) ?? '?');
  const restantes = [...jaTem];
  const faltantes = [];
  for (const l of doRelatorio) {
    const k = norm(l.nome);
    const i = restantes.indexOf(k);
    if (i >= 0) restantes.splice(i, 1);
    else faltantes.push(l);
  }
  if (faltantes.length === 0) continue;
  const somaAtual = o.items.reduce((s, i) => s + Number(i.grossValue), 0);
  const somaFaltante = faltantes.reduce((s, l) => s + l.total, 0);
  const fecha = Math.abs(somaAtual + somaFaltante - Number(o.netTotal)) <= 0.01;
  const itens = faltantes.map((l) => {
    const k = norm(l.nome);
    const revenda = REVENDA.test(l.categoria ?? '') || REVENDA.test(l.nome ?? '');
    const kind = revenda ? (idProduto.has(k) ? 'product' : idServico.has(k) ? 'service' : 'product')
                         : (idServico.has(k) ? 'service' : idProduto.has(k) ? 'product' : 'service');
    const refId = kind === 'service' ? idServico.get(k) ?? null : idProduto.get(k) ?? null;
    if (!refId) faltamNomes.set(`${kind}|${l.nome}|${l.categoria}`, (faltamNomes.get(`${kind}|${l.nome}|${l.categoria}`) ?? 0) + 1);
    return { ...l, kind, refId, unitario: l.quantidade > 0 ? Number((l.total / l.quantidade).toFixed(2)) : l.total };
  });
  plano.push({ orderId: o.id, numero: o.number, netTotal: Number(o.netTotal), somaAtual, somaFaltante, fecha,
               completo: itens.every((i) => i.refId), itens });
}

console.log(JSON.stringify({
  modo: escrever ? 'ESCREVENDO' : 'ensaio',
  comandasParciais: plano.length,
  itensFaltando: plano.reduce((s, o) => s + o.itens.length, 0),
  fechamComOTotal: plano.filter((o) => o.fecha).length,
  prontasParaReligar: plano.filter((o) => o.fecha && o.completo).length,
  nomesForaDoCatalogo: [...faltamNomes.entries()].map(([k, v]) => `${k} (${v}x)`),
}, null, 1));

if (!escrever) { await p.$disconnect(); process.exit(0); }
let inseridos = 0;
for (const o of plano.filter((x) => x.fecha && x.completo)) {
  const antes = await p.order.findUnique({ where: { id: o.orderId }, select: { netTotal: true } });
  await p.$transaction(o.itens.map((it) => p.orderItem.create({
    data: { orderId: o.orderId, kind: it.kind, refId: it.refId,
            professionalId: idProf.get(norm(it.profissional)) ?? null,
            quantity: it.quantidade, unitPrice: it.unitario, grossValue: it.total, discount: 0 },
  })));
  const depois = await p.order.findUnique({ where: { id: o.orderId }, select: { netTotal: true } });
  if (String(antes.netTotal) !== String(depois.netTotal)) throw new Error(`cabeçalho #${o.numero} mudou`);
  inseridos += o.itens.length;
}
console.log('itens inseridos nas parciais:', inseridos);
await p.$disconnect();
