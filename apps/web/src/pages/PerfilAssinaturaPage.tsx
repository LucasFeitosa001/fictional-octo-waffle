// TODO(backend): billing_subscription — buscar plano atual do tenant (nome,
// preço, ciclo, próximo vencimento), forma de pagamento vigente e histórico
// de faturas em GET /billing/subscription e GET /billing/invoices. Integrar
// troca de plano/forma de pagamento (bump/downgrade + prorata) e cancelamento
// via POST /billing/subscription/cancel.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Chip } from '@heroui/react';
import { PageHeader } from '../components/PageHeader';
import { MobileBackHeader } from '../components/MobileBackHeader';
import { AppTabs } from '../components/AppTabs';
import {
  IconCheck,
  IconCreditCard,
  IconDownload,
  IconEye,
  IconSparkles,
  IconStar,
  IconX,
} from '../components/icons';
import { useFeatures } from '../lib/queries/features';
import { usePlans, type Plan, type PlanName } from '../lib/queries/plans';

// ---------------------------------------------------------------------------
// Style tokens
// ---------------------------------------------------------------------------

const CARD =
  'rounded-2xl border border-[var(--color-soft-border)] bg-warm-white p-4 shadow-[var(--shadow-card)] sm:p-5';

/** The plan we nudge users toward (visually highlighted / "Recomendado"). */
const RECOMMENDED_PLAN: PlanName = 'pro';

// ---------------------------------------------------------------------------
// Mock data — remover ao plugar billing real. Faturas/pagamento seguem mock
// enquanto GET /billing/* não existe; o foco desta tela é plano + comparação.
// ---------------------------------------------------------------------------

