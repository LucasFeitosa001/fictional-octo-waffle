import {
  useZoom,
  zoomIn,
  zoomOut,
  zoomReset,
  ZOOM_MIN,
  ZOOM_MAX,
} from '../theme/zoom';

/**
 * Controles de acessibilidade de zoom (aproximar/afastar), estilizados para o
 * sidebar escuro. O nível é salvo (localStorage) e aplicado no boot. Escala o
 * conteúdo inteiro via font-size do <html> — útil sobretudo em tablet/iPad.
 */
export function ZoomControls({ collapsed = false }: { collapsed?: boolean }) {
  const zoom = useZoom();
  const pct = Math.round(zoom * 100);
  const btn =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30';

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-1" aria-label="Zoom">
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= ZOOM_MAX}
          className={btn}
          aria-label="Aproximar (aumentar tamanho)"
          title="Aproximar"
        >
          A+
        </button>
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= ZOOM_MIN}
          className={btn}
          aria-label="Afastar (diminuir tamanho)"
          title="Afastar"
        >
          A&minus;
        </button>
      </div>
    );
  }

  return (
    <div
      className="mx-2.5 flex items-center justify-between gap-1 rounded-xl bg-white/5 p-1"
      aria-label="Controles de zoom"
    >
      <button
        type="button"
        onClick={zoomOut}
        disabled={zoom <= ZOOM_MIN}
        className={btn}
        aria-label="Afastar (diminuir tamanho)"
        title="Diminuir o tamanho"
      >
        A&minus;
      </button>
      <button
        type="button"
        onClick={zoomReset}
        className="min-w-[3.25rem] rounded-lg px-2 py-1 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10"
        aria-label="Restaurar tamanho padrão (100%)"
        title="Tamanho padrão (100%)"
      >
        {pct}%
      </button>
      <button
        type="button"
        onClick={zoomIn}
        disabled={zoom >= ZOOM_MAX}
        className={btn}
        aria-label="Aproximar (aumentar tamanho)"
        title="Aumentar o tamanho"
      >
        A+
      </button>
    </div>
  );
}
