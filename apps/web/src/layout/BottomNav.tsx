import { useEffect, type ComponentType, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { IconCalendar, IconPlus, IconUsers, IconX } from '../components/icons';
import { CREATE_GROUPS, useCreateSheet, usePageActions, type CreateItem } from './PageActions';
import { useCreateDrawer } from './CreateDrawer';

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
  const { openCreate } = useCreateDrawer();
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

  // Create-in-place: abre o drawer da entidade DIRETO (sem navegar), fechando a
  // bottom-sheet de "Criar".
  function pickCreate(item: CreateItem) {
    closeCreateSheet();
    if (item.kind) openCreate(item.kind);
  }

  return (
    <>
      {/* Create sheet — grouped tile grid ("Financeiro" / "Cadastros") mirroring
          the Belasis "Novo +" bottom-sheet. Always mounted so it slides smoothly
          in/out. */}
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
          aria-label="Criar"
          className={[
            'absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-warm-white pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[var(--shadow-pop)] transition-transform duration-300 ease-out will-change-transform',
            createOpen ? 'translate-y-0' : 'translate-y-full',
          ].join(' ')}
        >
          <div className="flex justify-center pt-3">
            <span className="h-1.5 w-10 rounded-full bg-black/15" />
          </div>
          <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-2">
            <h2 className="text-sm font-semibold text-ink">Criar</h2>
            <button
              type="button"
              onClick={closeCreateSheet}
              aria-label="Fechar"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white text-[#5f5a54] shadow-sm"
            >
              <IconX size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-1">
            {CREATE_GROUPS.map((group) => (
              <section key={group.label} className="pt-4 first:pt-2">
                <h3 className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9AA0A6]">
                  {group.label}
                </h3>
                <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5 md:grid-cols-6">
                  {group.items.map((item) => (
                    <CreateTile
                      key={`${group.label}-${item.label}`}
                      item={item}
                      onPick={pickCreate}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <nav
        aria-label="Navegação principal"
        // Barra FLUTUANTE: afastada da borda inferior segura, mas JUNTO ao fundo.
        // No Safari (com URL bar) a inset é 0 → cai no piso de 0.5rem (respiro
        // enxuto). Em standalone a inset (~34px do home indicator) É o próprio
        // afastamento — a barra fica logo ACIMA do home indicator SEM o +0.5rem
        // extra que antes deixava um gap grande. O padding interno vem só do
        // py-2 dos botões (o padding-bottom duplicado da .club-bottomnav foi
        // removido no CSS).
        className="sp-navbar-surface club-bottomnav fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-lg rounded-[24px] border border-white/10 shadow-[0_18px_55px_rgba(0,0,0,0.32)] lg:hidden"
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

/**
 * A single Belasis-style "Create" tile: 60×60 rounded dark square with a white
 * icon on top and a small label below. Disabled tiles render at reduced opacity
 * and expose an "Em breve" tooltip.
 */
function CreateTile({
  item,
  onPick,
}: {
  item: CreateItem;
  onPick: (item: CreateItem) => void;
}) {
  const { label, icon: Icon, disabled = false, disabledReason } = item;
  const tooltip = disabled ? disabledReason ?? 'Em breve' : undefined;
  return (
    <button
      type="button"
      onClick={() => (disabled ? undefined : onPick(item))}
      disabled={disabled}
      title={tooltip}
      aria-label={disabled ? `${label} — ${tooltip}` : label}
      className={[
        'group flex flex-col items-center gap-1.5 px-0.5 pt-0.5 text-center transition-transform disabled:cursor-not-allowed',
        disabled ? 'opacity-45' : 'active:scale-[0.97]',
      ].join(' ')}
    >
      <span
        className={[
          'grid h-[60px] w-[60px] shrink-0 place-items-center rounded-[18px] bg-ink text-white shadow-[0_2px_6px_rgba(0,0,0,0.14)] transition-colors',
          disabled ? '' : 'group-hover:bg-black group-active:bg-black',
        ].join(' ')}
      >
        <Icon size={24} />
      </span>
      <span className="line-clamp-2 max-w-full text-[11px] font-medium leading-tight text-ink">
        {label}
      </span>
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
