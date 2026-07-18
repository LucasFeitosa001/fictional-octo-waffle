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
import { BottomNav } from '../components/BottomNav';
import { signIn, useCustomerSession } from '../lib/auth';
import {
  useAvailability,
  useBook,
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

type Step = 'service' | 'professional' | 'datetime' | 'confirm';
const STEPS: { id: Step; label: string }[] = [
  { id: 'service', label: 'Serviço' },
  { id: 'professional', label: 'Profissional' },
  { id: 'datetime', label: 'Horário' },
  { id: 'confirm', label: 'Confirmar' },
];

export function BookingPage({ slug, basePath = '' }: { slug: string; basePath?: string }) {
  const navigate = useNavigate();
  const { data: session } = useCustomerSession();
  const isLoggedIn = !!session;
  // First name for the hero greeting ("Olá, Maria 👋") when logged in.
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? null;
  // Phone already on the logged-in account (additional field on the auth user).
  const userPhone = (session?.user as { phone?: string | null } | undefined)?.phone ?? null;
  // Logged in but without a phone → we must collect one before booking.
  const needsPhone = isLoggedIn && !userPhone;

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
  // Navbar "Favoritos": jump to the service list filtered to hearted services.
  const showFavorites = () => {
    setStep('service');
    setFavoritesOnly(true);
    setShowFilters(true);
    document.getElementById('servicos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const portal = usePortal(slug);
  const services = useServices(slug);

  // Show the salon name first in the browser tab once the portal loads.
  useEffect(() => {
    if (portal.data?.name) {
      document.title = `${portal.data.name} — Agende seu horário`;
    }
  }, [portal.data?.name]);

  const [step, setStep] = useState<Step>('service');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  // Convenience aliases for the primary (first) service — used by downstream
  // queries that still need a single serviceId, and backwards compat.
  const service = selectedServices.length > 0 ? selectedServices[0] : null;
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [slot, setSlot] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  // Phone for a logged-in customer who has none on file yet (e.g. Google sign-up).
  const [accountPhone, setAccountPhone] = useState('');
  const [done, setDone] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  // Show only the services this visitor has hearted (toggled via the navbar's
  // "Favoritos" tab or the Favoritos filter chip).
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const favorites = useFavorites(slug);

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

  return (
    <div className="club-page flex flex-col">
      <TopBar
        slug={slug}
        isLoggedIn={isLoggedIn}
        onLogin={goToLogin}
        onAccount={goToAccount}
        onHome={goHome}
        whatsapp={portal.data?.whatsapp ?? null}
        salonName={portal.data?.name}
      />

      {!done && (
        <>
          {/* Dark backdrop: the full-width salon header below is pulled up to
              overlap its lower edge, so this reads as a layered background. */}
          <header
            id="inicio"
            className="w-full scroll-mt-24 text-white"
            style={{
              backgroundImage:
                'radial-gradient(560px 240px at 100% 0%, rgba(242,179,61,0.20), transparent 70%), linear-gradient(180deg, #1a1a1a 0%, #111111 100%)',
            }}
          >
            <div className="mx-auto w-full max-w-2xl px-4 pb-20 pt-5 sm:px-6 sm:pb-24 sm:pt-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f2b33d]">
                Agendamento online
              </p>
              {firstName && (
                <h2 className="mt-1 font-brand text-xl leading-tight text-white sm:text-2xl">
                  Olá, {firstName} 👋
                </h2>
              )}
              <p className="mt-1.5 max-w-sm text-sm text-white/60">
                Escolha o serviço, o profissional e o melhor horário pra você.
              </p>
            </div>
          </header>

          {/* Salon header card — full viewport width (it's a direct child of the
              page column, so it isn't capped by the max-w-2xl main). Its rounded
              top rides up over the dark backdrop; the content stays centered. */}
          <div
            className="-mt-14 overflow-hidden rounded-t-[26px] border-b border-[var(--color-soft-border)] shadow-[var(--shadow-pop)] sm:-mt-16 sm:rounded-t-[32px]"
            style={{
              backgroundImage:
                'radial-gradient(220px 120px at 12% 0%, rgba(242,179,61,0.12), transparent 70%), linear-gradient(180deg, #fffdf8 0%, #fbf3e3 100%)',
            }}
          >
            <SalonHero
              portal={portal.data}
              isLoading={portal.isLoading}
              agendaPath={`${basePath}/agenda`}
            />
          </div>
        </>
      )}

      <main className="club-page-main mx-auto w-full max-w-2xl flex-1 pb-48 pt-5 sm:pt-7 md:pb-24">
        {done ? (
          <Card className="mx-auto mt-6 max-w-md border border-[var(--color-soft-border)] bg-[#fffdf8] text-center shadow-[var(--shadow-card)]">
            <Card.Content className="flex flex-col items-center gap-3 px-5 py-8 sm:px-8 sm:py-10">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-[#FCE4EA] text-[#F08CA5] shadow-[var(--shadow-soft)]">
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
          <div id="servicos" className="flex scroll-mt-24 flex-col gap-5">
            <StepProgress current={stepIndex} />

            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    aria-label="Voltar"
                    className="club-touch grid shrink-0 place-items-center rounded-full border border-[var(--color-soft-border)] bg-white text-foreground transition-colors hover:border-[var(--color-pink)] hover:text-[var(--color-pink)]"
                  >
                    <ArrowLeft width={18} height={18} />
                  </button>
                )}
                <h2 className="flex min-w-0 items-center gap-2 font-brand text-xl leading-tight text-foreground sm:text-2xl">
                  {step === 'service' && (
                    <>
                      Escolha os serviços
                      <HeartFill width={20} height={20} className="shrink-0 text-[var(--color-pink)]" />
                    </>
                  )}
                  {step === 'professional' && 'Escolha o profissional'}
                  {step === 'datetime' && 'Escolha o dia e horário'}
                  {step === 'confirm' && 'Confirme seu agendamento'}
                </h2>
              </div>

              {step === 'service' && (
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    showFilters || categoryFilter || favoritesOnly
                      ? 'border-[var(--color-pink)] text-[var(--color-pink)]'
                      : 'border-[var(--color-soft-border)] text-foreground hover:border-[var(--color-pink)] hover:text-[var(--color-pink)]'
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-[#FCE4EA] px-3.5 py-3 text-sm">
                <CircleCheck width={16} height={16} className="shrink-0 text-[var(--color-pink)]" />
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
            <div key={step} className="animate-step flex flex-col gap-3">
              {step === 'service' &&
                (services.isLoading ? (
                  <ServiceListSkeleton />
                ) : (services.data?.data.length ?? 0) === 0 ? (
                  <Empty>Nenhum serviço disponível para agendamento online.</Empty>
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
                  <div className="flex flex-col gap-3">
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
                <>
                  <div className="club-scroll-row -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {days.map((d) => {
                      const active = toDateInput(d) === toDateInput(date);
                      return (
                        <button
                          key={d.toISOString()}
                          type="button"
                          onClick={() => {
                            setDate(d);
                            setSlot(null);
                          }}
                          className={`flex min-h-16 min-w-16 shrink-0 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-all ${
                            active
                              ? 'border-transparent bg-[var(--color-pink)] text-white shadow-[var(--shadow-pink)]'
                              : 'border-[var(--color-soft-border)] bg-[#FFF1EE] text-foreground hover:border-[var(--color-pink)]'
                          }`}
                        >
                          <span className="text-[11px] capitalize">
                            {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                          </span>
                          <span className="text-base font-semibold leading-tight">
                            {d.getDate()}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {availability.isLoading ? (
                    <SlotGridSkeleton />
                  ) : (availability.data?.slots.length ?? 0) === 0 ? (
                    <Empty>Sem horários livres neste dia. Tente outra data.</Empty>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {availability.data?.slots.map((s) => {
                        const active = slot === s.start;
                        return (
                          <button
                            key={s.start}
                            type="button"
                            onClick={() => setSlot(s.start)}
                            className={`flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-sm font-medium transition-all ${
                              active
                                ? 'border-transparent bg-[var(--color-pink)] text-white shadow-[var(--shadow-pink)]'
                                : 'border-[var(--color-soft-border)] bg-[#FFF1EE] text-foreground hover:border-[var(--color-pink)]'
                            }`}
                          >
                            <Clock width={14} height={14} />
                            {formatTime(s.start)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {step === 'confirm' && (
                <div className="flex flex-col gap-4">
                  <Card className="border border-[var(--color-soft-border)] bg-[#FFF1EE] shadow-[var(--shadow-card)]">
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
                        <Tag width={14} height={14} className="shrink-0 text-[var(--color-pink)]" />
                        O pagamento é feito apenas no dia, presencialmente no salão.
                      </p>
                    </Card.Content>
                  </Card>

                  {/* Logged-in customer with no phone on file (e.g. Google sign-up):
                      collect a WhatsApp so the confirmation/reminders can reach them. */}
                  {needsPhone && (
                    <Card className="border border-[var(--color-soft-border)] bg-[#FFF1EE] shadow-[var(--shadow-card)]">
                      <Card.Content className="flex flex-col gap-3 p-4">
                        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <WhatsAppGlyph size={16} />
                          Seu WhatsApp
                        </h3>
                        <p className="text-xs text-muted">
                          Para enviarmos a confirmação e os lembretes do seu horário.
                        </p>
                        <TextField value={accountPhone} onChange={setAccountPhone} type="tel" isRequired>
                          <Label>Telefone (WhatsApp)</Label>
                          <Input placeholder="(00) 00000-0000" />
                        </TextField>
                      </Card.Content>
                    </Card>
                  )}

                  {!isLoggedIn && (
                    <>
                      <Card className="border border-[var(--color-soft-border)] bg-[#FFF1EE] shadow-[var(--shadow-card)]">
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
                            <span className="font-semibold text-[var(--color-pink)]">Entrar</span>
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

                      <Card className="border border-[var(--color-soft-border)] bg-[#FFF1EE] shadow-[var(--shadow-card)]">
                        <Card.Content className="flex flex-col gap-3 p-4">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <Person width={16} height={16} className="text-[var(--color-pink)]" />
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

      {/* Floating advance / confirm CTA — sits above the BottomNav on mobile.
          "Continuar" hugs its label and aligns right; the final "Confirmar
          agendamento" spans full width as the primary action. */}
      {!done && (
        <div className="club-action-dock pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3 pt-7 md:bottom-0 md:bg-transparent md:pb-4 md:pt-0">
          <div
            className="pointer-events-auto mx-auto flex max-w-2xl"
          >
            <button
              type="button"
              onClick={advance}
              disabled={ctaDisabled || book.isPending}
              className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold transition-all sm:ml-auto sm:w-auto sm:min-w-52 ${
                ctaDisabled || book.isPending
                  ? 'cursor-not-allowed bg-[#f0c2ce] text-white/80'
                  : 'bg-[var(--color-pink)] text-white shadow-[var(--shadow-pink)] hover:bg-[#e7799a] active:scale-[0.99]'
              }`}
            >
              {book.isPending ? <Spinner size="sm" /> : null}
              {ctaLabel}
            </button>
          </div>
        </div>
      )}

      <BottomNav
        isLoggedIn={isLoggedIn}
        onLogin={goToLogin}
        onAccount={goToAccount}
        onHome={goHome}
        onFavorites={showFavorites}
      />
    </div>
  );
}

function StepProgress({ current }: { current: number }) {
  return (
    <div aria-label={`Passo ${current + 1} de ${STEPS.length}`} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-pink)]">
          Passo {current + 1} de {STEPS.length}
        </span>
        <span className="text-xs font-medium text-muted">{STEPS[current]?.label}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
        {STEPS.map((item, index) => (
          <span
            key={item.id}
            className={`h-1.5 rounded-full transition-colors ${
              index <= current ? 'bg-[var(--color-pink)]' : 'bg-[#eadde0]'
            }`}
          />
        ))}
      </div>
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
      <div className="mx-auto flex w-full max-w-2xl items-start gap-3 px-4 py-5 sm:gap-3.5 sm:px-6">
        <Skeleton className="h-14 w-14 shrink-0 rounded-2xl sm:h-16 sm:w-16" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 pt-1">
          <Skeleton className="h-6 w-2/5 rounded-md" />
          <Skeleton className="h-4 w-3/5 rounded-md" />
          <Skeleton className="h-9 w-44 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl items-start gap-3 px-4 py-5 sm:gap-3.5 sm:px-6">
      {portal?.logoUrl ? (
        <img
          src={portal.logoUrl}
          alt={name}
          className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-soft-border)] sm:h-16 sm:w-16"
        />
      ) : (
        <span
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-brand text-xl text-[#a67c1e] shadow-[var(--shadow-soft)] ring-1 ring-[var(--color-soft-border)] sm:h-16 sm:w-16 sm:text-2xl"
          style={{ backgroundImage: 'linear-gradient(160deg, #fbf3e3 0%, #f1ddc2 100%)' }}
          aria-hidden
        >
          {initial}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="break-words font-brand text-lg leading-tight text-foreground sm:text-xl">
              {name}
            </h1>
            {plan && (
              <span className="shrink-0 rounded-full bg-[#FCE4EA] px-2.5 py-0.5 text-xs font-semibold text-[#d76b88]">
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
            className="club-touch grid shrink-0 place-items-center text-[var(--color-pink)] transition-opacity hover:opacity-70"
          >
            <span className="hidden whitespace-nowrap pt-1 text-sm font-semibold sm:inline">
              Ver disponibilidade
            </span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#FCE4EA] sm:hidden">
              <Calendar width={18} height={18} />
            </span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
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
            className="mt-1 inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
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
      className={`flex min-h-14 items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-all ${
        selected
          ? 'border-[var(--color-pink)] bg-[#FCE4EA] shadow-[var(--shadow-pink)]'
          : 'border-[var(--color-soft-border)] bg-[#FFF1EE] hover:border-[var(--color-pink)]'
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted">{subtitle}</span>}
      </span>
      <span
        className={`ml-3 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
          selected ? 'border-[var(--color-pink)] bg-[var(--color-pink)] text-white' : 'border-default-300'
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
    ? { label: 'Mais pedido', icon: <Star width={12} height={12} />, cls: 'bg-[#FCE4EA] text-[#d76b88]' }
    : service.isNew
      ? { label: 'Novidade', icon: <Sparkles width={12} height={12} />, cls: 'bg-[#FCE4EA] text-[#d76b88]' }
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
      className={`club-no-touch-lift relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white text-left transition-all sm:flex-row ${
        selected
          ? 'border-[var(--color-pink)] shadow-[var(--shadow-soft)]'
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
        className="absolute right-2.5 top-2.5 z-10 grid h-11 w-11 place-items-center rounded-full bg-white/90 text-[var(--color-pink)] shadow-[var(--shadow-soft)] backdrop-blur-sm transition-transform hover:scale-105 active:scale-95"
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

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4 sm:p-4">
        {badge && (
          <span
            className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
          >
            {badge.icon}
            {badge.label}
          </span>
        )}

        <h3 className="font-brand text-base leading-tight text-foreground">{service.name}</h3>

        {service.description && (
          <p className="line-clamp-2 text-sm text-muted">{service.description}</p>
        )}

        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Clock width={14} height={14} />
            {durationLabel(service.durationMin)}
          </span>
          {service.categoryName && (
            <span className="flex items-center gap-1">
              <Tag width={14} height={14} />
              {service.categoryName}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <Price value={service.price} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
              selected
                ? 'bg-[var(--color-pink)] text-white shadow-[var(--shadow-pink)]'
                : 'border border-[var(--color-pink)] text-[var(--color-pink)] hover:bg-[#FCE4EA]'
            }`}
          >
            {selected && <CircleCheck width={15} height={15} />}
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
        className="relative aspect-[16/7] w-full shrink-0 self-stretch sm:aspect-auto sm:w-40"
        style={{
          backgroundImage:
            'radial-gradient(120px 120px at 30% 20%, rgba(240,140,165,0.22), transparent 70%), linear-gradient(160deg, #fbe2e8 0%, #f4cdd6 100%)',
        }}
        aria-hidden
      >
        <span className="absolute inset-0 grid place-items-center text-[#d79bab]">
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
    <div className="relative aspect-[16/7] w-full shrink-0 self-stretch sm:aspect-auto sm:w-40">
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
        className="absolute left-2 top-2 inline-flex min-h-10 items-center gap-1 rounded-full bg-black/60 px-3 py-2 text-[11px] font-semibold text-white backdrop-blur-sm transition-opacity hover:opacity-90"
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
          ? 'border-transparent bg-[var(--color-pink)] text-white shadow-[var(--shadow-pink)]'
          : 'border-[var(--color-soft-border)] bg-white text-foreground hover:border-[var(--color-pink)]'
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
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FCE4EA] text-[var(--color-pink)]">
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
