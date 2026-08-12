/**
 * DESFAZ o conserto de 29/07 na produção da Fátima.
 *
 *   node reverter.mjs itens        → apaga os OrderItem criados hoje nas 103 comandas
 *   node reverter.mjs status       → devolve o status de TODOS os agendamentos ao que era
 *   node reverter.mjs catalogo     → apaga serviços/produtos criados hoje (só os sem uso)
 *
 * O que fundamenta cada passo está em belasis-reference/_backup-conserto-2026-07-29/.
 */
import { prod as p } from './prod.mjs';
import fs from 'fs';
const cid = 'cmrqa8nzm00000hfbkyljwqrc';
const dir = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_backup-conserto-2026-07-29';
const modo = process.argv[2];

if (modo === 'itens') {
  const ordens = JSON.parse(fs.readFileSync(`${dir}/ordens-sem-item.json`, 'utf8'));
  const ids = ordens.map((o) => o.id);
  const r = await p.orderItem.deleteMany({ where: { orderId: { in: ids } } });
  console.log('itens apagados:', r.count);
  // Confere que os cabeçalhos continuam intactos.
  const agora = await p.order.findMany({ where: { id: { in: ids } }, select: { id: true, netTotal: true } });
  const antes = new Map(ordens.map((o) => [o.id, String(o.netTotal)]));
  const mudou = agora.filter((o) => String(o.netTotal) !== antes.get(o.id));
  console.log('cabeçalhos alterados (deve ser 0):', mudou.length);
} else if (modo === 'status') {
  const ags = JSON.parse(fs.readFileSync(`${dir}/agendamentos-status.json`, 'utf8'));
  let n = 0;
  for (const a of ags) {
    const r = await p.appointment.updateMany({
      where: { id: a.id, companyId: cid, status: { not: a.status } },
      data: { status: a.status },
    });
    n += r.count;
  }
  console.log('agendamentos revertidos:', n);
} else if (modo === 'catalogo') {
  const { servicos, produtos } = JSON.parse(fs.readFileSync(`${dir}/catalogo.json`, 'utf8'));
  const idsS = new Set(servicos.map((x) => x.id));
  const idsP = new Set(produtos.map((x) => x.id));
  const novosS = (await p.service.findMany({ where: { companyId: cid }, select: { id: true, name: true } })).filter((x) => !idsS.has(x.id));
  const novosP = (await p.product.findMany({ where: { companyId: cid }, select: { id: true, name: true } })).filter((x) => !idsP.has(x.id));
  console.log('criados hoje — serviços:', novosS.length, '| produtos:', novosP.length);
  console.log('para apagar, rode com CONFIRMA=1');
  if (process.env.CONFIRMA === '1') {
    const usados = new Set((await p.orderItem.findMany({ where: { order: { companyId: cid } }, select: { refId: true } })).map((i) => i.refId));
    const apagarS = novosS.filter((x) => !usados.has(x.id)).map((x) => x.id);
    const apagarP = novosP.filter((x) => !usados.has(x.id)).map((x) => x.id);
    console.log('serviços apagados:', (await p.service.deleteMany({ where: { id: { in: apagarS } } })).count);
    console.log('produtos apagados:', (await p.product.deleteMany({ where: { id: { in: apagarP } } })).count);
  }
} else {
  console.log('uso: node reverter.mjs itens|status|catalogo');
}
await p.$disconnect();
