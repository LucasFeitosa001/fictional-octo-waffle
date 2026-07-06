import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Opens a create modal when the page is reached with `?new=1` in the URL
 * (used by the sidebar "Novo" quick-create menu), then strips the param so a
 * refresh doesn't re-open it.
 */
export function useAutoCreate(open: () => void) {
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') {
      open();
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
