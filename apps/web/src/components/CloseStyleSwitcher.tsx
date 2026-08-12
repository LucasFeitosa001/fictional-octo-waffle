import { IconX } from './icons';
import { CLOSE_STYLES, setCloseStyle, useCloseStyle, type CloseStyleId } from '../theme/closeStyle';
import { saveAppearanceToCloud } from '../theme/useThemeSync';

/** Amostra visual de como o botão "fechar" fica em cada estilo. */
function ClosePreview({ id }: { id: CloseStyleId }) {
  if (id === 'label') {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-medium text-[#5f5a54] shadow-sm">
        <IconX size={16} /> Fechar
      </span>
    );
  }
  if (id === 'round') {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white text-[#5f5a54] shadow-sm">
        <IconX size={16} />
      </span>
    );
  }
  return (
    <span className="grid h-9 w-9 place-items-center rounded-lg text-muted-ink">
      <IconX size={16} />
    </span>
  );
}

export function CloseStyleSwitcher({ disabled = false }: { disabled?: boolean } = {}) {
  const current = useCloseStyle();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {CLOSE_STYLES.map((s) => {
        const active = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            disabled={disabled}
            onClick={() => {
              setCloseStyle(s.id);
              void saveAppearanceToCloud({ closeStyle: s.id }).catch(() => {
                /* segue aplicado localmente; o botão Salvar permite tentar de novo */
              });
            }}
            aria-pressed={active}
            className={[
              'flex flex-col items-center gap-3 rounded-xl border p-4 text-center transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-line bg-card hover:border-primary/40',
            ].join(' ')}
          >
            <span className="flex h-12 items-center justify-center">
              <ClosePreview id={s.id} />
            </span>
            <span className="block">
              <span className="block text-sm font-semibold text-ink">{s.label}</span>
              <span className="mt-0.5 block text-xs text-muted-ink">{s.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
