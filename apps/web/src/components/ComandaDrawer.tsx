import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Spinner } from '@heroui/react';
import { ApiClientError, type Customer } from '@beautypass/shared';
import { Drawer } from './Drawer';
import { ErrorState } from './States';
import { CustomerAvatar } from './CustomerPickerDrawer';
import { ItemPickerDrawer, type PickedItem } from './ItemPickerDrawer';
import { ItemEditDrawer } from './ItemEditDrawer';
import {
  IconBox,
  IconCalendar,
  IconCheck,
  IconChevron,
  IconPlus,
  IconScissors,
  IconTrash,
  IconUser,
  IconWhatsApp,
} from './icons';
import {
  useAddOrderDiscount,
  useAddOrderItem,
  useAddOrderPayment,
  useApplyOrderCashback,
  useApplyOrderCredit,
  useFinishOrder,
  useOrder,
  useProfessionals,
  useRemoveOrderCashback,
  useRemoveOrderCredit,
  useRemoveOrderItem,
  useReopenOrder,
  useReverseOrderPayment,
} from '../lib/queries';
import { usePaymentMethods } from '../lib/queries/financeiro';
import { formatDate, formatMoney, formatPhone } from '../lib/format';
import type {
  OrderDetail,
  OrderItemDetail,
  OrderPaymentDetail,
  OrderRow,
} from '../lib/types';

function StatusTag({ status }: { status: OrderRow['status'] }) {
  if (status === 'finished') {
    return (
      <span
        className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium text-white"
        style={{ backgroundColor: '#777777' }}
      >
        Finalizado
      </span>
    );
  }
  if (status === 'canceled') {
    return (
      <span className="inline-flex items-center rounded-[4px] border border-[#ffa39e] bg-[#fff1f0] px-2 py-0.5 text-xs font-medium text-[#cf1322]">
        Cancelada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[4px] border border-[#ffd591] bg-[#fff7e6] px-2 py-0.5 text-xs font-medium text-[#d46b08]">
      Em aberto
    </span>
  );
}

function PaymentTag({ status }: { status: OrderRow['status'] }) {
  if (status === 'canceled') return <span className="text-xs text-muted">—</span>;
  const paid = status === 'finished';
  return paid ? (
    <span className="inline-flex items-center rounded-[4px] border border-[#b7eb8f] bg-[#f6ffed] px-2 py-0.5 text-xs font-medium text-[#389e0d]">
      Pago
    </span>
  ) : (
    <span
      className="inline-flex items-center rounded-[4px] px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: '#faad14' }}
    >
      Pendente
    </span>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="inline-flex items-center text-xs font-medium text-muted-ink">{label}</label>
      {children}
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}

function TotalLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? 'font-semibold text-foreground' : 'text-muted-ink'}>
        {label}
      </span>
      <span
        className={
          strong
            ? 'text-base font-bold tabular-nums text-foreground'
            : 'tabular-nums text-foreground'
        }
      >
        {value}
      </span>
    </div>
  );
}

