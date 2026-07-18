import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Chip,
  Input,
  ListBox,
  Modal,
  Select,
  Tabs,
  TextField,
} from '@heroui/react';
import { ApiClientError } from '@beautypass/shared';
import { PageHeader } from '../../components/PageHeader';
import { DataTable, type Column } from '../../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import {
  IconClock,
  IconEye,
  IconPlus,
  IconReceipt,
  IconTrash,
} from '../../components/icons';
import { formatDate, formatMoney, formatNumber, isoDate } from '../../lib/format';
import {
  useCreatePurchase,
  useDeletePurchase,
  useImportedXmls,
  usePurchase,
  usePurchases,
  type PurchaseRow,
} from '../../lib/queries/compras';
import { useProducts, useSuppliers } from '../../lib/queries/catalogo';
import {
  useFinancialAccounts,
  usePaymentMethods,
} from '../../lib/queries/financeiro';

const NONE = '';

/** Compras não têm número no schema — derivamos um ticket curto do id. */
function ticket(id: string) {
  return `#${id.slice(-6).toUpperCase()}`;
}

export function ComprasPage() {
  const [tab, setTab] = useState('compras');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const purchases = usePurchases(search || undefined);
  const deletePurchase = useDeletePurchase();

  const rows = purchases.data?.data ?? [];
  const total = purchases.data?.total ?? 0;
  const hasFilters = Boolean(search);

  function applySearch() {
    setSearch(searchInput.trim());
  }

  async function handleDelete(p: PurchaseRow) {
    if (
      !window.confirm(
        `Excluir a compra ${ticket(p.id)}? A entrada de estoque será estornada.`,
      )
    )
      return;
    try {
      await deletePurchase.mutateAsync(p.id);
    } catch (err) {
      window.alert(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível excluir a compra.',
      );
    }
  }

  const columns: Column<PurchaseRow>[] = [
    {
      key: 'ticket',
      header: 'Compra',
      isRowHeader: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-default-100 text-muted">
            <IconReceipt size={18} />
          </div>
          <div>
            <div className="font-semibold text-foreground">{ticket(p.id)}</div>
            <div className="text-xs text-muted">{formatDate(p.date)}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'supplier',
      header: 'Fornecedor',
      render: (p) =>
        p.supplier?.name ?? <span className="text-muted">Sem fornecedor</span>,
    },
    { key: 'date', header: 'Data', render: (p) => formatDate(p.date) },
    {
      key: 'items',
      header: 'Itens',
      render: (p) => formatNumber(p.itemsCount),
    },
    {
      key: 'total',
      header: 'Total',
      render: (p) => (
        <span className="font-semibold text-foreground">
          {formatMoney(p.total)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: () => (
        <Chip color="success" variant="soft" size="sm">
          Lançada
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            aria-label="Detalhes"
            onClick={() => setDetailId(p.id)}
          >
            <IconEye size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Excluir"
            className="text-danger"
            isDisabled={deletePurchase.isPending}
            onClick={() => handleDelete(p)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Compras"
        subtitle={
          total ? `${total} compra(s)` : 'Pedidos de compra e entrada de estoque'
        }
        onRefresh={() => purchases.refetch()}
        isRefreshing={purchases.isFetching}
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} /> Nova compra
          </Button>
        }
      />

      <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
        <Tabs.List className="w-full overflow-x-auto">
          <Tabs.Tab id="compras">Compras</Tabs.Tab>
          <Tabs.Tab id="xmls">XMLs Importados</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel id="compras" className="pt-4">
          <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
            <Card.Content className="p-4">
              <div className="mb-4 flex max-w-2xl flex-wrap items-center gap-2">
                <TextField
                  value={searchInput}
                  onChange={setSearchInput}
                  className="min-w-0 flex-1"
                  aria-label="Buscar compra"
                >
                  <Input
                    placeholder="Buscar por fornecedor…"
                    className="focus:border-[#f2b33d] focus:ring-2 focus:ring-[#f2b33d]/25"
                    onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                  />
                </TextField>
                <Button variant="primary" onClick={applySearch}>
                  Buscar
                </Button>
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchInput('');
                      setSearch('');
                    }}
                  >
                    Limpar
                  </Button>
                )}
              </div>

              {purchases.isLoading ? (
                <LoadingState />
              ) : purchases.isError ? (
                <ErrorState onRetry={() => purchases.refetch()} />
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={<IconReceipt size={32} />}
                  title="Nenhuma compra registrada"
                  description={
                    hasFilters
                      ? 'Nenhuma compra encontrada para a busca.'
                      : 'Registre a primeira compra para dar entrada no estoque.'
                  }
                  action={
                    !hasFilters && (
                      <Button variant="primary" onClick={() => setCreateOpen(true)}>
                        <IconPlus size={16} /> Nova compra
                      </Button>
                    )
                  }
                />
              ) : (
                <DataTable
                  aria-label="Compras"
                  columns={columns}
                  rows={rows}
                  getKey={(p) => p.id}
                />
              )}
            </Card.Content>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel id="xmls" className="pt-4">
          <XmlsTab />
        </Tabs.Panel>
      </Tabs>

      <NovaCompraModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      <DetalheCompraModal
        id={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

// =====================================================================
// Aba XMLs Importados — estado honesto (sem model ImportedXml no schema)
// =====================================================================

function XmlsTab() {
  const xmls = useImportedXmls();

  return (
    <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
      <Card.Content className="p-4">
        {xmls.isLoading ? (
          <LoadingState />
        ) : (
          <EmptyState
            icon={<IconClock size={32} />}
            title="Importação de XML em breve"
            description="A importação de NF-e (XML) para gerar compras automaticamente ainda não está disponível. Por enquanto, registre as compras manualmente na aba Compras."
          />
        )}
      </Card.Content>
    </Card>
  );
}

// =====================================================================
// Detalhe da compra
// =====================================================================

function DetalheCompraModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const detail = usePurchase(id ?? undefined);
  const p = detail.data;

  return (
    <Modal isOpen={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading>
                {id ? `Compra ${ticket(id)}` : 'Compra'}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {detail.isLoading ? (
                <LoadingState />
              ) : detail.isError || !p ? (
                <ErrorState onRetry={() => detail.refetch()} />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Info label="Fornecedor" value={p.supplier?.name ?? '—'} />
                    <Info label="Data" value={formatDate(p.date)} />
                    <Info label="Conta" value={p.account?.name ?? '—'} />
                    <Info
                      label="Forma de pagamento"
                      value={p.paymentMethod?.name ?? '—'}
                    />
                  </div>

                  <div className="rounded-lg border border-[var(--color-soft-border)]">
                    <div className="border-b border-[var(--color-soft-border)] px-3 py-2 text-xs font-semibold text-muted">
                      Itens
                    </div>
                    <ul className="divide-y divide-[var(--color-soft-border)]">
                      {p.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {it.product?.name ?? 'Produto'}
                            </div>
                            <div className="text-xs text-muted">
                              {formatNumber(Number(it.quantity))} ×{' '}
                              {formatMoney(it.unitCost)}
                            </div>
                          </div>
                          <div className="shrink-0 font-medium text-foreground">
                            {formatMoney(
                              Number(it.quantity) * Number(it.unitCost),
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-default-100 px-3 py-2">
                    <span className="text-sm font-medium text-muted">Total</span>
                    <span className="text-lg font-bold text-foreground">
                      {formatMoney(p.total)}
                    </span>
                  </div>

                  <p className="text-xs text-muted">
                    A entrada de estoque desta compra já foi lançada. Excluir a
                    compra estorna a entrada.
                  </p>
                </>
              )}
            </Modal.Body>
            <Modal.Footer className="flex justify-end">
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// =====================================================================
// Nova compra
// =====================================================================

interface DraftItem {
  productId: string;
  quantity: string;
  unitCost: string;
  discount: string;
}

function emptyItem(): DraftItem {
  return { productId: '', quantity: '1', unitCost: '', discount: '' };
}

function NovaCompraModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const create = useCreatePurchase();
  const suppliers = useSuppliers();
  const products = useProducts();
  const accounts = useFinancialAccounts();
  const methods = usePaymentMethods();

  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState(isoDate(new Date()));
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [freight, setFreight] = useState('');
  const [discount, setDiscount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSupplierId('');
    setDate(isoDate(new Date()));
    setItems([emptyItem()]);
    setFreight('');
    setDiscount('');
    setAccountId('');
    setPaymentMethodId('');
    setNotes('');
    setError(null);
  }, [isOpen]);

  const productOptions = (products.data?.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    costPrice: p.costPrice,
  }));

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function onPickProduct(index: number, productId: string) {
    const prod = productOptions.find((p) => p.id === productId);
    // pré-preenche o custo unitário com o custo cadastrado do produto
    updateItem(index, {
      productId,
      unitCost:
        prod && Number(prod.costPrice) > 0 ? String(prod.costPrice) : items[index].unitCost,
    });
  }

  function lineTotal(it: DraftItem) {
    const q = Number(it.quantity) || 0;
    const c = Number(it.unitCost) || 0;
    const d = Number(it.discount) || 0;
    return Math.max(0, q * c - d);
  }

  const grandTotal = useMemo(() => {
    const itemsSum = items.reduce((acc, it) => acc + lineTotal(it), 0);
    return Math.max(0, itemsSum + (Number(freight) || 0) - (Number(discount) || 0));
  }, [items, freight, discount]);

  const validItems = items.filter(
    (it) => it.productId && Number(it.quantity) > 0 && it.unitCost !== '',
  );
  const canSave = validItems.length > 0 && !create.isPending;

  async function handleSave() {
    setError(null);
    if (validItems.length === 0) {
      setError('Adicione ao menos um item com produto, quantidade e custo.');
      return;
    }
    try {
      await create.mutateAsync({
        supplierId: supplierId || undefined,
        date: new Date(`${date}T00:00:00`).toISOString(),
        items: validItems.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost),
          discount: it.discount !== '' ? Number(it.discount) : undefined,
        })),
        freight: freight !== '' ? Number(freight) : undefined,
        discount: discount !== '' ? Number(discount) : undefined,
        accountId: accountId || undefined,
        paymentMethodId: paymentMethodId || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível registrar a compra.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
        <Modal.Container size="lg" placement="center">
          <Modal.Dialog className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading>Nova compra</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fornecedor (opcional)">
                  <SelectField
                    ariaLabel="Fornecedor"
                    value={supplierId}
                    onChange={setSupplierId}
                    placeholder="Selecione o fornecedor"
                    options={(suppliers.data?.data ?? []).map((s) => ({
                      id: s.id,
                      name: s.name,
                    }))}
                  />
                </Field>
                <Field label="Data">
                  <TextField value={date} onChange={setDate} aria-label="Data">
                    <Input type="date" />
                  </TextField>
                </Field>
              </div>

              {/* Itens */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted">Itens</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItems((prev) => [...prev, emptyItem()])}
                  >
                    <IconPlus size={14} /> Adicionar item
                  </Button>
                </div>

                {items.map((it, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-[var(--color-soft-border)] bg-white p-3"
                  >
                    <div className="mb-2">
                      <SelectField
                        ariaLabel="Produto"
                        value={it.productId}
                        onChange={(v) => onPickProduct(index, v)}
                        placeholder="Selecione o produto"
                        options={productOptions.map((p) => ({
                          id: p.id,
                          name: p.name,
                        }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MiniField label="Qtd">
                        <TextField
                          value={it.quantity}
                          onChange={(v) => updateItem(index, { quantity: v })}
                          aria-label="Quantidade"
                        >
                          <Input type="number" min={0} placeholder="0" />
                        </TextField>
                      </MiniField>
                      <MiniField label="Custo un.">
                        <TextField
                          value={it.unitCost}
                          onChange={(v) => updateItem(index, { unitCost: v })}
                          aria-label="Custo unitário"
                        >
                          <Input type="number" min={0} placeholder="0,00" />
                        </TextField>
                      </MiniField>
                      <MiniField label="Desconto">
                        <TextField
                          value={it.discount}
                          onChange={(v) => updateItem(index, { discount: v })}
                          aria-label="Desconto do item"
                        >
                          <Input type="number" min={0} placeholder="0,00" />
                        </TextField>
                      </MiniField>
                      <MiniField label="Total">
                        <div className="flex h-9 items-center justify-between gap-1 rounded-md border border-[var(--color-soft-border)] bg-default-100 px-2 text-sm font-medium text-foreground">
                          <span className="truncate">
                            {formatMoney(lineTotal(it))}
                          </span>
                          {items.length > 1 && (
                            <button
                              type="button"
                              aria-label="Remover item"
                              className="text-danger"
                              onClick={() =>
                                setItems((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                            >
                              <IconTrash size={14} />
                            </button>
                          )}
                        </div>
                      </MiniField>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Frete (opcional)">
                  <TextField value={freight} onChange={setFreight} aria-label="Frete">
                    <Input type="number" min={0} placeholder="0,00" />
                  </TextField>
                </Field>
                <Field label="Desconto geral (opcional)">
                  <TextField
                    value={discount}
                    onChange={setDiscount}
                    aria-label="Desconto geral"
                  >
                    <Input type="number" min={0} placeholder="0,00" />
                  </TextField>
                </Field>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Conta de pagamento (opcional)">
                  <SelectField
                    ariaLabel="Conta de pagamento"
                    value={accountId}
                    onChange={setAccountId}
                    placeholder="Selecione a conta"
                    options={(accounts.data ?? []).map((a) => ({
                      id: a.id,
                      name: a.name,
                    }))}
                  />
                </Field>
                <Field label="Forma de pagamento (opcional)">
                  <SelectField
                    ariaLabel="Forma de pagamento"
                    value={paymentMethodId}
                    onChange={setPaymentMethodId}
                    placeholder="Selecione a forma"
                    options={(methods.data ?? []).map((m) => ({
                      id: m.id,
                      name: m.name,
                    }))}
                  />
                </Field>
              </div>

              <Field label="Observações (opcional)">
                <TextField value={notes} onChange={setNotes} aria-label="Observações">
                  <Input placeholder="Anotações sobre a compra" />
                </TextField>
              </Field>

              <div className="flex items-center justify-between rounded-lg bg-[#f2b33d]/15 px-3 py-2">
                <span className="text-sm font-medium text-[#a67c1e]">
                  Total da compra
                </span>
                <span className="text-lg font-bold text-foreground">
                  {formatMoney(grandTotal)}
                </span>
              </div>

              <p className="text-xs text-muted">
                Ao salvar, cada item dá entrada no estoque do produto
                correspondente.
              </p>

              {error && (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                isDisabled={!canSave}
                onClick={handleSave}
              >
                {create.isPending ? 'Salvando…' : 'Salvar compra'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

// =====================================================================
// Small UI helpers
// =====================================================================

interface Option {
  id: string;
  name: string;
}

function SelectField({
  ariaLabel,
  value,
  onChange,
  options,
  placeholder = 'Selecione',
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value || null}
      onSelectionChange={(k) => onChange(k ? String(k) : NONE)}
    >
      <Select.Trigger>
        <Select.Value>
          {({ isPlaceholder, selectedText }) =>
            isPlaceholder ? placeholder : selectedText
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
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function MiniField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
