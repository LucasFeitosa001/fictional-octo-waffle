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
 * Black navbar (salão feminino) — compact and sticky on mobile so the
 * customer never loses navigation during a long service list.
 * Paints into the iOS status-bar safe area (black), so the notification bar is
 * never a bare white strip. The brand shown is the SALON's own (logo + name),
 * never the SalonPass wordmark — the public booking flow is the salon's face.
 * Holds the salon brand, section links, and the login button (logged out) or
 * the account button + notification bell (logged in).
 */
export function TopBar({
  slug,
  isLoggedIn,
  onLogin,
  onAccount,
  onHome,
  whatsapp,
  salonName,
  logoUrl,
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
  /** Salon logo URL — shown in the navbar; falls back to the salon initial. */
  logoUrl?: string | null;
}) {
  const displayName = salonName?.trim() || 'Salão';
  const initial = displayName[0]?.toUpperCase() ?? 'S';
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
    <header className="club-topbar sticky top-0 z-40 shadow-sm">
      <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 md:py-3">
        <button
          type="button"
          onClick={() => handleNav('inicio')}
          aria-label={`${displayName} — início`}
          className="club-touch flex min-w-0 items-center gap-2.5 text-left"
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={displayName}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/15 sm:h-10 sm:w-10"
            />
          ) : (
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-brand text-base text-[#1a1a1a] sm:h-10 sm:w-10"
              style={{ backgroundImage: 'linear-gradient(160deg, #f2b33d 0%, #e59a1f 100%)' }}
            >
              {initial}
            </span>
          )}
          <span className="min-w-0 truncate font-brand text-base font-semibold leading-tight text-white sm:text-lg">
            {displayName}
          </span>
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

        <div className="flex shrink-0 items-center gap-1">
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
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onPress={onLogin}
              className="min-h-10 rounded-full border border-[#f2b33d] bg-transparent px-3 text-[#f2b33d] hover:bg-[#f2b33d]/10 sm:px-4"
            >
              Entrar
            </Button>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            aria-controls="club-mobile-menu"
            className="club-touch grid place-items-center rounded-full text-white transition-colors hover:bg-white/15 md:hidden"
          >
            {menuOpen ? <Xmark width={22} height={22} /> : <Bars width={22} height={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {menuOpen && (
        <nav id="club-mobile-menu" className="border-t border-white/10 px-3 pb-3 pt-2 md:hidden">
          <div className="mx-auto flex max-w-5xl flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNav(link.id)}
                className="min-h-12 rounded-xl px-3 py-3 text-left text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
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
                className="flex min-h-12 items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#25D366] transition-colors hover:bg-white/10"
              >
                <WhatsAppGlyph size={16} />
                WhatsApp
              </a>
            )}
            {isLoggedIn && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onAccount();
                  }}
                  className="flex min-h-12 items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
                >
                  <Person width={18} height={18} />
                  Minha conta
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex min-h-12 items-center gap-2 rounded-xl px-3 py-3 text-left text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ArrowRightFromSquare width={18} height={18} />
                  Sair
                </button>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
