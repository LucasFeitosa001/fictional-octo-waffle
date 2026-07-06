import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, CircleDollarSign, Package, Percent, Sparkles, Users } from 'lucide-react';
import { commandItemTotal, formatBRL, localDayOfISO, todayISO } from '@silvia/core';
import { repos } from '../lib/repos';
import { useCollection, useLookups } from '../lib/hooks';
import { PageHeader } from '../components/PageHeader';
import { Tabs } from '../components/Tabs';

interface Row {
  id: string;
  cells: React.ReactNode[];
}

function ReportTable({ headers, rows }: { headers: string[]; rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-paper/70">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-500 ${i > 0 ? 'text-right' : ''}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-ink-300">
                Sem dados para o período.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b border-ink-100/70 last:border-0">
                {row.cells.map((cell, i) => (
                  <td key={i} className={`px-4 py-3 text-ink-700 ${i > 0 ? 'text-right' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const REPORTS: { key: string; label: string; icon: LucideIcon; description: string }[] = [
  { key: 'produtividade', label: 'Produtividade', icon: BarChart3, description: 'Atendimentos finalizados por profissional' },
  { key: 'comissoes', label: 'Comissões e rateios', icon: Percent, description: 'Comissão sobre comandas pagas' },
  { key: 'servicos', label: 'Serviços mais vendidos', icon: Sparkles, description: 'Ranking por faturamento' },
  { key: 'produtos', label: 'Produtos', icon: Package, description: 'Vendas e giro de produtos' },
  { key: 'financeiro', label: 'Fluxo financeiro', icon: CircleDollarSign, description: 'Entradas x saídas por categoria' },
  { key: 'maladireta', label: 'Mala direta', icon: Users, description: 'Contatos ativos para campanhas' },
];

export function RelatoriosPage() {
  const [report, setReport] = useState('produtividade');
  /** Mês selecionado (YYYY-MM); vazio = todo o período. */
  const [month, setMonth] = useState('');
  const appointments = useCollection(repos.appointments);
  const commands = useCollection(repos.commands);
  const clients = useCollection(repos.clients);
  const financial = useCollection(repos.financialAccounts);
  const lookups = useLookups();

  const inMonth = (dateISO?: string) => !month || (dateISO ?? '').startsWith(month);

  const paidItems = useMemo(
    () =>
      commands.items
        .filter((c) => c.status === 'paga' && (!month || localDayOfISO(c.closedAt).startsWith(month)))
        .flatMap((c) => c.items),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commands.items, month],
  );

  const produtividade = useMemo(() => {
    const map = new Map<string, { count: number; minutes: number }>();
    for (const a of appointments.items.filter((x) => x.status === 'finalizado' && inMonth(x.date))) {
      const cur = map.get(a.professionalId) ?? { count: 0, minutes: 0 };
      map.set(a.professionalId, { count: cur.count + 1, minutes: cur.minutes + a.durationMinutes });
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments.items, month]);

  const comissoes = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of paidItems) {
      if (!item.professionalId) continue;
      const professional = lookups.professionals.get(item.professionalId);
      const service = item.kind === 'servico' ? lookups.services.get(item.refId) : undefined;
      const product = item.kind === 'produto' ? lookups.products.get(item.refId) : undefined;
      const percent = service?.commissionPercent ?? product?.saleCommissionPercent ?? professional?.commissionPercent ?? 0;
      const value = (commandItemTotal(item) * percent) / 100;
      map.set(item.professionalId, (map.get(item.professionalId) ?? 0) + value);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [paidItems, lookups]);

  const servicosRank = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const item of paidItems.filter((i) => i.kind === 'servico')) {
      const cur = map.get(item.refId) ?? { count: 0, total: 0 };
      map.set(item.refId, { count: cur.count + item.quantity, total: cur.total + commandItemTotal(item) });
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [paidItems]);

  const produtosRank = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const item of paidItems.filter((i) => i.kind === 'produto')) {
      const cur = map.get(item.refId) ?? { count: 0, total: 0 };
      map.set(item.refId, { count: cur.count + item.quantity, total: cur.total + commandItemTotal(item) });
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [paidItems]);

  const categorias = useMemo(() => {
    const map = new Map<string, { in: number; out: number }>();
    for (const a of financial.items.filter((x) => x.status !== 'cancelado' && inMonth(x.dueDate))) {
      const key = a.category ?? 'Sem categoria';
      const cur = map.get(key) ?? { in: 0, out: 0 };
      if (a.kind === 'receber') cur.in += a.amount;
      else cur.out += a.amount;
      map.set(key, cur);
    }
    return [...map.entries()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financial.items, month]);

  // Últimos 12 meses para o filtro de período (select — o input type="month"
  // nativo trava a janela no WebKitGTK/Tauri).
  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, []);

  const active = REPORTS.find((r) => r.key === report) ?? REPORTS[0];

  return (
    <div>
      <PageHeader title="Relatórios" description={`Gerado em ${todayISO().split('-').reverse().join('/')} a partir dos dados locais.`}>
        <label className="flex items-center gap-2 text-sm text-ink-500">
          Período
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-ink-100 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-300 focus:outline-none"
          >
            <option value="">Todo o período</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </PageHeader>
      <div className="mb-5">
        <Tabs tabs={REPORTS.map((r) => ({ key: r.key, label: r.label }))} active={report} onChange={setReport} />
      </div>
      <p className="mb-4 flex items-center gap-2 text-sm text-ink-500">
        <active.icon className="size-4 text-brand-500" />
        {active.description}
      </p>

      {report === 'produtividade' ? (
        <ReportTable
          headers={['Profissional', 'Atendimentos finalizados', 'Horas trabalhadas']}
          rows={produtividade.map(([id, v]) => ({
            id,
            cells: [lookups.professionalName(id), v.count, `${(v.minutes / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`],
          }))}
        />
      ) : null}

      {report === 'comissoes' ? (
        <ReportTable
          headers={['Profissional', 'Comissão sobre comandas pagas']}
          rows={comissoes.map(([id, v]) => ({ id, cells: [lookups.professionalName(id), formatBRL(v)] }))}
        />
      ) : null}

      {report === 'servicos' ? (
        <ReportTable
          headers={['Serviço', 'Quantidade', 'Faturamento']}
          rows={servicosRank.map(([id, v]) => ({ id, cells: [lookups.serviceName(id), v.count, formatBRL(v.total)] }))}
        />
      ) : null}

      {report === 'produtos' ? (
        <ReportTable
          headers={['Produto', 'Unidades vendidas', 'Faturamento', 'Estoque atual']}
          rows={produtosRank.map(([id, v]) => ({
            id,
            cells: [lookups.productName(id), v.count, formatBRL(v.total), lookups.products.get(id)?.stock ?? '—'],
          }))}
        />
      ) : null}

      {report === 'financeiro' ? (
        <ReportTable
          headers={['Categoria', 'Entradas', 'Saídas', 'Resultado']}
          rows={categorias.map(([cat, v]) => ({
            id: cat,
            cells: [
              cat,
              <span key="in" className="text-emerald-600">{formatBRL(v.in)}</span>,
              <span key="out" className="text-rose-600">{formatBRL(v.out)}</span>,
              <span key="res" className={`font-semibold ${v.in - v.out >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatBRL(v.in - v.out)}
              </span>,
            ],
          }))}
        />
      ) : null}

      {report === 'maladireta' ? (
        <ReportTable
          headers={['Cliente', 'WhatsApp', 'E-mail', 'Cidade']}
          rows={clients.items
            .filter((c) => c.active)
            .map((c) => ({
              id: c.id,
              cells: [c.name, c.whatsapp ?? c.phone ?? '—', c.email ?? '—', c.city ?? '—'],
            }))}
        />
      ) : null}
    </div>
  );
}
