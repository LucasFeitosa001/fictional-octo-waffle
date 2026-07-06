// Small data-fetching hook around the shared ApiClient with loading/error/
// refresh state. No caching — keeps the screens honest against the live API.
import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refresh: () => void;
}

export function useFetch<T>(
  path: string | null,
  query?: Record<string, string | number | boolean | undefined>,
): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryKey = query ? JSON.stringify(query) : '';

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!path) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await api.get<T>(path, query);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar dados.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, queryKey],
  );

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, queryKey]);

  const refresh = useCallback(() => {
    load(true);
  }, [load]);

  return { data, loading, error, refreshing, refresh };
}
