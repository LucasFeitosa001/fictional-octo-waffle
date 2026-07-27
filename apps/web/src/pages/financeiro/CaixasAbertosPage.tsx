import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, ListBox, Select } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { Drawer } from '../../components/Drawer';
import { AppTabs } from '../../components/AppTabs';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { IconCash, IconRefresh, IconPlus } from '../../components/icons';
import {
  useOpenedCashRegisters,
  useOpenCashRegister,
  useCloseCashRegister,
  useCashMovement,
  type CashRegisterDetail,
} from '../../lib/queries/caixa';
import {
  useCreateTransfer,
  useFinancialAccounts,
  usePaymentMethods,
} from '../../lib/queries/financeiro';
import { formatDateTime, formatMoney, isoDate } from '../../lib/format';
import { useSetPageActions } from '../../layout/PageActions';
import { HelpTooltip } from '../../components/HelpTooltip';

// ── Ícones anticon reproduzidos (play-circle, minus) ─────────────────────────
function IconPlayCircle({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="64 64 896 896" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" />
      <path d="M719.4 499.1l-296.1-215A15.9 15.9 0 00398 297v430c0 13.1 14.8 20.5 25.3 12.9l296.1-215a15.9 15.9 0 000-25.8zm-257.6 134V390.9L628.5 512 461.8 633.1z" />
    </svg>
  );
}
function IconMinus({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="64 64 896 896" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M872 474H152c-4.4 0-8 3.6-8 8v60c0 4.4 3.6 8 8 8h720c4.4 0 8-3.6 8-8v-60c0-4.4-3.6-8-8-8z" />
    </svg>
  );
}

type View = 'resumo' | 'detalhado';
type DrawerMode = 'open' | 'sangria' | 'suprimento' | 'close';

// Exportado para consumidores externos (rota /:id, deep-linking).
export function openCashDetail(id: string) {
  // Placeholder — a rota /:id será conectada por outro agente. Deixamos o
  // helper aqui para o consumo já existir no bundle.
  return `/financeiro/caixas-abertos/${id}`;
}

export function CaixasAbertosPage() {
  const opened = useOpenedCashRegisters();
  const rows = opened.data ?? [];

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: View = searchParams.get('tab') === 'detalhado' ? 'detalhado' : 'resumo';
  const [view, setView] = useState<View>(initialTab);

  function changeView(next: View) {
    setView(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'resumo') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true });
  }

  // Total à receber ainda não existe no backend — só mostramos a linha se
  // algum caixa expuser algo > 0 no futuro.
  // TODO(backend): expor "totalAReceber" no summary do caixa.
  const showTotalAReceber = rows.some((r) => ((r.summary as { totalAReceber?: number }).totalAReceber ?? 0) > 0);
  const [drawer, setDrawer] = useState<{ mode: DrawerMode; register?: CashRegisterDetail } | null>(
    null,
  );

  // Mobile: as ações do header vivem na BottomNav (padrão Belasis). Mesmos
  // handlers dos botões desktop — só reutilizados aqui.
  useSetPageActions(
    [
      {
        key: 'atualizar',
        label: 'Atualizar',
        icon: <IconRefresh size={22} className={opened.isFetching ? 'animate-spin' : ''} />,
        onClick: () => {
          void opened.refetch();
        },
        disabled: opened.isFetching,
      },
      {
        key: 'abrir-caixa',
        label: 'Abrir caixa',
        icon: <IconCash size={22} />,
        onClick: () => setDrawer({ mode: 'open' }),
      },
    ],
    [opened.refetch, opened.isFetching],
  );

  return (
    <div>
      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="flex items-center gap-2 text-[1.4rem] font-bold leading-tight text-ink sm:text-2xl">
          Caixas abertos
          <span className="text-muted-ink" title="Ver tutorial">
            <IconPlayCircle size={18} />
          </span>
        </h1>
        <div className="hidden gap-2 lg:flex lg:w-auto">
          <Button variant="outline" onClick={() => opened.refetch()}>
            <IconRefresh size={16} /> Atualizar
          </Button>
          <Button variant="primary" onClick={() => setDrawer({ mode: 'open' })}>
            Abrir caixa
            <HelpTooltip>Iniciar novo caixa com saldo inicial</HelpTooltip>
          </Button>
        </div>
      </div>

      {/* Abas: componente padrão (carrossel no mobile) — ver components/Tabs.tsx */}
      <AppTabs<View>
        className="mb-4"
        ariaLabel="Visualização dos caixas"
        selectedKey={view}
        onSelectionChange={changeView}
        items={[
          { id: 'resumo', label: 'Resumo', icon: <IconCash size={16} /> },
          { id: 'detalhado', label: 'Detalhado', icon: <IconRefresh size={16} /> },
        ]}
      />

      {opened.isLoading ? (
        <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
          <LoadingState />
        </div>
      ) : opened.isError ? (
        <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
          <ErrorState onRetry={() => opened.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-4 shadow-[var(--shadow-card)]">
          <EmptyState
            icon={<IconCash size={32} />}
            title="Nenhum caixa aberto"
            description="Abra um caixa para começar a registrar as movimentações do dia."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((reg) => (
            <CashCard
              key={reg.id}
              reg={reg}
              view={view}
              showTotalAReceber={showTotalAReceber}
              onAction={(mode) => setDrawer({ mode, register: reg })}
            />
          ))}
        </div>
      )}

      {drawer && (
        <CashActionDrawer
          mode={drawer.mode}
          register={drawer.register}
          isOpen
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}


// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="h-[54px] w-[54px] rounded-full object-cover" />;
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span className="grid h-[54px] w-[54px] place-items-center rounded-full bg-gold/20 text-base font-semibold text-gold-strong">
      {initials || '?'}
    </span>
  );
}

