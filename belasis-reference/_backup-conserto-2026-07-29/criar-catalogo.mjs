/**
 * Cria no catálogo os serviços/produtos que o histórico usa e que não vieram na
 * importação. Nascem INATIVOS e invisíveis: restauram o histórico sem entrar nas
 * listas de venda nova. Rode com CONFIRMA=1 para escrever.
 */
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/home/lucssfeitosa/beautypass/beautypass/packages/db/');
const { PrismaClient } = require('@prisma/client');
const url = fs.readFileSync('/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/d6b351c7-90d3-45f3-aa74-75c4f3e3862e/scratchpad/.dburl', 'utf8').trim();
const p = new PrismaClient({ datasources: { db: { url } } });
const cid = 'cmrqa8nzm00000hfbkyljwqrc';
const escrever = process.env.CONFIRMA === '1';

const plano = JSON.parse(fs.readFileSync('/tmp/claude-1000/-home-lucssfeitosa-beautypass-beautypass/d6b351c7-90d3-45f3-aa74-75c4f3e3862e/scratchpad/plano-itens.json', 'utf8'));

// Preço = o mais frequente no histórico daquele nome (não a média: o valor real cobrado).
const precos = new Map();
for (const o of plano.ordens) {
  for (const it of o.itens ?? []) {
    if (it.refId) continue;
    const k = `${it.kind}|${it.nome}`;
    if (!precos.has(k)) precos.set(k, { kind: it.kind, nome: it.nome, categoria: it.categoria, valores: [] });
    precos.get(k).valores.push(it.unitario);
  }
}
const maisFrequente = (arr) => {
  const c = new Map();
  for (const v of arr) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
};

const aCriar = [...precos.values()].map((x) => ({ ...x, preco: maisFrequente(x.valores), ocorrencias: x.valores.length }));
console.log(JSON.stringify({
  modo: escrever ? 'ESCREVENDO' : 'ensaio',
  servicos: aCriar.filter((x) => x.kind === 'service').length,
  produtos: aCriar.filter((x) => x.kind === 'product').length,
  itens: aCriar.map((x) => `${x.kind} · ${x.nome} · R$ ${x.preco} · ${x.ocorrencias}x`),
}, null, 1));

if (!escrever) { await p.$disconnect(); process.exit(0); }

let criados = 0;
for (const x of aCriar) {
  const jaExiste = x.kind === 'service'
    ? await p.service.findFirst({ where: { companyId: cid, name: x.nome }, select: { id: true } })
    : await p.product.findFirst({ where: { companyId: cid, name: x.nome }, select: { id: true } });
  if (jaExiste) continue;
  if (x.kind === 'service') {
    await p.service.create({
      data: { companyId: cid, name: x.nome, price: x.preco, durationMin: 30,
              active: false, visible: false, onlineBookable: false,
              description: 'Recriado a partir do histórico importado do Belasis (29/07/2026).' },
    });
  } else {
    await p.product.create({
      data: { companyId: cid, name: x.nome, salePrice: x.preco, costPrice: 0, stock: 0,
              active: false, observation: 'Recriado a partir do histórico importado do Belasis (29/07/2026).' },
    });
  }
  criados++;
}
console.log('criados:', criados);
await p.$disconnect();
