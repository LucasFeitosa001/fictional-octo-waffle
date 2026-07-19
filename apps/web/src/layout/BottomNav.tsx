import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconCalendar, IconHome, IconPlus, IconUsers } from '../components/icons';
import { CREATE_GROUPS, usePageActions } from './PageActions';

function IconMenu({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

type IconType = ComponentType<{ size?: number }>;

/**
 * Mobile bottom tab bar (Gestão): black bar hidden on >=lg, where the static
 * sidebar takes over.
 *
 * - Default: flat tabs (Início / Agenda / Clientes / Menu) with a raised gold
 *   "Mais" FAB that opens the grouped "Novo" sheet.
 * - Contextual: when the current page registers its own actions (via
 *   `useSetPageActions`), the bar renders those actions in place of the default
 *   tabs — always keeping an **Início** shortcut and the **Menu** button.
 */
export function BottomNav({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const pageActions = usePageActions();
  const contextual = pageActions.length > 0;

  const isActive = (to: string) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to);

  // Lock background scroll while the sheet is open.
  useEffect(() => {
    if (!createOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [createOpen]);

  function pickCreate(to: string) {
    setCreateOpen(false);
    navigate(to);
  }

  return (
    <>
      {/* Create sheet — grouped "Novo" menu (Principal / Cadastros / Financeiro).
          Always mounted so it slides smoothly in/out. */}
      <div
        className={['fixed inset-0 z-50 lg:hidden', createOpen ? '' : 'pointer-events-none'].join(' ')}
        aria-hidden={!createOpen}
      >
        {/* Scrim */}
        <div
          className={[
            'absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out',
            createOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          onClick={() => setCreateOpen(false)}
        />
        {/* Sheet */}
        <div
          role="dialog"
          aria-label="Criar novo"
          className={[
            'absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-[#fffdf8] pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[var(--shadow-pop)] transition-transform duration-300 ease-out will-change-transform',
            createOpen ? 'translate-y-0' : 'translate-y-full',
          ].join(' ')}
        >
          <div className="flex justify-center pt-3">
            <span className="h-1.5 w-10 rounded-full bg-black/15" />
          </div>
          <div className="px-4 pb-2 pt-3">
            <h2 className="text-base font-semibold text-[#111111]">Criar novo</h2>
            <p className="text-sm text-[#6f6a63]">O que você quer criar?</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
            {CREATE_GROUPS.map((group) => (
              <div key={group.label} className="pb-1">
                <div className="px-2.5 pb-0.5 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[#9AA0A6]">
                  {group.label}
                </div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map(({ to, label, icon: Icon }) => (
                    <button
                      key={to}
                      type="button"
                      onClick={() => pickCreate(to)}
                      className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-[#f7f3ea] active:bg-[#f2ece0]"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#111111] text-[#f2b33d]">
                        <Icon size={19} />
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-[#111111]">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <nav
        aria-label="Navegação principal"
        className="club-bottomnav fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-[24px] border border-white/10 shadow-[0_18px_55px_rgba(0,0,0,0.32)] lg:hidden"
      >
        {contextual ? (
          // Contextual bar: Início + the page's own actions + Menu.
          <div className="flex items-stretch px-1">
            <TabButton label="Início" icon={IconHome} active={isActive('/')} onPress={() => navigate('/')} />
            {pageActions.map((action) => (
              <ActionButton key={action.key} label={action.label} icon={action.icon} onPress={action.onClick} />
            ))}
            <TabButton label="Menu" icon={IconMenu} active={false} onPress={() => onMenuOpen?.()} />
          </div>
        ) : (
          <div className="relative mx-auto grid max-w-md grid-cols-5 items-end px-2">
            {/* Left tab */}
            <TabButton label="Início" icon={IconHome} active={isActive('/')} onPress={() => navigate('/')} />

            <TabButton label="Agenda" icon={IconCalendar} active={isActive('/agenda')} onPress={() => navigate('/agenda')} />

            {/* Center raised "Mais" FAB → opens the grouped create sheet */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-label="Criar novo"
                className="-mt-7 flex flex-col items-center"
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-[#f2b33d] text-[#111111] shadow-[var(--shadow-gold)] ring-4 ring-[#111111] transition-transform active:scale-95">
                  <IconPlus size={26} />
                </span>
                <span className="mt-1 text-[11px] font-semibold text-[#f2b33d]">Mais</span>
              </button>
            </div>

            {/* Right tab */}
            <TabButton label="Clientes" icon={IconUsers} active={isActive('/clientes')} onPress={() => navigate('/clientes')} />

            {/* Menu (opens the complete navigation drawer) */}
            <TabButton label="Menu" icon={IconMenu} active={false} onPress={() => onMenuOpen?.()} />
          </div>
        )}
      </nav>
    </>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: IconType;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] font-medium transition-colors ${
        active ? 'text-[#f2b33d]' : 'text-white/55 hover:text-white/80'
      }`}
    >
      <Icon size={22} />
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

/** Renders a contextual page action; its icon is a ready-made node. */
function ActionButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] font-medium text-white/70 transition-colors hover:text-white active:text-[#f2b33d]"
    >
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
