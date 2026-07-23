import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Spinner, TextField } from '@heroui/react';
import { Drawer } from './Drawer';
import { AppTabs } from './AppTabs';
import { IconBox, IconScissors, IconSearch } from './icons';
import { useServices } from '../lib/queries';
import { useProducts } from '../lib/queries/catalogo';
import { formatMoney } from '../lib/format';

/** An item chosen from the picker, ready to be staged on the comanda. */
export interface PickedItem {
  kind: 'service' | 'product';
  refId: string;
  name: string;
  unitPrice: number;
}

type Tab = 'service' | 'product';

/** Parse a user-typed amount ("12,50" or "12.50") into a finite number or null. */
function parseAmount(value: string): number | null {
  const n = Number(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
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
  mobileBackLabel,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: PickedItem) => void;
  /** Restringe o picker a Serviços (esconde a aba Produtos). Ex.: modelos de assinatura. */
  servicesOnly?: boolean;
  mobileBackLabel?: string;
}) {
  const [tab, setTab] = useState<Tab>('service');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  // Linha escolhida aguardando confirmação de preço. O input de preço é
  // pré-preenchido com o preço do catálogo (unitPrice) e permanece editável.
  const [selected, setSelected] = useState<PickedItem | null>(null);
  const [priceInput, setPriceInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTab('service');
      setSearch('');
      setDebounced('');
      setSelected(null);
      setPriceInput('');
    }
  }, [isOpen]);

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

  const productRows = useMemo(
    () => (products.data?.data ?? []).filter((p) => p.active !== false),
    [products.data],
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
      : productRows.map((p) => ({
          kind: 'product' as const,
          refId: p.id,
          name: p.name,
          unitPrice: Number(p.salePrice) || 0,
        }));

  /** Escolhe a linha e pré-preenche o input de preço com o preço do catálogo. */
  function pickRow(row: PickedItem) {
    setSelected(row);
    setPriceInput(String(row.unitPrice));
  }

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

          <div className="relative">
            <IconSearch
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tab === 'service' ? 'Buscar serviço' : 'Buscar produto'}
              aria-label="Buscar item"
              autoFocus
              className="h-11 min-h-11 w-full rounded-lg border border-black/15 bg-white pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
            />
          </div>

          {loading && rows.length === 0 && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted">
              <Spinner size="sm" /> Carregando…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="rounded-lg border border-dashed border-default-200 px-3 py-8 text-center text-sm text-muted">
              {tab === 'service' ? 'Nenhum serviço encontrado.' : 'Nenhum produto encontrado.'}
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
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cream text-primary/80">
                      {r.kind === 'service' ? <IconScissors size={17} /> : <IconBox size={17} />}
                    </span>
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
  );
}