// ── Linha valor/label (styled-component `kxgYzN` do Belasis) ─────────────────
function Row({
  label,
  value,
  positive,
  muted,
}: {
  label: string;
  value: string;
  positive?: boolean;
  muted?: boolean;
}) {
  const labelClass = positive
    ? 'font-medium text-success'
    : muted
      ? 'text-muted-ink'
      : 'text-ink';
  const valueClass = positive
    ? 'font-semibold text-success'
    : muted
      ? 'text-muted-ink'
      : 'font-medium text-ink';
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 text-sm">
      <span className={['truncate', labelClass].join(' ')} style={{ maxWidth: '60%' }}>
        {label}
      </span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

// ── Sub-card interno (Conferência de caixa / Outros pagamentos) ──────────────
function InnerCard({
  title,
  help,
  className,
  children,
}: {
  title: string;
  help?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={['flex h-full flex-col rounded-xl border border-line bg-card', className ?? '']
        .join(' ')
        .trim()}
    >
      <div className="inline-flex items-center border-b border-line px-3 py-2.5 text-sm font-semibold text-ink">
        {title}
        {help ? <HelpTooltip>{help}</HelpTooltip> : null}
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  );
}

// ── Card de um caixa aberto ──────────────────────────────────────────────────
function CashCard({
  reg,
  view,
  showTotalAReceber,
  onAction,
}: {
  reg: CashRegisterDetail;
  view: View;
  showTotalAReceber: boolean;
  onAction: (mode: DrawerMode) => void;
}) {
  const s = reg.summary;
  const user = reg.responsibleUser;
  const userName = user?.name ?? 'Sem responsável';
  // TODO(backend): expor "totalAReceber" no summary do caixa.
  const totalAReceber = (s as { totalAReceber?: number }).totalAReceber ?? 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-card)]">
      {/* Cabeçalho do caixa */}
      <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
        <Avatar name={userName} url={user?.avatarUrl ?? user?.image} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink">
            {userName} <span className="font-semibold text-muted-ink">#{reg.number}</span>
          </div>
          {user?.email && <div className="truncate text-xs text-muted-ink">{user.email}</div>}
          <div className="text-xs text-muted-ink">Caixa aberto em {formatDateTime(reg.openedAt)}</div>
        </div>
      </div>

      {/* Corpo */}
      <div className="px-4 py-4">
        {view === 'resumo' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InnerCard
              title="Conferência de caixa"
              help="Saldo esperado no caixa por forma de pagamento"
            >
              <Row label="Saldo inicial" value={formatMoney(s.openingBalance)} />
              {s.byMethod.map((b) => (
                <Row key={b.name} label={b.name} value={formatMoney(b.total)} />
              ))}
              <Row label="Movimentações" value={formatMoney(s.movements)} />
              <Row label="Saldo em caixa" value={formatMoney(s.saldoEmCaixa)} positive />
            </InnerCard>
            <InnerCard
              title="Outros pagamentos"
              help="Recebimentos que não passam pelo caixa físico"
            >
              <Row label="Outros pagamentos" value={formatMoney(s.outros)} />
              <Row label="Total recebido" value={formatMoney(s.totalPago)} muted />
              {showTotalAReceber && (
                <Row label="Total à receber" value={formatMoney(totalAReceber)} muted />
              )}
            </InnerCard>
          </div>
        ) : (
          <DetalhadoBody reg={reg} />
        )}
      </div>

      {/* Ações (ant-card-actions) */}
      <div className="mt-auto flex flex-col gap-3 border-t border-line px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onAction('suprimento')}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-success/60 text-sm font-medium text-success transition-colors hover:bg-success/10"
          >
            <IconPlus size={16} /> Suprimento
            <HelpTooltip>Adicionar valor ao caixa (reforço)</HelpTooltip>
          </button>
          <button
            type="button"
            onClick={() => onAction('sangria')}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-danger/60 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
          >
            <IconMinus size={16} /> Sangria
            <HelpTooltip>Retirar valor do caixa</HelpTooltip>
          </button>
        </div>
        <button
          type="button"
          onClick={() => onAction('close')}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-danger/40 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
        >
          Fechar caixa
          <HelpTooltip>Conferir saldo e encerrar o caixa</HelpTooltip>
        </button>
      </div>
    </div>
  );
}

