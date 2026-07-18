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
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ImageUpload } from '../components/ImageUpload';
import {
  IconBox,
  IconDownload,
  IconPencil,
  IconPlus,
  IconStar,
  IconTrash,
} from '../components/icons';
import { formatMoney, formatNumber } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import {
  useBrands,
  useCreateProduct,
  useDeleteProduct,
  useProductCategories,
  useProducts,
  useStockMovement,
  useUpdateProduct,
  type Product,
  type StockMovementType,
} from '../lib/queries/catalogo';
import { useAutoCreate } from '../lib/useAutoCreate';

const NONE = '';

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProdutosPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  useAutoCreate(() => setCreateOpen(true));
  const [moveProduct, setMoveProduct] = useState<Product | null>(null);

  const products = useProducts({ search: search || undefined, lowStock });
  const categories = useProductCategories();
  const brands = useBrands();
  const deleteProduct = useDeleteProduct();

  const allRows = products.data?.data ?? [];
  const total = products.data?.total ?? 0;

  // Category/brand/favorites aren't supported server-side, so filter client-side.
  const rows = useMemo(
    () =>
      allRows.filter(
        (p) =>
          (!categoryFilter || p.categoryId === categoryFilter) &&
          (!brandFilter || p.brandId === brandFilter) &&
          (!favoritesOnly || p.favorite),
      ),
    [allRows, categoryFilter, brandFilter, favoritesOnly],
  );

  const hasFilters = Boolean(
    search || lowStock || categoryFilter || brandFilter || favoritesOnly,
  );

  function applySearch() {
    setSearch(searchInput.trim());
  }

  function exportCsv() {
    downloadCsv<Product>(
      'produtos',
      [
        { header: 'Produto', value: (p) => p.name },
        { header: 'Categoria', value: (p) => p.category?.name },
        { header: 'Marca', value: (p) => p.brand?.name },
        { header: 'Preço', value: (p) => Number(p.salePrice).toFixed(2) },
        { header: 'Custo', value: (p) => Number(p.costPrice).toFixed(2) },
        { header: 'Estoque', value: (p) => p.stock },
        { header: 'Estoque mínimo', value: (p) => p.minStock },
        { header: 'Cashback %', value: (p) => Number(p.cashbackPercent).toFixed(2) },
        { header: 'Favorito', value: (p) => (p.favorite ? 'Sim' : 'Não') },
        { header: 'Status', value: (p) => (p.active ? 'Ativo' : 'Inativo') },
      ],
      rows,
    );
  }

  function isLow(p: Product) {
    return Number(p.stock) <= Number(p.minStock);
  }

  async function handleDelete(p: Product) {
    if (!window.confirm(`Remover o produto "${p.name}"?`)) return;
    await deleteProduct.mutateAsync(p.id);
  }

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Produto',
      isRowHeader: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.imageUrl ? (
            <img
              src={p.imageUrl}
              alt={p.name}
              className="h-10 w-10 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-default-100 text-xs font-semibold text-muted">
              {initials(p.name) || <IconBox size={18} />}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              {p.favorite && (
                <IconStar
                  size={14}
                  className="fill-[#f2b33d] text-[#f2b33d]"
                  aria-label="Favorito"
                />
              )}
              {p.name}
            </div>
            {Number(p.cashbackPercent) > 0 && (
              <div className="text-xs text-muted">
                Cashback {formatNumber(Number(p.cashbackPercent))}%
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categoria',
      render: (p) =>
        p.category ? (
          <Chip variant="soft" color="accent" size="sm">
            {p.category.name}
          </Chip>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'brand',
      header: 'Marca',
      render: (p) => p.brand?.name ?? <span className="text-muted">—</span>,
    },
    { key: 'price', header: 'Preço', render: (p) => formatMoney(p.salePrice) },
    {
      key: 'stock',
      header: 'Estoque',
      render: (p) => {
        const qty = Number(p.stock);
        const low = isLow(p);
        return (
          <span
            className={
              qty === 0
                ? 'font-semibold text-danger'
                : 'font-semibold text-success'
            }
          >
            {formatNumber(qty)}
            {low && qty > 0 && (
              <Chip variant="soft" color="danger" size="sm" className="ml-2">
                Baixo
              </Chip>
            )}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setMoveProduct(p)}>
            <IconBox size={14} /> Estoque
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Editar"
            onClick={() => setEditing(p)}
          >
            <IconPencil size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Remover"
            className="text-danger"
            isDisabled={deleteProduct.isPending}
            onClick={() => handleDelete(p)}
          >
            <IconTrash size={14} />
          </Button>
        </div>
      ),
    },
  ];

  const categoryOptions = (categories.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));
  const brandOptions = (brands.data ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle={total ? `${total} produto(s)` : 'Catálogo de produtos'}
        onRefresh={() => products.refetch()}
        isRefreshing={products.isFetching}
        actions={
          <>
            <Button
              variant="outline"
              onClick={exportCsv}
              isDisabled={rows.length === 0}
            >
              <IconDownload size={16} /> Exportar CSV
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <IconPlus size={16} /> Novo produto
            </Button>
          </>
        }
      />

      <Card className="border border-[var(--color-soft-border)] bg-[#fffdf8] shadow-[var(--shadow-card)]">
        <Card.Content className="p-4">
          <div className="mb-3 flex max-w-2xl flex-wrap items-center gap-2">
            <TextField
              value={searchInput}
              onChange={setSearchInput}
              className="min-w-0 flex-1"
              aria-label="Buscar produto"
            >
              <Input
                placeholder="Buscar produto…"
                className="focus:border-[#f2b33d] focus:ring-2 focus:ring-[#f2b33d]/25"
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              />
            </TextField>
            <Button variant="primary" onClick={applySearch}>
              Buscar
            </Button>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <FilterSelect
              ariaLabel="Filtrar por categoria"
              placeholder="Categoria"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categories.data ?? []}
            />
            <FilterSelect
              ariaLabel="Filtrar por marca"
              placeholder="Marca"
              value={brandFilter}
              onChange={setBrandFilter}
              options={brands.data ?? []}
            />
            <FilterToggle
              active={lowStock}
              onClick={() => setLowStock((v) => !v)}
            >
              Estoque baixo
            </FilterToggle>
            <FilterToggle
              active={favoritesOnly}
              onClick={() => setFavoritesOnly((v) => !v)}
            >
              Favoritos
            </FilterToggle>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setLowStock(false);
                  setCategoryFilter('');
                  setBrandFilter('');
                  setFavoritesOnly(false);
                }}
              >
                Limpar
              </Button>
            )}
          </div>

          {products.isLoading ? (
            <LoadingState />
          ) : products.isError ? (
            <ErrorState onRetry={() => products.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<IconBox size={32} />}
              title="Nenhum produto encontrado"
              description={
                hasFilters
                  ? 'Tente ajustar os filtros.'
                  : 'Cadastre seu primeiro produto.'
              }
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-muted">
                {formatNumber(rows.length)} de {formatNumber(total)} produto(s)
              </p>
              <DataTable
                aria-label="Produtos"
                columns={columns}
                rows={rows}
                getKey={(p) => p.id}
              />
            </>
          )}
        </Card.Content>
      </Card>

      <ProductModal
        mode="create"
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categoryOptions}
        brands={brandOptions}
      />
      <ProductModal
        mode="edit"
        product={editing}
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        categories={categoryOptions}
        brands={brandOptions}
      />

      <StockMovementModal
        product={moveProduct}
        onClose={() => setMoveProduct(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------

interface Option {
  id: string;
  name: string;
}

// Campos adicionais do produto ainda não tipados no client compartilhado
// (@beautypass/shared / lib/queries/catalogo). Vêm como Decimal string da API.
type ProductExtraFields = {
  employeePrice?: string | null;
  additionalCost?: string | null;
  unit?: string | null;
  unitEquivalence?: string | null;
  itemCode?: string | null;
  barcode?: string | null;
  observation?: string | null;
  defaultCommissionPercent?: string | null;
};

function ProductModal({
  mode,
  product,
  isOpen,
  onClose,
  categories,
  brands,
}: {
  mode: 'create' | 'edit';
  product?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  categories: Option[];
  brands: Option[];
}) {
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [employeePrice, setEmployeePrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [additionalCost, setAdditionalCost] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [unit, setUnit] = useState('');
  const [unitEquivalence, setUnitEquivalence] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [observation, setObservation] = useState('');
  const [cashbackPercent, setCashbackPercent] = useState('');
  const [defaultCommissionPercent, setDefaultCommissionPercent] = useState('');
  const [active, setActive] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [tab, setTab] = useState('cadastro');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const extra = (product ?? null) as (Product & ProductExtraFields) | null;
    setImageUrl(product?.imageUrl ?? null);
    setName(product?.name ?? '');
    setCategoryId(product?.categoryId ?? '');
    setBrandId(product?.brandId ?? '');
    setSalePrice(product ? String(product.salePrice) : '');
    setEmployeePrice(extra?.employeePrice != null ? String(extra.employeePrice) : '');
    setCostPrice(product ? String(product.costPrice) : '');
    setAdditionalCost(extra?.additionalCost != null ? String(extra.additionalCost) : '');
    setStock(product ? String(product.stock) : '');
    setMinStock(product ? String(product.minStock) : '');
    setUnit(extra?.unit ?? '');
    setUnitEquivalence(
      extra?.unitEquivalence != null ? String(extra.unitEquivalence) : '',
    );
    setItemCode(extra?.itemCode ?? '');
    setBarcode(extra?.barcode ?? '');
    setObservation(extra?.observation ?? '');
    setCashbackPercent(product ? String(product.cashbackPercent) : '');
    setDefaultCommissionPercent(
      extra?.defaultCommissionPercent != null
        ? String(extra.defaultCommissionPercent)
        : '',
    );
    setActive(product?.active ?? true);
    setFavorite(product?.favorite ?? false);
    setTab('cadastro');
    setError(null);
  }, [isOpen, product]);

  const pending = create.isPending || update.isPending;
  const canSave =
    name.trim().length >= 2 && salePrice !== '' && Number(salePrice) >= 0 && !pending;

  async function handleSave() {
    setError(null);
    const body = {
      name: name.trim(),
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      imageUrl,
      salePrice: Number(salePrice),
      employeePrice: employeePrice !== '' ? Number(employeePrice) : undefined,
      costPrice: costPrice ? Number(costPrice) : undefined,
      additionalCost: additionalCost !== '' ? Number(additionalCost) : undefined,
      minStock: minStock ? Number(minStock) : undefined,
      unit: unit.trim() || undefined,
      unitEquivalence:
        unitEquivalence !== '' ? Number(unitEquivalence) : undefined,
      itemCode: itemCode.trim() || undefined,
      barcode: barcode.trim() || undefined,
      observation: observation.trim() || undefined,
      cashbackPercent: cashbackPercent !== '' ? Number(cashbackPercent) : undefined,
      defaultCommissionPercent:
        defaultCommissionPercent !== ''
          ? Number(defaultCommissionPercent)
          : undefined,
      favorite,
    };
    try {
      if (mode === 'edit' && product) {
        await update.mutateAsync({
          id: product.id,
          body: { ...body, stock: stock !== '' ? Number(stock) : undefined, active },
        });
      } else {
        await create.mutateAsync({
          ...body,
          stock: stock ? Number(stock) : undefined,
        });
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível salvar o produto.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container size="lg" placement="center">
        <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <Modal.Header>
            <Modal.Heading>
              {mode === 'edit' ? 'Editar produto' : 'Novo produto'}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(String(k))}>
              <Tabs.List className="w-full overflow-x-auto">
                <Tabs.Tab id="cadastro">Cadastro</Tabs.Tab>
                <Tabs.Tab id="config">Configurações</Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel id="cadastro" className="flex flex-col gap-4 pt-4">
                <ImageUpload
                  value={imageUrl}
                  onChange={setImageUrl}
                  kind="product"
                  shape="square"
                  size={88}
                  label="Imagem do produto"
                  placeholder="Foto"
                />

                <Field label="Nome">
                  <TextField value={name} onChange={setName} aria-label="Nome">
                    <Input placeholder="Nome do produto" />
                  </TextField>
                </Field>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Categoria (opcional)">
                    <SelectField
                      ariaLabel="Categoria"
                      value={categoryId}
                      onChange={setCategoryId}
                      options={categories}
                    />
                  </Field>
                  <Field label="Marca (opcional)">
                    <SelectField
                      ariaLabel="Marca"
                      value={brandId}
                      onChange={setBrandId}
                      options={brands}
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Preço de venda">
                    <TextField value={salePrice} onChange={setSalePrice} aria-label="Preço de venda">
                      <Input type="number" placeholder="0,00" />
                    </TextField>
                  </Field>
                  <Field label="Preço de custo">
                    <TextField value={costPrice} onChange={setCostPrice} aria-label="Preço de custo">
                      <Input type="number" placeholder="0,00" />
                    </TextField>
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Preço para profissional">
                    <TextField
                      value={employeePrice}
                      onChange={setEmployeePrice}
                      aria-label="Preço para profissional"
                    >
                      <Input type="number" placeholder="0,00" />
                    </TextField>
                  </Field>
                  <Field label="Custo adicional">
                    <TextField
                      value={additionalCost}
                      onChange={setAdditionalCost}
                      aria-label="Custo adicional"
                    >
                      <Input type="number" placeholder="0,00" />
                    </TextField>
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Estoque">
                    <TextField value={stock} onChange={setStock} aria-label="Estoque">
                      <Input type="number" placeholder="0" />
                    </TextField>
                  </Field>
                  <Field label="Estoque mínimo">
                    <TextField value={minStock} onChange={setMinStock} aria-label="Estoque mínimo">
                      <Input type="number" placeholder="0" />
                    </TextField>
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Unidade">
                    <TextField value={unit} onChange={setUnit} aria-label="Unidade">
                      <Input placeholder="un, ml, g…" />
                    </TextField>
                  </Field>
                  <Field label="1 unidade equivale a">
                    <TextField
                      value={unitEquivalence}
                      onChange={setUnitEquivalence}
                      aria-label="1 unidade equivale a"
                    >
                      <Input type="number" placeholder="0" />
                    </TextField>
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Código do item">
                    <TextField
                      value={itemCode}
                      onChange={setItemCode}
                      aria-label="Código do item"
                    >
                      <Input placeholder="Código interno" />
                    </TextField>
                  </Field>
                  <Field label="Código de barras">
                    <TextField
                      value={barcode}
                      onChange={setBarcode}
                      aria-label="Código de barras"
                    >
                      <Input placeholder="EAN / GTIN" />
                    </TextField>
                  </Field>
                </div>
              </Tabs.Panel>

              <Tabs.Panel id="config" className="flex flex-col gap-4 pt-4">
                <Field label="Cashback (%)">
                  <TextField
                    value={cashbackPercent}
                    onChange={setCashbackPercent}
                    aria-label="Cashback"
                  >
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="0"
                    />
                  </TextField>
                  <span className="text-xs text-muted">
                    Percentual de cashback concedido ao cliente nas compras deste produto.
                  </span>
                </Field>

                <Field label="Comissão padrão (%)">
                  <TextField
                    value={defaultCommissionPercent}
                    onChange={setDefaultCommissionPercent}
                    aria-label="Comissão padrão"
                  >
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      placeholder="0"
                    />
                  </TextField>
                  <span className="text-xs text-muted">
                    Percentual de comissão aplicado ao profissional na venda deste produto.
                  </span>
                </Field>

                <Field label="Observações">
                  <TextField
                    value={observation}
                    onChange={setObservation}
                    aria-label="Observações"
                  >
                    <Input placeholder="Anotações internas sobre o produto" />
                  </TextField>
                </Field>

                <div className="flex flex-col gap-3 rounded-md border border-[var(--color-soft-border)] bg-[#fffdf8] p-3">
                  <Toggle label="Favorito" checked={favorite} onChange={setFavorite} />
                  <span className="text-xs text-muted">
                    Produtos favoritos aparecem no topo da listagem.
                  </span>
                  {mode === 'edit' && (
                    <>
                      <Toggle label="Ativo" checked={active} onChange={setActive} />
                      <span className="text-xs text-muted">
                        Produtos inativos ficam ocultos nas vendas, mas mantêm o histórico.
                      </span>
                    </>
                  )}
                </div>
              </Tabs.Panel>
            </Tabs>

            {error && (
              <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              isDisabled={!canSave}
              onClick={handleSave}
            >
              {pending ? 'Salvando…' : 'Salvar'}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function StockMovementModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const move = useStockMovement();
  const [type, setType] = useState<StockMovementType>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isOpen = Boolean(product);

  useEffect(() => {
    if (product) {
      setType('in');
      setQuantity('');
      setReason('');
      setError(null);
    }
  }, [product]);

  const canSave = product != null && quantity !== '' && Number(quantity) >= 0;

  async function handleSave() {
    if (!product) return;
    setError(null);
    try {
      await move.mutateAsync({
        id: product.id,
        body: { type, quantity: Number(quantity), reason: reason.trim() || undefined },
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Não foi possível registrar a movimentação.',
      );
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Backdrop>
      <Modal.Container size="md" placement="center">
        <Modal.Dialog className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <Modal.Header>
            <Modal.Heading>Movimentar estoque</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {product && (
              <p className="text-sm text-muted">
                {product.name} — estoque atual:{' '}
                <span className="font-medium text-foreground">
                  {formatNumber(Number(product.stock))}
                </span>
              </p>
            )}

            <Field label="Tipo">
              <Select
                aria-label="Tipo de movimentação"
                selectedKey={type}
                onSelectionChange={(k) => setType((k ? String(k) : 'in') as StockMovementType)}
              >
                <Select.Trigger>
                  <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="in" textValue="Entrada">
                      Entrada
                    </ListBox.Item>
                    <ListBox.Item id="out" textValue="Saída">
                      Saída
                    </ListBox.Item>
                    <ListBox.Item id="adjust" textValue="Ajuste">
                      Ajuste (define o estoque)
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            </Field>

            <Field label="Quantidade">
              <TextField value={quantity} onChange={setQuantity} aria-label="Quantidade">
                <Input type="number" placeholder="0" />
              </TextField>
            </Field>

            <Field label="Motivo (opcional)">
              <TextField value={reason} onChange={setReason} aria-label="Motivo">
                <Input placeholder="Ex.: compra, venda, perda…" />
              </TextField>
            </Field>

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
              isDisabled={!canSave || move.isPending}
              onClick={handleSave}
            >
              {move.isPending ? 'Salvando…' : 'Registrar'}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function SelectField({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
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
  );
}

function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={
        active
          ? 'border-[#f2b33d] bg-[#f2b33d] text-[#3a2a06] shadow-[var(--shadow-gold)] hover:bg-[#f2b33d]'
          : ''
      }
    >
      {children}
    </Button>
  );
}

function FilterSelect({
  ariaLabel,
  placeholder,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value || null}
      onSelectionChange={(k) => onChange(k ? String(k) : NONE)}
      className={value ? 'min-w-[10rem]' : 'min-w-[10rem]'}
    >
      <Select.Trigger
        className={
          value
            ? 'border-[#f2b33d] bg-[#f2b33d]/15 text-[#a67c1e]'
            : undefined
        }
      >
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