const BILLING = {
  price: 199.0,
  addons: 0,
  discount: 0,
  total: 199.0,
  nextDue: '19 ago, 2026',
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
    plan: 'Pro',
    period: 'Mensal',
    amount: 199.0,
    method: 'Boleto',
    status: 'Pendente',
    boletoUrl: '#',
  },
  {
    createdAt: '05/06/2026',
    dueAt: '12/06/2026',
    paidAt: '06/06/2026',
    plan: 'Pro',
    period: 'Mensal',
    amount: 199.0,
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
const MAIN_TABS: { id: MainTab; label: string; icon: React.ReactNode; to?: string }[] = [
  { id: 'assinatura', label: 'Assinatura', icon: <IconCreditCard size={16} /> },
  { id: 'adicionais', label: 'Adicionais', icon: <IconSparkles size={16} />, to: '/perfil/adicionais' },
];

// ---------------------------------------------------------------------------
// Plano atual (destacado) — lê o plano vigente da empresa via GET /feature-flags
// ---------------------------------------------------------------------------

function CurrentPlanBanner({
  planLabel,
  status,
  tagline,
}: {
  planLabel: string;
  status: string | null;
  tagline?: string;
}) {
  const statusLabel =
    status === 'active'
      ? 'Assinatura ativa'
      : status === 'trialing'
      ? 'Período de teste'
      : status === 'past_due'
      ? 'Pagamento pendente'
      : status === 'canceled'
      ? 'Cancelada'
      : 'Sem assinatura';
  const statusColor: 'success' | 'warning' | 'danger' | 'default' =
    status === 'active'
      ? 'success'
      : status === 'trialing'
      ? 'warning'
      : status === 'past_due' || status === 'canceled'
      ? 'danger'
      : 'default';

  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-warm-white p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
            Seu plano
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground">
              {planLabel}
            </span>
          </div>
          {tagline ? (
            <p className="mt-1 max-w-md text-sm leading-snug text-muted-ink">
              {tagline}
            </p>
          ) : null}
        </div>
        <Chip variant="soft" color={statusColor} size="sm" className="shrink-0">
          {statusLabel}
        </Chip>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card de plano (comparação lado a lado)
// ---------------------------------------------------------------------------

function PlanCard({
  plan,
  isCurrent,
  isRecommended,
  onChoose,
}: {
  plan: Plan;
  isCurrent: boolean;
  isRecommended: boolean;
  onChoose: (plan: Plan) => void;
}) {
  return (
    <div
      className={[
        'relative flex flex-col rounded-2xl border bg-warm-white p-5 shadow-[var(--shadow-card)]',
        isCurrent
          ? 'border-primary ring-2 ring-primary/30'
          : isRecommended
          ? 'border-gold/60 ring-1 ring-gold/40'
          : 'border-[var(--color-soft-border)]',
      ].join(' ')}
    >
      {/* Badge topo direito */}
      {isCurrent ? (
        <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm">
          Seu plano
        </span>
      ) : isRecommended ? (
        <span className="absolute -top-2.5 right-4 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink shadow-sm">
          <IconStar size={11} /> Recomendado
        </span>
      ) : null}

      <div className="text-lg font-extrabold text-foreground">{plan.label}</div>
      <p className="mt-1 min-h-[2.5rem] text-sm leading-snug text-muted-ink">
        {plan.tagline}
      </p>

      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-2xl font-extrabold text-ink tabular-nums">
          {formatMoney(plan.priceMonthly)}
        </span>
        <span className="text-sm text-muted-ink">/mês</span>
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2">
        {plan.features.map((f) => (
          <li key={f.key} className="flex items-start gap-2">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <IconCheck size={11} />
            </span>
            <span className="text-sm leading-snug text-foreground">
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5">
        {isCurrent ? (
          <Button variant="outline" className="w-full" isDisabled>
            Plano atual
          </Button>
        ) : (
          <Button
            variant={isRecommended ? 'primary' : 'outline'}
            className="w-full"
            onPress={() => onChoose(plan)}
          >
            Escolher {plan.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub components (resumo/pagamentos)
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
  const { data: features } = useFeatures();
  const { data: plans } = usePlans();
  const [notice, setNotice] = useState<string | null>(null);

  function handleTab(t: MainTab) {
    if (t === 'assinatura') return;
    const target = MAIN_TABS.find((x) => x.id === t)?.to;
    if (target) navigate(target);
  }

  const currentPlanName = (features?.plan ?? null) as PlanName | null;
  const currentPlan = plans?.find((p) => p.name === currentPlanName) ?? null;
  const currentPlanLabel = currentPlan?.label ?? 'Sem plano';

  function handleChoose(plan: Plan) {
    // TODO(backend): iniciar troca de plano (POST /billing/subscription).
    setNotice(
      `Contratação do plano ${plan.label} estará disponível em breve. ` +
        `Fale com nosso time para ativar agora.`,
    );
  }

  function handleMobileBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/configuracoes');
  }

  return (
    <div className="pb-24">
      <MobileBackHeader title="Minha assinatura" onBack={handleMobileBack} />
      <PageHeader title="Minha conta" subtitle="Assinatura, plano e cobrança" />

      <AppTabs
        items={MAIN_TABS}
        selectedKey="assinatura"
        onSelectionChange={handleTab}
        ariaLabel="Minha assinatura"
        className="mb-4"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Plano atual (destacado)                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-5">
        <CurrentPlanBanner
          planLabel={currentPlanLabel}
          status={features?.status ?? null}
          tagline={currentPlan?.tagline}
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Comparação de planos                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-6">
        <div className="mb-3">
          <h2 className="text-base font-bold text-foreground">
            Escolha o plano ideal
          </h2>
          <p className="mt-0.5 text-sm text-muted-ink">
            Compare o que cada plano oferece. Cada nível inclui tudo do anterior.
          </p>
        </div>

        {notice ? (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3">
            <p className="text-sm text-ink">{notice}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Fechar aviso"
              className="shrink-0 text-muted-ink hover:text-foreground"
            >
              <IconX size={16} />
            </button>
          </div>
        ) : null}

        {plans && plans.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.name}
                plan={plan}
                isCurrent={plan.name === currentPlanName}
                isRecommended={
                  plan.name === RECOMMENDED_PLAN && plan.name !== currentPlanName
                }
                onChoose={handleChoose}
              />
            ))}
          </div>
        ) : (
          <div className={CARD + ' text-sm text-muted-ink'}>
            Carregando planos…
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Resumo do plano (billing — mock enquanto GET /billing não existe)  */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-4">
        <div className={CARD}>
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-ink">
            Resumo da cobrança
          </div>
          <div className="flex flex-col gap-2.5">
            <SummaryRow label="Plano" value={formatMoney(BILLING.price)} />
            <SummaryRow label="Adicionais" value={formatMoney(BILLING.addons)} />
            <SummaryRow
              label="Descontos"
              value={`- ${formatMoney(BILLING.discount)}`}
              variant="discount"
            />
            <div className="my-1 h-px bg-[var(--color-soft-border)]" />
            <SummaryRow
              label="Total"
              value={formatMoney(BILLING.total)}
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
                {BILLING.nextDue}
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
                {BILLING.paymentMethod}
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
