import { BUTTON_RADII, useButtonRadius } from '../theme/buttonStyle';
import { saveButtonRadiusToCloud } from '../theme/useThemeSync';

/**
 * Seletor do estilo de arredondamento dos botões. Escolher um card aplica o
 * `data-btn-radius` no <html> na hora (todos os botões mudam de raio via
 * --sp-btn-radius) e persiste a escolha (localStorage + conta), igual ao tema.
 * Cada card mostra um "botão de amostra" com o raio da opção como preview.
 */
export function ButtonStyleSwitcher() {
  const [current, setRadius] = useButtonRadius();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {BUTTON_RADII.map((r) => {
        const active = current === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              setRadius(r.id); // instant local apply + localStorage cache
              saveButtonRadiusToCloud(r.id); // mirror to the account (cross-device)
            }}
            aria-pressed={active}
            className={[
              'flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition',
              active
                ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
                : 'border-line hover:border-muted-ink/40',
            ].join(' ')}
          >
            {/* Amostra do formato — usa o raio da própria opção (não o ativo). */}
            <span
              className="flex h-9 w-full items-center justify-center bg-primary text-xs font-semibold text-primary-foreground"
              style={{ borderRadius: r.radius }}
            >
              Botão
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="font-semibold text-ink">{r.label}</span>
                {active && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                    Ativo
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-muted-ink">{r.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
