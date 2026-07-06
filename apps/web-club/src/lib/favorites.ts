import { useCallback, useEffect, useState } from 'react';

/**
 * Per-visitor favorite services, kept in localStorage and scoped per salon slug.
 * These are a client-side preference (the salon's own `service.favorite` flag is
 * a separate "Mais pedido" marker), so a customer can heart the services they
 * like and filter the list down to them — even without an account.
 */
const keyFor = (slug: string) => `salonpass:favorites:${slug}`;

function read(slug: string): string[] {
  try {
    const raw = localStorage.getItem(keyFor(slug));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useFavorites(slug: string) {
  const [ids, setIds] = useState<Set<string>>(() => new Set(read(slug)));

  // Reload when switching salons.
  useEffect(() => {
    setIds(new Set(read(slug)));
  }, [slug]);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        try {
          localStorage.setItem(keyFor(slug), JSON.stringify([...next]));
        } catch {
          /* ignore quota / private-mode errors */
        }
        return next;
      });
    },
    [slug],
  );

  return { ids, toggle };
}
