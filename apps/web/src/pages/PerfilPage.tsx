import { useEffect, useState } from 'react';
import { Button, Card, Input, Spinner, TextField } from '@heroui/react';
import { PageHeader } from '../components/PageHeader';
import { useSession } from '../lib/auth';
import { api } from '../lib/api';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

const PLAN_START = new Date('2026-06-13T00:00:00-03:00');
const PLAN_PRICE = 199;
const PLAN_DISCOUNT = 1;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function generateInvoices(): { period: string; due: string; amount: number; status: string }[] {
  const now = new Date();
  const invoices: { period: string; due: string; amount: number; status: string }[] = [];
  let cursor = new Date(PLAN_START);

  while (cursor <= now || invoices.length < 3) {
    const end = addMonths(cursor, 1);
    const dueDate = new Date(cursor);
    dueDate.setDate(dueDate.getDate() + 5);

    const isPast = dueDate < now;
    const isCurrent = cursor <= now && end > now;

    invoices.push({
      period: `${formatDate(cursor)} - ${formatDate(end)}`,
      due: formatDate(dueDate),
      amount: PLAN_PRICE * (1 - PLAN_DISCOUNT),
      status: isPast && !isCurrent ? 'cortesia' : isCurrent ? 'cortesia' : 'futuro',
    });

    cursor = end;
    if (invoices.length >= 12) break;
  }

  return invoices;
}

export function PerfilPage() {
  const { data: session } = useSession();
  const user = session?.user;

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.patch('/auth/update-user', { name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const invoices = generateInvoices();

  return (
    <div>
      <PageHeader title="Meu Perfil" subtitle="Seus dados pessoais e plano" />

      <div className="flex flex-col gap-5">
        {/* Dados pessoais */}
        <Card className={CARD}>
          <Card.Header className="p-5 pb-0">
            <Card.Title>Dados pessoais</Card.Title>
          </Card.Header>
          <Card.Content className="p-5">
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Nome</label>
                  <TextField value={name} onChange={setName} aria-label="Nome">
                    <Input placeholder="Seu nome" />
                  </TextField>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">E-mail</label>
                  <TextField value={user?.email ?? ''} isReadOnly aria-label="E-mail">
                    <Input />
                  </TextField>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" isDisabled={saving || !name.trim()}>
                  {saving ? <><Spinner size="sm" /> Salvando…</> : 'Salvar'}
                </Button>
                {saved && <span className="text-sm font-medium text-emerald-600">Salvo!</span>}
              </div>
            </form>
          </Card.Content>
        </Card>

        {/* Plano */}
        <Card className={CARD}>
          <Card.Header className="p-5 pb-0">
            <Card.Title>Plano</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-4 rounded-xl bg-[#f2b33d]/10 px-4 py-3">
              <div className="flex-1">
                <div className="text-sm font-semibold text-[#111111]">Plano Pro</div>
                <div className="text-xs text-[#6f6a63]">
                  Ativo desde {formatDate(PLAN_START)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-[#111111]">
                  <span className="text-sm font-normal text-[#6f6a63] line-through">{formatMoney(PLAN_PRICE)}</span>{' '}
                  {formatMoney(0)}
                </div>
                <div className="text-xs font-medium text-emerald-600">Cortesia aplicada</div>
              </div>
            </div>

            <div className="text-xs font-medium text-muted">Faturamento mensal</div>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-soft-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-soft-border)] bg-[#faf6ec]">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6f6a63]">Período</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-[#6f6a63]">Vencimento</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6f6a63]">Valor</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-[#6f6a63]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={i} className="border-b border-[var(--color-soft-border)] last:border-0">
                      <td className="px-4 py-2.5 text-[#111111]">{inv.period}</td>
                      <td className="px-4 py-2.5 text-[#6f6a63]">{inv.due}</td>
                      <td className="px-4 py-2.5 text-right">
                        {inv.amount > 0 ? (
                          <span className="font-medium text-[#111111]">{formatMoney(inv.amount)}</span>
                        ) : (
                          <span className="font-medium text-emerald-600">{formatMoney(0)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {inv.status === 'cortesia' && (
                          <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                            Cortesia
                          </span>
                        )}
                        {inv.status === 'futuro' && (
                          <span className="inline-block rounded-full bg-[#f7f3ea] px-2.5 py-0.5 text-xs font-semibold text-[#6f6a63]">
                            Futuro
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-[#6f6a63]">
              O valor padrão do plano é {formatMoney(PLAN_PRICE)}/mês. Atualmente você possui um desconto de cortesia de 100% aplicado.
            </p>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
