/** Cria os nomes que faltam para as comandas PARCIAIS (inativos, como os outros). */
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/home/lucssfeitosa/beautypass/beautypass/packages/db/');
const { PrismaClient } = require('@prisma/client');
const XLSX = (await import('xlsx')).default;
const url = fs.readFileSync('/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/d6b351c7-90d3-45f3-aa74-75c4f3e3862e/scratchpad/.dburl', 'utf8').trim();
const p = new PrismaClient({ datasources: { db: { url } } });
const cid = 'cmrqa8nzm00000hfbkyljwqrc';
const escrever = process.env.CONFIRMA === '1';

const FALTAM = [
  ['product', 'MASCARA GINKCO BILOBA 500G'],
  ['product', 'KIT PROTEINAS DO LEITE 500G'],
  ['product', 'KIT OJON'],
  ['service', 'UNHA POSTICA'],
  ['product', 'KIT PROTEINAS DO LEITE 250G'],
  ['product', 'KIT POWER FORCE'],
  ['product', 'NINHO C/ KITKAT'],
  ['service', 'SOBRANCELHA MASCULINA'],
  ['product', 'SENSAÇAO'],
];

const wb = XLSX.readFile('/mnt/c/Users/Usuario/Downloads/Vendas-Produtos-Serviços-Completo.xls');
const linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }).slice(1);
const precoPorNome = new Map();
for (const l of linhas) {
  const nome = String(l[5] ?? '').trim();
  const q = Number(String(l[7]).replace(',', '.')) || 1;
  const t = Number(String(l[8]).replace(',', '.')) || 0;
  if (!precoPorNome.has(nome)) precoPorNome.set(nome, []);
  precoPorNome.get(nome).push(q > 0 ? Number((t / q).toFixed(2)) : t);
}
const maisFrequente = (arr) => {
  const c = new Map();
  for (const v of arr) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
};

const plano = FALTAM.map(([kind, nome]) => ({ kind, nome, preco: maisFrequente(precoPorNome.get(nome) ?? [0]) }));
console.log(JSON.stringify({ modo: escrever ? 'ESCREVENDO' : 'ensaio', plano }, null, 1));
if (!escrever) { await p.$disconnect(); process.exit(0); }

let criados = 0;
for (const x of plano) {
  const existe = x.kind === 'service'
    ? await p.service.findFirst({ where: { companyId: cid, name: x.nome }, select: { id: true } })
    : await p.product.findFirst({ where: { companyId: cid, name: x.nome }, select: { id: true } });
  if (existe) continue;
  if (x.kind === 'service') {
    await p.service.create({ data: { companyId: cid, name: x.nome, price: x.preco, durationMin: 30, active: false, visible: false, onlineBookable: false, description: 'Recriado a partir do histórico importado do Belasis (29/07/2026).' } });
  } else {
    await p.product.create({ data: { companyId: cid, name: x.nome, salePrice: x.preco, costPrice: 0, stock: 0, active: false, observation: 'Recriado a partir do histórico importado do Belasis (29/07/2026).' } });
  }
  criados++;
}
console.log('criados:', criados);
await p.$disconnect();