/** Parse "12,50"/"12.50" → finite number, or 0. */
function parseNum(value: string): number {
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Live line total for an order item (gross − discount). */
function lineTotal(it: OrderItemDetail): number {
  return Math.max(0, Number(it.grossValue) - Number(it.discount));
}

const WEEKDAY_FMT = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
function weekdayLong(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : WEEKDAY_FMT.format(d);
}

const numInputCls =
  'h-11 w-full rounded-lg border border-default-200 bg-white px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary';

/**
 * Ver/Editar comanda (Belasis f_003) — drawer rico e editável (bottom-sheet no
 * mobile, lateral no desktop). Busca o pedido COMPLETO (useOrder) com
 * itens/descontos/pagamentos e espelha o layout: abas Dados | Notas Fiscais,
 * card do cliente + ações (Conversar / Ver cliente), data por extenso, itens
 * clicáveis (→ editar item), Desconto/Crédito/Cashback, totais ao vivo e
 * sub-drawer de Pagamentos + Faturar. Absorve o antigo "Editar" (o Belasis não
 * separa ver/editar).
 */
export function ComandaDrawer({
  order,
  onClose,
  initialPaymentsOpen = false,
}: {
  order: OrderRow | null;
  onClose: () => void;
  /** Abre diretamente o fluxo de pagamento, usado pelo botão "Faturar" da criação. */
  initialPaymentsOpen?: boolean;
}) {
  const navigate = useNavigate();
  const orderId = order?.id ?? '';
  const detailQ = useOrder(order?.id);
  const detail = detailQ.data;

  const professionals = useProfessionals();
  const professionalItems = useMemo(
    () => professionals.data?.data ?? [],
    [professionals.data],
  );

  const addItem = useAddOrderItem(orderId);
  const removeItem = useRemoveOrderItem(orderId);
  const finish = useFinishOrder(orderId);
  const reopen = useReopenOrder(orderId);
  const applyCredit = useApplyOrderCredit(orderId);
  const removeCredit = useRemoveOrderCredit(orderId);
  const applyCashback = useApplyOrderCashback(orderId);
  const removeCashback = useRemoveOrderCashback(orderId);

  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  // Guardamos apenas o id do item em edição e derivamos o objeto do detail
  // sempre fresco — assim add/remove de auxiliares/consumidos (que refazem o
  // GET da comanda) refletem no drawer de editar item sem re-seed.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [addingDiscount, setAddingDiscount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingItem = detail?.items.find((i) => i.id === editingItemId) ?? null;

  // Reset transient UI whenever a different comanda opens.
  useEffect(() => {
    setItemPickerOpen(false);
    setEditingItemId(null);
    setPaymentsOpen(Boolean(order) && initialPaymentsOpen);
    setAddingDiscount(false);
    setError(null);
  }, [order?.id, initialPaymentsOpen]);

  const editable = detail?.status === 'open';

  async function handleAddPicked(picked: PickedItem) {
    setError(null);
    try {
      await addItem.mutateAsync({
        kind: picked.kind,
        refId: picked.refId,
        unitPrice: picked.unitPrice,
        quantity: 1,
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível adicionar o item.');
    }
  }

  async function handleRemoveItem(item: OrderItemDetail) {
    setError(null);
    try {
      await removeItem.mutateAsync(item.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível remover o item.');
    }
  }

  async function handleFinish() {
    setError(null);
    try {
      await finish.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível faturar a comanda.');
      throw err;
    }
  }

  async function handleReopen() {
    setError(null);
    try {
      await reopen.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível reabrir a comanda.');
    }
  }

  const paidTotal = detail
    ? detail.payments
        .filter((p) => p.status !== 'reversed')
        .reduce((acc, p) => acc + Number(p.amount), 0)
    : 0;
  const remaining = detail ? Math.max(Number(detail.netTotal) - paidTotal, 0) : 0;

  return (
    <Drawer
      isOpen={order != null}
      onClose={onClose}
      title={order ? `Visualizando comanda #${order.number}` : 'Comanda'}
      widthClass="sm:w-[560px]"
      footer={
        <>
          <Button variant="outline" className="mr-auto" onClick={onClose}>
            Fechar
          </Button>
          {detail?.status === 'open' && (
            <Button
              variant="primary"
              onClick={() => setPaymentsOpen(true)}
              className="!bg-[#16a34a] !text-white hover:!bg-[#15803d]"
            >
              <IconCheck size={16} /> Pagamentos
            </Button>
          )}
          {detail?.status === 'finished' && (
            <Button variant="primary" isDisabled={reopen.isPending} onClick={handleReopen}>
              {reopen.isPending ? 'Reabrindo…' : 'Reabrir'}
            </Button>
          )}
        </>
      }
    >
      {/* Sub-drawers (z-[90], sobem por cima da comanda). */}
      <ItemPickerDrawer
        isOpen={itemPickerOpen}
        onClose={() => setItemPickerOpen(false)}
        onSelect={handleAddPicked}
      />
      <ItemEditDrawer
        orderId={orderId}
        item={editingItem}
        professionals={professionalItems}
        editable={editable}
        onClose={() => setEditingItemId(null)}
      />
      {detail && (
        <PagamentosDrawer
          isOpen={paymentsOpen}
          order={detail}
          paidTotal={paidTotal}
          remaining={remaining}
          faturando={finish.isPending}
          onClose={() => setPaymentsOpen(false)}
          onFaturar={async () => {
            await handleFinish();
            setPaymentsOpen(false);
          }}
        />
      )}

      {detailQ.isLoading || !detail ? (
        detailQ.isError ? (
          <div className="py-10">
            <ErrorState onRetry={() => detailQ.refetch()} />
          </div>
        ) : (
          <div className="flex items-center gap-2 py-10 text-sm text-muted">
            <Spinner size="sm" /> Carregando comanda…
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {/* Abas Dados | Notas Fiscais (Notas Fiscais → 2ª onda). */}
          <div className="inline-flex gap-1 self-start rounded-lg border border-[var(--color-soft-border)] bg-canvas p-0.5 text-sm">
            <span className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground">
              Dados
            </span>
            <span
              className="rounded-md px-3 py-1.5 font-medium text-muted opacity-60"
              title="Em breve"
            >
              Notas Fiscais
            </span>
          </div>

          {/* (1) Card do cliente + ações. */}
          <OrderCustomerCard
            detail={detail}
            onConversar={(phone) =>
              window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank', 'noopener')
            }
            onVerCliente={(cid) => {
              onClose();
              navigate(`/clientes/${cid}`);
            }}
          />

          {/* (2) Data por extenso. */}
          <div className="flex items-center gap-2 text-sm text-foreground">
            <IconCalendar size={16} className="text-muted" />
            <span className="capitalize">
              {weekdayLong(detail.date.slice(0, 10))}, {formatDate(detail.date)}
            </span>
          </div>

          {/* Status + Pagamento. */}
          <div className="flex items-center gap-2">
            <StatusTag status={detail.status} />
            <PaymentTag status={detail.status} />
          </div>

          {/* (3) Itens. */}
          <section>
            <div className="mb-2 text-sm font-semibold text-foreground">Itens</div>
            <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
              {detail.items.length === 0 && (
                <div className="px-3 py-4 text-sm text-muted">Nenhum item adicionado.</div>
              )}
              {detail.items.map((it) => {
                const Icon = it.kind === 'service' ? IconScissors : IconBox;
                const name = it.itemName ?? (it.kind === 'service' ? 'Serviço' : 'Produto');
                return (
                  <div
                    key={it.id}
                    className="flex items-center gap-2 border-b border-[var(--color-soft-border)] px-3 py-2.5 last:border-b-0"
                  >
                    {/* Item SEMPRE abre o drawer (modo leitura quando a comanda
                        não está aberta) — antes ficava disabled e o clique não
                        fazia nada em comanda finalizada. */}
                    <button
                      type="button"
                      onClick={() => setEditingItemId(it.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                        {Number(it.quantity)}x
                      </span>
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          {/* Destaque de clicável: cor primária + sublinhado. */}
                          <span className="truncate text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-2">
                            {name}
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                            {formatMoney(lineTotal(it))}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <IconUser size={12} />
                          {/* Quantidade já aparece no badge "Nx" à esquerda. */}
                          <span className="truncate">
                            {it.professionalName || 'Sem profissional'}
                          </span>
                        </span>
                      </span>
                      <IconChevron size={16} className="shrink-0 -rotate-90 text-muted" />
                    </button>
                    {editable && (
                      <button
                        type="button"
                        aria-label="Remover item"
                        onClick={() => handleRemoveItem(it)}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-ink transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <IconTrash size={15} />
                      </button>
                    )}
                  </div>
                );
              })}

              {editable && (
                <button
                  type="button"
                  onClick={() => setItemPickerOpen(true)}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-primary hover:bg-[color-mix(in_oklab,var(--sp-primary)_5%,transparent)]"
                >
                  <IconPlus size={15} /> Selecionar serviço ou produto
                </button>
              )}
            </div>
          </section>

          {/* (4) Desconto / Crédito / Cashback. */}
          <section className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm">
            <TotalLine label="Desconto" value={formatMoney(detail.discountTotal)} />
            {editable &&
              (addingDiscount ? (
                <AddDiscountInline orderId={orderId} onDone={() => setAddingDiscount(false)} />
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingDiscount(true)}
                  className="mb-1 inline-flex items-center gap-1 self-start text-xs font-semibold text-primary hover:underline"
                >
                  <IconPlus size={13} /> Adicionar desconto
                </button>
              ))}

            <div className="my-1 border-t border-[var(--color-soft-border)]" />

            {/* Crédito e Cashback — abatem saldo do cliente (ledger). */}
            <LedgerLine
              label="Crédito"
              applied={Number(detail.creditUsed)}
              balance={Number(detail.customerBalance?.creditBalance ?? 0)}
              maxApply={Number(detail.netTotal) + Number(detail.creditUsed)}
              editable={editable}
              apply={applyCredit}
              remove={removeCredit}
            />
            <LedgerLine
              label="Cashback"
              applied={Number(detail.cashbackUsed)}
              balance={Number(detail.customerBalance?.cashbackBalance ?? 0)}
              maxApply={Number(detail.netTotal) + Number(detail.cashbackUsed)}
              editable={editable}
              apply={applyCashback}
              remove={removeCashback}
            />
          </section>

          {/* Totais ao vivo. */}
          <section className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm">
            <TotalLine label="Total bruto" value={formatMoney(detail.grossTotal)} />
            <TotalLine label="Descontos" value={`- ${formatMoney(detail.discountTotal)}`} />
            <div className="my-1 border-t border-[var(--color-soft-border)]" />
            <TotalLine label="Valor líquido" value={formatMoney(detail.netTotal)} strong />
            <TotalLine label="Total pago" value={formatMoney(paidTotal)} />
            <TotalLine label="Restante" value={formatMoney(remaining)} />
          </section>

          {error && <FormError message={error} />}
        </div>
      )}
    </Drawer>
  );
}

/**
 * Card do cliente (f_003): avatar + nome + telefone e duas ações lado a lado —
 * "Conversar" (abre WhatsApp) e "Ver cliente" (vai pro perfil). Avulso → sem ações.
 */
function OrderCustomerCard({
  detail,
  onConversar,
  onVerCliente,
}: {
  detail: OrderDetail;
  onConversar: (phone: string) => void;
  onVerCliente: (customerId: string) => void;
}) {
  const cust = detail.customer as (Customer & { avatarUrl?: string | null }) | null | undefined;

  if (!cust?.id) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-2.5">
        <CustomerAvatar name={detail.customerName ?? 'Avulso'} size={44} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {detail.customerName ?? 'Avulso'}
          </div>
          <div className="text-xs italic text-muted">Sem cliente vinculado</div>
        </div>
      </div>
    );
  }

  const phone = cust.phone ?? null;

  return (
    <div className="rounded-xl border border-[var(--color-soft-border)] bg-white px-3 py-3">
      <div className="flex items-center gap-3">
        <CustomerAvatar name={cust.name} avatarUrl={cust.avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{cust.name}</div>
          {phone && <div className="truncate text-xs text-muted">{formatPhone(phone)}</div>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!phone}
          onClick={() => phone && onConversar(phone)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-soft-border)] py-2 text-sm font-medium text-foreground transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
        >
          <IconWhatsApp size={16} /> Conversar
        </button>
        <button
          type="button"
          onClick={() => onVerCliente(cust.id)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-soft-border)] py-2 text-sm font-medium text-foreground transition-colors hover:bg-cream"
        >
          <IconUser size={16} /> Ver cliente
        </button>
      </div>
    </div>
  );
}

/** Desconto inline (POST /orders/:id/discounts) — valor R$ ou %. */
function AddDiscountInline({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const add = useAddOrderDiscount(orderId);
  const [type, setType] = useState<'value' | 'percent'>('value');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    const v = parseNum(value);
    if (v <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      await add.mutateAsync({ type, value: v });
      setValue('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível aplicar o desconto.');
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-[var(--color-soft-border)] pt-2">
      <div className="flex items-center gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'value' | 'percent')}
          aria-label="Tipo de desconto"
          className="h-10 rounded-lg border border-default-200 bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="value">R$</option>
          <option value="percent">%</option>
        </select>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === 'percent' ? '0' : '0,00'}
          aria-label="Valor do desconto"
          className="h-10 flex-1 rounded-lg border border-default-200 bg-white px-3 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="primary" size="sm" isDisabled={add.isPending} onClick={handleAdd}>
          {add.isPending ? 'Aplicando…' : 'Aplicar'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Linha de Crédito / Cashback (ledger CustomerCredit/CustomerCashback). Mostra o
 * valor já abatido na comanda e, quando editável, permite aplicar até o menor
 * entre o saldo do cliente e o líquido da comanda (POST /orders/:id/credit|cashback)
 * ou remover o que já foi aplicado (DELETE). Sem endpoint novo — usa os hooks
 * existentes de apply/remove.
 */
function LedgerLine({
  label,
  applied,
  balance,
  maxApply,
  editable,
  apply,
  remove,
}: {
  label: string;
  applied: number;
  balance: number;
  maxApply: number;
  editable: boolean;
  apply: ReturnType<typeof useApplyOrderCredit>;
  remove: ReturnType<typeof useRemoveOrderCredit>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Teto real: não dá pra abater mais que o saldo do cliente nem que o valor
  // devido na comanda (líquido restante + o que já está aplicado nesta linha).
  const cap = Math.max(0, Math.min(balance, maxApply));

  async function handleApply() {
    setError(null);
    const v = parseNum(value);
    if (v <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    if (v > cap + 0.001) {
      setError(`Máximo ${formatMoney(cap)}.`);
      return;
    }
    try {
      await apply.mutateAsync(v);
      setValue('');
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Não foi possível aplicar ${label.toLowerCase()}.`);
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await remove.mutateAsync();
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Não foi possível remover ${label.toLowerCase()}.`);
    }
  }

  const canApply = editable && cap > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-muted-ink">
          {label}
          {editable && balance > 0 && (
            <span className="text-xs text-muted">(saldo {formatMoney(balance)})</span>
          )}
        </span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums text-foreground">{formatMoney(applied)}</span>
          {editable &&
            (applied > 0 ? (
              <button
                type="button"
                onClick={handleRemove}
                disabled={remove.isPending}
                className="text-xs font-semibold text-danger hover:underline disabled:opacity-50"
              >
                {remove.isPending ? '…' : 'Remover'}
              </button>
            ) : canApply && !open ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <IconPlus size={12} /> Aplicar
              </button>
            ) : null)}
        </span>
      </div>

      {editable && open && applied === 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-soft-border)] bg-white p-2">
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              aria-label={`Valor de ${label.toLowerCase()}`}
              className="h-9 flex-1 rounded-lg border border-default-200 bg-white px-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setValue(String(cap).replace('.', ','))}
              className="shrink-0 whitespace-nowrap rounded-lg border border-default-200 px-2 py-2 text-xs font-medium text-foreground hover:bg-cream"
            >
              Usar {formatMoney(cap)}
            </button>
          </div>
          {error && <span className="text-xs text-danger">{error}</span>}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpen(false);
                setValue('');
                setError(null);
              }}
            >
              Cancelar
            </Button>
            <Button variant="primary" size="sm" isDisabled={apply.isPending} onClick={handleApply}>
              {apply.isPending ? 'Aplicando…' : 'Aplicar'}
            </Button>
          </div>
        </div>
      )}
      {editable && error && !open && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

/**
 * Pagamentos (f_055) — sub-drawer sobre a comanda: valor, forma (Dinheiro /
 * Cartão / Outros, ou método cadastrado), lista de pagamentos com estorno,
 * Resumo (Descontos / Total / Total pago / Restante), troco e Faturar (verde).
 */
function PagamentosDrawer({
  isOpen,
  order,
  paidTotal,
  remaining,
  faturando,
  onClose,
  onFaturar,
}: {
  isOpen: boolean;
  order: OrderDetail;
  paidTotal: number;
  remaining: number;
  faturando: boolean;
  onClose: () => void;
  onFaturar: () => void;
}) {
  const add = useAddOrderPayment(order.id);
  const reverse = useReverseOrderPayment(order.id);
  const methods = usePaymentMethods();
  const methodList = useMemo(() => methods.data ?? [], [methods.data]);

  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [quickMethod, setQuickMethod] = useState('Dinheiro');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmount(remaining > 0 ? remaining.toFixed(2) : '');
      setMethodId('');
      setQuickMethod('Dinheiro');
      setError(null);
    }
  }, [isOpen, remaining]);

  const typed = parseNum(amount);
  const troco = Math.max(0, typed - remaining);
  const quicks = ['Dinheiro', 'Cartão', 'Outros'];
  const selectedQuickMethod = useMemo(() => {
    if (quickMethod !== 'Dinheiro') return null;
    return (
      methodList.find(
        (method) =>
          method.name
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLowerCase() === 'dinheiro',
      ) ?? null
    );
  }, [methodList, quickMethod]);

  function paymentBody(value: number) {
    const resolvedMethodId = methodId || selectedQuickMethod?.id;
    return {
      paymentMethodId: resolvedMethodId || undefined,
      amount: Math.min(value, remaining),
      description: resolvedMethodId ? undefined : quickMethod,
    };
  }

  async function handleAdd() {
    setError(null);
    const value = parseNum(amount);
    if (remaining <= 0.009) {
      setError('O valor da comanda já está integralmente pago.');
      return;
    }
    if (value <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      // O valor entregue pelo cliente pode ser maior para cálculo de troco,
      // mas o pagamento persistido é somente o restante real da venda.
      await add.mutateAsync(paymentBody(value));
      setAmount('');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível registrar o pagamento.');
    }
  }

  async function handleFaturar() {
    setError(null);
    try {
      // O campo já abre preenchido com o restante. Se a pessoa tocar direto em
      // “Faturar”, registra primeiro esse pagamento e só então fecha a comanda.
      // Antes o botão fechava sem pagamento e a venda não aparecia no caixa.
      if (remaining > 0.009) {
        const value = parseNum(amount);
        if (value + 0.009 < remaining) {
          setError(`Falta registrar ${formatMoney(remaining - Math.max(value, 0))}.`);
          return;
        }
        if (value <= 0) {
          setError('Informe o valor e a forma de pagamento antes de faturar.');
          return;
        }
        await add.mutateAsync(paymentBody(value));
      }
      await onFaturar();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível faturar a comanda.');
    }
  }

  async function handleReverse(p: OrderPaymentDetail) {
    setError(null);
    try {
      await reverse.mutateAsync(p.id);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Não foi possível estornar o pagamento.');
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Pagamentos"
      widthClass="sm:w-[480px]"
      fullscreen
      zClass="z-[90]"
      footer={
        <>
          <Button variant="outline" className="mr-auto" onClick={onClose}>
            Voltar
          </Button>
          <Button
            variant="primary"
            isDisabled={faturando || add.isPending}
            onClick={handleFaturar}
            className="!bg-[#16a34a] !text-white hover:!bg-[#15803d]"
          >
            <IconCheck size={16} />{' '}
            {faturando || add.isPending ? 'Faturando…' : 'Faturar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Valor (R$)">
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Valor do pagamento"
            className={numInputCls}
          />
        </Field>

        {/* Formas rápidas Dinheiro / Cartão / Outros. */}
        <div className="grid grid-cols-3 gap-2">
          {quicks.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setQuickMethod(q);
                setMethodId('');
              }}
              className={[
                'rounded-lg border py-2 text-sm font-medium transition-colors',
                !methodId && quickMethod === q
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-[var(--color-soft-border)] text-foreground hover:bg-cream',
              ].join(' ')}
            >
              {q}
            </button>
          ))}
        </div>

        {methodList.length > 0 && (
          <Field label="Método cadastrado (opcional)">
            <select
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
              aria-label="Método de pagamento"
              className={numInputCls}
            >
              <option value="">Usar forma rápida</option>
              {methodList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Button variant="outline" isDisabled={add.isPending} onClick={handleAdd}>
          <IconPlus size={16} /> {add.isPending ? 'Registrando…' : 'Adicionar pagamento'}
        </Button>

        {/* Lista de pagamentos. */}
        {order.payments.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
            {order.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 border-b border-[var(--color-soft-border)] px-3 py-2.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {p.paymentMethodName ?? p.description ?? 'Pagamento'}
                  </div>
                  {p.status === 'reversed' && (
                    <div className="text-xs text-muted">Estornado</div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={[
                      'text-sm font-semibold tabular-nums',
                      p.status === 'reversed' ? 'text-muted line-through' : 'text-foreground',
                    ].join(' ')}
                  >
                    {formatMoney(p.amount)}
                  </span>
                  {p.status !== 'reversed' && (
                    <button
                      type="button"
                      onClick={() => handleReverse(p)}
                      className="text-xs font-semibold text-danger hover:underline"
                    >
                      Estornar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Resumo. */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3 text-sm">
          <TotalLine label="Descontos" value={`- ${formatMoney(order.discountTotal)}`} />
          <TotalLine label="Total" value={formatMoney(order.netTotal)} strong />
          <TotalLine label="Total pago" value={formatMoney(paidTotal)} />
          <TotalLine label="Restante" value={formatMoney(remaining)} />
          <div className="my-1 border-t border-[var(--color-soft-border)]" />
          <TotalLine label="Troco" value={formatMoney(troco)} strong />
        </div>

        {error && <FormError message={error} />}
      </div>
    </Drawer>
  );
}
