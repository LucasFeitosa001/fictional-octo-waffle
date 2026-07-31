/**
 * Corrige o status dos agendamentos importados a partir do relatório do Belasis.
 * Rode com CONFIRMA=1 para escrever; sem isso é ensaio.
 */
import { prod as p } from './prod.mjs';
import fs from 'fs';
const cid = 'cmrqa8nzm00000hfbkyljwqrc';
const plano = JSON.parse(fs.readFileSync(`${new URL('.', import.meta.url).pathname}/plano-status.json`, 'utf8'));
const escrever = process.env.CONFIRMA === '1';

const porDestino = plano.atualizacoes.reduce((acc, u) => {
  const k = `${u.de}→${u.para}`;
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({
  modo: escrever ? 'ESCREVENDO' : 'ensaio',
  atualizacoes: plano.atualizacoes.length,
  porTransicao: porDestino,
  semCorrespondencia: (plano.semCorrespondencia ?? []).length,
}, null, 1));

if (!escrever) { await p.$disconnect(); process.exit(0); }

// Em lotes por destino: um updateMany por status alvo, com o id restrito.
const porStatus = new Map();
for (const u of plano.atualizacoes) {
  if (!porStatus.has(u.para)) porStatus.set(u.para, []);
  porStatus.get(u.para).push(u.id);
}
let total = 0;
for (const [status, ids] of porStatus) {
  for (let i = 0; i < ids.length; i += 200) {
    const fatia = ids.slice(i, i + 200);
    const r = await p.appointment.updateMany({
      where: { id: { in: fatia }, companyId: cid },
      data: { status },
    });
    total += r.count;
  }
  console.log(`→ ${status}: ${ids.length} pedidos`);
}
console.log('agendamentos atualizados:', total);
const dist = await p.appointment.groupBy({ by: ['status'], where: { companyId: cid }, _count: true });
console.log('distribuição final:', JSON.stringify(dist));
await p.$disconnect();
