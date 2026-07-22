import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiClientError } from '@beautypass/shared';
import { Button } from '@heroui/react';
import { Drawer } from './Drawer';
import { IconPlus, IconTrash } from './icons';
import { formatMoney } from '../lib/format';
import type { OrderItemDetail } from '../lib/types';
import {
  useAddConsumedProduct,
  useAddOrderItemAuxiliary,
  useProductBatches,
  useRemoveConsumedProduct,
  useRemoveOrderItemAuxiliary,
  useUpdateOrderItem,
} from '../lib/queries';
import { useProducts } from '../lib/queries/catalogo';

type Professional = { id: string; name: string };

const inputCls =
  'h-11 w-full rounded-lg border border-default-200 bg-white px-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary disabled:cursor-not-allowed disabled:opacity-60';

/** Parse "12,50"/"12.50" → finite number, or 0. */
function parseNum(value: string): number {
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Vertical field (label above control). */
function Field({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      <label className="text-xs font-medium text-muted-ink">{label}</label>
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

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="inline-flex gap-1 self-start rounded-lg border border-[var(--color-soft-border)] bg-canvas p-0.5 text-sm">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={[
            'rounded-md px-3 py-1.5 font-medium transition-colors',
            active === t.id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-ink hover:text-foreground',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Editar item da comanda — drawer com abas (Belasis item-edit).
 *
 * - Item de SERVIÇO → Dados | Auxiliares | Produtos consumidos.
 * - Item de PRODUTO → Dados | Lote.
 *
 * Dados/Lote salvam via PATCH /orders/:id/items/:itemId (o "Salvar" do rodapé).
 * Auxiliares e Produtos consumidos têm add/remove próprios (mutam na hora e
 * reinvalidam a comanda; baixa/estorno de estoque no consumo).
 *
 * Mobile: o Drawer já sobe como bottom-sheet (<md). zClass z-[90] p/ empilhar
 * acima do "Ver comanda".
 */
export function ItemEditDrawer({
  orderId,
  item,
  professionals,
  editable = true,
  onClose,
}: {
  orderId: string;
  item: OrderItemDetail | null;
  professionals: Professional[];
  editable?: boolean;
  onClose: () => void;
}) {
  const isProduct = item?.kind === 'product';
  const tabs = useMemo(
    () =>
      isProduct
        ? [
            { id: 'dados', label: 'Dados' },
            { id: 'lote', label: 'Lote' },
          ]
        : [
            { id: 'dados', label: 'Dados' },
            { id: 'auxiliares', label: 'Auxiliares' },
            { id: 'consumidos', label: 'Produtos consumidos' },
          ],
    [isProduct],
  );

  const [tab, setTab] = useState('dados');

  // ---- aba Dados (+ Lote via batchId) ----
  const [professionalId, setProfessionalId] = useState('');
  const [unitPrice, setUnitPrice] = useState('0');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');
  const [discountType, setDiscountType] = useState<'value' | 'percent'>('value');
  const [batchId, setBatchId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = useUpdateOrderItem(orderId);
  // Lotes do próprio item (só produtos têm lote).
  const batchesQ = useProductBatches(isProduct ? item?.refId : undefined);
  const batches = useMemo(() => batchesQ.data ?? [], [batchesQ.data]);

  // Seed do formulário só quando o item (id) muda — não reseta em refetches
  // disparados por add/remove de auxiliares/consumidos.
  useEffect(() => {
    if (!item) return;
    setTab('dados');
    setProfessionalId(item.professionalId ?? '');
    setUnitPrice(String(Number(item.unitPrice)));
    setQuantity(String(Number(item.quantity)));
    setDiscount(String(Number(item.discount)));
    setDiscountType('value');
    setBatchId(item.batchId ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const qtyN = Math.max(0.001, parseNum(quantity) || 1);
  const priceN = Math.max(0, parseNum(unitPrice));
  const gross = qtyN * priceN;
  const effectiveDiscount =
    discountType === 'percent'
      ? (gross * Math.min(100, Math.max(0, parseNum(discount)))) / 100
      : Math.max(0, parseNum(discount));
  const total = Math.max(0, gross - effectiveDiscount);

  async function handleSave() {
    if (!item) return;
    setError(null);
    try {
      await update.mutateAsync({
        itemId: item.id,
        body: {
          professionalId: professionalId || undefined,
          unitPrice: priceN,
          quantity: qtyN,
          discount: Math.round(effectiveDiscount * 100) / 100,
          // batchId só faz sentido em itens de produto.
          ...(isProduct ? { batchId: batchId || null } : {}),
        },
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível salvar o item.',
      );
    }
  }

  return (
    <Drawer
      isOpen={item != null}
      onClose={onClose}
      title={item?.itemName ?? 'Editar item'}
      widthClass="sm:w-[520px]"
      zClass="z-[90]"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {editable && (tab === 'dados' || tab === 'lote') && (
            <Button variant="primary" isDisabled={update.isPending} onClick={handleSave}>
              {update.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          )}
        </>
      }
    >
      {item && (
        <div className="flex flex-col gap-4">
          <TabBar tabs={tabs} active={tab} onChange={setTab} />

          {/* ---------------- Dados ---------------- */}
          {tab === 'dados' && (
            <div className="flex flex-col gap-4">
              <Field label="Profissional">
                <select
                  value={professionalId}
                  onChange={(e) => setProfessionalId(e.target.value)}
                  aria-label="Profissional"
                  disabled={!editable}
                  className={inputCls}
                >
                  <option value="">Sem profissional</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Preço (R$)">
                  <input
                    inputMode="decimal"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    aria-label="Preço"
                    disabled={!editable}
                    className={inputCls}
                  />
                </Field>
                <Field label="Quantidade">
                  <input
                    inputMode="decimal"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    aria-label="Quantidade"
                    disabled={!editable}
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Desconto">
                <div className="flex items-stretch gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'value' | 'percent')}
                    aria-label="Tipo de desconto"
                    disabled={!editable}
                    className="h-11 w-20 shrink-0 rounded-lg border border-default-200 bg-white px-2 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
                  >
                    <option value="value">R$</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    inputMode="decimal"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    aria-label="Valor do desconto"
                    disabled={!editable}
                    className={inputCls}
                  />
                </div>
              </Field>

              <div className="flex items-center justify-between border-t border-[var(--color-soft-border)] pt-3">
                <span className="text-sm text-muted-ink">Total</span>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {formatMoney(total)}
                </span>
              </div>
            </div>
          )}

          {/* ---------------- Lote (produto) ---------------- */}
          {tab === 'lote' && isProduct && (
            <div className="flex flex-col gap-4">
              <Field label="Lote">
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  aria-label="Lote"
                  disabled={!editable || batchesQ.isLoading}
                  className={inputCls}
                >
                  <option value="">
                    {batchesQ.isLoading ? 'Carregando…' : 'Sem lote'}
                  </option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code}
                      {Number(b.quantity) > 0 ? ` · ${Number(b.quantity)} un.` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {batches.length === 0 && !batchesQ.isLoading && (
                <p className="text-xs text-muted">
                  Nenhum lote cadastrado para este produto.
                </p>
              )}
            </div>
          )}

          {/* ---------------- Auxiliares (serviço) ---------------- */}
          {tab === 'auxiliares' && !isProduct && (
            <AuxiliariesTab orderId={orderId} item={item} professionals={professionals} />
          )}

          {/* ---------------- Produtos consumidos (serviço) ---------------- */}
          {tab === 'consumidos' && !isProduct && (
            <ConsumedTab orderId={orderId} item={item} />
          )}

          {error && <FormError message={error} />}
        </div>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Aba Auxiliares — rateio de comissão (Profissional + "Desconto do" +
// "Valor" %/R$ + "De" Comissão do profissional). Não altera o total.
// ---------------------------------------------------------------------------

function AuxiliariesTab({
  orderId,
  item,
  professionals,
}: {
  orderId: string;
  item: OrderItemDetail;
  professionals: Professional[];
}) {
  const add = useAddOrderItemAuxiliary(orderId);
  const remove = useRemoveOrderItemAuxiliary(orderId);
  const list = item.auxiliaries ?? [];

  const [professionalId, setProfessionalId] = useState('');
  const [discountFrom, setDiscountFrom] = useState<'establishment' | 'professional'>(
    'establishment',
  );
  const [valueType, setValueType] = useState<'percent' | 'value'>('percent');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const professionalName = (id: string) =>
    professionals.find((p) => p.id === id)?.name ?? 'Profissional';

  async function handleAdd() {
    setError(null);
    if (!professionalId) {
      setError('Selecione o profissional auxiliar.');
      return;
    }
    const v = parseNum(value);
    if (v <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    try {
      await add.mutateAsync({
        itemId: item.id,
        body: { professionalId, discountFrom, valueType, value: v },
      });
      setProfessionalId('');
      setValue('');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível adicionar o auxiliar.',
      );
    }
  }

  async function handleRemove(auxId: string) {
    setError(null);
    try {
      await remove.mutateAsync({ itemId: item.id, auxId });
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Não foi possível remover o auxiliar.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lista de auxiliares. */}
      {list.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
          {list.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-2 border-b border-[var(--color-soft-border)] px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {a.professionalName ?? professionalName(a.professionalId)}
                </div>
                <div className="text-xs text-muted">
                  Desconto do{' '}
                  {a.discountFrom === 'establishment' ? 'estabelecimento' : 'profissional'} ·{' '}
                  {a.valueType === 'percent'
                    ? `${Number(a.value)}%`
                    : formatMoney(a.value)}
                </div>
              </div>
              <button
                type="button"
                aria-label="Remover auxiliar"
                onClick={() => handleRemove(a.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-ink transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <IconTrash size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulário de adição. */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3">
        <Field label="Profissional">
          <select
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            aria-label="Profissional auxiliar"
            className={inputCls}
          >
            <option value="">Selecionar profissional</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Desconto do">
          <select
            value={discountFrom}
            onChange={(e) =>
              setDiscountFrom(e.target.value as 'establishment' | 'professional')
            }
            aria-label="Desconto do"
            className={inputCls}
          >
            <option value="establishment">Estabelecimento</option>
            <option value="professional">Profissional</option>
          </select>
        </Field>

        <Field label="Valor">
          <div className="flex items-stretch gap-2">
            <select
              value={valueType}
              onChange={(e) => setValueType(e.target.value as 'percent' | 'value')}
              aria-label="Tipo do valor"
              className="h-11 w-20 shrink-0 rounded-lg border border-default-200 bg-white px-2 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="percent">%</option>
              <option value="value">R$</option>
            </select>
            <input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={valueType === 'percent' ? '0' : '0,00'}
              aria-label="Valor do rateio"
              className={inputCls}
            />
          </div>
        </Field>

        <Field label="De">
          {/* "De" = origem do rateio (Comissão do profissional). Fixo no MVP. */}
          <select disabled aria-label="De" className={inputCls}>
            <option>Comissão do profissional</option>
          </select>
        </Field>

        {error && <FormError message={error} />}

        <Button variant="outline" isDisabled={add.isPending} onClick={handleAdd}>
          <IconPlus size={16} /> {add.isPending ? 'Adicionando…' : 'Adicionar auxiliar'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aba Produtos consumidos — Produto + Valor + Lote + Unidade/Extra + Total.
// Baixa estoque (add) / estorna (remove). Fora do total da comanda.
// ---------------------------------------------------------------------------

function ConsumedTab({ orderId, item }: { orderId: string; item: OrderItemDetail }) {
  const add = useAddConsumedProduct(orderId);
  const remove = useRemoveConsumedProduct(orderId);
  const productsQ = useProducts();
  const products = useMemo(() => productsQ.data?.data ?? [], [productsQ.data]);
  const list = item.consumedProducts ?? [];

  const [productId, setProductId] = useState('');
  const [unitValue, setUnitValue] = useState('0');
  const [batchId, setBatchId] = useState('');
  const [unitQty, setUnitQty] = useState('1');
  const [extraQty, setExtraQty] = useState('0');
  const [error, setError] = useState<string | null>(null);

  // Lotes do produto selecionado.
  const batchesQ = useProductBatches(productId || undefined);
  const batches = useMemo(() => batchesQ.data ?? [], [batchesQ.data]);

  // Ao trocar o produto, herda o custo como "Valor" e limpa o lote.
  useEffect(() => {
    if (!productId) return;
    const p = products.find((x) => x.id === productId);
    if (p) setUnitValue(String(Number(p.costPrice)));
    setBatchId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const qtyN = Math.max(0, parseNum(unitQty));
  const valueN = Math.max(0, parseNum(unitValue));
  const total = qtyN * valueN;

  async function handleAdd() {
    setError(null);
    if (!productId) {
      setError('Selecione o produto.');
      return;
    }
    if (qtyN <= 0) {
      setError('Informe a quantidade (Unidade).');
      return;
    }
    try {
      await add.mutateAsync({
        itemId: item.id,
        body: {
          productId,
          quantity: qtyN,
          unitValue: valueN,
          batchId: batchId || undefined,
          extraQuantity: Math.max(0, parseNum(extraQty)) || undefined,
        },
      });
      setProductId('');
      setUnitValue('0');
      setBatchId('');
      setUnitQty('1');
      setExtraQty('0');
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível adicionar o produto consumido.',
      );
    }
  }

  async function handleRemove(consumedId: string) {
    setError(null);
    try {
      await remove.mutateAsync({ itemId: item.id, consumedId });
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível remover o produto consumido.',
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Lista de consumidos. */}
      {list.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[var(--color-soft-border)]">
          {list.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 border-b border-[var(--color-soft-border)] px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {c.productName ?? 'Produto'}
                </div>
                <div className="text-xs text-muted">
                  {Number(c.quantity)} {c.unit ?? 'un.'}
                  {Number(c.extraQuantity) > 0 && ` (+${Number(c.extraQuantity)} extra)`}
                  {c.batchCode && ` · Lote ${c.batchCode}`}
                  {` · ${formatMoney(Number(c.unitValue) * Number(c.quantity))}`}
                </div>
              </div>
              <button
                type="button"
                aria-label="Remover produto consumido"
                onClick={() => handleRemove(c.id)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-ink transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <IconTrash size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulário de adição. */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-soft-border)] bg-canvas p-3">
        <Field label="Produto">
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            aria-label="Produto"
            disabled={productsQ.isLoading}
            className={inputCls}
          >
            <option value="">
              {productsQ.isLoading ? 'Carregando…' : 'Selecionar produto'}
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Valor (R$)">
          <input
            inputMode="decimal"
            value={unitValue}
            onChange={(e) => setUnitValue(e.target.value)}
            aria-label="Valor"
            className={inputCls}
          />
        </Field>

        <Field label="Lote">
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            aria-label="Lote"
            disabled={!productId || batchesQ.isLoading}
            className={inputCls}
          >
            <option value="">{batchesQ.isLoading ? 'Carregando…' : 'Sem lote'}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code}
                {Number(b.quantity) > 0 ? ` · ${Number(b.quantity)} un.` : ''}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Unidade">
            <input
              inputMode="decimal"
              value={unitQty}
              onChange={(e) => setUnitQty(e.target.value)}
              aria-label="Unidade"
              className={inputCls}
            />
          </Field>
          <Field label="Extra">
            <input
              inputMode="decimal"
              value={extraQty}
              onChange={(e) => setExtraQty(e.target.value)}
              aria-label="Extra"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--color-soft-border)] pt-3">
          <span className="text-sm text-muted-ink">Total</span>
          <span className="text-base font-bold tabular-nums text-foreground">
            {formatMoney(total)}
          </span>
        </div>

        {error && <FormError message={error} />}

        <Button variant="outline" isDisabled={add.isPending} onClick={handleAdd}>
          <IconPlus size={16} /> {add.isPending ? 'Adicionando…' : 'Adicionar produto'}
        </Button>
      </div>
    </div>
  );
}
