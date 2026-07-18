import { useEffect, useState, type ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  IconBox,
  IconCalendar,
  IconHome,
  IconPlus,
  IconReceipt,
  IconScissors,
  IconUsers,
} from '../components/icons';

function IconMenu({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

type IconType = ComponentType<{ size?: number }>;

type CreateItem = { to: string; label: string; description: string; icon: IconType };

const CREATE: CreateItem[] = [
  { to: '/agenda?new=1', label: 'Agendamento', description: 'Marcar um horário', icon: IconCalendar },
  { to: '/comandas?new=1', label: 'Comanda', description: 'Abrir uma venda', icon: IconReceipt },
  { to: '/clientes?new=1', label: 'Cliente', description: 'Cadastrar pessoa', icon: IconUsers },
  { to: '/servicos?new=1', label: 'Serviço', description: 'Novo serviço', icon: IconScissors },
  { to: '/produtos?new=1', label: 'Produto', description: 'Item de estoque', icon: IconBox },
];

/**
 * Mobile bottom tab bar (Gestão): black bar with flat tabs and a raised gold
 * "Mais" FAB in the middle that opens a slide-up sheet asking what to create.
 * Hidden on >=lg, where the static sidebar takes over.
 */
export function BottomNav({ onMenuOpen }: { onMenuOpen?: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [createOpen, setCreateOpen] = useState(false);

  const left: { to: string; label: string; icon: IconType }[] = [
    { to: '/', label: 'Início', icon: IconHome },
  ];
  const right: { to: string; label: string; icon: IconType }[] = [
    { to: '/clientes', label: 'Clientes', icon: IconUsers },
  ];

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
      {/* Create sheet — always mounted so it slides smoothly in/out. */}
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
            'absolute inset-x-0 bottom-0 rounded-t-3xl bg-[#fffdf8] pb-[calc(env(safe-area-inset-bottom)+16px)] shadow-[var(--shadow-pop)] transition-transform duration-300 ease-out will-change-transform',
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
          <div className="flex flex-col gap-1 px-2.5">
            {CREATE.map(({ to, label, description, icon: Icon }) => (
              <button
                key={to}
                type="button"
                onClick={() => pickCreate(to)}
                className="flex items-center gap-3 rounded-2xl px-2.5 py-3 text-left transition-colors hover:bg-[#f7f3ea] active:bg-[#f2ece0]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#111111] text-[#f2b33d]">
                  <Icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#111111]">{label}</span>
                  <span className="block text-xs text-[#6f6a63]">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <nav className="club-bottomnav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 lg:hidden">
        <div className="relative mx-auto grid max-w-md grid-cols-5 items-end px-2">
          {/* Left tab */}
          {left.map((t) => (
            <TabButton key={t.to} {...t} active={isActive(t.to)} onPress={() => navigate(t.to)} />
          ))}

          <TabButton label="Agenda" icon={IconCalendar} active={isActive('/agenda')} onPress={() => navigate('/agenda')} />

          {/* Center raised "Mais" FAB → opens the create sheet */}
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

          {/* Right tabs */}
          {right.map((t) => (
            <TabButton key={t.to} {...t} active={isActive(t.to)} onPress={() => navigate(t.to)} />
          ))}

          {/* Menu (opens the complete navigation drawer) */}
          <TabButton label="Menu" icon={IconMenu} active={false} onPress={() => onMenuOpen?.()} />
        </div>
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
      className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] font-medium transition-colors ${
        active ? 'text-[#f2b33d]' : 'text-white/55 hover:text-white/80'
      }`}
    >
      <Icon size={22} />
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
