import { SIDEBAR_STYLES, setSidebarStyle, useSidebarStyle, type SidebarStyleId } from '../theme/sidebarStyle';

/** Mini-preview de um "app": sidebar sólida (encostada) vs flutuante (margem + cantos + sombra). */
function SidebarPreview({ id }: { id: SidebarStyleId }) {
  const floating = id === 'floating';
  return (
    <div className="relative h-16 w-full overflow-hidden rounded-lg border border-line bg-canvas">
      <div
        className={[
          'absolute bottom-0 top-0 w-6',
          'bg-[image:linear-gradient(180deg,var(--sp-sidebar-grad-top),var(--sp-sidebar-grad-bottom))]',
          floating ? 'left-1 my-1 rounded-md shadow-md' : 'left-0',
        ].join(' ')}
      />
    </div>
  );
}

export function SidebarStyleSwitcher() {
  const current = useSidebarStyle();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {SIDEBAR_STYLES.map((s) => {
        const active = s.id === current;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => setSidebarStyle(s.id)}
            aria-pressed={active}
            className={[
              'flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors',
              active
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'border-line bg-card hover:border-primary/40',
            ].join(' ')}
          >
            <SidebarPreview id={s.id} />
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
