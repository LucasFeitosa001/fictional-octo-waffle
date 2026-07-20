import { useEffect, useState } from 'react';

// True quando viewport < 768px (mesmo breakpoint md do Tailwind).
export function useIsMobile(): boolean {
  const [is, setIs] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767.98px)');
    const on = () => setIs(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return is;
}
