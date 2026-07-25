import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Label, Skeleton, TextField } from '@heroui/react';
import {
  ArrowLeft,
  ArrowRightFromSquare,
  Bell,
  Calendar,
  Person,
  Star,
  StarFill,
} from '@gravity-ui/icons';
import { signOut, useCustomerSession } from '../lib/auth';
import { AppointmentListSkeleton } from '../components/Skeletons';
import { SalonBrand } from '../components/SalonBrand';
import {
  useBookingAccent,
  useCancelAppointment,
  useMyAppointments,
  useMyProfile,
  useReviewAppointment,
  useUpdateProfile,
  type MyAppointment,
} from '../lib/booking';
import { formatDay, formatTime, statusLabel } from '../lib/format';

type PermState = 'unsupported' | 'default' | 'granted' | 'denied';

function readPermission(): PermState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermState;
}

/**
 * The logged-in customer's account page (replaces the old modal): enable web
 * notifications, see and cancel their appointments, and sign out. Navigates via
 * the SPA router so there's no full page reload. If the visitor isn't logged in
 * we bounce them to the login page.
 */
export function AccountPage({ slug, backTo }: { slug: string; backTo: string }) {
  const navigate = useNavigate();
  useBookingAccent(slug);
  const { data: session, isPending } = useCustomerSession();
  const isLoggedIn = !!session;

  const appointments = useMyAppointments(slug, isLoggedIn);
  const cancel = useCancelAppointment(slug);
  const review = useReviewAppointment(slug);
  const [perm, setPerm] = useState<PermState>(readPermission());

  useEffect(() => {
    setPerm(readPermission());
  }, []);

  // Not logged in → redirect to the login page (preserving the same return path).
  useEffect(() => {
    if (!isPending && !isLoggedIn) {
      const loginPath = backTo === '/' ? '/login' : `${backTo}/login`;
      navigate(loginPath, { replace: true });
    }
  }, [isPending, isLoggedIn, navigate, backTo]);

  async function enableNotifications() {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPerm(result as PermState);
  }

  const items = appointments.data?.data ?? [];

  // While the session resolves (or just before the logged-out redirect fires)
  // show a skeleton of the account layout instead of a giant centered spinner.
  if (isPending || !isLoggedIn) {
    return (
      <div className="club-page flex flex-col">
        <header className="club-topbar sticky top-0 z-40 shadow-sm">
          <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-2 px-4 py-2.5 md:py-3">
            <span className="h-11 w-11 rounded-full bg-white/10" />
            <SalonBrand slug={slug} />
          </div>
        </header>
        <main className="club-page-main mx-auto w-full max-w-xl flex-1 py-6 sm:py-8">
          <Skeleton className="h-7 w-40 rounded-md" />
          <Skeleton className="mt-2 h-4 w-28 rounded-md" />
          <div className="mt-6 flex flex-col gap-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-4 w-36 rounded-md" />
            <AppointmentListSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="club-page flex flex-col">
      <header className="club-topbar sticky top-0 z-40 shadow-sm">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-2 px-4 py-2.5 sm:gap-3 md:py-3">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            aria-label="Voltar"
            className="club-touch grid place-items-center rounded-full text-white transition-colors hover:bg-white/15"
          >
            <ArrowLeft width={22} height={22} />
          </button>
          <SalonBrand slug={slug} />
        </div>
      </header>

      <main className="club-page-main mx-auto w-full max-w-xl flex-1 py-6 sm:py-8">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-brand text-2xl text-foreground">Minha conta</h1>
          {session?.user?.name && (
            <p className="text-sm text-muted">Olá, {session.user.name} 👋</p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {/* Editable profile: name + WhatsApp */}
          <ProfileEditor slug={slug} enabled={isLoggedIn} />

          {/* Web notifications toggle */}
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 rounded-2xl border border-default-200 bg-white px-4 py-3 shadow-[var(--shadow-card)]">
            <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <span className="text-[#a67c1e]">
                <Bell width={18} height={18} />
              </span>
              <span className="text-foreground">
                {perm === 'granted'
                  ? 'Notificações ativadas'
                  : perm === 'denied'
                    ? 'Notificações bloqueadas no navegador'
                    : 'Ativar notificações'}
              </span>
            </span>
            {perm === 'default' && (
              <Button size="sm" variant="primary" onPress={enableNotifications} className="min-h-11">
                Ativar
              </Button>
            )}
            {perm === 'granted' && (
              <span className="text-xs font-semibold text-success">Ativo</span>
            )}
          </div>

          {/* Appointments */}
          <div className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="text-[#a67c1e]">
                <Calendar width={16} height={16} />
              </span>
              Meus agendamentos
            </h2>
            {appointments.isLoading ? (
              <AppointmentListSkeleton />
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Você ainda não tem agendamentos.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((a) => (
                  <AppointmentRow
                    key={a.id}
                    appt={a}
                    onCancel={() => cancel.mutate(a.id)}
                    canceling={cancel.isPending && cancel.variables === a.id}
                    onReview={(rating, comment) =>
                      review.mutateAsync({ id: a.id, rating, comment })
                    }
                    reviewing={review.isPending && review.variables?.id === a.id}
                  />
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate(backTo);
            }}
            className="mt-2 flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-default-200 bg-white px-4 py-3 text-sm text-muted transition-colors hover:border-danger hover:text-danger"
          >
            <ArrowRightFromSquare width={16} height={16} />
            Sair da conta
          </button>
        </div>
      </main>
    </div>
  );
}

/**
 * Lets the logged-in customer edit their own name and WhatsApp number. The
 * number is also captured on the first booking, but this gives a place to fix a
 * typo or add it later. Saves via PATCH /my-profile (updates the auth User +
 * this salon's Customer record) — no data is ever deleted.
 */
function ProfileEditor({ slug, enabled }: { slug: string; enabled: boolean }) {
  const profile = useMyProfile(slug, enabled);
  const update = useUpdateProfile(slug);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);

  // Hydrate the fields once the profile loads (and whenever it changes server-side).
  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name ?? '');
      setPhone(profile.data.phone ?? '');
    }
  }, [profile.data]);

  const original = profile.data;
  const dirty =
    !!original &&
    (name.trim() !== (original.name ?? '') || phone.trim() !== (original.phone ?? ''));
  const canSave = dirty && name.trim().length >= 2 && !update.isPending;

  async function save() {
    if (!canSave) return;
    setSaved(false);
    await update.mutateAsync({ name: name.trim(), phone: phone.trim() });
    setSaved(true);
  }

  if (profile.isLoading) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-default-200 bg-white px-4 py-5 shadow-[var(--shadow-card)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-[#a67c1e]">
          <Person width={16} height={16} />
        </span>
        Meus dados
      </h2>

      {/* Email is the account identity (e.g. from a Google sign-in) — shown for
          reference but not editable here. */}
      {original?.email && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">E-mail</span>
          <div className="truncate rounded-lg bg-default-100 px-3 py-2 text-sm text-foreground">
            {original.email}
          </div>
        </div>
      )}

      <TextField
        value={name}
        onChange={(v) => {
          setName(v);
          setSaved(false);
        }}
        isRequired
      >
        <Label>Nome</Label>
        <Input placeholder="Seu nome" />
      </TextField>

      <TextField
        value={phone}
        onChange={(v) => {
          setPhone(v);
          setSaved(false);
        }}
        type="tel"
      >
        <Label>WhatsApp</Label>
        <Input placeholder="(00) 00000-0000" />
      </TextField>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-success" aria-live="polite">
          {saved && !dirty ? 'Dados salvos ✓' : ''}
        </span>
        <Button
          size="sm"
          variant="primary"
          isPending={update.isPending}
          isDisabled={!canSave}
          onPress={save}
          className="min-h-11 min-w-24"
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}

function AppointmentRow({
  appt,
  onCancel,
  canceling,
  onReview,
  reviewing,
}: {
  appt: MyAppointment;
  onCancel: () => void;
  canceling: boolean;
  onReview: (rating: number, comment?: string) => Promise<unknown>;
  reviewing: boolean;
}) {
  const canceled = appt.status === 'canceled';
  const [reviewOpen, setReviewOpen] = useState(false);
  return (
    <li
      className={`rounded-2xl border px-4 py-4 shadow-[var(--shadow-card)] ${
        canceled ? 'border-default-200 bg-default-50 opacity-70' : 'border-default-200 bg-white'
      }`}
    >
      <div className="flex flex-col items-stretch gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-foreground">
            {appt.serviceNames.join(', ') || 'Atendimento'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {appt.professionalName ? `${appt.professionalName} · ` : ''}
            {formatDay(appt.start)} às {formatTime(appt.start)}
          </p>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
              canceled
                ? 'bg-danger/10 text-danger'
                : 'bg-[#f2b33d]/15 text-[#a67c1e]'
            }`}
          >
            {statusLabel(appt.status)}
          </span>
        </div>
        {appt.canCancel ? (
          <Button
            size="sm"
            variant="ghost"
            isPending={canceling}
            onPress={onCancel}
            className="min-h-11 shrink-0 text-danger max-[419px]:w-full"
          >
            Cancelar
          </Button>
        ) : appt.canReview && !reviewOpen ? (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setReviewOpen(true)}
            className="min-h-11 shrink-0 text-[#a67c1e] max-[419px]:w-full"
          >
            Avaliar
          </Button>
        ) : null}
      </div>

      {/* Already rated → show the stars the customer gave. */}
      {appt.reviewed && appt.rating != null && (
        <div className="mt-2 flex items-center gap-1">
          <StarRow value={appt.rating} />
          <span className="text-xs text-muted">Sua avaliação</span>
        </div>
      )}

      {/* Inline review form for a finished, not-yet-rated appointment. */}
      {appt.canReview && reviewOpen && (
        <ReviewForm
          submitting={reviewing}
          onCancel={() => setReviewOpen(false)}
          onSubmit={async (rating, comment) => {
            await onReview(rating, comment);
            setReviewOpen(false);
          }}
        />
      )}
    </li>
  );
}

// Read-only row of 5 stars with `value` of them filled.
function StarRow({ value }: { value: number }) {
  return (
    <span className="flex items-center text-[#f2b33d]">
      {[1, 2, 3, 4, 5].map((n) =>
        n <= value ? (
          <StarFill key={n} width={15} height={15} />
        ) : (
          <Star key={n} width={15} height={15} />
        ),
      )}
    </span>
  );
}

// Interactive star picker + optional comment for leaving a review.
function ReviewForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const active = hover || rating;

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl bg-default-50 p-3">
      <p className="text-xs font-medium text-foreground">Como foi seu atendimento?</p>
      <div className="flex items-center justify-between gap-1 sm:justify-start">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="grid h-11 w-11 place-items-center rounded-full text-[#f2b33d] transition-transform hover:scale-110"
          >
            {n <= active ? (
              <StarFill width={26} height={26} />
            ) : (
              <Star width={26} height={26} />
            )}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Conte como foi (opcional)"
        className="w-full resize-none rounded-xl border border-default-200 bg-white px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#f2b33d]"
      />
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
        <Button size="sm" variant="ghost" onPress={onCancel} className="min-h-11 text-muted">
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="primary"
          isPending={submitting}
          isDisabled={rating < 1 || submitting}
          onPress={() => onSubmit(rating, comment.trim() || undefined)}
          className="min-h-11"
        >
          Enviar avaliação
        </Button>
      </div>
    </div>
  );
}
