import { useEffect, type ComponentType, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconCalendar, IconPlus, IconUsers, IconX } from '../components/icons';
import { CREATE_GROUPS, useCreateSheet, usePageActions } from './PageActions';

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
 * - Menu is always the first item, at the far left.
 * - The remaining items are registered by the current page. Pages that have not
 *   registered actions yet use Agenda / Criar / Clientes as a safe fallback.
 */
export function BottomNav({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { open: createOpen, openSheet: openCreateSheet, closeSheet: closeCreateSheet } = useCreateSheet();
  const pageActions = usePageActions();
  const contextual = pageActions.length > 0;

  const isActive = (to: string) =>
    pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));

  // Lock background scroll while the sheet is open.
  useEffect(() => {
    if (!createOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [createOpen]);

  function pickCreate(to: string) {
    closeCreateSheet();
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
            'absolute inset-0 cursor-pointer bg-black/40 transition-opacity duration-300 ease-out',
            createOpen ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          onClick={closeCreateSheet}
        />
        {/* Sheet */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Criar novo"
          className={[
            'absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-warm-white pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[var(--shadow-pop)] transition-transform duration-300 ease-out will-change-transform',
            createOpen ? 'translate-y-0' : 'translate-y-full',
          ].join(' ')}
        >
          <div className="flex justify-center pt-3">
            <span className="h-1.5 w-10 rounded-full bg-black/15" />
          </div>
          <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
            <div>
              <h2 className="text-base font-semibold text-ink">Criar novo</h2>
              <p className="text-sm text-muted-ink">O que você quer criar?</p>
            </div>
            <button
              type="button"
              onClick={closeCreateSheet}
              aria-label="Fechar"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-xs font-medium text-[#5f5a54] shadow-sm"
            >
              <IconX size={16} />
              Fechar
            </button>
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
                      className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-cream active:bg-[#f2ece0]"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-gold">
                        <Icon size={19} />
                      </span>
                      <span className="min-w-0 truncate text-sm font-semibold text-ink">{label}</span>
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
        className="sp-navbar-surface club-bottomnav fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-[24px] border border-white/10 shadow-[0_18px_55px_rgba(0,0,0,0.32)] lg:hidden"
      >
        {contextual ? (
          // Contextual bar: Menu first, followed only by the current page actions.
          <div className="flex items-stretch px-1">
            <TabButton label="Menu" icon={IconMenu} active={false} onPress={() => onMenuOpen?.()} />
            {pageActions.map((action) => (
              <ActionButton
                key={action.key}
                label={action.label}
                icon={action.icon}
                onPress={action.onClick}
                disabled={action.disabled}
                active={action.active}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-stretch px-1">
            <TabButton label="Menu" icon={IconMenu} active={false} onPress={() => onMenuOpen?.()} />
            <TabButton label="Agenda" icon={IconCalendar} active={isActive('/agenda')} onPress={() => navigate('/agenda')} />
            <ActionButton label="Criar" icon={<IconPlus size={22} />} onPress={openCreateSheet} />
            <TabButton label="Clientes" icon={IconUsers} active={isActive('/clientes')} onPress={() => navigate('/clientes')} />
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
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] font-medium transition-colors ${
        active ? 'text-gold' : 'text-white/55 hover:text-white/80'
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
  disabled = false,
  active = false,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-pressed={active}
      className={[
        'flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        active ? 'text-gold' : 'text-white/70 hover:text-white active:text-gold',
      ].join(' ')}
    >
      {icon}
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
