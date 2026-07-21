// TODO(backend): billing_subscription — buscar plano atual do tenant (nome,
// preço, ciclo, próximo vencimento), forma de pagamento vigente e histórico
// de faturas em GET /billing/subscription e GET /billing/invoices. Integrar
// troca de plano/forma de pagamento (bump/downgrade + prorata) e cancelamento
// via POST /billing/subscription/cancel.

import { useNavigate } from 'react-router-dom';
import { Button, Chip } from '@heroui/react';
import { PageHeader } from '../components/PageHeader';
import { IconDownload, IconEye } from '../components/icons';

// ---------------------------------------------------------------------------
// Style tokens
// ---------------------------------------------------------------------------

const CARD =
  'rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-4 shadow-[var(--shadow-card)] sm:p-5';

// ---------------------------------------------------------------------------
// Mock data — remover ao plugar backend
// ---------------------------------------------------------------------------

const PLAN = {
  name: 'Até 5 usuários - Anual',
  seats: 'Até 5 usuários',
  price: 2124.0,
  addons: 0,
  discount: 424.8,
  total: 1699.2,
  nextDue: '19 jul, 2026',
  paymentMethod: 'Boleto' as const,
};

type InvoiceStatus = 'Pago' | 'Pendente';
interface Invoice {
  createdAt: string;
  dueAt: string;
  paidAt?: string;
  plan: string;
  period: string;
  amount: number;
  method: 'Boleto' | 'Cartão';
  status: InvoiceStatus;
  invoiceUrl?: string;
  boletoUrl?: string;
}

