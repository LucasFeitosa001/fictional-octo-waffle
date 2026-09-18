#!/usr/bin/env node
/* Converte o export Belasis (XLS/XLSX) no formato consumido pelos importadores
 * idempotentes de Fátima Cabelos. Relatórios duplicados/derivados não viram
 * lançamentos extras: a fonte canônica é escolhida explicitamente abaixo. */
const XLSX = require(process.env.XLSX_MODULE || '/tmp/salonpass-xlsx-fixed/node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const SRC = process.env.FATIMA_XLS_DIR || '/mnt/c/Users/Usuario/Downloads';
const OUT = process.env.FATIMA_JSON_DIR || '/tmp/fatima-belasis-data';
fs.mkdirSync(OUT, { recursive: true });
const read = (name) => {
  const wb = XLSX.readFile(path.join(SRC, name), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
  const headers = rows.shift().map((x) => String(x).trim());
  return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
};
const out = (name, value) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(value));
const clean = (v) => String(v ?? '').replace(/\u00a0/g, ' ').trim();
const num = (v) => {
  let s = clean(v).replace(/R\$\s*/gi, '').replace(/%/g, '').replace(/\s/g, '');
  if (!s || /^(?:-|—|quitado|sem)$/i.test(s)) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^0-9+-.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const isoDate = (v) => {
  const s = clean(v);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const isoDateTime = (date, time = '00:00') => {
  const d = isoDate(date);
  const t = clean(time).match(/^(\d{1,2}):(\d{2})/);
  return d ? `${d}T${(t ? t[1] : '00').padStart(2, '0')}:${t ? t[2] : '00'}:00-03:00` : null;
};
const duration = (v) => { const m = clean(v).match(/^(\d+):([0-5]\d)$/); return m ? Number(m[1]) * 60 + Number(m[2]) : Math.max(1, Math.round(num(v)) || 30); };
const norm = (s) => clean(s).toUpperCase();

const clients = read('Lista-de-Clientes.xls').filter((r) => clean(r.Nome));
out('clientes.json', clients.map((r) => ({
  name: clean(r.Nome), mobile: clean(r.Celular).replace(/\D/g, ''), phone: clean(r.Telefone).replace(/\D/g, ''),
  email: clean(r['E-mail']) || null, cpf: clean(r.CPF) || null, rg: clean(r.RG) || null,
  birthday: isoDate(r['Aniversário']), active: true,
})));

const catalog = read('Lista-de-Produtos-e-Serviços.xls').filter((r) => clean(r.Nome));
const catalogItems = catalog.map((r) => ({
  kind: /^serv/i.test(clean(r.Tipo)) ? 'service' : 'product', name: clean(r.Nome), unit: clean(r.Unidade) || null,
  price: num(r.Valor), durationMin: duration(r.Duração), commission: num(r.Comissão), category: clean(r.Categoria) || null, brand: clean(r.Marca) || null,
}));
// Alguns itens antigos aparecem nas comandas, mas foram removidos do cadastro
// antes da exportação. Recriá-los com o preço médio histórico mantém os itens
// das comandas íntegros, sem inventar produtos para relatórios agregados.
const known = new Set(catalogItems.map((x) => norm(x.name)));
const observed = new Map();
for (const r of read('Vendas-Produtos-Serviços-Completo.xls')) {
  const name = clean(r['Produto/Serviço']); if (!name || !/^C#\d+$/i.test(clean(r['Comanda/Pacote/Assinatura']))) continue;
  const key = norm(name); const q = num(r.Quantidade) || 1; const row = observed.get(key) || { name, category: clean(r.Categoria) || null, total: 0, qty: 0 };
  row.total += num(r.Total); row.qty += q; observed.set(key, row);
}
for (const row of observed.values()) if (!known.has(norm(row.name))) {
  const service = /^(CABELO|UNHAS|ROSTO|DEPILA)/i.test(row.category || '') || /MANUTEN|ALONGAMENTO|MASSAGEM|SOBRANCELHA/i.test(row.name);
  catalogItems.push({ kind: service ? 'service' : 'product', name: row.name, unit: service ? null : 'Unidade', price: row.qty ? row.total / row.qty : 0,
    durationMin: 30, commission: 0, category: row.category, brand: null });
}
out('itens.json', catalogItems);
const stock = read('Estoque-Completo.xls').filter((r) => clean(r.Produto));
out('estoque.json', stock.map((r) => ({ name: clean(r.Produto), stock: num(r.Quantidade), cost: num(r.Custo) })));
const minRows = read('Sugestão-Produtos.xls').filter((r) => clean(r.Produto));
out('estoque-min.json', minRows.map((r) => ({ name: clean(r.Produto), minStock: num(r['Estoque mínimo']) })));

const appointmentsRaw = read('Agendamentos (1).xls').filter((r) => clean(r.Data) && clean(r['Horário inicial']) && clean(r.Cliente));
const status = (s) => { const x = norm(s); if (x.includes('CANCEL') || x.includes('EXCLU')) return 'canceled'; if (x.includes('CONFIRM')) return 'confirmed'; if (x.includes('AGUARD') || x.includes('ESPER')) return 'waiting'; if (x.includes('CONCL') || x.includes('FINAL')) return 'finished'; return 'scheduled'; };
out('agendamentos.json', appointmentsRaw.map((r) => ({
  start: isoDateTime(r.Data, r['Horário inicial']), cliente: clean(r.Cliente), profissional: clean(r.Profissional), servico: clean(r.Serviço),
  status: status(r.Status), notes: clean(r.Observação) || null, durMin: duration(r.Duração), phone: clean(r.Celular).replace(/\D/g, ''),
})).filter((r) => r.start));

const people = new Set(['FATIMA LACERDA']);
for (const r of appointmentsRaw) if (clean(r.Profissional)) people.add(clean(r.Profissional));
for (const r of read('Vendas-Produtos-Serviços-Completo.xls')) if (clean(r['Profissional/Vendedor'])) people.add(clean(r['Profissional/Vendedor']));
for (const r of read('Criação de Agendamento.xls')) if (clean(r['Criado por'])) people.add(clean(r['Criado por']));
out('profissionais.json', [...people]);

const finRows = read('Extrato de Contas.xls').filter((r) => clean(r['Data competência']) && num(r.Bruto) !== 0);
out('financeiro.json', finRows.map((r) => {
  const gross = num(r.Bruto); const paidText = clean(r['Pagamento/Baixa']);
  return { kind: gross < 0 ? 'expense' : 'income', valor: Math.abs(gross), pago: paidText ? Math.abs(gross) : 0,
    historico: clean(r.Histórico) || null, competencia: isoDate(r['Data competência']), vencimento: isoDate(r.Vencimento), baixa: isoDate(paidText),
    forma: clean(r['Forma de pagamento']) || null, conta: clean(r.Conta) || null, categoria: clean(r.Categoria) || null };
}));

const commandRows = read('Vendas-Comandas-Pacotes (1).xls').filter((r) => /^C#\d+$/i.test(clean(r['Comanda/Pacote'])));
out('comandas.json', commandRows.map((r) => ({ num: Number(clean(r['Comanda/Pacote']).replace(/\D/g, '')), cliente: clean(r.Cliente) || null,
  date: isoDate(r['Data da venda']), subtotal: num(r.Subtotal), desconto: num(r['Desconto total']) + num(r['Desconto unitário']), credito: num(r.Crédito), cashback: num(r.Cashback), total: num(r.Total) })));
const sales = read('Vendas-Produtos-Serviços-Completo.xls').filter((r) => /^C#\d+$/i.test(clean(r['Comanda/Pacote/Assinatura'])) && clean(r['Produto/Serviço']));
out('comanda-itens.json', sales.map((r) => ({ num: Number(clean(r['Comanda/Pacote/Assinatura']).replace(/\D/g, '')), item: clean(r['Produto/Serviço']), qtd: num(r.Quantidade) || 1, total: num(r.Total), prof: clean(r['Profissional/Vendedor']) || null })));
const consumed = read('Produtos-Consumidos.xls').filter((r) => clean(r.Comanda) && clean(r.Produto));
out('produtos-consumidos.json', consumed.map((r, i) => ({ legacyId: `cons:${i}:${clean(r.Comanda)}`, num: Number(clean(r.Comanda).replace(/\D/g, '')), product: clean(r.Produto), quantity: num(r.Quantidade) || 1, unitValue: num(r['Valor unitário']), unit: null, date: isoDate(r.Data) })));
const packageRows = read('Pacotes adquiridos.xls').filter((r) => /^P#\d+$/i.test(clean(r.Código)));
out('pacotes.json', packageRows.map((r) => ({ code: clean(r.Código), cliente: clean(r.Cliente), valor: num(r.Valor), status: /ativo/i.test(clean(r.Disponibilidade)) ? 'active' : /venc/i.test(clean(r.Disponibilidade)) ? 'expired' : 'finished', validade: isoDate(r.Validade), itens: clean(r.Itens), qtd: num(r.Quantidade), saldo: num(r.Saldo), date: isoDate(r['Data da venda']) })));

// Arquivo adicional para a carga de movimentações de estoque (não é relatório derivado).
const moves = read('Movimentações de estoque.xls').filter((r) => clean(r.Data) && clean(r.Produto) && clean(r.Movimentação));
out('movimentacoes-estoque.json', moves.map((r, i) => ({ legacyId: `inv:${i}:${isoDate(r.Data)}:${norm(r.Produto)}:${num(r.Quantidade)}`,
  date: isoDate(r.Data), product: clean(r.Produto), type: /sa[ií]da/i.test(clean(r.Movimentação)) ? 'out' : /entrada/i.test(clean(r.Movimentação)) ? 'in' : 'adjust', quantity: num(r.Quantidade), reason: clean(r.Descrição) || null, saldo: num(r.Saldo) })));
const inactive = read('Clientes-Inativos.xls').filter((r) => clean(r.Nome));
out('clientes-inativos.json', inactive.map((r) => ({ name: clean(r.Nome), phone: clean(r.Celular || r.Telefone).replace(/\D/g, '') })));

const counts = {}; for (const f of fs.readdirSync(OUT)) if (f.endsWith('.json')) counts[f] = JSON.parse(fs.readFileSync(path.join(OUT, f))).length;
console.log(JSON.stringify({ out: OUT, counts }, null, 2));
