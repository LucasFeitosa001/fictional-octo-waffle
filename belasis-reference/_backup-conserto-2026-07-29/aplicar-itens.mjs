/**
 * Religa os itens das comandas importadas sem item.
 *
 * REGRA DE OURO: o cabeçalho da comanda NÃO muda. Só religo quando a soma dos
 * itens bate com o `netTotal` já lançado — item que não fecha com o total faria
 * o `recalculate()` mudar o valor da comanda sozinho numa edição futura.
 *
 * Rode com CONFIRMA=1 para escrever; sem isso é ensaio.
 */
import { prod as p } from './prod.mjs';
import fs from 'fs';
const cid = 'cmrqa8nzm00000hfbkyljwqrc';
const plano = JSON.parse(fs.readFileSync(`${new URL('.', import.meta.url).pathname}/plano-itens.json`, 'utf8'));
const escrever = process.env.CONFIRMA === '1';

const elegiveis = plano.ordens.filter((o) => o.bate && o.itens.length > 0 && o.itens.every((i) => i.refId));
const semCatalogo = plano.ordens.filter((o) => o.itens.length > 0 && !o.itens.every((i) => i.refId));
const naoBatem = plano.ordens.filter((o) => o.itens.length > 0 && !o.bate);
const semLinhas = plano.ordens.filter((o) => o.itens.length === 0);

console.log(JSON.stringify({
  modo: escrever ? 'ESCREVENDO' : 'ensaio',
  elegiveis: elegiveis.length,
  bloqueadasPorCatalogo: semCatalogo.length,
  bloqueadasPorTotalDivergente: naoBatem.length,
  semLinhasNoRelatorio: semLinhas.length,
  itensAInserir: elegiveis.reduce((s, o) => s + o.itens.length, 0),
}, null, 1));

if (!escrever) { await p.$disconnect(); process.exit(0); }

const profs = await p.professional.findMany({ where: { companyId: cid }, select: { id: true, name: true } });
const idPorProf = new Map(profs.map((x) => [x.name.trim().toUpperCase(), x.id]));

let inseridos = 0;
for (const o of elegiveis) {
  const antes = await p.order.findUnique({ where: { id: o.orderId }, select: { netTotal: true, items: { select: { id: true } } } });
  if (!antes || antes.items.length > 0) continue; // idempotente: não duplica
  await p.$transaction(
    o.itens.map((it) =>
      p.orderItem.create({
        data: {
          orderId: o.orderId,
          kind: it.kind,
          refId: it.refId,
          professionalId: idPorProf.get(String(it.profissional ?? '').trim().toUpperCase()) ?? null,
          quantity: it.quantidade,
          unitPrice: it.unitario,
          grossValue: it.total,
          discount: 0,
        },
      }),
    ),
  );
  const depois = await p.order.findUnique({ where: { id: o.orderId }, select: { netTotal: true } });
  if (String(depois.netTotal) !== String(antes.netTotal)) {
    throw new Error(`cabeçalho da comanda #${o.numero} mudou — abortando`);
  }
  inseridos += o.itens.length;
}
console.log('itens inseridos:', inseridos);
const aindaSemItem = await p.order.count({ where: { companyId: cid, items: { none: {} } } });
console.log('comandas ainda sem item:', aindaSemItem);
await p.$disconnect();
