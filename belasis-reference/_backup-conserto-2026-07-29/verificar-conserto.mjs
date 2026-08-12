import { prod as p } from './prod.mjs';
import fs from 'fs';
const cid = 'cmrqa8nzm00000hfbkyljwqrc';
const dir = '/home/lucssfeitosa/beautypass/beautypass/belasis-reference/_backup-conserto-2026-07-29';

// 1) Nenhum cabeçalho pode ter mudado.
const antes = JSON.parse(fs.readFileSync(`${dir}/ordens-sem-item.json`, 'utf8'));
const ids = antes.map((o) => o.id);
const agora = await p.order.findMany({ where: { id: { in: ids } }, select: { id: true, number: true, netTotal: true, grossTotal: true, _count: { select: { items: true } } } });
const mapa = new Map(antes.map((o) => [o.id, o]));
const mudaram = agora.filter((o) => String(o.netTotal) !== String(mapa.get(o.id).netTotal) || String(o.grossTotal) !== String(mapa.get(o.id).grossTotal));
console.log('cabeçalhos alterados (tem que ser 0):', mudaram.length);
console.log('das 103, agora COM itens:', agora.filter((o) => o._count.items > 0).length);

// 2) Comandas sem item que sobraram, e quanto valem.
const semItem = await p.order.findMany({ where: { companyId: cid, items: { none: {} } }, select: { number: true, netTotal: true } });
console.log('ainda sem item:', semItem.length, '| soma:', semItem.reduce((s, o) => s + Number(o.netTotal), 0).toFixed(2));

// 3) Totais gerais de itens e status.
const itens = await p.orderItem.count({ where: { order: { companyId: cid } } });
const st = await p.appointment.groupBy({ by: ['status'], where: { companyId: cid }, _count: true });
console.log('itens de comanda na empresa:', itens);
console.log('agendamentos por status:', JSON.stringify(st));

// 4) O faturamento não pode ter mudado.
const fat = await p.order.aggregate({ _sum: { netTotal: true }, where: { companyId: cid, status: 'finished' } });
console.log('faturamento (comandas finalizadas):', String(fat._sum.netTotal));

// 5) Catálogo: quantos foram criados hoje (inativos).
const inativosS = await p.service.count({ where: { companyId: cid, active: false } });
const inativosP = await p.product.count({ where: { companyId: cid, active: false } });
console.log('catálogo inativo (recriado do histórico): serviços', inativosS, '| produtos', inativosP);
await p.$disconnect();