const INVOICES: Invoice[] = [
  {
    createdAt: '05/07/2026',
    dueAt: '12/07/2026',
    plan: 'Até 5 usuários',
    period: 'Anual',
    amount: 1699.2,
    method: 'Boleto',
    status: 'Pendente',
    boletoUrl: '#',
  },
  {
    createdAt: '05/07/2024',
    dueAt: '12/07/2024',
    paidAt: '05/07/2024',
    plan: 'Até 5 usuários',
    period: 'Bianual',
    amount: 1884.0,
    method: 'Cartão',
    status: 'Pago',
    invoiceUrl: '#',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const isPaid = status === 'Pago';
  return (
    <Chip
      variant="soft"
      color={isPaid ? 'success' : 'warning'}
      size="sm"
      className="shrink-0"
    >
      {status}
    </Chip>
  );
}

// ---------------------------------------------------------------------------
// Tabs header (mesmo padrão de AssinaturasPage/tabs horizontais Belasis)
// ---------------------------------------------------------------------------

type MainTab = 'assinatura' | 'adicionais';
const MAIN_TABS: { id: MainTab; label: string; to?: string }[] = [
  { id: 'assinatura', label: 'Assinatura' },
  { id: 'adicionais', label: 'Adicionais', to: '/perfil/adicionais' },
];

function TabBar({
  tab,
  onTab,
}: {
  tab: MainTab;
  onTab: (t: MainTab) => void;
}) {
  return (
    <div className="mb-4 -mx-1 overflow-x-auto px-1">
      <div className="inline-flex min-w-max gap-1 border-b border-[var(--color-soft-border)]">
        {MAIN_TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={[
                'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'text-primary after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary'
                  : 'text-muted-ink hover:text-foreground',
              ].join(' ')}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub components
// ---------------------------------------------------------------------------

function SummaryRow({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: 'default' | 'discount' | 'total';
}) {
  const valueClass =
    variant === 'total'
      ? 'text-base font-bold text-ink tabular-nums'
      : variant === 'discount'
      ? 'text-sm font-medium text-emerald-600 tabular-nums'
      : 'text-sm font-medium text-ink tabular-nums';
  const labelClass =
    variant === 'total'
      ? 'text-sm font-semibold text-foreground'
      : 'text-sm text-muted-ink';
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={labelClass}>{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

function PaymentActionCell({ inv }: { inv: Invoice }) {
  if (inv.method === 'Boleto' && inv.status === 'Pendente') {
    return (
      <Button
        variant="outline"
        size="sm"
        onPress={() => {
          // TODO(backend): abrir boleto (GET /billing/invoices/:id/boleto)
        }}
      >
        Visualizar boleto
      </Button>
    );
  }
  return <span className="text-sm text-foreground">{inv.method}</span>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function PerfilAssinaturaPage() {
  const navigate = useNavigate();

  function handleTab(t: MainTab) {
    if (t === 'assinatura') return;
    const target = MAIN_TABS.find((x) => x.id === t)?.to;
    if (target) navigate(target);
  }

  return (
    <div className="pb-24">
      <PageHeader title="Minha conta" subtitle="Assinatura, plano e cobrança" />

      <TabBar tab="assinatura" onTab={handleTab} />

      {/* ------------------------------------------------------------------ */}
      {/* Plano atual                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-4">
        <div className={CARD}>
          <div className="text-sm font-semibold uppercase tracking-wide text-muted-ink">
            Plano atual
          </div>
          <div className="mt-2 text-lg font-bold text-foreground">{PLAN.name}</div>
          <div className="mt-1 text-sm text-muted-ink">{PLAN.seats}</div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Resumo do plano                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-4">
        <div className={CARD}>
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-ink">
            Resumo do plano
          </div>
          <div className="flex flex-col gap-2.5">
            <SummaryRow label="Plano" value={formatMoney(PLAN.price)} />
            <SummaryRow label="Adicionais" value={formatMoney(PLAN.addons)} />
            <SummaryRow
              label="Descontos"
              value={`- ${formatMoney(PLAN.discount)}`}
              variant="discount"
            />
            <div className="my-1 h-px bg-[var(--color-soft-border)]" />
            <SummaryRow
              label="Total"
              value={formatMoney(PLAN.total)}
              variant="total"
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Próxima renovação                                                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-4">
        <div className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold uppercase tracking-wide text-muted-ink">
                Próxima renovação
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {PLAN.nextDue}
              </div>
            </div>
            <Chip variant="soft" color="success" size="sm" className="shrink-0">
              Assinatura Ativa
            </Chip>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Forma de pagamento                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-4">
        <div className={CARD}>
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-ink">
            Forma de pagamento
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-bold text-foreground">
                {PLAN.paymentMethod}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                // TODO(backend): abrir modal de troca de forma de pagamento
              }}
            >
              Alterar
            </Button>
          </div>
          <div className="mt-3 flex flex-col gap-1 text-xs text-muted-ink">
            <div>*Boleto: até 3 dias úteis para a aprovação</div>
            <div>*Cartão: aprovação instantânea</div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Últimos pagamentos                                                 */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-6">
        <div className="mb-2 text-sm font-semibold text-foreground">
          Últimos pagamentos
        </div>

        {/* Desktop: tabela */}
        <div
          className={
            CARD + ' hidden overflow-hidden !p-0 shadow-none sm:block'
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream/60 text-left text-xs uppercase tracking-wide text-muted-ink">
                <tr>
                  <th className="px-4 py-2 font-medium">Criado em</th>
                  <th className="px-4 py-2 font-medium">Vencimento</th>
                  <th className="px-4 py-2 font-medium">Pagamento</th>
                  <th className="px-4 py-2 font-medium">Plano</th>
                  <th className="px-4 py-2 font-medium">Período</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">Forma de pagamento</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">NF-e</th>
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv, i) => (
                  <tr
                    key={i}
                    className="border-t border-[var(--color-soft-border)] text-foreground"
                  >
                    <td className="px-4 py-3 tabular-nums">{inv.createdAt}</td>
                    <td className="px-4 py-3 tabular-nums">{inv.dueAt}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-ink">
                      {inv.paidAt ?? '—'}
                    </td>
                    <td className="px-4 py-3">{inv.plan}</td>
                    <td className="px-4 py-3">{inv.period}</td>
                    <td className="px-4 py-3 font-medium text-ink tabular-nums">
                      {formatMoney(inv.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentActionCell inv={inv} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={inv.status} />
                    </td>
                    <td className="px-4 py-3">
                      {inv.invoiceUrl ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Baixar NF-e"
                          onPress={() => {
                            // TODO(backend): download NF-e
                          }}
                        >
                          <IconDownload size={16} />
                        </Button>
                      ) : (
                        <span className="text-muted-ink">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: lista sem card creme wrapper */}
        <ul className="flex flex-col divide-y divide-[var(--color-soft-border)] border-y border-[var(--color-soft-border)] sm:hidden">
          {INVOICES.map((inv, i) => (
            <li
              key={i}
              className="flex flex-col gap-2 bg-warm-white py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    {inv.createdAt}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-ink">
                    {inv.plan} · {inv.period}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-sm font-bold text-ink tabular-nums">
                    {formatMoney(inv.amount)}
                  </div>
                  <StatusPill status={inv.status} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-ink">
                  Venc.{' '}
                  <span className="tabular-nums text-foreground">
                    {inv.dueAt}
                  </span>
                </div>
                {inv.method === 'Boleto' && inv.status === 'Pendente' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      // TODO(backend): abrir boleto
                    }}
                  >
                    <IconEye size={14} /> Boleto
                  </Button>
                ) : inv.invoiceUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => {
                      // TODO(backend): download NF-e
                    }}
                  >
                    <IconDownload size={14} /> NF-e
                  </Button>
                ) : (
                  <span className="text-xs text-muted-ink">{inv.method}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Cancelar assinatura                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-4">
        <div className={CARD}>
          <div className="text-base font-bold text-foreground">
            Precisa cancelar sua assinatura?
          </div>
          <p className="mt-2 text-sm leading-snug text-muted-ink">
            Sabemos que, às vezes, as circunstâncias podem mudar. Mas antes de
            partir, você já tentou consultar a nossa Base de Conhecimento para
            perguntas frequentes?
          </p>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button
              variant="ghost"
              className="!text-rose-600 hover:!bg-rose-50"
              onPress={() => {
                // TODO(backend): iniciar fluxo de cancelamento
              }}
            >
              Cancelar assinatura
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                // TODO(backend): abrir base de conhecimento (link externo)
              }}
            >
              Base de conhecimento
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
