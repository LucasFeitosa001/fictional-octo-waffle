import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Chip, ListBox, Modal, Select } from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { SegBtn } from '../../components/SegBtn';
import { IconCash, IconClock, IconWallet } from '../../components/icons';
import {
  useOpenedCashRegisters,
  useOpenCashRegister,
  useCloseCashRegister,
  useCashMovement,
  type CashRegisterDetail,
  type CashMovementRow,
} from '../../lib/queries/caixa';
import { usePaymentMethods } from '../../lib/queries/financeiro';
import { formatDateTime, formatMoney } from '../../lib/format';

const CARD = 'border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]';

type View = 'resumido' | 'detalhado';
type ModalMode = 'open' | 'sangria' | 'suprimento' | 'close';

export function CaixasAbertosPage() {
  const navigate = useNavigate();
  const opened = useOpenedCashRegisters();
  const rows = opened.data ?? [];

  const [view, setView] = useState<View>('resumido');
  const [modal, setModal] = useState<{ mode: ModalMode; register?: CashRegisterDetail } | null>(
    null,
  );

  const openTotal = useMemo(
    () => rows.reduce((s, c) => s + Number(c.openingBalance ?? 0), 0),
    [rows],
  );
  const cashTotal = useMemo(
    () => rows.reduce((s, c) => s + Number(c.summary?.saldoEmCaixa ?? 0), 0),
    [rows],
  );

  return (
    <div>
      <PageHeader
        title="Caixas abertos"
        subtitle="Caixas em aberto no momento"
        onRefresh={() => opened.refetch()}
        isRefreshing={opened.isFetching}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/financeiro/caixas/historico')}>
              <IconClock size={16} /> Histórico
            </Button>
            <Button variant="primary" onClick={() => setModal({ mode: 'open' })}>
              <IconCash size={16} /> Abrir caixa
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={<IconCash size={18} />} label="Caixas abertos" value={String(rows.length)}
          hint="Em aberto neste momento" />
        <KpiCard icon={<IconWallet size={18} />} label="Saldo inicial somado" value={formatMoney(openTotal)}
          hint="Somatório dos saldos de abertura" />
        <KpiCard icon={<IconWallet size={18} />} label="Saldo em caixa somado" value={formatMoney(cashTotal)}
          hint="Inicial + movimentações" />
      </div>

      {/* Abas de visualização */}
      <div className="mb-4 flex flex-wrap gap-2">
        <SegBtn active={view === 'resumido'} onClick={() => setView('resumido')}>
          Resumido
        </SegBtn>
        <SegBtn active={view === 'detalhado'} onClick={() => setView('detalhado')}>
          Detalhado
        </SegBtn>
      </div>

      {opened.isLoading ? (
        <Card className={CARD}>
          <Card.Content className="p-4">
            <LoadingState />
          </Card.Content>
        </Card>
      ) : opened.isError ? (
        <Card className={CARD}>
          <Card.Content className="p-4">
            <ErrorState onRetry={() => opened.refetch()} />
          </Card.Content>
        </Card>
      ) : rows.length === 0 ? (
        <Card className={CARD}>
          <Card.Content className="p-4">
            <EmptyState
              icon={<IconCash size={32} />}
              title="Nenhum caixa aberto"
              description="Abra um caixa para começar a registrar as movimentações do dia."
            />
          </Card.Content>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((reg) => (
            <CashCard
              key={reg.id}
              reg={reg}
              view={view}
              onAction={(mode) => setModal({ mode, register: reg })}
            />
          ))}
        </div>
      )}

      {modal && (
        <CashActionModal
          mode={modal.mode}
          register={modal.register}
          isOpen
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className={CARD}>
      <Card.Content className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f2b33d]/15 text-[#a67c1e]">
            {icon}
          </span>
          <span className="text-sm font-medium text-muted">{label}</span>
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="mt-1 text-sm text-muted">{hint}</div>
      </Card.Content>
    </Card>
  );
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return <img src={url} alt={name} className="h-11 w-11 rounded-full object-cover" />;
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  return (
    <span className="grid h-11 w-11 place-items-center rounded-full bg-[#f2b33d]/20 text-sm font-semibold text-[#a67c1e]">
      {initials || '?'}
    </span>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? 'font-semibold text-foreground' : 'text-foreground'}>{value}</span>
    </div>
  );
}