// ── Corpo detalhado (lançamentos + totais) ───────────────────────────────────
function DetalhadoBody({ reg }: { reg: CashRegisterDetail }) {
  const s = reg.summary;
  const movements = reg.movements ?? [];
  const payments = movements.filter((m) => m.refType !== 'sangria' && m.refType !== 'suprimento');
  const others = movements.filter((m) => m.refType === 'sangria' || m.refType === 'suprimento');
  const lancamentoTotal = payments.reduce(
    (acc, m) => acc + (m.type === 'out' ? -Number(m.amount) : Number(m.amount)),
    0,
  );
  const hasOthers = others.length > 0 || s.suprimentos > 0 || s.sangrias > 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <InnerCard title="Lançamentos">
        <Row label="Saldo inicial" value={formatMoney(s.openingBalance)} />
        <Row label="Movimentações" value={formatMoney(s.movements)} />
        <Row label="Lançamento" value={formatMoney(lancamentoTotal)} />
        {s.byMethod.length > 0 && (
          <div className="mt-1 border-t border-line pt-1.5">
            {s.byMethod.map((b) => (
              <Row key={b.name} label={b.name} value={formatMoney(b.total)} />
            ))}
          </div>
        )}
        {payments.length > 0 && (
          <div className="mt-1 flex flex-col gap-1 border-t border-line pt-1.5">
            {payments.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs text-muted-ink">
                <span className="truncate" style={{ maxWidth: '60%' }}>
                  {m.paymentMethod?.name ?? 'Outros'} · {formatDateTime(m.at)}
                </span>
                <span className={m.type === 'out' ? 'text-danger' : ''}>
                  {m.type === 'out' ? '- ' : ''}
                  {formatMoney(m.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </InnerCard>

      <InnerCard
        title="Outras movimentações"
        className={hasOthers ? '' : 'hidden sm:flex'}
      >
        <Row label="Suprimentos (reforço)" value={formatMoney(s.suprimentos)} />
        <Row label="Sangrias (retirada)" value={formatMoney(s.sangrias)} />
        {others.length > 0 && (
          <div className="mt-1 flex flex-col gap-1 border-t border-line pt-1.5">
            {others.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs text-muted-ink">
                <span className="truncate" style={{ maxWidth: '60%' }}>
                  {m.refType === 'sangria' ? 'Sangria' : 'Suprimento'} · {formatDateTime(m.at)}
                </span>
                <span>{formatMoney(m.amount)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-1 border-t border-line pt-1.5">
          <Row label="Saldo em caixa" value={formatMoney(s.saldoEmCaixa)} positive />
        </div>
      </InnerCard>
    </div>
  );
}

// ===================== Drawer de ações =====================

const TITLES: Record<DrawerMode, string> = {
  open: 'Abrir caixa',
  sangria: 'Sangria (retirada)',
  suprimento: 'Suprimento (reforço)',
  close: 'Fechamento de caixa',
};

function MoneyInput({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-ink">{label}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
        className="rounded-xl border border-line bg-transparent px-3.5 py-3 text-sm text-ink outline-none placeholder:text-muted-ink focus:border-primary"
      />
    </label>
  );
}

function CashActionDrawer({
  mode,
  register,
  isOpen,
  onClose,
}: {
  mode: DrawerMode;
  register?: CashRegisterDetail;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ expected: number; divergence: number } | null>(null);

  const paymentMethods = usePaymentMethods();
  const methodItems = paymentMethods.data ?? [];

  // Fechamento: data editável (costuma ser feito no dia seguinte) e
  // transferência do dinheiro do dia para outra conta.
  const [closeDate, setCloseDate] = useState(() => isoDate(new Date()));
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const accounts = useFinancialAccounts();
  const accountItems = accounts.data ?? [];
  const createTransfer = useCreateTransfer();

  const openCash = useOpenCashRegister();
  const closeCash = useCloseCashRegister();
  const movement = useCashMovement();

  useEffect(() => {
    setAmount('');
    setPaymentMethodId('');
    setError(null);
    setResult(null);
    setCloseDate(isoDate(new Date()));
    setTransferFrom('');
    setTransferTo('');
    setTransferAmount('');
  }, [mode, register?.id]);

  const busy = openCash.isPending || closeCash.isPending || movement.isPending;
  const expected = register?.summary?.saldoEmCaixa ?? 0;

  async function handleConfirm() {
    setError(null);
    const value = Number(amount);
    try {
      if (mode === 'open') {
        await openCash.mutateAsync({ openingBalance: Number.isFinite(value) ? value : 0 });
        onClose();
        return;
      }
      if (!register) return;
      if (mode === 'close') {
        if (!amount || !Number.isFinite(value)) {
          setError('Informe o valor conferido.');
          return;
        }
        const res = await closeCash.mutateAsync({
          id: register.id,
          countedBalance: value,
          // Data escolhida (fechamento feito no dia seguinte). Fecha ao meio-dia
          // local para a data civil não escorregar por fuso.
          ...(closeDate ? { closedAt: new Date(`${closeDate}T12:00:00`).toISOString() } : {}),
        });
        setResult({ expected: res.expectedBalance, divergence: res.divergence });
        // Transferência do dinheiro do dia para outra conta. Roda DEPOIS do
        // fechamento (que é a operação crítica) e reusa o endpoint de
        // transferência já existente. Se falhar, o caixa continua fechado e o
        // erro aparece — dá para lançar a transferência à mão.
        if (transferTo && transferFrom && transferTo !== transferFrom) {
          const valorTransf = transferAmount ? Number(transferAmount) : value;
          if (Number.isFinite(valorTransf) && valorTransf > 0) {
            try {
              await createTransfer.mutateAsync({
                amount: valorTransf,
                fromAccountId: transferFrom,
                toAccountId: transferTo,
                description: `Fechamento do caixa #${register.number}`,
                ...(closeDate ? { date: closeDate } : {}),
              });
            } catch (err) {
              setError(
                err instanceof ApiClientError
                  ? `Caixa fechado, mas a transferência falhou: ${err.message}`
                  : 'Caixa fechado, mas a transferência falhou. Lance-a manualmente em Financeiro.',
              );
            }
          }
        }
        return;
      }
      // sangria / suprimento
      if (!amount || !Number.isFinite(value) || value <= 0) {
        setError('Informe um valor válido.');
        return;
      }
      await movement.mutateAsync({
        id: register.id,
        body: {
          type: mode === 'sangria' ? 'out' : 'in',
          amount: value,
          paymentMethodId: paymentMethodId || undefined,
          refType: mode,
        },
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message || 'Não foi possível concluir a operação.');
        return;
      }
      setError('Não foi possível concluir a operação. Tente novamente.');
    }
  }

  const title = `${TITLES[mode]}${register ? ` · Caixa #${register.number}` : ''}`;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            Concluir
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" isDisabled={busy} onClick={handleConfirm}>
              {busy
                ? 'Salvando…'
                : mode === 'open'
                  ? 'Abrir'
                  : mode === 'close'
                    ? 'Fechar caixa'
                    : 'Salvar'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-2">
          <Row label="Saldo esperado" value={formatMoney(result.expected)} />
          <Row label="Valor conferido" value={formatMoney(Number(amount))} />
          <div className="my-1 border-t border-line" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-ink">Divergência</span>
            <span
              className={[
                'rounded-full px-2.5 py-0.5 text-sm font-semibold',
                Math.abs(result.divergence) < 0.005
                  ? 'bg-success/12 text-success'
                  : result.divergence > 0
                    ? 'bg-gold/15 text-gold-strong'
                    : 'bg-danger/12 text-danger',
              ].join(' ')}
            >
              {result.divergence >= 0 ? '+' : ''}
              {formatMoney(result.divergence)}
            </span>
          </div>
          <div className="text-xs text-muted-ink">
            {Math.abs(result.divergence) < 0.005
              ? 'Caixa fechado sem divergência.'
              : 'Caixa fechado com divergência registrada.'}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {mode === 'open' && (
            <MoneyInput label="Saldo inicial" value={amount} onChange={setAmount} autoFocus />
          )}

          {mode === 'close' && (
            <>
              <div className="rounded-xl border border-line bg-card p-3">
                <Row
                  label="Saldo inicial"
                  value={formatMoney(expected - (register?.summary?.movements ?? 0))}
                />
                <Row
                  label="Movimentações"
                  value={formatMoney(register?.summary?.movements ?? 0)}
                />
                <Row label="Saldo esperado" value={formatMoney(expected)} positive />
              </div>
              <MoneyInput
                label="Valor conferido (real)"
                value={amount}
                onChange={setAmount}
                autoFocus
              />

              {/* Data do fechamento: normalmente o caixa é fechado no dia
                  SEGUINTE, e antes o sistema gravava sempre a data de hoje. */}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-ink">Data do fechamento</span>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="h-10 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink outline-none focus:border-primary"
                />
              </div>

              {/* Transferir o dinheiro do dia para outra conta (ex.: Caixa → Itaú).
                  Opcional: só transfere se as duas contas forem escolhidas. */}
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-3">
                <span className="text-sm font-semibold text-ink">
                  Transferir o dinheiro do dia (opcional)
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-ink">De (conta de origem)</span>
                  <Select
                    aria-label="Conta de origem"
                    selectedKey={transferFrom || null}
                    onSelectionChange={(k) => setTransferFrom(k ? String(k) : '')}
                  >
                    <Select.Trigger className="min-h-[40px]">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {accountItems.map((a) => (
                          <ListBox.Item key={a.id} id={a.id}>
                            {a.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-ink">Para (conta de destino)</span>
                  <Select
                    aria-label="Conta de destino"
                    selectedKey={transferTo || null}
                    onSelectionChange={(k) => setTransferTo(k ? String(k) : '')}
                  >
                    <Select.Trigger className="min-h-[40px]">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {accountItems.map((a) => (
                          <ListBox.Item key={a.id} id={a.id}>
                            {a.name}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                </div>
                <MoneyInput
                  label="Valor a transferir (vazio = valor conferido)"
                  value={transferAmount}
                  onChange={setTransferAmount}
                />
              </div>
            </>
          )}

          {(mode === 'sangria' || mode === 'suprimento') && (
            <>
              <MoneyInput label="Valor" value={amount} onChange={setAmount} autoFocus />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-ink">Forma de pagamento</span>
                <Select
                  aria-label="Forma de pagamento"
                  selectedKey={paymentMethodId || null}
                  onSelectionChange={(k) => setPaymentMethodId(k ? String(k) : '')}
                >
                  <Select.Trigger>
                    <Select.Value>
                      {({ isPlaceholder, selectedText }) =>
                        isPlaceholder ? 'Selecionar forma' : selectedText
                      }
                    </Select.Value>
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {methodItems.map((m) => (
                        <ListBox.Item key={m.id} id={m.id} textValue={m.name}>
                          {m.name}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </>
          )}

          {error && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
