import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Entity, Repository } from '@silvia/core';
import type {
  Client,
  Group,
  Product,
  Professional,
  Service,
} from '@silvia/core';
import { repos } from './repos';

export interface Collection<T extends Entity> {
  items: T[];
  loading: boolean;
  refresh: () => Promise<void>;
  create: (data: Omit<T, 'id'>) => Promise<T>;
  update: (id: string, patch: Partial<Omit<T, 'id'>>) => Promise<T | undefined>;
  remove: (id: string) => Promise<void>;
}

/** Estado reativo sobre um Repository: carrega, e recarrega após cada mutação. */
export function useCollection<T extends Entity>(repo: Repository<T>): Collection<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await repo.list();
    setItems(list);
    setLoading(false);
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (data: Omit<T, 'id'>) => {
      const created = await repo.create(data);
      await refresh();
      return created;
    },
    [repo, refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<Omit<T, 'id'>>) => {
      const updated = await repo.update(id, patch);
      await refresh();
      return updated;
    },
    [repo, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      await repo.remove(id);
      await refresh();
    },
    [repo, refresh],
  );

  return { items, loading, refresh, create, update, remove };
}

export interface Lookups {
  clients: Map<string, Client>;
  professionals: Map<string, Professional>;
  services: Map<string, Service>;
  products: Map<string, Product>;
  groups: Map<string, Group>;
  clientName: (id?: string) => string;
  professionalName: (id?: string) => string;
  serviceName: (id?: string) => string;
  productName: (id?: string) => string;
  groupName: (id?: string) => string;
  loading: boolean;
}

/** Mapas id->entidade para exibir nomes em tabelas (agenda, comandas, estoque...). */
export function useLookups(): Lookups {
  const [state, setState] = useState<Omit<Lookups, 'clientName' | 'professionalName' | 'serviceName' | 'productName' | 'groupName'>>({
    clients: new Map(),
    professionals: new Map(),
    services: new Map(),
    products: new Map(),
    groups: new Map(),
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [clients, professionals, services, products, groups] = await Promise.all([
        repos.clients.list(),
        repos.professionals.list(),
        repos.services.list(),
        repos.products.list(),
        repos.groups.list(),
      ]);
      if (cancelled) return;
      setState({
        clients: new Map(clients.map((c) => [c.id, c])),
        professionals: new Map(professionals.map((p) => [p.id, p])),
        services: new Map(services.map((s) => [s.id, s])),
        products: new Map(products.map((p) => [p.id, p])),
        groups: new Map(groups.map((g) => [g.id, g])),
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => {
    const nameOf = (map: Map<string, { name?: string; legalName?: string }>) => (id?: string) => {
      if (!id) return '—';
      const item = map.get(id);
      return item?.name ?? item?.legalName ?? '—';
    };
    return {
      ...state,
      clientName: nameOf(state.clients),
      professionalName: nameOf(state.professionals),
      serviceName: nameOf(state.services),
      productName: nameOf(state.products),
      groupName: nameOf(state.groups),
    };
  }, [state]);
}
