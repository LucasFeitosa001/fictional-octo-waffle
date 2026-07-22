import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@heroui/react';
import { Drawer } from './Drawer';
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

/**
 * Bottom-sheet (mobile) / lateral (desktop) drawer to add an item to a comanda.
 * Segmented by Serviços | Produtos, each row = icon + name + price. Opens ABOVE
 * the comanda drawer (`z-[90]`). Products search server-side; services filter
 * client-side (the /services endpoint takes no text query).
 */
export function ItemPickerDrawer({
  isOpen,
  onClose,
  onSelect,
  servicesOnly = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: PickedItem) => void;
  /** Restringe o picker a Serviços (esconde a aba Produtos). Ex.: modelos de assinatura. */
  servicesOnly?: boolean;
}) {
  const [tab, setTab] = useState<Tab>('service');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTab('service');
      setSearch('');
      setDebounced('');
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

  const tabCls = (active: boolean) =>
    [
      'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active ? 'bg-primary text-primary-foreground' : 'text-muted-ink hover:text-foreground',
    ].join(' ');

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Adicionar item"
      widthClass="sm:w-[480px]"
      zClass="z-[90]"
    >
      <div className="flex flex-col gap-3">
        {!servicesOnly && (
          <div className="inline-flex gap-1 rounded-lg border border-[var(--color-soft-border)] bg-canvas p-0.5">
            <button type="button" className={tabCls(tab === 'service')} onClick={() => setTab('service')}>
              Serviços
            </button>
            <button type="button" className={tabCls(tab === 'product')} onClick={() => setTab('product')}>
              Produtos
            </button>
          </div>
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
            className="h-11 w-full rounded-lg border border-default-200 bg-white pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
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
                  onClick={() => {
                    onSelect(r);
                    onClose();
                  }}
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
    </Drawer>
  );
}
