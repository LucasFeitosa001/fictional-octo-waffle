import { THEMES, useTheme } from '../theme/theme';
import { saveThemeToCloud } from '../theme/useThemeSync';

/**
 * Color-theme picker. Selecting a card swaps [data-theme] on <html> instantly
 * and persists the choice. Every brand color in the product follows from the
 * chosen palette (see the --sp-* tokens in index.css).
 */
export function ThemeSwitcher() {
  const [current, setTheme] = useTheme();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {THEMES.map((t) => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTheme(t.id); // instant local apply + localStorage cache
              saveThemeToCloud(t.id); // mirror to the account (cross-device)
            }}
            aria-pressed={active}
            className={[
              'flex items-center gap-3 rounded-2xl border p-3 text-left transition',
              active
                ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                : 'border-line hover:border-muted-ink/40',
            ].join(' ')}
          >
            <span className="flex shrink-0 overflow-hidden rounded-xl border border-line shadow-[var(--shadow-soft)]">
              {t.swatches.map((c, i) => (
                <span key={i} style={{ background: c }} className="h-11 w-4" />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-ink">{t.label}</span>
                {active && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Ativo
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted-ink">{t.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
