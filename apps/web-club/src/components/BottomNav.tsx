import { useState } from 'react';
import { Calendar, Heart, House, ListTimeline, Person } from '@gravity-ui/icons';

function scrollToSection(id: string | null) {
  if (!id || id === 'inicio') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Mobile bottom tab bar (salonpass feminino). A black bar with four flat tabs
 * (Início, Agendamentos, Favoritos, Perfil) and a raised gold "Agendar" FAB in
 * the middle — the primary call to action. Hidden on >=md, where the TopBar
 * links take over. Paints into the iOS home-indicator safe area.
 */
export function BottomNav({
  isLoggedIn,
  onLogin,
  onAccount,
  onHome,
  onFavorites,
}: {
  isLoggedIn: boolean;
  onLogin: () => void;
  onAccount: () => void;
  /** "Início": clears any active service filter and scrolls to the top. */
  onHome: () => void;
  /** "Favoritos": opens the service list filtered to hearted services. */
  onFavorites: () => void;
}) {
  const [active, setActive] = useState('inicio');

  const tabs = [
    { id: 'inicio', label: 'Início', icon: House },
    { id: 'agendamentos', label: 'Agenda', icon: ListTimeline },
    { id: 'favoritos', label: 'Favoritos', icon: Heart },
    { id: 'perfil', label: 'Perfil', icon: Person },
  ] as const;

  function handleTab(id: string) {
    setActive(id);
    // "Agendamentos" and "Perfil" both open the account page (which lists the
    // customer's appointments); logged-out visitors are sent to login first.
    if (id === 'agendamentos' || id === 'perfil') {
      isLoggedIn ? onAccount() : onLogin();
      return;
    }
    if (id === 'favoritos') {
      onFavorites();
      return;
    }
    if (id === 'inicio') {
      onHome();
      return;
    }
    scrollToSection(id);
  }

  function handleAgendar() {
    setActive('servicos');
    scrollToSection('servicos');
  }

  return (
    <nav aria-label="Navegação principal" className="club-bottomnav fixed inset-x-0 bottom-0 z-40 border-t border-white/10 md:hidden">
      <div className="relative mx-auto grid max-w-lg grid-cols-5 items-end px-1.5">
        {/* Left pair */}
        {tabs.slice(0, 2).map((t) => (
          <TabButton key={t.id} {...t} active={active === t.id} onPress={() => handleTab(t.id)} />
        ))}

        {/* Center raised "Agendar" FAB */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleAgendar}
            aria-label="Agendar"
            className="-mt-7 flex min-w-0 flex-col items-center px-1"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-[#f2b33d] text-[#111111] shadow-[var(--shadow-gold)] ring-4 ring-[#111111] transition-transform active:scale-95">
              <Calendar width={24} height={24} />
            </span>
            <span className="mt-1 text-[11px] font-semibold text-[#f2b33d]">Agendar</span>
          </button>
        </div>

        {/* Right pair */}
        {tabs.slice(2).map((t) => (
          <TabButton key={t.id} {...t} active={active === t.id} onPress={() => handleTab(t.id)} />
        ))}
      </div>
    </nav>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: typeof House;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-current={active ? 'page' : undefined}
      className={`flex min-w-0 flex-col items-center justify-end gap-0.5 px-0.5 py-2 text-[10px] font-medium transition-colors min-[360px]:text-[11px] ${
        active ? 'text-[#f2b33d]' : 'text-white/55 hover:text-white/80'
      }`}
    >
      <Icon width={22} height={22} />
      {label}
    </button>
  );
}
