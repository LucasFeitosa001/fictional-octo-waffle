import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  Select,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import type { PaymentStatus } from '@beautypass/shared';
import { OrderStatusChip } from '../components/StatusChip';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { IconChevron, IconPlus, IconReceipt, IconTrash } from '../components/icons';
import { ItemEditDrawer } from '../components/ItemEditDrawer';
import {
  useAddOrderDiscount,
  useAddOrderItem,
  useAddOrderPayment,
  useFinishOrder,
  useOrder,
  useProfessionals,
  useRemoveOrderItem,
  useReopenOrder,
  useReverseOrderPayment,
  useServices,
} from '../lib/queries';
import { useProducts } from '../lib/queries/catalogo';
import { usePaymentMethods } from '../lib/queries/financeiro';
import { formatDateTime, formatMoney } from '../lib/format';
import type {
  OrderDetail,
  OrderDiscountDetail,
  OrderItemDetail,
  OrderPaymentDetail,
} from '../lib/types';

const CARD =
  'border border-[var(--color-soft-border)] bg-warm-white shadow-[var(--shadow-card)]';

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  reversed: 'Estornado',
};

const PAYMENT_STATUS_COLOR: Record<PaymentStatus, 'success' | 'warning' | 'default'> = {
  pending: 'warning',
  paid: 'success',
  reversed: 'default',
};

