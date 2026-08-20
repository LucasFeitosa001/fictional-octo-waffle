import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Spinner, TextField } from '@heroui/react';
import { Drawer } from './Drawer';
import { AppTabs } from './AppTabs';
import { BarcodeScanner } from './BarcodeScanner';
import { IconBox, IconQr, IconScissors, IconSearch, IconX } from './icons';
import { useServices } from '../lib/queries';
import { useProducts, type Product } from '../lib/queries/catalogo';
import { formatMoney } from '../lib/format';
import { toast } from '../lib/toast';

/** An item chosen from the picker, ready to be staged on the comanda. */
export interface PickedItem {
  kind: 'service' | 'product';
  refId: string;
  name: string;
  unitPrice: number;
  imageUrl?: string | null;
}

type Tab = 'service' | 'product';

/** Parse a user-typed amount ("12,50" or "12.50") into a finite number or null. */
function parseAmount(value: string): number | null {
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function toPickedProduct(product: Product): PickedItem {
  return {
    kind: 'product',
    refId: product.id,
    name: product.name,
    unitPrice: Number(product.salePrice) || 0,
    imageUrl: product.imageUrl,
  };
}

/**
 * Bottom-sheet (mobile) / lateral (desktop) drawer to add an item to a comanda.
 * Segmented by Serviços | Produtos, each row = icon + name + price. Opens ABOVE
 * the comanda drawer (`z-[90]`). Products search server-side; services filter
 * client-side (the /services endpoint takes no text query).
 *
 * Ao escolher uma linha, o preço do catálogo PRÉ-PREENCHE um input editável de
 * "Preço unit." (não commita direto): o dono confere/ajusta e confirma. Assim o
 * item nunca entra a R$0 e o preço do serviço/produto sempre vem preenchido.
 */
export function ItemPickerDrawer({
  isOpen,
  onClose,
  onSelect,
  servicesOnly = false,
  permitirScanner = false,
  mobileBackLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: PickedItem) => void;
  /** Restringe o picker a Serviços (esconde a aba Produtos). Ex.: modelos de assinatura. */
  servicesOnly?: boolean;
  /** Habilita leitura de código de barras. Desligado para preservar os demais fluxos. */
  permitirScanner?: boolean;
  mobileBackLabel?: string;
}) {
  const [tab, setTab] = useState<Tab>('service');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  // Linha escolhida aguardando confirmação de preço. O input de preço é
  // pré-preenchido com o preço do catálogo (unitPrice) e permanece editável.
  const [selected, setSelected] = useState<PickedItem | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [expandedImage, setExpandedImage] = useState<{ url: string; name: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab('service');
      setSearch('');
      setDebounced('');
      setSelected(null);
      setPriceInput('');
      setExpandedImage(null);
      setScannerOpen(false);
      setPendingBarcode(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!expandedImage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      // Intercepta o ESC antes do Drawer: a primeira tecla fecha só a foto.
      event.stopImmediatePropagation();
      setExpandedImage(null);
    };
    document.addEventListener('keydown', closeOnEscape, true);
    return () => document.removeEventListener('keydown', closeOnEscape, true);
  }, [expandedImage]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const services = useServices();
  const products = useProducts({ search: tab === 'product' ? debounced : undefined });

  const serviceRows = useMemo(() => {
    const all = services.data?.data ?? [];
    const q = debounced;
    return all
      .filter((s) => s.active !== false)
      .filter((s) => (q ? s.name.toLowerCase().includes(q) : true));
  }, [services.data, debounced]);

  const ativos = useMemo(
    () => (products.data?.data ?? []).filter((p) => p.active !== false),
    [products.data],
  );
  /**
   * Produto ESGOTADO sai da lista — não faz sentido oferecer o que não há para
   * vender. Só vale para quem o salão declarou controlar (`trackStock`): o
   * catálogo importado do Belasis está quase todo com saldo 0 sem controle
   * (346 de 346 na Fátima), e esconder por saldo deixaria o salão sem nada para
   * vender. Mesmo recorte que o backend usa para recusar a venda. Estudo 167.
   */
  const esgotados = useMemo(
    () => ativos.filter((p) => p.trackStock === true && Number(p.stock) <= 0),
    [ativos],
  );
  const productRows = useMemo(
    () => ativos.filter((p) => !(p.trackStock === true && Number(p.stock) <= 0)),
    [ativos],
  );

  const loading = tab === 'service'
    ? services.isLoading
    : products.isLoading || products.isFetching;

  const rows: PickedItem[] =
    tab === 'service'
      ? serviceRows.map((s) => ({
          kind: 'service' as const,
          refId: s.id,
          name: s.name,
          unitPrice: Number(s.price) || 0,
        }))
      : productRows.map(toPickedProduct);

  /** Escolhe a linha e pré-preenche o input de preço com o preço do catálogo. */
  function pickRow(row: PickedItem) {
    setSelected(row);
    setPriceInput(String(row.unitPrice));
  }

  function handleBarcode(code: string) {
    setSearch(code);
    setDebounced(code.trim().toLowerCase());
    setPendingBarcode(code);
    setScannerOpen(false);
  }

  useEffect(() => {
    if (
      !pendingBarcode ||
      tab !== 'product' ||
      products.isLoading ||
      products.isFetching
    ) return;

    if (productRows.length === 1) {
      // Reusa exatamente o caminho do clique: ainda permite conferir/editar o preço.
      pickRow(toPickedProduct(productRows[0]));
    } else if (productRows.length === 0) {
      toast.warning(`Código ${pendingBarcode} não encontrado`);
    }
    // Com múltiplos resultados, a lista filtrada permanece para escolha manual.
    setPendingBarcode(null);
  }, [pendingBarcode, productRows, products.isFetching, products.isLoading, tab]);

  /** Confirma com o preço (editado ou pré-preenchido) e fecha o picker. */
  function confirmSelected() {
    if (!selected) return;
    const parsed = parseAmount(priceInput);
    const unitPrice = parsed !== null && parsed >= 0 ? parsed : selected.unitPrice;
    onSelect({ ...selected, unitPrice });
    onClose();
  }

  const priceInvalid = (() => {
    const parsed = parseAmount(priceInput);
    return parsed === null || parsed < 0;
  })();

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Adicionar item"
        widthClass="sm:w-[480px]"
        zClass="z-[90]"
        mobileBackLabel={mobileBackLabel}
      >
      {selected ? (
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
          >
            ← Voltar para a lista
          </button>

          <div className="flex items-center gap-3 rounded-lg border border-default-200 bg-white px-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
              {selected.kind === 'service' ? <IconScissors size={17} /> : <IconBox size={17} />}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {selected.name}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Preço unit. (R$)</label>
            <TextField value={priceInput} onChange={setPriceInput} aria-label="Preço unitário">
              <Input inputMode="decimal" placeholder="0,00" autoFocus />
            </TextField>
            <p className="text-xs text-muted">
              Pré-preenchido com o preço do {selected.kind === 'service' ? 'serviço' : 'produto'}.
              Ajuste se necessário.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setSelected(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              isDisabled={priceInvalid}
              onClick={confirmSelected}
            >
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!servicesOnly && (
            <AppTabs
              items={[
                { id: 'service', label: 'Serviços', icon: <IconScissors size={16} /> },
                { id: 'product', label: 'Produtos', icon: <IconBox size={16} /> },
              ]}
              selectedKey={tab}
              onSelectionChange={setTab}
              ariaLabel="Tipos de item"
            />
          )}

          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <IconSearch
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPendingBarcode(null);
                }}
                placeholder={tab === 'service' ? 'Buscar serviço' : 'Buscar produto'}
                aria-label="Buscar item"
                autoFocus
                className="h-11 min-h-11 w-full rounded-lg border border-black/15 bg-white pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
              />
            </div>
            {/* Código de barras pertence ao catálogo de produtos, não a serviços. */}
            {permitirScanner && tab === 'product' && (
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                aria-label="Escanear código de barras"
                title="Escanear código de barras"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-black/15 bg-white text-primary transition-colors hover:bg-cream"
              >
                <IconQr size={20} />
              </button>
            )}
          </div>

          {loading && rows.length === 0 && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted">
              <Spinner size="sm" /> Carregando…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="rounded-lg border border-dashed border-default-200 px-3 py-8 text-center text-sm text-muted">
              {tab === 'service' ? (
                'Nenhum serviço encontrado.'
              ) : esgotados.length > 0 ? (
                /* Sem esta frase, a lista vazia parece defeito ("sumiram meus
                   produtos") em vez de estoque zerado. Ver estudo 167. */
                <>
                  Nenhum produto disponível.
                  <br />
                  <span className="text-xs">
                    {esgotados.length === 1
                      ? '1 produto está esgotado e foi ocultado.'
                      : `${esgotados.length} produtos estão esgotados e foram ocultados.`}
                  </span>
                </>
              ) : (
                'Nenhum produto encontrado.'
              )}
            </div>
          )}

          {rows.length > 0 && (
            <ul className="flex flex-col divide-y divide-default-200 overflow-hidden rounded-lg border border-default-200 bg-white">
              {rows.map((r) => (
                <li key={`${r.kind}-${r.refId}`}>
                  <button
                    type="button"
                    onClick={() => pickRow(r)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-cream"
                  >
                    {r.kind === 'product' ? (
                      <span className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-cream text-primary/80">
                        <IconBox size={19} />
                        {r.imageUrl && (
                          <img
                            src={r.imageUrl}
                            alt={`Foto de ${r.name}`}
                            title="Ampliar foto"
                            // Evita o conflito com o clique da linha, que adiciona o item à comanda.
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpandedImage({ url: r.imageUrl!, name: r.name });
                            }}
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                            className="absolute inset-0 h-full w-full cursor-zoom-in object-cover"
                          />
                        )}
                      </span>
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
                        <IconScissors size={17} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {r.name}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                      {formatMoney(r.unitPrice)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      </Drawer>

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetect={handleBarcode}
      />

      {expandedImage && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Foto ampliada de ${expandedImage.name}`}
          onClick={() => setExpandedImage(null)}
          className="fixed inset-0 z-[120] grid cursor-zoom-out place-items-center bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setExpandedImage(null)}
            aria-label="Fechar foto"
            className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70"
          >
            <IconX size={22} />
          </button>
          <img
            src={expandedImage.url}
            alt={`Foto ampliada de ${expandedImage.name}`}
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full cursor-default object-contain"
          />
        </div>,
        document.body,
      )}
    </>
  );
}
