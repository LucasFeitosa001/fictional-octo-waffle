import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@heroui/react';
import type { Customer } from '@beautypass/shared';
import { Drawer } from './Drawer';
import { IconSearch, IconUser } from './icons';
import { useCustomers } from '../lib/queries';
import { formatPhone, initials } from '../lib/format';

/** Minimal shape a picked customer exposes to callers. */
export interface PickedCustomer {
  id: string;
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

/**
 * The /customers list endpoint now returns an `avatarUrl` (the shared `Customer`
 * type doesn't model it yet), so widen it locally to read the photo when present.
 */
type CustomerListItem = Customer & { avatarUrl?: string | null };

/** Circular avatar: photo when available, initials fallback otherwise. */
export function CustomerAvatar({
  name,
  avatarUrl,
  size = 40,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  const label = initials(name);
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-cream text-[13px] font-semibold text-primary/80"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : label && label !== '?' ? (
        label
      ) : (
        <IconUser size={Math.round(size * 0.55)} className="text-primary/70" />
      )}
    </span>
  );
}

/**
 * Reusable bottom-sheet (mobile) / lateral (desktop) drawer to pick a customer.
 * Opens ABOVE the comanda drawer (`z-[90]`), searches via `useCustomers` with a
 * 300ms debounce, and renders avatar + name + formatted phone per row.
 */
export function CustomerPickerDrawer({
  isOpen,
  onClose,
  onSelect,
  onCreateNew,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (customer: PickedCustomer) => void;
  /**
   * Abre o cadastro de cliente por cima, sem sair de onde a pessoa está —
   * recebe o que ela já digitou na busca para não fazer digitar de novo.
   *
   * Opcional de propósito: quem não passa segue exatamente como antes. Como o
   * picker é compartilhado (comanda, pacotes, IA), ligar aqui resolve os três
   * lugares. Ver estudo 155.
   */
  onCreateNew?: (nomeDigitado: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  // Reset the query whenever the picker (re)opens.
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setDebounced('');
    }
  }, [isOpen]);

  // Debounce the text input by 300ms before it hits the query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const customers = useCustomers(debounced);
  const items = useMemo(
    () => (customers.data?.data ?? []) as CustomerListItem[],
    [customers.data],
  );
  const loading = customers.isLoading || customers.isFetching;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Selecionar cliente"
      widthClass="sm:w-[480px]"
      zClass="z-[90]"
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <IconSearch
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente"
            aria-label="Buscar cliente"
            autoFocus
            className="h-11 min-h-11 w-full rounded-lg border border-black/15 bg-white pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted focus:border-primary"
          />
        </div>

        {loading && items.length === 0 && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Spinner size="sm" /> Buscando clientes…
          </div>
        )}

        {onCreateNew && (
          <button
            type="button"
            onClick={() => onCreateNew(search.trim())}
            className="self-start text-xs font-medium text-gold-strong hover:underline"
          >
            + Novo cliente
          </button>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded-lg border border-dashed border-default-200 px-3 py-8 text-center text-sm text-muted">
            {debounced ? 'Nenhum cliente encontrado.' : 'Digite para buscar um cliente.'}
            {/* A busca sem resultado é justamente quando a pessoa descobre que
                a cliente não existe — é aqui que o cadastro tem de estar, já
                com o nome digitado. */}
            {onCreateNew && debounced && (
              <button
                type="button"
                onClick={() => onCreateNew(debounced)}
                className="mt-3 block w-full rounded-lg border border-default-200 bg-white px-3 py-2 text-sm font-medium text-gold-strong hover:bg-canvas"
              >
                + Cadastrar “{debounced}”
              </button>
            )}
          </div>
        )}

        {items.length > 0 && (
          <ul className="flex flex-col divide-y divide-default-200 overflow-hidden rounded-lg border border-default-200 bg-white">
            {items.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect({ id: c.id, name: c.name, phone: c.phone, avatarUrl: c.avatarUrl });
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-cream"
                >
                  <CustomerAvatar name={c.name} avatarUrl={c.avatarUrl} />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {c.name}
                    </span>
                    {c.phone ? (
                      <span className="truncate text-xs text-muted">{formatPhone(c.phone)}</span>
                    ) : null}
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