/** Parse a user-typed amount ("12,50" or "12.50") into a finite number or null. */
function parseAmount(value: string): number | null {
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ComandaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const order = useOrder(id);

  if (order.isLoading) {
    return (
      <div>
        <BackButton onClick={() => navigate('/comandas')} />
        <LoadingState />
      </div>
    );
  }

  if (order.isError) {
    return (
      <div>
        <BackButton onClick={() => navigate('/comandas')} />
        <ErrorState
          message="Não foi possível carregar a comanda."
          onRetry={() => order.refetch()}
        />
      </div>
    );
  }

  if (!order.data) {
    return (
      <div>
        <BackButton onClick={() => navigate('/comandas')} />
        <EmptyState
          icon={<IconReceipt size={32} />}
          title="Comanda não encontrada"
          description="Ela pode ter sido removida ou o link está incorreto."
          action={
            <Button variant="primary" onClick={() => navigate('/comandas')}>
              Voltar para comandas
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <ComandaDetalhe
      key={order.data.id}
      order={order.data}
      onBack={() => navigate('/comandas')}
    />
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
    >
      <IconChevron size={16} className="rotate-90" /> Voltar
    </button>
  );
}

function ComandaDetalhe({ order, onBack }: { order: OrderDetail; onBack: () => void }) {
  const orderId = order.id;
  const isOpen = order.status === 'open';
  const isFinished = order.status === 'finished';
  const editable = isOpen;

  const finish = useFinishOrder(orderId);
  const reopen = useReopenOrder(orderId);
  const [actionError, setActionError] = useState<string | null>(null);

  const paidTotal = useMemo(
    () =>
      order.payments
        .filter((p) => p.status !== 'reversed')
        .reduce((acc, p) => acc + Number(p.amount), 0),
    [order.payments],
  );
  const netTotal = Number(order.netTotal);
  const remaining = Math.max(netTotal - paidTotal, 0);

  async function handleFinish() {
    setActionError(null);
    try {
      await finish.mutateAsync();
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível finalizar a comanda.'));
    }
  }

  async function handleReopen() {
    setActionError(null);
    try {
      await reopen.mutateAsync();
    } catch (err) {
      setActionError(errorMessage(err, 'Não foi possível reabrir a comanda.'));
    }
  }

  return (
    <div className="pb-28">
      <BackButton onClick={onBack} />

      {/* Header */}
      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">#{order.number}</h1>
                <OrderStatusChip status={order.status} />
              </div>
              <p className="mt-1 truncate text-sm text-foreground">
                {order.customer?.name ?? order.customerName ?? 'Avulso'}
              </p>
              <p className="text-xs text-muted">{formatDateTime(order.date)}</p>
              {order.professionalName && (
                <p className="mt-0.5 text-xs text-muted">
                  Profissional: {order.professionalName}
                </p>
              )}
            </div>
          </div>
          {isFinished && (
            <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              Comanda finalizada — reabra para editar.
            </div>
          )}
          {order.status === 'canceled' && (
            <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              Comanda cancelada.
            </div>
          )}
        </Card.Content>
      </Card>

      <ItemsSection order={order} editable={editable} />
      <DiscountsSection order={order} editable={editable} />
      <PaymentsSection order={order} editable={editable} />

      {/* Totais */}
      <Card className={`mb-4 ${CARD}`}>
        <Card.Content className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Totais</h2>
          <dl className="flex flex-col gap-1.5 text-sm">
            <TotalRow label="Bruto" value={formatMoney(order.grossTotal)} />
            <TotalRow label="Desconto" value={`- ${formatMoney(order.discountTotal)}`} />
            {Number(order.creditUsed) > 0 && (
              <TotalRow label="Crédito usado" value={`- ${formatMoney(order.creditUsed)}`} />
            )}
            {Number(order.cashbackUsed) > 0 && (
              <TotalRow label="Cashback usado" value={`- ${formatMoney(order.cashbackUsed)}`} />
            )}
            <div className="my-1 border-t border-[var(--color-soft-border)]" />
            <TotalRow label="Líquido" value={formatMoney(order.netTotal)} strong />
            <TotalRow label="Pago" value={formatMoney(paidTotal)} />
            <TotalRow label="Restante" value={formatMoney(remaining)} strong />
          </dl>
        </Card.Content>
      </Card>

      {/* Sticky footer actions */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-soft-border)] bg-warm-white/95 p-3 backdrop-blur sm:left-auto sm:right-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {actionError && (
            <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {actionError}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={onBack}>
              Voltar
            </Button>
            {isOpen && (
              <Button
                variant="primary"
                className="flex-1"
                isDisabled={finish.isPending}
                onClick={handleFinish}
              >
                {finish.isPending ? 'Finalizando…' : 'Finalizar comanda'}
              </Button>
            )}
            {isFinished && (
              <Button
                variant="primary"
                className="flex-1"
                isDisabled={reopen.isPending}
                onClick={handleReopen}
              >
                {reopen.isPending ? 'Reabrindo…' : 'Reabrir comanda'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalRow({
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
      <dt className={strong ? 'font-semibold text-foreground' : 'text-muted'}>{label}</dt>
      <dd className={strong ? 'font-semibold text-foreground' : 'text-foreground'}>{value}</dd>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={`mb-4 ${CARD}`}>
      <Card.Content className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
        {children}
      </Card.Content>
    </Card>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}

/* ---------------- Itens ---------------- */

function ItemsSection({ order, editable }: { order: OrderDetail; editable: boolean }) {
  const [adding, setAdding] = useState(false);
  const remove = useRemoveOrderItem(order.id);
  const [removeError, setRemoveError] = useState<string | null>(null);
  // Clicar no item abre o mesmo drawer de edição usado nos outros fluxos
  // (Dados | Auxiliares | Produtos consumidos). Guardamos só o id e derivamos o
  // objeto do `order` para refletir mudanças sem re-seed.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const professionals = useProfessionals();
  const professionalItems = useMemo(
    () => professionals.data?.data ?? [],
    [professionals.data],
  );
  const editingItem = order.items.find((i) => i.id === editingItemId) ?? null;

  async function handleRemove(item: OrderItemDetail) {
    setRemoveError(null);
    try {
      await remove.mutateAsync(item.id);
    } catch (err) {
      setRemoveError(errorMessage(err, 'Não foi possível remover o item.'));
    }
  }

  return (
    <SectionCard title="Itens">
      {/* Drawer de edição do item (Dados | Auxiliares | Produtos consumidos).
          Abre também com a comanda finalizada — aí em modo leitura. */}
      <ItemEditDrawer
        orderId={order.id}
        item={editingItem}
        professionals={professionalItems}
        editable={editable}
        onClose={() => setEditingItemId(null)}
      />
      {order.items.length === 0 ? (
        <p className="text-sm text-muted">Nenhum item adicionado.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-soft-border)]">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2.5">
              {/* Nome do item é o gatilho do drawer. Destaque explícito
                  (cor primária + sublinhado) para deixar claro que é clicável —
                  antes era texto morto e ninguém descobria o editor. */}
              <button
                type="button"
                onClick={() => setEditingItemId(item.id)}
                className="group min-w-0 flex-1 text-left"
              >
                <p className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-primary underline decoration-primary/40 underline-offset-2 group-hover:decoration-primary">
                    {item.itemName ?? (item.kind === 'service' ? 'Serviço' : 'Produto')}
                  </span>
                  <IconChevron
                    size={14}
                    className="shrink-0 -rotate-90 text-primary/70 transition-transform group-hover:translate-x-0.5"
                  />
                </p>
                <p className="text-xs text-muted">
                  {Number(item.quantity)} × {formatMoney(item.unitPrice)}
                  {Number(item.discount) > 0 && ` · desc. ${formatMoney(item.discount)}`}
                </p>
                {item.professionalName && (
                  <p className="text-xs text-muted">{item.professionalName}</p>
                )}
              </button>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold text-foreground">
                  {formatMoney(Number(item.grossValue) - Number(item.discount))}
                </span>
                {editable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={remove.isPending}
                    onClick={() => handleRemove(item)}
                    aria-label="Remover item"
                  >
                    <IconTrash size={16} /> Remover
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {removeError && (
        <div className="mt-3">
          <FormError message={removeError} />
        </div>
      )}

      {editable && (
        <div className="mt-3">
          {adding ? (
            <AddItemForm order={order} onDone={() => setAdding(false)} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <IconPlus size={16} /> Adicionar item
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function AddItemForm({ order, onDone }: { order: OrderDetail; onDone: () => void }) {
  const add = useAddOrderItem(order.id);
  const services = useServices();
  const products = useProducts();
  const professionals = useProfessionals();

  const [kind, setKind] = useState<'service' | 'product'>('service');
  const [refId, setRefId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const serviceList = useMemo(() => services.data?.data ?? [], [services.data]);
  const productList = useMemo(() => products.data?.data ?? [], [products.data]);
  const professionalList = useMemo(
    () => professionals.data?.data ?? [],
    [professionals.data],
  );

  function selectRef(newRefId: string) {
    setRefId(newRefId);
    if (kind === 'service') {
      const s = serviceList.find((x) => x.id === newRefId);
      if (s) setUnitPrice(String(s.price));
    } else {
      const p = productList.find((x) => x.id === newRefId);
      if (p) setUnitPrice(String(p.salePrice));
    }
  }

  function switchKind(newKind: 'service' | 'product') {
    setKind(newKind);
    setRefId('');
    setUnitPrice('');
  }

  async function handleAdd() {
    setError(null);
    const price = parseAmount(unitPrice);
    const qty = parseAmount(quantity);
    if (!refId) {
      setError('Selecione um item.');
      return;
    }
    if (price === null || price < 0) {
      setError('Informe um preço válido.');
      return;
    }
    if (qty === null || qty <= 0) {
      setError('Informe uma quantidade válida.');
      return;
    }
    try {
      await add.mutateAsync({
        kind,
        refId,
        professionalId: professionalId || undefined,
        quantity: qty,
        unitPrice: price,
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível adicionar o item.'));
    }
  }

  const options = kind === 'service' ? serviceList : productList;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--color-soft-border)] p-3">
      <FieldLabel label="Tipo">
        <Select
          aria-label="Tipo"
          selectedKey={kind}
          onSelectionChange={(k) => switchKind(String(k) as 'service' | 'product')}
        >
          <Select.Trigger>
            <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="service" textValue="Serviço">
                Serviço
              </ListBox.Item>
              <ListBox.Item id="product" textValue="Produto">
                Produto
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </FieldLabel>

      <FieldLabel label={kind === 'service' ? 'Serviço' : 'Produto'}>
        <Select
          aria-label="Item"
          selectedKey={refId || null}
          onSelectionChange={(k) => selectRef(k ? String(k) : '')}
        >
          <Select.Trigger>
            <Select.Value>
              {({ isPlaceholder, selectedText }) =>
                isPlaceholder ? 'Selecione' : selectedText
              }
            </Select.Value>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {options.map((o) => (
                <ListBox.Item key={o.id} id={o.id} textValue={o.name}>
                  {o.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </FieldLabel>

      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Qtd.">
          <TextField value={quantity} onChange={setQuantity} aria-label="Quantidade">
            <Input inputMode="decimal" placeholder="1" />
          </TextField>
        </FieldLabel>
        <FieldLabel label="Preço unit. (R$)">
          <TextField value={unitPrice} onChange={setUnitPrice} aria-label="Preço unitário">
            <Input inputMode="decimal" placeholder="0,00" />
          </TextField>
        </FieldLabel>
      </div>

      <FieldLabel label="Profissional (opcional)">
        <Select
          aria-label="Profissional"
          selectedKey={professionalId || null}
          onSelectionChange={(k) => setProfessionalId(k ? String(k) : '')}
        >
          <Select.Trigger>
            <Select.Value>
              {({ isPlaceholder, selectedText }) =>
                isPlaceholder ? 'Nenhum' : selectedText
              }
            </Select.Value>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {professionalList.map((p) => (
                <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                  {p.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </FieldLabel>

      {error && <FormError message={error} />}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          isDisabled={add.isPending}
          onClick={handleAdd}
        >
          {add.isPending ? 'Adicionando…' : 'Adicionar'}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Descontos ---------------- */

function DiscountsSection({ order, editable }: { order: OrderDetail; editable: boolean }) {
  const [adding, setAdding] = useState(false);

  return (
    <SectionCard title="Descontos">
      {order.discounts.length === 0 ? (
        <p className="text-sm text-muted">Nenhum desconto aplicado.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-soft-border)]">
          {order.discounts.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {formatDiscount(d)}
                </p>
                {d.reason && <p className="truncate text-xs text-muted">{d.reason}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(Number(order.creditUsed) > 0 || Number(order.cashbackUsed) > 0) && (
        <div className="mt-2 flex flex-col gap-1 text-xs text-muted">
          {Number(order.creditUsed) > 0 && (
            <span>Crédito usado: {formatMoney(order.creditUsed)}</span>
          )}
          {Number(order.cashbackUsed) > 0 && (
            <span>Cashback usado: {formatMoney(order.cashbackUsed)}</span>
          )}
        </div>
      )}

      {editable && (
        <div className="mt-3">
          {adding ? (
            <AddDiscountForm order={order} onDone={() => setAdding(false)} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <IconPlus size={16} /> Adicionar desconto
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function formatDiscount(d: OrderDiscountDetail): string {
  return d.type === 'percent' ? `${Number(d.value)}%` : formatMoney(d.value);
}

function AddDiscountForm({ order, onDone }: { order: OrderDetail; onDone: () => void }) {
  const add = useAddOrderDiscount(order.id);
  const [type, setType] = useState<'percent' | 'value'>('value');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    const v = parseAmount(value);
    if (v === null || v < 0) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      await add.mutateAsync({ type, value: v, reason: reason.trim() || undefined });
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível adicionar o desconto.'));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--color-soft-border)] p-3">
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Tipo">
          <Select
            aria-label="Tipo de desconto"
            selectedKey={type}
            onSelectionChange={(k) => setType(String(k) as 'percent' | 'value')}
          >
            <Select.Trigger>
              <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="value" textValue="Valor (R$)">
                  Valor (R$)
                </ListBox.Item>
                <ListBox.Item id="percent" textValue="Percentual (%)">
                  Percentual (%)
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </FieldLabel>
        <FieldLabel label={type === 'percent' ? 'Percentual' : 'Valor (R$)'}>
          <TextField value={value} onChange={setValue} aria-label="Valor do desconto">
            <Input inputMode="decimal" placeholder="0,00" />
          </TextField>
        </FieldLabel>
      </div>
      <FieldLabel label="Motivo (opcional)">
        <TextField value={reason} onChange={setReason} aria-label="Motivo">
          <Input placeholder="Ex.: Cliente fidelidade" />
        </TextField>
      </FieldLabel>

      {error && <FormError message={error} />}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          isDisabled={add.isPending}
          onClick={handleAdd}
        >
          {add.isPending ? 'Adicionando…' : 'Adicionar'}
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Pagamentos ---------------- */

function PaymentsSection({ order, editable }: { order: OrderDetail; editable: boolean }) {
  const [adding, setAdding] = useState(false);
  const reverse = useReverseOrderPayment(order.id);
  const [reverseError, setReverseError] = useState<string | null>(null);

  async function handleReverse(payment: OrderPaymentDetail) {
    setReverseError(null);
    try {
      await reverse.mutateAsync(payment.id);
    } catch (err) {
      setReverseError(errorMessage(err, 'Não foi possível estornar o pagamento.'));
    }
  }

  return (
    <SectionCard title="Pagamentos">
      {order.payments.length === 0 ? (
        <p className="text-sm text-muted">Nenhum pagamento registrado.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--color-soft-border)]">
          {order.payments.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {p.paymentMethodName ?? 'Pagamento'}
                </p>
                {p.description && (
                  <p className="truncate text-xs text-muted">{p.description}</p>
                )}
                <Chip
                  color={PAYMENT_STATUS_COLOR[p.status]}
                  variant="soft"
                  size="sm"
                  className="mt-1"
                >
                  {PAYMENT_STATUS_LABELS[p.status]}
                </Chip>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`text-sm font-semibold ${
                    p.status === 'reversed'
                      ? 'text-muted line-through'
                      : 'text-foreground'
                  }`}
                >
                  {formatMoney(p.amount)}
                </span>
                {p.status !== 'reversed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isDisabled={reverse.isPending}
                    onClick={() => handleReverse(p)}
                  >
                    Estornar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {reverseError && (
        <div className="mt-3">
          <FormError message={reverseError} />
        </div>
      )}

      {editable && (
        <div className="mt-3">
          {adding ? (
            <AddPaymentForm order={order} onDone={() => setAdding(false)} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <IconPlus size={16} /> Adicionar pagamento
            </Button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function AddPaymentForm({ order, onDone }: { order: OrderDetail; onDone: () => void }) {
  const add = useAddOrderPayment(order.id);
  const methods = usePaymentMethods();
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const methodList = useMemo(() => methods.data ?? [], [methods.data]);

  async function handleAdd() {
    setError(null);
    const value = parseAmount(amount);
    if (value === null || value <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      await add.mutateAsync({
        paymentMethodId: paymentMethodId || undefined,
        amount: value,
        description: description.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível adicionar o pagamento.'));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--color-soft-border)] p-3">
      <FieldLabel label="Forma de pagamento">
        <Select
          aria-label="Forma de pagamento"
          selectedKey={paymentMethodId || null}
          onSelectionChange={(k) => setPaymentMethodId(k ? String(k) : '')}
        >
          <Select.Trigger>
            <Select.Value>
              {({ isPlaceholder, selectedText }) =>
                isPlaceholder ? 'Selecione (opcional)' : selectedText
              }
            </Select.Value>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {methodList.map((m) => (
                <ListBox.Item key={m.id} id={m.id} textValue={m.name}>
                  {m.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </FieldLabel>
      <FieldLabel label="Valor (R$)">
        <TextField value={amount} onChange={setAmount} aria-label="Valor">
          <Input inputMode="decimal" placeholder="0,00" />
        </TextField>
      </FieldLabel>
      <FieldLabel label="Descrição (opcional)">
        <TextField value={description} onChange={setDescription} aria-label="Descrição">
          <Input placeholder="Ex.: Sinal" />
        </TextField>
      </FieldLabel>

      {error && <FormError message={error} />}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onDone}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="flex-1"
          isDisabled={add.isPending}
          onClick={handleAdd}
        >
          {add.isPending ? 'Registrando…' : 'Registrar'}
        </Button>
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}
