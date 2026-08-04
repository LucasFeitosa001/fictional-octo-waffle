import { getSubdomainSlug, sharedBookingUrl } from '../lib/config';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, Input, Label, Spinner, TextField } from '@heroui/react';
import { Skeleton } from '@heroui/react';
import {
  ChoiceListSkeleton,
  ServiceListSkeleton,
  SlotGridSkeleton,
} from '../components/Skeletons';
import {
  ArrowLeft,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  GeoPin,
  Heart,
  HeartFill,
  Person,
  Sliders,
  Sparkles,
  Star,
  StarFill,
  Tag,
  Xmark,
} from '@gravity-ui/icons';
import { TopBar } from '../components/TopBar';
import { NotificationBell } from '../components/NotificationBell';
import { BottomNav, type BookingNavStep } from '../components/BottomNav';
import { signIn, signOut, useCustomerSession } from '../lib/auth';
import {
  useAvailability,
  useBook,
  useBookingAccent,
  useBookingAppearance,
  usePortal,
  useProfessionals,
  useServices,
  type Portal,
  type Professional,
  type Service,
} from '../lib/booking';
import { useFavorites } from '../lib/favorites';
import { formatDay, formatTime, toDateInput } from '../lib/format';

function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${m}` : `${h}h`;
}

// A Brazilian phone needs at least a DDD + number (10 digits; 11 with the mobile
// 9). We require a phone on every booking so the WhatsApp confirmation/reminders
// can always reach the customer.
function isValidPhone(value: string): boolean {
  return value.replace(/\D/g, '').length >= 10;
}

// Filled WhatsApp brand glyph (gravity-ui has no WhatsApp logo).
function WhatsAppGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M.06 24l1.68-6.13A11.86 11.86 0 0 1 .15 11.9C.15 5.34 5.5 0 12.07 0a11.82 11.82 0 0 1 8.41 3.49 11.82 11.82 0 0 1 3.48 8.42c0 6.56-5.35 11.9-11.9 11.9a11.9 11.9 0 0 1-5.69-1.45L.06 24zm6.6-3.8c1.68.99 3.28 1.59 5.4 1.59 5.45 0 9.89-4.43 9.9-9.88 0-5.46-4.42-9.9-9.88-9.9-5.46 0-9.9 4.43-9.9 9.89 0 2.22.65 3.89 1.75 5.62l-.99 3.62 3.72-.95zm11.4-5.3c-.08-.12-.27-.2-.56-.34-.29-.15-1.72-.85-1.99-.94-.26-.1-.46-.15-.65.14-.19.29-.74.94-.91 1.13-.17.19-.34.22-.62.07-.29-.14-1.23-.45-2.34-1.44-.86-.77-1.45-1.72-1.62-2.01-.17-.29-.02-.45.13-.59.13-.13.29-.34.43-.51.15-.17.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.14-.65-1.57-.89-2.15-.24-.56-.47-.48-.65-.49l-.56-.01c-.19 0-.51.07-.77.36-.26.29-1.01.99-1.01 2.42 0 1.42 1.04 2.8 1.18 2.99.14.19 2.04 3.12 4.95 4.37.69.3 1.23.48 1.65.61.69.22 1.32.19 1.82.12.56-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38z" />
    </svg>
  );
}

// Compact floating access control shown instead of the full black TopBar when
// the salon hides the navbar. Keeps essential auth navigation reachable (login
// when logged out; account + notification bell when logged in) without the bar.
function MinimalAccess({
  slug,
  isLoggedIn,
  onLogin,
  onAccount,
}: {
  slug: string;
  isLoggedIn: boolean;
  onLogin: () => void;
  onAccount: () => void;
}) {
  return (
    <div className="pointer-events-none fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex items-center gap-1.5">
      {isLoggedIn ? (
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--color-soft-border)] bg-[var(--booking-surface)]/90 px-1 py-1 shadow-[var(--shadow-soft)] backdrop-blur-md">
          <NotificationBell slug={slug} enabled={isLoggedIn} />
          <button
            type="button"
            onClick={onAccount}
            aria-label="Minha conta"
            className="grid h-9 w-9 place-items-center rounded-full text-foreground transition-colors hover:bg-black/5"
          >
            <Person width={20} height={20} />
          </button>
        </div>
      ) : (
        <Button
          variant="primary"
          size="sm"
          onPress={onLogin}
          className="pointer-events-auto min-h-9 rounded-full px-4 shadow-[var(--shadow-soft)]"
        >
          Entrar
        </Button>
      )}
    </div>
  );
}

// Next 14 days as selectable chips.
function nextDays(count = 14): Date[] {
  const out: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}

type Step = BookingNavStep;

/**
 * RASCUNHO do agendamento — o que sobrevive ao desvio pelo login com Google.
 *
 * O login social é uma navegação de página inteira: o navegador sai para o
 * Google e volta, e todo `useState` do BookingPage morre no caminho. O dono
 * escolhia serviço, profissional, dia e horário, vinculava a conta e voltava
 * para o passo 1, tendo que refazer tudo. O dado nunca foi "perdido por bug" —
 * ele nunca era guardado. Ver estudo 118.
 *
 * `sessionStorage`, não `localStorage`: rascunho pertence à aba e àquela visita.
 * Em `localStorage` ele sobreviveria dias e ressuscitaria, na visita seguinte,
 * um horário provavelmente já ocupado.
 */
interface RascunhoAgendamento {
  slug: string;
  step: Step;
  services: Service[];
  professional: Professional | null;
  /** ISO do dia escolhido (só a data importa). */
  date: string;
  slot: string | null;
  salvoEm: number;
}

/** Rascunho mais velho que isto é descartado: horário velho é pior que nenhum. */
const RASCUNHO_VALIDADE_MS = 30 * 60 * 1000;

const rascunhoKey = (slug: string) => `sp-club:rascunho:${slug}`;

function lerRascunho(slug: string): RascunhoAgendamento | null {
  if (typeof window === 'undefined') return null;
  try {
    const cru = window.sessionStorage.getItem(rascunhoKey(slug));
    if (!cru) return null;
    const r = JSON.parse(cru) as RascunhoAgendamento;
    const fresco = Date.now() - (r?.salvoEm ?? 0) < RASCUNHO_VALIDADE_MS;
    // Confere o salão: a mesma aba pode ter passado por outro portal.
    if (!fresco || r?.slug !== slug || !Array.isArray(r.services)) {
      window.sessionStorage.removeItem(rascunhoKey(slug));
      return null;
    }
    return r;
  } catch {
    return null;
  }
}

function apagarRascunho(slug: string): void {
  try {
    window.sessionStorage.removeItem(rascunhoKey(slug));
  } catch {
    // Modo privado/quota: seguir sem rascunho é degradação aceitável.
  }
}

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'service', label: 'Serviços', icon: <Tag width={16} height={16} /> },
  { id: 'professional', label: 'Profissional', icon: <Person width={16} height={16} /> },
  { id: 'datetime', label: 'Dia e horário', icon: <Calendar width={16} height={16} /> },
  { id: 'confirm', label: 'Confirmar', icon: <CircleCheck width={16} height={16} /> },
];

export function BookingPage({ slug, basePath = '' }: { slug: string; basePath?: string }) {
  const navigate = useNavigate();
  const { data: session, ehStaff, emailDaConta } = useCustomerSession();
  const isLoggedIn = !!session;
  // Phone already on the logged-in account (additional field on the auth user).
  const userPhone = (session?.user as { phone?: string | null } | undefined)?.phone ?? null;
  /**
   * SEMPRE confirmar o telefone de quem agenda com conta — não só quando falta.
   *
   * Antes era `isLoggedIn && !userPhone`: havendo QUALQUER número na conta, ele
   * entrava no agendamento sem aparecer na tela. E esse número é o destino da
   * confirmação e dos lembretes de WhatsApp; herdado de um cadastro antigo ou de
   * outra pessoa que usou o mesmo aparelho, a mensagem do horário de alguém vai
   * para o celular de outro. Na base havia o MESMO telefone em contas de pessoas
   * diferentes, e foi o que o dono viu virar "o número da empresa" nos dois
   * agendamentos que fez. Ver estudo 121.
   */
  const needsPhone = isLoggedIn;

  // SPA navigation targets for the auth flows. `basePath` is "" on a tenant
  // subdomain (portal at "/") and "/:slug" under path-based routing.
  const loginPath = `${basePath}/login`;
  const accountPath = `${basePath}/conta`;
  const goToLogin = () => navigate(loginPath);
  const goToSignup = () => navigate(loginPath, { state: { signup: true } });
  const goToAccount = () => navigate(accountPath);

  // Navbar "Início": clear any active filter, close the filters panel and scroll
  // back to the top.
  const goHome = () => {
    setFavoritesOnly(false);
    setCategoryFilter(null);
    setShowFilters(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const portal = usePortal(slug);

  // Subdomínio próprio é exclusivo de pro/max. Se o salão for starter e alguém
  // chegar por <slug>.salonpass.com.br, mandamos para o link compartilhado em
  // vez de servir o portal — senão o recurso pago vazaria para o plano básico.
  // Só age quando o portal já respondeu (customSubdomain === false explícito).
  useEffect(() => {
    if (!portal.data) return;
    if (portal.data.customSubdomain !== false) return;
    if (!getSubdomainSlug()) return; // chegou pelo link compartilhado: ok
    window.location.replace(sharedBookingUrl(slug));
  }, [portal.data, slug]);

  // Theme the whole flow with the salon's customized colors (primary/accent/
  // background), falling back to the house theme when the salon hasn't set them.
  useBookingAccent(slug);
  // Per-salon appearance: `hideNavbar` removes the black top bar entirely.
  const appearance = useBookingAppearance(slug);
  const services = useServices(slug);

  // Show the salon name first in the browser tab once the portal loads.
  useEffect(() => {
    if (portal.data?.name) {
      document.title = `${portal.data.name} — Agende seu horário`;
    }
  }, [portal.data?.name]);

  // Ícone da aba = logo do salão. A aba mostrava o ícone do Salonpass para
  // todos; com o logo, a cliente reconhece o salão entre 15 abas abertas.
  // Ver estudo 67.
  useEffect(() => {
    const logo = portal.data?.logoUrl;
    if (!logo) return;
    const anterior = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const href = anterior?.href ?? null;
    const link = anterior ?? document.createElement('link');
    link.rel = 'icon';
    link.href = logo;
    if (!anterior) document.head.appendChild(link);
    return () => {
      if (href) link.href = href;
    };
  }, [portal.data?.logoUrl]);

  // Rascunho lido UMA vez, na montagem: é o que devolve a pessoa ao ponto em
  // que ela estava antes de sair para o Google. Ver estudo 118.
  const rascunho = useRef<RascunhoAgendamento | null>(lerRascunho(slug)).current;

  const [step, setStep] = useState<Step>(rascunho?.step ?? 'service');
  const [selectedServices, setSelectedServices] = useState<Service[]>(rascunho?.services ?? []);
  // Convenience aliases for the primary (first) service — used by downstream
  // queries that still need a single serviceId, and backwards compat.
  const service = selectedServices.length > 0 ? selectedServices[0] : null;
  const [professional, setProfessional] = useState<Professional | null>(rascunho?.professional ?? null);
  const [date, setDate] = useState<Date>(() => {
    const salva = rascunho?.date ? new Date(rascunho.date) : null;
    const d = salva && !Number.isNaN(salva.getTime()) ? salva : new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [slot, setSlot] = useState<string | null>(rascunho?.slot ?? null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  // Phone for a logged-in customer who has none on file yet (e.g. Google sign-up).
  const [accountPhone, setAccountPhone] = useState('');
  // Pré-preenche com o número que a conta já tem, para a pessoa CONFERIR em vez
  // de digitar de novo. Só enquanto ela não mexeu no campo — depois disso o que
  // vale é o que ela escreveu. A sessão chega depois da primeira renderização,
  // por isso é efeito e não valor inicial do useState.
  const telefoneTocado = useRef(false);
  useEffect(() => {
    if (telefoneTocado.current || !userPhone) return;
    setAccountPhone(userPhone);
  }, [userPhone]);
  const [done, setDone] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // Show only the services this visitor has hearted (toggled via the navbar's
  // "Favoritos" tab or the Favoritos filter chip).
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favorites = useFavorites(slug);

  /**
   * Grava o rascunho a cada escolha, para que o desvio pelo login não custe o
   * trabalho já feito.
   *
   * Grava a partir do momento em que HÁ algo escolhido — um rascunho vazio só
   * ocuparia espaço e mascararia o "começar do zero" legítimo. Falha de
   * `sessionStorage` (modo privado, cota) é engolida: perder o rascunho é ruim,
   * derrubar a tela de agendamento é pior.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedServices.length === 0 && !professional && !slot) return;
    try {
      const r: RascunhoAgendamento = {
        slug,
        step,
        services: selectedServices,
        professional,
        date: date.toISOString(),
        slot,
        salvoEm: Date.now(),
      };
      window.sessionStorage.setItem(rascunhoKey(slug), JSON.stringify(r));
    } catch {
      // Sem rascunho o fluxo continua funcionando; só não sobrevive ao login.
    }
  }, [slug, step, selectedServices, professional, date, slot]);

  const serviceIds = selectedServices.map((s) => s.id);
  const professionals = useProfessionals(slug, service?.id ?? null, serviceIds.length > 1 ? serviceIds : undefined);
  const availability = useAvailability(
    slug,
    service?.id ?? null,
    professional?.id ?? null,
    toDateInput(date),
    serviceIds.length > 1 ? serviceIds : undefined,
  );
  const book = useBook(slug);

  const days = useMemo(() => nextDays(14), []);

  // Distinct service categories for the filter chips, in first-seen order.
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    services.data?.data.forEach((s) => {
      if (s.categoryName) seen.set(s.categoryId ?? s.categoryName, s.categoryName);
    });
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [services.data]);

  const visibleServices = useMemo(() => {
    let list = services.data?.data ?? [];
    if (favoritesOnly) list = list.filter((s) => favorites.ids.has(s.id));
    if (categoryFilter)
      list = list.filter((s) => (s.categoryId ?? s.categoryName) === categoryFilter);
    return list;
  }, [services.data, categoryFilter, favoritesOnly, favorites.ids]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function resetFlow() {
    setStep('service');
    setSelectedServices([]);
    setProfessional(null);
    setSlot(null);
    setDone(false);
  }

  function goBack() {
    setStep((s) => STEPS[Math.max(0, STEPS.findIndex((x) => x.id === s) - 1)].id);
  }

  function canOpenStep(target: Step) {
    if (target === 'service') return true;
    if (target === 'professional') return selectedServices.length > 0;
    if (target === 'datetime') return selectedServices.length > 0 && !!professional;
    return selectedServices.length > 0 && !!professional && !!slot;
  }

  function openStep(target: Step) {
    if (canOpenStep(target)) setStep(target);
  }

  // Whether the current step has a valid selection to advance.
  const stepValid =
    step === 'service'
      ? selectedServices.length > 0
      : step === 'professional'
        ? !!professional
        : step === 'datetime'
          ? !!slot
          : canConfirmGuest();

  // Confirm-step readiness: a valid phone is always required so the WhatsApp
  // confirmation can reach the customer — from the guest form, from the account
  // (if it has one), or from the "your WhatsApp" field shown to phone-less users.
  function canConfirmGuest() {
    if (!isLoggedIn) return guestName.trim().length >= 2 && isValidPhone(guestPhone);
    if (needsPhone) return isValidPhone(accountPhone);
    return true;
  }

  function advance() {
    if (step === 'service' && selectedServices.length > 0) setStep('professional');
    else if (step === 'professional' && professional) setStep('datetime');
    else if (step === 'datetime' && slot) setStep('confirm');
    else if (step === 'confirm') confirmBooking();
  }

  async function confirmBooking() {
    if (selectedServices.length === 0 || !professional || !slot) return;
    const guest =
      !isLoggedIn && guestName.trim()
        ? {
            name: guestName.trim(),
            phone: guestPhone.trim() || undefined,
            email: guestEmail.trim() || undefined,
          }
        : undefined;
    await book.mutateAsync({
      serviceId: selectedServices[0].id,
      ...(selectedServices.length > 1 ? { serviceIds: selectedServices.map((s) => s.id) } : {}),
      professionalId: professional.id,
      start: slot,
      guest,
      // Logged-in customers without a phone supply one here; it's persisted.
      phone: needsPhone ? accountPhone.trim() : undefined,
    });
    // O rascunho cumpriu o papel: mantê-lo faria o PRÓXIMO agendamento abrir já
    // preenchido com o horário que a pessoa acabou de marcar.
    apagarRascunho(slug);
    setDone(true);
  }

  const canConfirm = selectedServices.length > 0 && !!professional && !!slot && canConfirmGuest();

  // Total duration / price summaries for multi-select feedback.
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  // Floating CTA label + enabled state per step.
  const ctaLabel =
    step === 'confirm'
      ? 'Confirmar agendamento'
      : step === 'service' && selectedServices.length > 1
        ? `Continuar (${selectedServices.length} serviços)`
        : 'Continuar';
  const ctaDisabled = step === 'confirm' ? !canConfirm : !stepValid;

  // Contextual summary shown left of the CTA (desktop) — mirrors the current
  // selection so the primary action always has context without extra chrome.
  const ctaSummary: { title: string; sub?: string } | null =
    selectedServices.length === 0
      ? null
      : {
          title:
            selectedServices.length === 1
              ? selectedServices[0].name
              : `${selectedServices.length} serviços`,
          sub:
            step === 'datetime' && slot
              ? `${formatDay(slot)} · ${formatTime(slot)}`
              : totalPrice > 0
                ? `${durationLabel(totalDuration)} · R$ ${totalPrice.toFixed(2).replace('.', ',')}`
                : durationLabel(totalDuration),
        };

  return (
    <div className="club-page flex flex-col">
      {/* The salon can hide the black top bar (Setting booking.appearance
          .hideNavbar). When hidden, we still surface a compact floating access
          control so login / account / notifications are never lost. */}
      {appearance.hideNavbar ? (
        <MinimalAccess
          slug={slug}
          isLoggedIn={isLoggedIn}
          onLogin={goToLogin}
          onAccount={goToAccount}
        />
      ) : (
        <TopBar
          slug={slug}
          isLoggedIn={isLoggedIn}
          onLogin={goToLogin}
          onAccount={goToAccount}
          onHome={goHome}
          whatsapp={portal.data?.whatsapp ?? null}
          salonName={portal.data?.name}
          logoUrl={portal.data?.logoUrl ?? null}
        />
      )}

      {!done && (
        <section
          id="inicio"
          className="scroll-mt-20 border-b border-[var(--color-soft-border)] bg-[var(--booking-surface)]/95 shadow-[var(--shadow-soft)] backdrop-blur-xl"
        >
          {/* Capa do salão (estudo 67): imagem do topo com véu ajustável, para o
              nome e o status continuarem legíveis sobre qualquer foto. */}
          <SalonCover url={appearance.coverUrl} overlay={appearance.coverOverlay} />
          <SalonHero
            portal={portal.data}
            isLoading={portal.isLoading}
            agendaPath={`${basePath}/agenda`}
          />
        </section>
      )}

      <main className="club-page-main mx-auto w-full max-w-2xl flex-1 pb-36 pt-2.5 sm:pt-3 md:pb-24">
        {done ? (
          <Card className="mx-auto mt-6 max-w-md border border-[var(--color-soft-border)] bg-[var(--booking-surface)] text-center shadow-[var(--shadow-card)]">
            <Card.Content className="flex flex-col items-center gap-3 px-5 py-8 sm:px-8 sm:py-10">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--booking-accent-2-soft)] text-[var(--booking-accent-2-ink)] shadow-[var(--shadow-soft)]">
                <CircleCheck width={36} height={36} />
              </span>
              <h2 className="font-brand text-xl text-foreground">Agendamento confirmado!</h2>
              <p className="text-sm text-muted">
                {selectedServices.map((s) => s.name).join(', ')} com {professional?.name}
                <br />
                {slot && formatDay(slot)} às {slot && formatTime(slot)}
              </p>
              {isLoggedIn ? (
                <p className="text-sm text-muted">
                  Você pode acompanhar tudo em <strong>Meus agendamentos</strong> e receberá
                  avisos pela sino de notificações.
                </p>
              ) : (
                <p className="text-sm text-muted">
                  Quer acompanhar e receber lembretes? Crie sua conta.
                </p>
              )}
              <div className="mt-2 flex w-full flex-col gap-2">
                {isLoggedIn ? (
                  <Button variant="primary" onPress={() => { resetFlow(); goToAccount(); }}>
                    Ver meus agendamentos
                  </Button>
                ) : (
                  <Button variant="primary" onPress={goToLogin}>
                    Criar minha conta
                  </Button>
                )}
                <Button variant="ghost" onPress={resetFlow}>
                  Fazer outro agendamento
                </Button>
              </div>
            </Card.Content>
          </Card>
        ) : (
          <div id="servicos" className="flex scroll-mt-24 flex-col gap-2.5">
            <StepProgress current={stepIndex} />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    aria-label="Voltar"
                    className="club-touch grid shrink-0 place-items-center rounded-full border border-[var(--color-soft-border)] bg-white text-foreground transition-colors hover:border-[var(--booking-accent)] hover:text-[var(--booking-accent)]"
                  >
                    <ArrowLeft width={18} height={18} />
                  </button>
                )}
                <div className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--booking-accent)] md:hidden">
                    Passo {stepIndex + 1} de {STEPS.length}
                  </span>
                  <h2 className="flex min-w-0 items-center gap-2 font-brand text-[17px] leading-tight text-foreground sm:text-lg">
                  {step === 'service' && (
                    <>
                      Selecione os serviços
                      <HeartFill width={16} height={16} className="shrink-0 text-[var(--booking-accent)]" />
                    </>
                  )}
                  {step === 'professional' && 'Selecione o profissional'}
                  {step === 'datetime' && 'Defina dia e horário'}
                  {step === 'confirm' && 'Revise e confirme'}
                  </h2>
                </div>
              </div>

              {step === 'service' && (
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    showFilters || categoryFilter || favoritesOnly
                      ? 'border-[var(--booking-accent)] text-[var(--booking-accent)]'
                      : 'border-[var(--color-soft-border)] text-foreground hover:border-[var(--booking-accent)] hover:text-[var(--booking-accent)]'
                  }`}
                >
                  <Sliders width={16} height={16} />
                  Filtros
                </button>
              )}
            </div>

            {step === 'service' && showFilters && (
              <div className="club-scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                <FilterChip
                  label="Favoritos"
                  icon={<Heart width={14} height={14} />}
                  active={favoritesOnly}
                  onClick={() => setFavoritesOnly((v) => !v)}
                />
                {categories.length > 0 && (
                  <>
                    <FilterChip
                      label="Todos"
                      active={categoryFilter === null}
                      onClick={() => setCategoryFilter(null)}
                    />
                    {categories.map((c) => (
                      <FilterChip
                        key={c.id}
                        label={c.name}
                        active={categoryFilter === c.id}
                        onClick={() => setCategoryFilter(c.id)}
                      />
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Selection strip: shows count + total when >1 service selected */}
            {step === 'service' && selectedServices.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[var(--booking-accent-soft)] px-3 py-2 text-sm">
                <CircleCheck width={15} height={15} className="shrink-0 text-[var(--booking-accent)]" />
                <span className="font-semibold text-foreground">
                  {selectedServices.length} {selectedServices.length === 1 ? 'serviço selecionado' : 'serviços selecionados'}
                </span>
                <span className="text-muted">·</span>
                <span className="text-muted">{durationLabel(totalDuration)}</span>
                {totalPrice > 0 && (
                  <>
                    <span className="text-muted">·</span>
                    <span className="font-semibold text-foreground">R$ {totalPrice.toFixed(2).replace('.', ',')}</span>
                  </>
                )}
              </div>
            )}

            {/* Step body — only one renders at a time. */}
            <div key={step} className="animate-step flex flex-col gap-2.5">
              {step === 'service' &&
                (services.isLoading ? (
                  <ServiceListSkeleton />
                ) : (services.data?.data.length ?? 0) === 0 ? (
                  <NoServices whatsapp={portal.data?.whatsapp ?? null} salonName={portal.data?.name} />
                ) : visibleServices.length === 0 ? (
                  favoritesOnly ? (
                    <Empty>
                      Você ainda não favoritou nenhum serviço. Toque no ♥ de um serviço para
                      salvá-lo aqui.
                    </Empty>
                  ) : (
                    <Empty>Nenhum serviço nesta categoria.</Empty>
                  )
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {visibleServices.map((s) => (
                      <ServiceCard
                        key={s.id}
                        service={s}
                        selected={selectedServices.some((sel) => sel.id === s.id)}
                        isFavorite={favorites.ids.has(s.id)}
                        onToggleFavorite={() => favorites.toggle(s.id)}
                        onSelect={() => {
                          setSelectedServices((prev) => {
                            const exists = prev.some((sel) => sel.id === s.id);
                            const next = exists
                              ? prev.filter((sel) => sel.id !== s.id)
                              : [...prev, s];
                            setProfessional(null);
                            setSlot(null);
                            return next;
                          });
                        }}
                      />
                    ))}
                  </div>
                ))}

              {/* Galeria e "sobre" só na primeira etapa: é onde a cliente decide
                  se o salão tem a cara dela. Ambos vinham do painel e não
                  apareciam para ninguém (estudo 67). */}
              {step === 'service' && (
                <>
                  <SalonGallery fotos={portal.data?.gallery ?? []} />
                  <SalonAbout about={portal.data?.about} />
                </>
              )}

              {step === 'professional' &&
                (professionals.isLoading ? (
                  <ChoiceListSkeleton />
                ) : (professionals.data?.data.length ?? 0) === 0 ? (
                  <Empty>Nenhum profissional disponível para este serviço.</Empty>
                ) : (
                  <div className="flex flex-col gap-2">
                    {professionals.data?.data.map((p) => (
                      <ChoiceRow
                        key={p.id}
                        selected={professional?.id === p.id}
                        onClick={() => {
                          setProfessional(p);
                          setSlot(null);
                        }}
                        title={p.nickname || p.name}
                        subtitle={p.profession ?? undefined}
                      />
                    ))}
                  </div>
                ))}

              {step === 'datetime' && (
                <div className="flex flex-col gap-2.5">
                  {/* Day picker: a horizontally scrollable row of compact chips
                      (weekday over day number, with the short month when it
                      changes). Keeps the grid of times high on the screen. */}
                  <div>
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Dia
                    </span>
                    <div className="club-scroll-row -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                      {days.map((d, i) => {
                        const active = toDateInput(d) === toDateInput(date);
                        const showMonth = i === 0 || d.getDate() === 1;
                        return (
                          <button
                            key={d.toISOString()}
                            type="button"
                            onClick={() => {
                              setDate(d);
                              setSlot(null);
                            }}
                            className={`flex min-h-14 w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center leading-none transition-all ${
                              active
                                ? 'border-transparent bg-[var(--booking-accent)] text-white shadow-[var(--shadow-pink)]'
                                : 'border-[var(--color-soft-border)] bg-[var(--booking-accent-surface)] text-foreground hover:border-[var(--booking-accent)]'
                            }`}
                          >
                            <span className="text-[10px] font-medium capitalize opacity-80">
                              {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                            </span>
                            <span className="mt-0.5 text-base font-bold leading-none">
                              {d.getDate()}
                            </span>
                            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide opacity-70">
                              {showMonth
                                ? d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
                                : ' '}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Times: a dense pill grid — hour only, no icon — so more slots
                      fit above the fold. */}
                  <div>
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Horário
                    </span>
                    {availability.isLoading ? (
                      <SlotGridSkeleton />
                    ) : (availability.data?.slots.length ?? 0) === 0 ? (
                      <Empty>Sem horários livres neste dia. Tente outra data.</Empty>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                        {availability.data?.slots.map((s) => {
                          const active = slot === s.start;
                          return (
                            <button
                              key={s.start}
                              type="button"
                              onClick={() => setSlot(s.start)}
                              className={`flex min-h-10 items-center justify-center rounded-lg border px-1 py-1.5 text-sm font-semibold tabular-nums transition-all ${
                                active
                                  ? 'border-transparent bg-[var(--booking-accent)] text-white shadow-[var(--shadow-pink)]'
                                  : 'border-[var(--color-soft-border)] bg-[var(--booking-accent-surface)] text-foreground hover:border-[var(--booking-accent)]'
                              }`}
                            >
                              {formatTime(s.start)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 'confirm' && (
                <div className="flex flex-col gap-4">
                  <Card className="border border-[var(--color-soft-border)] bg-[var(--booking-accent-surface)] shadow-[var(--shadow-card)]">
                    <Card.Content className="flex flex-col gap-3 p-4">
                      {selectedServices.map((svc) => (
                        <SummaryRow
                          key={svc.id}
                          icon={<HeartFill width={16} height={16} />}
                          label="Serviço"
                          value={svc.name}
                          sub={durationLabel(svc.durationMin)}
                        />
                      ))}
                      <SummaryRow icon={<Person width={16} height={16} />} label="Profissional" value={professional?.nickname || professional?.name || ''} sub={professional?.profession ?? undefined} />
                      <SummaryRow icon={<Calendar width={16} height={16} />} label="Quando" value={slot ? formatDay(slot) : ''} sub={slot ? formatTime(slot) : undefined} />
                      {selectedServices.some((s) => s.price != null) && (
                        <div className="flex items-center justify-between border-t border-[var(--color-soft-border)] pt-3">
                          <span className="text-sm font-medium text-muted">Total</span>
                          <Price value={selectedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0)} />
                        </div>
                      )}
                      <p className="flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-muted">
                        <Tag width={14} height={14} className="shrink-0 text-[var(--booking-accent)]" />
                        O pagamento é feito apenas no dia, presencialmente no salão.
                      </p>
                    </Card.Content>
                  </Card>

                  {/* Quem agenda com conta CONFIRMA o WhatsApp aqui, sempre —
                      inclusive quem já tem número gravado. É o destino da
                      confirmação e dos lembretes; um número herdado de cadastro
                      antigo manda a mensagem do horário para o aparelho de outra
                      pessoa. Ver estudo 121. */}
                  {needsPhone && (
                    <Card className="border border-[var(--color-soft-border)] bg-[var(--booking-accent-surface)] shadow-[var(--shadow-card)]">
                      <Card.Content className="flex flex-col gap-3 p-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <WhatsAppGlyph size={16} />
                          {userPhone ? 'Confirme seu WhatsApp' : 'Seu WhatsApp'}
                        </h3>
                        <p className="text-xs text-muted">
                          {userPhone
                            ? 'Confira se o número está certo — é nele que a confirmação e os lembretes chegam.'
                            : 'Para enviarmos a confirmação e os lembretes do seu horário.'}
                        </p>
                        <TextField
                          value={accountPhone}
                          onChange={(v) => {
                            telefoneTocado.current = true;
                            setAccountPhone(v);
                          }}
                          type="tel"
                          isRequired
                        >
                          <Label>Telefone (WhatsApp)</Label>
                          <Input placeholder="(00) 00000-0000" />
                        </TextField>
                      </Card.Content>
                    </Card>
                  )}

                  {/* CONTA DE ADMINISTRADOR — o login funcionou, mas aquela conta
                      não agenda. Sem este aviso a tela voltava a oferecer "Crie
                      sua conta" como se nada tivesse acontecido, e quem acabara
                      de entrar concluía que "nem conectou". Ver estudo 119. */}
                  {ehStaff && (
                    <Card className="border border-[var(--color-soft-border)] bg-[var(--booking-accent-surface)] shadow-[var(--shadow-card)]">
                      <Card.Content className="flex flex-col gap-3 p-4">
                        <h3 className="text-sm font-semibold text-foreground">
                          Esta conta é do salão, não de cliente
                        </h3>
                        <p className="text-xs text-muted">
                          {emailDaConta ? <><strong>{emailDaConta}</strong> é </> : 'Esta é '}
                          uma conta de administrador e não pode agendar como cliente. Entre com
                          outra conta ou siga sem conta — logo abaixo.
                        </p>
                        <Button
                          variant="primary"
                          className="w-full"
                          onPress={() => void signOut().then(() => window.location.reload())}
                        >
                          Sair e entrar com outra conta
                        </Button>
                      </Card.Content>
                    </Card>
                  )}

                  {!isLoggedIn && !ehStaff && (
                    <>
                      <Card className="border border-[var(--color-soft-border)] bg-[var(--booking-accent-surface)] shadow-[var(--shadow-card)]">
                        <Card.Content className="flex flex-col gap-3 p-4">
                          <h3 className="text-sm font-semibold text-foreground">
                            Crie sua conta
                          </h3>
                          <p className="text-xs text-muted">
                            Acompanhe seus agendamentos, receba lembretes e agende mais rápido
                            da próxima vez.
                          </p>
                          <Button variant="primary" className="w-full" onPress={goToSignup}>
                            Criar conta
                          </Button>
                          {portal.data?.googleEnabled && (
                            <Button
                              variant="secondary"
                              className="w-full"
                              onPress={() =>
                                void signIn.social({
                                  provider: 'google',
                                  callbackURL: window.location.origin + loginPath.replace(/\/login$/, ''),
                                  // Sem isto, a falha do OAuth despeja o cliente
                                  // na raiz do PAINEL (app.salonpass.com.br) —
                                  // ver estudo 117. Aqui ela volta para a tela de
                                  // login do portal, que mostra o motivo.
                                  errorCallbackURL: window.location.origin + loginPath,
                                })
                              }
                            >
                              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                                <path
                                  fill="#4285F4"
                                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
                                />
                                <path
                                  fill="#34A853"
                                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
                                />
                                <path
                                  fill="#FBBC05"
                                  d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
                                />
                                <path
                                  fill="#EA4335"
                                  d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
                                />
                              </svg>
                              Continuar com Google
                            </Button>
                          )}
                          <button
                            type="button"
                            onClick={goToLogin}
                            className="text-center text-sm text-muted hover:text-foreground"
                          >
                            Já tem conta?{' '}
                            <span className="font-semibold text-[var(--booking-accent)]">Entrar</span>
                          </button>
                        </Card.Content>
                      </Card>

                      <div className="flex items-center gap-3">
                        <span className="h-px flex-1 bg-[var(--color-soft-border)]" />
                        <span className="text-xs font-medium text-muted">
                          ou agende sem conta
                        </span>
                        <span className="h-px flex-1 bg-[var(--color-soft-border)]" />
                      </div>

                      <Card className="border border-[var(--color-soft-border)] bg-[var(--booking-accent-surface)] shadow-[var(--shadow-card)]">
                        <Card.Content className="flex flex-col gap-3 p-4">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Person width={16} height={16} className="text-[var(--booking-accent)]" />
                            Seus dados
                          </h3>
                          <TextField value={guestName} onChange={setGuestName} isRequired>
                            <Label>Nome</Label>
                            <Input placeholder="Seu nome" />
                          </TextField>
                          <TextField value={guestPhone} onChange={setGuestPhone} type="tel" isRequired>
                            <Label>Telefone (WhatsApp)</Label>
                            <Input placeholder="(00) 00000-0000" />
                          </TextField>
                          <TextField value={guestEmail} onChange={setGuestEmail} type="email">
                            <Label>E-mail (opcional)</Label>
                            <Input placeholder="voce@email.com" />
                          </TextField>
                        </Card.Content>
                      </Card>
                    </>
                  )}

                  {book.isError && (
                    <p className="text-center text-xs text-danger">
                      Não foi possível agendar. Tente outro horário.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating advance / confirm CTA — always visible, sits above the
          BottomNav on mobile. Compact: full-width pill with a per-step label and
          a live summary (selected count · total) on the left when relevant. */}
      {!done && (
        <div className="club-action-dock pointer-events-none fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-4 pb-2 pt-5 md:bottom-0 md:bg-transparent md:pb-4 md:pt-0">
          <div className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-3">
            {ctaSummary && (
              <div className="hidden min-w-0 flex-col leading-tight sm:flex">
                <span className="truncate text-sm font-semibold text-foreground">
                  {ctaSummary.title}
                </span>
                {ctaSummary.sub && (
                  <span className="truncate text-xs text-muted">{ctaSummary.sub}</span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={advance}
              disabled={ctaDisabled || book.isPending}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 text-base font-semibold transition-all sm:ml-auto sm:w-auto sm:min-w-52 ${
                ctaDisabled || book.isPending
                  ? 'cursor-not-allowed bg-[var(--booking-accent-disabled)] text-white/80'
                  : 'bg-[var(--booking-accent)] text-white shadow-[var(--shadow-pink)] hover:bg-[var(--booking-accent-strong)] active:scale-[0.99]'
              }`}
            >
              {book.isPending ? <Spinner size="sm" /> : null}
              {ctaLabel}
            </button>
          </div>
        </div>
      )}

      {!done && (
        <BottomNav
          step={step}
          onStepChange={openStep}
          canOpen={canOpenStep}
        />
      )}
    </div>
  );
}

// Compact stepper: a single dense line — "Passo 2 de 4 · Profissional" —
// over a slim 4-segment progress bar. Minimal vertical footprint so the active
// step's content sits high on the phone screen (Belasis-style).
function StepProgress({ current }: { current: number }) {
  return (
    <div
      aria-label={`Passo ${current + 1} de ${STEPS.length}: ${STEPS[current]?.label ?? ''}`}
      className="hidden grid-cols-4 gap-2 md:grid"
    >
      {STEPS.map((item, index) => {
        const active = index === current;
        const complete = index < current;
        return (
          <div
            key={item.id}
            className={[
              'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
              active
                ? 'border-[var(--booking-accent)] bg-[var(--booking-accent-soft)] text-[var(--booking-accent-ink)]'
                : complete
                  ? 'border-[#DCE9DF] bg-[#F0F8F2] text-[#378251]'
                  : 'border-[var(--color-soft-border)] bg-white/70 text-muted',
            ].join(' ')}
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white shadow-sm">
              {complete ? <CircleCheck width={14} height={14} /> : item.icon}
            </span>
            <span className="truncate">{index + 1}. {item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// "19:00" → "19h", "19:30" → "19h30" — friendly Brazilian hour label.
function hhmmLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

// Five stars that fill proportionally to the average (0–5). Always renders all
// five outlined stars; a clipped overlay of filled stars grows with the score —
// so a salon with no reviews shows five empty stars and the count "0 avaliações".
function StarRating({ average, size = 15 }: { average: number; size?: number }) {
  const pct = Math.max(0, Math.min(1, average / 5)) * 100;
  const stars = [0, 1, 2, 3, 4];
  return (
    <span
      className="relative inline-flex"
      role="img"
      aria-label={`${average.toFixed(1)} de 5 estrelas`}
    >
      <span className="flex">
        {stars.map((i) => (
          <Star key={i} width={size} height={size} className="text-[#d9d2c4]" />
        ))}
      </span>
      <span className="absolute inset-0 flex overflow-hidden" style={{ width: `${pct}%` }}>
        {stars.map((i) => (
          <StarFill key={i} width={size} height={size} className="shrink-0 text-[#f2b33d]" />
        ))}
      </span>
    </span>
  );
}

// Salon header content: logo on the left, with the salon name, its plan badge,
// a "Ver agenda" jump link and a meta line (open status · rating · location) on
// the right. Contained and left-aligned, aligned to the page gutter like the
// sections below it. Each meta element renders only when its data is present.
function SalonHero({
  portal,
  isLoading,
  agendaPath,
}: {
  portal?: Portal;
  isLoading: boolean;
  agendaPath: string;
}) {
  const name = portal?.name ?? 'Salão';
  const initial = (portal?.name?.trim()?.[0] ?? 'S').toUpperCase();
  const rating = portal?.rating ?? null;
  const location = portal?.location ?? null;
  const plan = portal?.plan ?? null;

  // While the portal loads, mirror the header's shape with skeletons instead of
  // a "Carregando…" placeholder, so the salon identity fills in smoothly.
  if (isLoading && !portal) {
    return (
      <div className="mx-auto flex w-full max-w-2xl items-start gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
        <Skeleton className="h-12 w-12 shrink-0 rounded-xl sm:h-14 sm:w-14" />
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
          <Skeleton className="h-5 w-2/5 rounded-md" />
          <Skeleton className="h-4 w-3/5 rounded-md" />
          <Skeleton className="h-8 w-36 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl items-start gap-3 px-4 py-3 sm:px-6 sm:py-3.5">
      {portal?.logoUrl ? (
        <img
          src={portal.logoUrl}
          alt={name}
          className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-soft-border)] sm:h-14 sm:w-14"
        />
      ) : (
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-brand text-lg text-[var(--booking-accent-ink)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-soft-border)] sm:h-14 sm:w-14 sm:text-xl"
          style={{
            backgroundImage:
              'linear-gradient(160deg, var(--booking-accent-2-soft) 0%, var(--booking-accent-soft) 100%)',
          }}
          aria-hidden
        >
          {initial}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="break-words font-brand text-[17px] leading-tight text-foreground sm:text-lg">
              {name}
            </h1>
            {plan && (
              <span className="shrink-0 rounded-full bg-[var(--booking-accent-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--booking-accent-ink)]">
                {plan}
              </span>
            )}
          </div>
          {/* Desktop: a text link. Mobile: a compact calendar icon button, so the
              salon name isn't squeezed/truncated by the longer label. */}
          <Link
            to={agendaPath}
            aria-label="Ver disponibilidade"
            title="Ver disponibilidade"
            className="club-touch grid shrink-0 place-items-center text-[var(--booking-accent)] transition-opacity hover:opacity-70"
          >
            <span className="hidden whitespace-nowrap pt-1 text-sm font-semibold sm:inline">
              Ver disponibilidade
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--booking-accent-soft)] sm:hidden">
              <Calendar width={18} height={18} />
            </span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
          <OpenStatus open={portal?.open} hours={portal?.todayHours ?? null} />
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <StarRating average={rating?.average ?? 0} />
            <span className="font-normal text-muted">
              {rating?.count ? `${rating.average.toFixed(1)} ` : ''}({rating?.count ?? 0}{' '}
              {(rating?.count ?? 0) === 1 ? 'avaliação' : 'avaliações'})
            </span>
          </span>
          {location && (
            <span className="flex min-w-0 items-center gap-1">
              <GeoPin width={14} height={14} className="shrink-0 text-muted" />
              <span className="truncate">{location}</span>
            </span>
          )}
        </div>

        {portal?.whatsapp && (
          <a
            href={`https://wa.me/${portal.whatsapp}?text=${encodeURIComponent(
              `Olá! Vim pelo agendamento online da ${name} e gostaria de tirar uma dúvida.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
          >
            <WhatsAppGlyph size={16} />
            Falar no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

// Compact open/closed indicator for the salon header meta line. Hours unknown
// (no schedules) → renders nothing so the line omits the status.
/** Capa do topo da página pública. Sem imagem, não ocupa espaço. Estudo 67. */
function SalonCover({ url, overlay }: { url: string | null; overlay: number }) {
  if (!url) return null;
  const veu = Math.min(80, Math.max(0, overlay)) / 100;
  return (
    <div className="relative h-32 w-full overflow-hidden sm:h-44">
      <img src={url} alt="" className="h-full w-full object-cover" aria-hidden />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,${veu * 0.4}) 0%, rgba(0,0,0,${veu}) 100%)`,
        }}
        aria-hidden
      />
    </div>
  );
}

/**
 * Galeria do salão — as fotos que o dono já subia no painel e que NUNCA
 * apareciam para o cliente (estudo 67). Faixa rolável, sem cortar no celular.
 */
function SalonGallery({ fotos }: { fotos: { url: string; caption: string | null }[] }) {
  if (!fotos.length) return null;
  return (
    <section className="mt-4">
      <h2 className="px-1 font-brand text-[15px] text-foreground">O salão por dentro</h2>
      <div className="hide-scrollbar mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
        {fotos.map((f) => (
          <figure
            key={f.url}
            className="relative h-36 w-56 shrink-0 snap-start overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-card)] sm:h-44 sm:w-64"
          >
            <img
              src={f.url}
              alt={f.caption ?? ''}
              loading="lazy"
              className="h-full w-full object-cover"
            />
            {f.caption && (
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-1.5 text-[11px] text-white">
                {f.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Descrição + redes do salão. Também só existiam no painel. Estudo 67. */
function SalonAbout({
  about,
}: {
  about?: {
    description: string | null;
    website: string | null;
    instagram: string | null;
    facebook: string | null;
  };
}) {
  if (!about) return null;
  const redes = [
    { rotulo: 'Instagram', url: about.instagram },
    { rotulo: 'Facebook', url: about.facebook },
    { rotulo: 'Site', url: about.website },
  ].filter((r): r is { rotulo: string; url: string } => Boolean(r.url));
  if (!about.description && redes.length === 0) return null;
  const comProtocolo = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
  return (
    <section className="mt-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
      {about.description && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {about.description}
        </p>
      )}
      {redes.length > 0 && (
        <div className={about.description ? 'mt-3 flex flex-wrap gap-2' : 'flex flex-wrap gap-2'}>
          {redes.map((r) => (
            <a
              key={r.rotulo}
              href={comProtocolo(r.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[var(--color-soft-border)] px-3 py-1.5 text-xs font-semibold text-[var(--booking-accent-ink)] transition-colors hover:bg-[var(--booking-accent-soft)]"
            >
              {r.rotulo}
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function OpenStatus({
  open,
  hours,
}: {
  open?: boolean | null;
  hours: { start: string; end: string } | null;
}) {
  if (open === null || open === undefined) return null;

  const detail = open
    ? hours && `até ${hhmmLabel(hours.end)}`
    : hours && `abre ${hhmmLabel(hours.start)}`;

  return (
    <span className={`flex items-center gap-1.5 font-semibold ${open ? 'text-[#2faa6a]' : 'text-muted'}`}>
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${open ? 'bg-[#2faa6a]' : 'bg-[#bfaf9e]'}`}
        style={open ? { boxShadow: '0 0 0 3px rgba(47,170,106,0.18)' } : undefined}
      />
      {open ? 'Aberto agora' : 'Fechado'}
      {detail && <span className="font-medium text-muted">· {detail}</span>}
    </span>
  );
}

function ChoiceRow({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all ${
        selected
          ? 'border-[var(--booking-accent)] bg-[var(--booking-accent-soft)] shadow-[var(--shadow-pink)]'
          : 'border-[var(--color-soft-border)] bg-[var(--booking-accent-surface)] hover:border-[var(--booking-accent)]'
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted">{subtitle}</span>}
      </span>
      <span
        className={`ml-3 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
          selected ? 'border-[var(--booking-accent)] bg-[var(--booking-accent)] text-white' : 'border-default-300'
        }`}
      >
        {selected && <CircleCheck width={14} height={14} />}
      </span>
    </button>
  );
}

function ServiceCard({
  service,
  selected,
  isFavorite,
  onToggleFavorite,
  onSelect,
}: {
  service: Service;
  selected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
}) {
  const badge = service.favorite
    ? { label: 'Mais pedido', icon: <Star width={12} height={12} />, cls: 'bg-[var(--booking-accent-soft)] text-[var(--booking-accent-ink)]' }
    : service.isNew
      ? { label: 'Novidade', icon: <Sparkles width={12} height={12} />, cls: 'bg-[var(--booking-accent-soft)] text-[var(--booking-accent-ink)]' }
      : null;

  return (
    <div
      onClick={onSelect}
      aria-pressed={selected}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`club-no-touch-lift relative flex w-full cursor-pointer flex-row overflow-hidden rounded-xl border bg-white text-left transition-all ${
        selected
          ? 'border-[var(--booking-accent)] shadow-[var(--shadow-soft)]'
          : 'border-[var(--color-soft-border)] shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]'
      }`}
    >
      {/* Favorite toggle — hearts the service into this visitor's favorites
          (stored locally), filterable via the navbar's "Favoritos" tab. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        aria-pressed={isFavorite}
        className="absolute right-1.5 top-1.5 z-10 grid h-9 w-9 place-items-center rounded-lg bg-white/90 text-[var(--booking-accent)] shadow-[var(--shadow-soft)] backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
      >
        {isFavorite ? (
          <HeartFill width={18} height={18} />
        ) : (
          <Heart width={18} height={18} className="text-muted" />
        )}
      </button>

      {/* Service photos: a swipeable carousel when there's more than one,
          a single cover when there's one, and a camera placeholder otherwise. */}
      <ServicePhoto service={service} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 p-3">
        {badge && (
          <span
            className={`mr-10 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.cls}`}
          >
            {badge.icon}
            {badge.label}
          </span>
        )}

        <h3 className="pr-10 font-brand text-[15px] leading-tight text-foreground">{service.name}</h3>

        {service.description && (
          <p className="line-clamp-2 text-xs leading-snug text-muted">{service.description}</p>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <Clock width={13} height={13} />
            {durationLabel(service.durationMin)}
          </span>
          {service.categoryName && (
            <span className="flex items-center gap-1">
              <Tag width={13} height={13} />
              {service.categoryName}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <Price value={service.price} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
              selected
                ? 'bg-[var(--booking-accent)] text-white shadow-[var(--shadow-pink)]'
                : 'border border-[var(--booking-accent)] text-[var(--booking-accent)] hover:bg-[var(--booking-accent-soft)]'
            }`}
          >
            {selected && <CircleCheck width={14} height={14} />}
            {selected ? 'Selecionado' : 'Selecionar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// The photo column of a ServiceCard. One image → a plain cover. Several →
// a horizontally swipeable, scroll-snapped carousel with dot indicators that
// track the active slide. None → the pink camera placeholder.
function ServicePhoto({ service }: { service: Service }) {
  const images = service.imageUrls?.length
    ? service.imageUrls
    : service.imageUrl
      ? [service.imageUrl]
      : [];
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (images.length === 0) {
    return (
      <div
        className="relative min-h-28 w-24 shrink-0 self-stretch sm:w-32"
        // O fundo da foto era rosa cravado em três lugares; agora deriva da cor
        // escolhida pelo salão (--booking-photo, padrão = o rosa da casa), com
        // o ícone num tom mais forte da MESMA cor. Ver estudo 66.
        style={{
          backgroundImage:
            'radial-gradient(120px 120px at 30% 20%, color-mix(in oklab, var(--booking-photo, #f08ca5) 30%, transparent), transparent 70%), linear-gradient(160deg, color-mix(in oklab, var(--booking-photo, #f08ca5) 22%, #fff) 0%, color-mix(in oklab, var(--booking-photo, #f08ca5) 46%, #fff) 100%)',
        }}
        aria-hidden
      >
        <span
          className="absolute inset-0 grid place-items-center"
          style={{ color: 'color-mix(in oklab, var(--booking-photo, #f08ca5) 72%, #000)' }}
        >
          <Camera width={30} height={30} />
        </span>
      </div>
    );
  }

  // Tapping the photo opens the fullscreen gallery so customers can study the
  // examples and before/after comparisons up close.
  const openGallery = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLightbox(true);
  };

  return (
    <div className="relative min-h-28 w-24 shrink-0 self-stretch sm:w-32">
      {images.length === 1 ? (
        <img
          src={images[0]}
          alt=""
          onClick={openGallery}
          className="absolute inset-0 h-full w-full cursor-zoom-in object-cover"
        />
      ) : (
        <>
          <div
            // Stop the card's onSelect from firing while the user swipes the gallery.
            onClick={(e) => e.stopPropagation()}
            onScroll={(e) => {
              const el = e.currentTarget;
              setIndex(Math.round(el.scrollLeft / el.clientWidth));
            }}
            className="hide-scrollbar absolute inset-0 flex snap-x snap-mandatory overflow-x-auto"
          >
            {images.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                onClick={openGallery}
                className="h-full w-full shrink-0 cursor-zoom-in snap-center object-cover"
                style={{ width: '100%' }}
              />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-3 bg-white' : 'w-1.5 bg-white/60'
                }`}
                style={{ boxShadow: '0 0 2px rgba(0,0,0,0.4)' }}
              />
            ))}
          </div>
        </>
      )}

      {/* "Ver fotos" affordance — invites tapping to open the full gallery. */}
      <button
        type="button"
        onClick={openGallery}
        className="absolute left-1.5 top-1.5 inline-flex min-h-8 items-center gap-1 rounded-lg bg-black/60 px-2 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm transition-opacity hover:opacity-90"
      >
        <Camera width={12} height={12} />
        {images.length > 1 ? `${images.length} fotos` : 'Ver foto'}
      </button>

      {lightbox && (
        <PhotoLightbox
          images={images}
          startIndex={index}
          onClose={() => setLightbox(false)}
        />
      )}
    </div>
  );
}

// Fullscreen, swipeable photo gallery. Renders into document.body (via a portal)
// so it's never clipped by the card's rounded/overflow-hidden container, and
// fills the viewport with object-contain images, a counter, dots and arrows.
function PhotoLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(startIndex);

  // Open on the photo the customer was looking at.
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollLeft = startIndex * el.clientWidth;
  }, [startIndex]);

  // Close on ESC and lock background scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-4 text-white">
        <span className="text-sm font-medium tabular-nums">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/15"
        >
          <Xmark width={22} height={22} />
        </button>
      </div>

      <div className="relative flex-1">
        <div
          ref={scrollerRef}
          onClick={(e) => e.stopPropagation()}
          onScroll={(e) =>
            setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))
          }
          className="hide-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
        >
          {images.map((src, i) => (
            <div
              key={i}
              className="flex h-full w-full shrink-0 snap-center items-center justify-center p-4"
              style={{ width: '100%' }}
            >
              <img src={src} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          ))}
        </div>

        {/* Desktop prev/next arrows. */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goTo(index - 1);
              }}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:grid"
            >
              <ChevronLeft width={22} height={22} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goTo(index + 1);
              }}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 place-items-center rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 sm:grid"
            >
              <ChevronRight width={22} height={22} />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 py-4">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

// A pill in the category filter row above the service list.
function FilterChip({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-transparent bg-[var(--booking-accent)] text-white shadow-[var(--shadow-pink)]'
          : 'border-[var(--color-soft-border)] bg-white text-foreground hover:border-[var(--booking-accent)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// One labelled line in the confirm-step summary card.
function SummaryRow({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--booking-accent-soft)] text-[var(--booking-accent)]">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
        <span className="break-words text-sm font-semibold text-foreground">
          {value}
          {sub && <span className="ml-1.5 font-normal text-muted">· {sub}</span>}
        </span>
      </div>
    </div>
  );
}

/** Price with a small "R$", a large integer part and small cents — like the design. */
function Price({ value }: { value: string | number | null }) {
  if (value == null) return null;
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  const [intPart, cents] = n.toFixed(2).split('.');
  const intFmt = new Intl.NumberFormat('pt-BR').format(Number(intPart));
  return (
    <span className="flex items-baseline gap-0.5 text-foreground">
      <span className="text-xs font-medium text-muted">R$</span>
      <span className="text-xl font-bold leading-none">{intFmt}</span>
      <span className="text-sm font-semibold">,{cents}</span>
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-sm text-muted">{children}</p>;
}

// Friendlier empty state for a salon that hasn't published any online-bookable
// service yet (or a brand-new/demo tenant). Explains it clearly and offers the
// WhatsApp shortcut when the salon has a number on file — so a visitor is never
// left at a dead end.
function NoServices({ whatsapp, salonName }: { whatsapp: string | null; salonName?: string }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-[var(--color-soft-border)] bg-white/70 px-5 py-8 text-center shadow-[var(--shadow-card)]">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--booking-accent-soft)] text-[var(--booking-accent)]">
        <Tag width={22} height={22} />
      </span>
      <div>
        <p className="font-brand text-base text-foreground">Agendamento online em preparação</p>
        <p className="mt-1 text-sm text-muted">
          Este salão ainda não liberou serviços para agendar pela internet. Fale com a gente para
          reservar seu horário.
        </p>
      </div>
      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
            `Olá! Vim pelo agendamento online${salonName ? ` da ${salonName}` : ''} e gostaria de agendar um horário.`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
        >
          <WhatsAppGlyph size={16} />
          Falar no WhatsApp
        </a>
      )}
    </div>
  );
}