function CashCard({
  reg,
  view,
  onAction,
}: {
  reg: CashRegisterDetail;
  view: View;
  onAction: (mode: ModalMode) => void;
}) {
  const s = reg.summary;
  const user = reg.responsibleUser;
  const userName = user?.name ?? 'Sem responsável';

  return (
    <Card className={CARD}>
      <Card.Content className="flex flex-col gap-4 p-5">
        {/* Cabeçalho do profissional */}
        <div className="flex items-start gap-3">
          <Avatar name={userName} url={user?.avatarUrl ?? user?.image} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-semibold text-foreground">{userName}</span>
              <Chip color="success" variant="soft" size="sm">
                Aberto
              </Chip>
            </div>
            {user?.email && <div className="truncate text-xs text-muted">{user.email}</div>}
            <div className="mt-0.5 text-xs text-muted">
              Caixa #{reg.number} · aberto em {formatDateTime(reg.openedAt)}
            </div>
          </div>
        </div>

        {view === 'resumido' ? (
          <div className="rounded-xl border border-[var(--color-soft-border)] bg-[#fffbf2] p-3">
            <Line label="Saldo inicial" value={formatMoney(s.openingBalance)} />
            <Line label="Dinheiro" value={formatMoney(s.dinheiro)} />
            <Line label="Cartão de crédito" value={formatMoney(s.credito)} />
            <Line label="Pix" value={formatMoney(s.pix)} />
            <Line label="Outros pagamentos" value={formatMoney(s.outros)} />
            <Line label="Movimentações" value={formatMoney(s.movements)} />
            <Line label="Total pago" value={formatMoney(s.totalPago)} />
            <div className="my-1 border-t border-[var(--color-soft-border)]" />
            <Line label="Saldo em caixa" value={formatMoney(s.saldoEmCaixa)} strong />
          </div>
        ) : (
          <DetalhadoBody reg={reg} />
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onAction('suprimento')}>
            Suprimento
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction('sangria')}>
            Sangria
          </Button>
          <Button size="sm" variant="primary" onClick={() => onAction('close')}>
            Fechar caixa
          </Button>
        </div>
      </Card.Content>
    </Card>
  );
}

