import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Cake,
  CalendarDays,
  CircleDollarSign,
  Package,
  ReceiptText,
  Scissors,
  Users,
  Wallet,
} from 'lucide-react';
import {
  appointmentStatusLabels,
  commandTotal,
  formatBRL,
  formatDate,
  localDayOfISO,
  monthOfISO,
  todayISO,
} from '@silvia/core';
import { repos } from '../lib/repos';
import { useCollection, useLookups } from '../lib/hooks';
import { StatCard } from '../components/StatCard';
import { StatusBadge, appointmentStatusTones } from '../components/StatusBadge';
import { EmptyState } from '../components/EmptyState';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-500">{title}</h3>
      {children}
    </section>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const appointments = useCollection(repos.appointments);
  const clients = useCollection(repos.clients);
  const professionals = useCollection(repos.professionals);
  const commands = useCollection(repos.commands);
  const products = useCollection(repos.products);
  const financial = useCollection(repos.financialAccounts);
  const lookups = useLookups();

  const hoje = todayISO();
  const mesAtual = Number(hoje.split('-')[1]);

  const todayAppointments = appointments.items
    .filter((a) => a.date === hoje && a.status !== 'cancelado')
    .sort((a, b) => a.time.localeCompare(b.time));
  const openCommands = commands.items.filter((c) => c.status === 'aberta');
  const paidTodayTotal = commands.items
    .filter((c) => c.status === 'paga' && localDayOfISO(c.closedAt) === hoje)
    .reduce((sum, c) => sum + commandTotal(c), 0);
  const lowStock = products.items.filter((p) => p.trackStock && p.active && p.stock <= p.reorderLevel);
  const dueSoon = financial.items.filter(
    (f) => f.kind === 'pagar' && (f.status === 'aberto' || f.status === 'vencido'),
  );
  const birthdays = clients.items.filter((c) => c.active && monthOfISO(c.birthDate) === mesAtual);
  const overdue = financial.items.filter((f) => f.status === 'vencido');

  const totalReceber = financial.items
    .filter((f) => f.kind === 'receber' && f.status !== 'pago' && f.status !== 'cancelado')
    .reduce((s, f) => s + f.amount, 0);
  const totalPagar = dueSoon.reduce((s, f) => s + f.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard icon={CalendarDays} label="Agendamentos de hoje" value={todayAppointments.length} tone="brand" onClick={() => navigate('/agenda')} />
        <StatCard icon={Users} label="Clientes cadastrados" value={clients.items.filter((c) => c.active).length} tone="accent" onClick={() => navigate('/clientes')} />
        <StatCard icon={Scissors} label="Profissionais ativos" value={professionals.items.filter((p) => p.active).length} tone="gold" onClick={() => navigate('/profissionais')} />
        <StatCard icon={CircleDollarSign} label="Faturamento do dia" value={formatBRL(paidTodayTotal)} tone="success" onClick={() => navigate('/caixa')} />
        <StatCard icon={ReceiptText} label="Comandas abertas" value={openCommands.length} tone="warning" onClick={() => navigate('/caixa')} />
        <StatCard icon={Package} label="Estoque baixo" value={lowStock.length} tone="danger" hint="produtos no nível de reposição" onClick={() => navigate('/estoque')} />
        <StatCard icon={Wallet} label="Contas a pagar em aberto" value={formatBRL(totalPagar)} tone="info" onClick={() => navigate('/financeiro')} />
        <StatCard icon={Cake} label="Aniversariantes do mês" value={birthdays.length} tone="brand" onClick={() => navigate('/consultas')} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Próximos atendimentos de hoje">
          {todayAppointments.length === 0 ? (
            <EmptyState title="Sem atendimentos hoje" description="A agenda de hoje está livre." />
          ) : (
            <ul className="divide-y divide-ink-100/70">
              {todayAppointments.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center gap-4 py-3">
                  <span className="w-14 shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-center text-sm font-semibold text-brand-700">
                    {a.time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-900">{lookups.clientName(a.clientId)}</p>
                    <p className="truncate text-sm text-ink-500">
                      {lookups.serviceName(a.serviceId)} · {lookups.professionalName(a.professionalId)}
                    </p>
                  </div>
                  <StatusBadge tone={appointmentStatusTones[a.status]}>{appointmentStatusLabels[a.status]}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Comandas abertas">
          {openCommands.length === 0 ? (
            <EmptyState title="Nenhuma comanda aberta" description="Abra uma comanda no Caixa." />
          ) : (
            <ul className="divide-y divide-ink-100/70">
              {openCommands.map((c) => (
                <li key={c.id} className="flex items-center gap-4 py-3">
                  <span className="w-14 shrink-0 rounded-lg bg-accent-50 px-2 py-1 text-center text-sm font-semibold text-accent-700">
                    #{c.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink-900">{lookups.clientName(c.clientId)}</p>
                    <p className="text-sm text-ink-500">{c.items.length} item(ns)</p>
                  </div>
                  <span className="font-semibold text-ink-900">{formatBRL(commandTotal(c))}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Alertas do sistema">
          <ul className="space-y-3">
            {overdue.map((f) => (
              <li key={f.id} className="flex items-start gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Conta vencida: <strong>{f.description}</strong> ({formatBRL(f.amount)}) — venceu em {formatDate(f.dueDate)}.
                </span>
              </li>
            ))}
            {lowStock.slice(0, 4).map((p) => (
              <li key={p.id} className="flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <Package className="mt-0.5 size-4 shrink-0" />
                <span>
                  Estoque crítico: <strong>{p.name}</strong> — {p.stock} un (reposição em {p.reorderLevel}).
                </span>
              </li>
            ))}
            {overdue.length === 0 && lowStock.length === 0 ? (
              <li className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Tudo em dia — sem alertas no momento.</li>
            ) : null}
          </ul>
        </Section>

        <Section title="Resumo financeiro">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-sm text-emerald-700">A receber (aberto)</p>
              <p className="mt-1 text-xl font-semibold text-emerald-800">{formatBRL(totalReceber)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <p className="text-sm text-rose-700">A pagar (aberto)</p>
              <p className="mt-1 text-xl font-semibold text-rose-800">{formatBRL(totalPagar)}</p>
            </div>
            <div className="col-span-2 rounded-xl bg-paper p-4">
              <p className="text-sm text-ink-500">Saldo projetado</p>
              <p className={`mt-1 text-xl font-semibold ${totalReceber - totalPagar >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatBRL(totalReceber - totalPagar)}
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
