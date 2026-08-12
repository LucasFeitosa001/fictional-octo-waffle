import { useEffect, useState } from 'react';

// True quando a viewport está abaixo de 1360px. Usado pelo Sidebar desktop pra
// forçar o modo minimizado/colapsado nesse intervalo (1360px é o ponto onde o
// rail expandido + conteúdo começam a ficar apertados). 1359.98px cobre o
// mesmo intervalo de "< 1360" sem depender de arredondamento de fração de px.
export function useCompactViewport(): boolean {
  const [is, setIs] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1359.98px)').matches,
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 1359.98px)');
    const on = () => setIs(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return is;
}