function DetalhadoBody({ reg }: { reg: CashRegisterDetail }) {
  const s = reg.summary;
  const movements = reg.movements ?? [];
  const payments = movements.filter((m) => m.refType !== 'sangria' && m.refType !== 'suprimento');
  const others = movements.filter((m) => m.refType === 'sangria' || m.refType === 'suprimento');

  const cols: Column<CashMovementRow>[] = [
    {
      key: 'method',
      header: 'Forma de pagamento',
      isRowHeader: true,
      render: (m) => m.paymentMethod?.name ?? 'Outros',
    },
    {
      key: 'amount',
      header: 'Valor',
      render: (m) => (
        <span className={m.type === 'out' ? 'text-danger' : 'text-foreground'}>
          {m.type === 'out' ? '- ' : ''}
          {formatMoney(m.amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Lançamentos</h4>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">Nenhum lançamento.</p>
        ) : (
          <DataTable
            aria-label="Lançamentos do caixa"
            columns={cols}
            rows={payments}
            getKey={(m) => m.id}
          />
        )}
      </div>

      {s.byMethod.length > 0 && (
        <div className="rounded-xl border border-[var(--color-soft-border)] bg-[#fffbf2] p-3">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Total por forma
          </h4>
          {s.byMethod.map((b) => (
            <Line key={b.name} label={b.name} value={formatMoney(b.total)} />
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[var(--color-soft-border)] bg-[#fffbf2] p-3">
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Outras movimentações
        </h4>
        <Line label="Suprimentos (reforço)" value={formatMoney(s.suprimentos)} />
        <Line label="Sangrias (retirada)" value={formatMoney(s.sangrias)} />
        {others.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {others.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-xs text-muted">
                <span>
                  {m.refType === 'sangria' ? 'Sangria' : 'Suprimento'}
                  {m.refId ? ` · ${m.refId}` : ''} · {formatDateTime(m.at)}
                </span>
                <span>{formatMoney(m.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===================== Modal de ações =====================

const TITLES: Record<ModalMode, string> = {
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
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
        className="rounded-xl border border-default-200 bg-transparent px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-[#f2b33d]"
      />
    </label>
  );
}

function CashActionModal({
  mode,
  register,
  isOpen,
  onClose,
}: {
  mode: ModalMode;
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

  const openCash = useOpenCashRegister();
  const closeCash = useCloseCashRegister();
  const movement = useCashMovement();

  useEffect(() => {
    setAmount('');
    setPaymentMethodId('');
    setError(null);
    setResult(null);
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
        const res = await closeCash.mutateAsync({ id: register.id, countedBalance: value });
        setResult({ expected: res.expectedBalance, divergence: res.divergence });
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

  return (
    <Modal isOpen={isOpen} onOpenChange={(o) => !o && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>
                {TITLES[mode]}
                {register ? ` · Caixa #${register.number}` : ''}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {result ? (
                <div className="flex flex-col gap-2">
                  <Line label="Saldo esperado" value={formatMoney(result.expected)} />
                  <Line label="Valor conferido" value={formatMoney(Number(amount))} />
                  <div className="my-1 border-t border-[var(--color-soft-border)]" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">Divergência</span>
                    <Chip
                      color={
                        Math.abs(result.divergence) < 0.005
                          ? 'success'
                          : result.divergence > 0
                            ? 'warning'
                            : 'danger'
                      }
                      variant="soft"
                      size="sm"
                    >
                      {result.divergence >= 0 ? '+' : ''}
                      {formatMoney(result.divergence)}
                    </Chip>
                  </div>
                  <p className="text-xs text-muted">
                    {Math.abs(result.divergence) < 0.005
                      ? 'Caixa fechado sem divergência.'
                      : 'Caixa fechado com divergência registrada.'}
                  </p>
                </div>
              ) : (
                <>
                  {mode === 'open' && (
                    <MoneyInput label="Saldo inicial" value={amount} onChange={setAmount} autoFocus />
                  )}

                  {mode === 'close' && (
                    <>
                      <div className="rounded-xl border border-[var(--color-soft-border)] bg-[#fffbf2] p-3">
                        <Line label="Saldo inicial" value={formatMoney(expected - (register?.summary?.movements ?? 0))} />
                        <Line label="Movimentações" value={formatMoney(register?.summary?.movements ?? 0)} />
                        <Line label="Saldo esperado" value={formatMoney(expected)} strong />
                      </div>
                      <MoneyInput label="Valor conferido (real)" value={amount} onChange={setAmount} autoFocus />
                    </>
                  )}

                  {(mode === 'sangria' || mode === 'suprimento') && (
                    <>
                      <MoneyInput label="Valor" value={amount} onChange={setAmount} autoFocus />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted">Forma de pagamento</span>
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
                </>
              )}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              {result ? (
                <Button variant="primary" onClick={onClose}>
                  Concluir
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={onClose}>
                    Cancelar
                  </Button>
                  <Button variant="primary" isDisabled={busy} onClick={handleConfirm}>
                    {busy ? 'Salvando…' : mode === 'open' ? 'Abrir' : mode === 'close' ? 'Fechar caixa' : 'Salvar'}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
