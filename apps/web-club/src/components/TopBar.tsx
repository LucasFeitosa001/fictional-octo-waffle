import { useState } from 'react';
import { ArrowRightFromSquare, Bars, Person, Xmark } from '@gravity-ui/icons';
import { Button } from '@heroui/react';
import { signOut } from '../lib/auth';
import { NotificationBell } from './NotificationBell';

const NAV_LINKS = [
  { id: 'inicio', label: 'Início' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'agendamentos', label: 'Agendamentos' },
] as const;

function scrollToSection(id: string) {
  const el = id === 'inicio' ? null : document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Filled WhatsApp brand glyph (gravity-ui has no WhatsApp logo).
function WhatsAppGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.06 24l1.68-6.13A11.86 11.86 0 0 1 .15 11.9C.15 5.34 5.5 0 12.07 0a11.82 11.82 0 0 1 8.41 3.49 11.82 11.82 0 0 1 3.48 8.42c0 6.56-5.35 11.9-11.9 11.9a11.9 11.9 0 0 1-5.69-1.45L.06 24zm6.6-3.8c1.68.99 3.28 1.59 5.4 1.59 5.45 0 9.89-4.43 9.9-9.88 0-5.46-4.42-9.9-9.88-9.9-5.46 0-9.9 4.43-9.9 9.89 0 2.22.65 3.89 1.75 5.62l-.99 3.62 3.72-.95zm11.4-5.3c-.08-.12-.27-.2-.56-.34-.29-.15-1.72-.85-1.99-.94-.26-.1-.46-.15-.65.14-.19.29-.74.94-.91 1.13-.17.19-.34.22-.62.07-.29-.14-1.23-.45-2.34-1.44-.86-.77-1.45-1.72-1.62-2.01-.17-.29-.02-.45.13-.59.13-.13.29-.34.43-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.14-.65-1.57-.89-2.15-.24-.56-.47-.48-.65-.49l-.56-.01c-.19 0-.51.07-.77.36-.26.29-1.01.99-1.01 2.42 0 1.42 1.04 2.8 1.18 2.99.14.19 2.04 3.12 4.95 4.37.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.12.56-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38z" />
    </svg>
  );
}

// wa.me deep link with a friendly pre-filled message.
function whatsappHref(number: string, salonName?: string): string {
  const text = `Olá! Vim pelo agendamento online${salonName ? ` da ${salonName}` : ''} e gostaria de tirar uma dúvida.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/**
 * Black navbar (salonpass feminino) — scrolls away with the page (not sticky).
 * Paints into the iOS status-bar safe area (black), so the notification bar is
 * never a bare white strip. Holds the
 * brand, section links, and the login button (logged out) or the account button
 * + notification bell (logged in).
 */
export function TopBar({
  slug,
  isLoggedIn,
  onLogin,
  onAccount,
  onHome,
  whatsapp,
  salonName,
}: {
  slug: string;
  isLoggedIn: boolean;
  onLogin: () => void;
  onAccount: () => void;
  /** "Início": clears any active service filter and scrolls to the top. */
  onHome: () => void;
  /** Salon WhatsApp (digits) — when present, a "WhatsApp" link is shown. */
  whatsapp?: string | null;
  salonName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    setMenuOpen(false);
    void signOut();
  }

  function handleNav(id: string) {
    setMenuOpen(false);
    // "Agendamentos" opens the customer's account page (their appointments list);
    // logged-out visitors go to login first. "Início" clears any active filter.
    if (id === 'agendamentos') {
      isLoggedIn ? onAccount() : onLogin();
      return;
    }
    if (id === 'inicio') {
      onHome();
      return;
    }
    scrollToSection(id);
  }

  return (
    <header className="club-topbar relative z-40 shadow-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-5">
        <button
          type="button"
          onClick={() => handleNav('inicio')}
          aria-label="Salonpass — início"
          className="flex min-w-0 items-center text-left"
        >
          <img
            src="/brand/salonpass-wordmark-white.svg"
            alt="Salonpass"
            className="h-7 w-auto shrink-0"
          />
        </button>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => handleNav(link.id)}
              className="text-sm font-medium text-white/80 transition-colors hover:text-[#f2b33d]"
            >
              {link.label}
            </button>
          ))}
          {whatsapp && (
            <a
              href={whatsappHref(whatsapp, salonName)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#25D366] transition-opacity hover:opacity-80"
            >
              <WhatsAppGlyph size={15} />
              WhatsApp
            </a>
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          {isLoggedIn ? (
            <>
              <NotificationBell slug={slug} enabled={isLoggedIn} />
              {/* Desktop: account shortcut. */}
              <button
                type="button"
                onClick={onAccount}
                aria-label="Minha conta"
                className="hidden h-10 w-10 place-items-center rounded-full text-white transition-colors hover:bg-white/15 md:grid"
              >
                <Person width={22} height={22} />
              </button>
              {/* Mobile: a logout button (the account lives in the bottom nav). */}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sair"
                className="grid h-10 w-10 place-items-center rounded-full text-white transition-colors hover:bg-white/15 md:hidden"
              >
                <ArrowRightFromSquare width={22} height={22} />
              </button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onPress={onLogin}
              className="hidden rounded-full border border-[#f2b33d] bg-transparent text-[#f2b33d] hover:bg-[#f2b33d]/10 md:inline-flex"
            >
              Entrar
            </Button>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            className="grid h-10 w-10 place-items-center rounded-full text-white transition-colors hover:bg-white/15 md:hidden"
          >
            {menuOpen ? <Xmark width={22} height={22} /> : <Bars width={22} height={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <nav className="border-t border-white/10 px-4 pb-4 pt-2 md:hidden">
          <div className="mx-auto flex max-w-5xl flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNav(link.id)}
                className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                {link.label}
              </button>
            ))}
            {whatsapp && (
              <a
                href={whatsappHref(whatsapp, salonName)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#25D366] transition-colors hover:bg-white/10"
              >
                <WhatsAppGlyph size={16} />
                WhatsApp
              </a>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
