// Camada de dados do Silvia Hair ERP no mobile: repositórios do @silvia/core
// persistidos em AsyncStorage + sessão da funcionária logada.

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  commandItemTotal,
  createRepositories,
  type CommandItem,
  type Product,
  type Professional,
  type Service,
  type StorageAdapter,
} from '@silvia/core';

const adapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

export const repos = createRepositories(adapter);

const SESSION_KEY = 'silvia-erp.staff-session';

export interface StaffSession {
  professionalId: string;
  name: string;
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StaffSession;
  } catch {
    return null;
  }
}

export async function setStaffSession(session: StaffSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearStaffSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export function useStaffSession() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getStaffSession().then((s) => {
      setSession(s);
      setLoading(false);
    });
  }, []);

  return { session, loading };
}

/** Carrega uma lista de um repositório com refresh manual (pull-to-refresh). */
export function useRepoList<T extends { id: string }>(list: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await list();
    setItems(data);
    setLoading(false);
  }, [list]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, loading, refresh };
}

/** Comissão de um item de comanda para a profissional (mesma regra do desktop). */
export function commissionForItem(
  item: CommandItem,
  professional: Professional | undefined,
  services: Map<string, Service>,
  products: Map<string, Product>,
): number {
  const service = item.kind === 'servico' ? services.get(item.refId) : undefined;
  const product = item.kind === 'produto' ? products.get(item.refId) : undefined;
  const percent = service?.commissionPercent ?? product?.saleCommissionPercent ?? professional?.commissionPercent ?? 0;
  return (commandItemTotal(item) * percent) / 100;
}
